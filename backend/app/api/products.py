from fastapi import APIRouter, Depends, HTTPException, Response, Request, Query
from sqlalchemy.orm import Session, joinedload, selectinload
from typing import List, Optional, Any
from pydantic import BaseModel
from ..core.database import get_db
from ..models import catalog as models
from ..schemas import product as schemas
from ..tools.product_tool import ProductTool
from ..tools.inventory_tool import InventoryTool
from ..core.redis_client import acquire_lock, release_lock, clear_cache_pattern, get_cache, set_cache, delete_cache
from ..core.limiter import rate_limit
from ..services.changelog_service import ChangeLogService
import json
import logging
from datetime import datetime

logger = logging.getLogger("product-intelligence.api")
router = APIRouter()

class PushUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    retail_price: Optional[float] = None
    wholesale_price: Optional[float] = None
    designer: Optional[str] = None
    color: Optional[str] = None
    sizes: Optional[dict] = None
    stores: Optional[List[str]] = ["TDO"]

import anyio
import httpx

@router.get("/")
async def get_products(
    vendor: Optional[str] = None, 
    page: int = 1,
    limit: int = 50,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    store: Optional[str] = None,
    status: Optional[str] = None,
    tag: Optional[str] = None,
    db: Session = Depends(get_db),
    response: Response = None
):
    cache_key = f"audit:list:v2:{vendor}:{page}:{limit}:{search}:{date_from}:{date_to}:{store}:{status}:{tag}"
    try:
        cached = await get_cache(cache_key)
        if cached:
            if response: response.headers["X-Cache"] = "HIT"
            return cached

        from ..services.dashboard_service import DashboardService
        service = DashboardService(db)
        
        result = await anyio.to_thread.run_sync(
            lambda: service.get_unified_products(vendor=vendor, page=page, limit=limit, search=search, date_from=date_from, date_to=date_to, store=store, status=status, tag=tag)
        )
        
        await set_cache(cache_key, result, ttl=3600)
        
        if response: response.headers["X-Cache"] = "MISS"
        return result
    except Exception as e:
        logger.warning(f"Cache miss (Redis error) for {cache_key}: {e}")
        from ..services.dashboard_service import DashboardService
        service = DashboardService(db)
        return await anyio.to_thread.run_sync(
            lambda: service.get_unified_products(vendor=vendor, page=page, limit=limit, search=search, date_from=date_from, date_to=date_to, store=store, status=status, tag=tag)
        )

@router.get("/changes")
async def get_product_changes(
    page: int = 1,
    limit: int = 50,
    search: Optional[str] = None,
    sort_by: Optional[str] = "newest",
    db: Session = Depends(get_db),
    response: Response = None
):
    """Returns products where backup data exists (pending/previous changes)."""
    from ..services.dashboard_service import DashboardService
    service = DashboardService(db)
    
    result = await anyio.to_thread.run_sync(
        lambda: service.get_changed_products(page=page, limit=limit, search=search, sort_by=sort_by)
    )
    return result

@router.get("/changes/audit")
async def get_audit_logs(
    page: int = 1,
    limit: int = 20,
    style: str = Query(None),
    change_type: str = Query(None),
    store: str = Query(None),
    db: Session = Depends(get_db),
):
    service = ChangeLogService(db)
    return service.get_logs(page=page, limit=limit, style=style, change_type=change_type, store=store)


@router.get("/changes/filters")
async def get_change_log_filters(db: Session = Depends(get_db)):
    service = ChangeLogService(db)
    return service.get_filters()


@router.get("/changes/unified")
async def get_unified_changes(
    page: int = 1,
    limit: int = 50,
    search: str = Query(None),
    sort_by: str = Query("newest"),
    change_type: str = Query(None),
    store: str = Query(None),
    db: Session = Depends(get_db),
):
    from ..services.dashboard_service import DashboardService

    log_service = ChangeLogService(db)
    dash_service = DashboardService(db)

    audit_result = log_service.get_logs(
        page=1, limit=9999,
        style=search,
        change_type=change_type,
        store=store,
    )
    audit_entries = [
        {
            "id": f"audit_{e['id']}",
            "source": "changelog",
            "style": e["style"],
            "store": e["store"],
            "changed_by": e["changed_by"],
            "change_type": e["change_type"],
            "old_value": e["old_value"],
            "new_value": e["new_value"],
            "timestamp": e["created_at"],
        }
        for e in audit_result.get("logs", [])
    ]

    backup_result = await anyio.to_thread.run_sync(
        lambda: dash_service.get_changed_products(page=1, limit=9999, search=search, sort_by="newest")
    )
    backup_entries = []
    for item in backup_result.get("items", []):
        fields = item.get("changes", {})
        change_types = set()
        if "retail_price" in fields or "wholesale_price" in fields:
            change_types.add("PRICE_UPDATE")
        if "sizes" in fields or "total_inventory" in fields:
            change_types.add("STOCK_UPDATE")
        if "title" in fields:
            change_types.add("CONTENT_UPDATE")
        backup_entries.append({
            "id": f"backup_{item.get('source_table', '')}_{item['style']}",
            "source": "backup",
            "style": item["style"],
            "vendor": item.get("vendor", ""),
            "store": "ALL",
            "changed_by": "System (Backup)",
            "change_type": " | ".join(sorted(change_types)) if change_types else "BACKUP",
            "old_value": json.dumps({k: v["before"] for k, v in fields.items()}),
            "new_value": json.dumps({k: v["after"] for k, v in fields.items()}),
            "fields": fields,
            "timestamp": item.get("changes_made_at") or "2024-01-01T00:00:00",
        })

    merged = audit_entries + backup_entries
    merged.sort(key=lambda x: x["timestamp"] or "", reverse=(sort_by != "oldest"))

    total = len(merged)
    start = (page - 1) * limit
    end = start + limit
    paged = merged[start:end]

    return {
        "success": True,
        "items": paged,
        "total_count": total,
        "total_pages": max(1, (total + limit - 1) // limit),
        "page": page,
    }


class SKUUpdate(BaseModel):
    sku: str
    title: Optional[Any] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    description: Optional[Any] = None
    retail_price: Optional[float] = None
    wholesale_price: Optional[float] = None
    sizes: Optional[dict] = None
    stores: Optional[list] = ["TDO"]
    notes: Optional[str] = None
    local_only: bool = False
    skip_content: bool = False

@router.post("/push-update")
async def push_update_by_sku(
    update: SKUUpdate, 
    request: Request,
    db: Session = Depends(get_db),
    _ = Depends(rate_limit)
):
    lock_name = f"sync:{update.sku}"
    try:
        lock_acquired = await acquire_lock(lock_name)
    except Exception:
        lock_acquired = True
    if not lock_acquired:
        raise HTTPException(status_code=423, detail=f"Style {update.sku} is currently being synced by another user. Please wait.")

    try:
        base_sku = update.sku.split('~')[0].split('-')[0].strip()
        product = db.query(models.InStockDashboard).filter(models.InStockDashboard.style == update.sku).first()
        if not product:
            product = db.query(models.InStockDashboard).filter(models.InStockDashboard.style == base_sku).first()
        if not product:
            product = db.query(models.InStockDashboard).filter(models.InStockDashboard.style.like(f"{base_sku}%")).first()
            
        if not product:
            product = db.query(models.TheDressOutlet).filter(models.TheDressOutlet.style == update.sku).first()
            if not product:
                product = db.query(models.TheDressOutlet).filter(models.TheDressOutlet.style == base_sku).first()
            if not product:
                product = db.query(models.TheDressOutlet).filter(models.TheDressOutlet.style.like(f"{base_sku}%")).first()

        if not product:
            raise HTTPException(status_code=404, detail=f"Style {update.sku} not found")

        old_retail = getattr(product, 'retail_price', None)
        old_wholesale = getattr(product, 'wholesale_price', None)

        prod_tool = ProductTool(db)
        results = await prod_tool.update_content(
            sku=update.sku,
            title=update.title,
            meta_title=update.meta_title,
            description=update.description,
            meta_description=update.meta_description,
            retail_price=update.retail_price,
            wholesale_price=update.wholesale_price,
            notes=update.notes,
            stores=update.stores or ["TDO", "WDO", "KOS" , "IM"],
            local_only=update.local_only,
            skip_content=update.skip_content
        )

        if update.sizes:
            inv_tool = InventoryTool(db)
            await inv_tool.update_stock(
                sku=update.sku,
                sizes=update.sizes,
                stores=[] if update.local_only else (update.stores or ["TDO"])
            )

        # Invalidate Cache AFTER database updates are committed and complete
        try:
            await clear_cache_pattern("audit:list:*")
            await clear_cache_pattern(f"audit:analytics:{update.sku}:*")
            await delete_cache("dashboard:stats")
            logger.info(f"Invalidated cache for SKU {update.sku} and dashboard stats")
        except Exception:
            pass

        # Log changes to changelog
        try:
            log_service = ChangeLogService(db)
            targets = update.stores or ["TDO", "WDO", "KOS", "IM"]
            for store_key in targets:
                if update.retail_price is not None or update.wholesale_price is not None:
                    log_service.log_change(
                        change_type="PRICE_UPDATE",
                        style=update.sku,
                        store=store_key,
                        old_value=json.dumps({"retail_price": old_retail, "wholesale_price": old_wholesale}),
                        new_value=json.dumps({"retail_price": update.retail_price, "wholesale_price": update.wholesale_price}),
                    )
        except Exception as e:
            logger.warning(f"Failed to log change for {update.sku}: {e}")

        return results
    finally:
        try:
            await release_lock(lock_name)
        except Exception:
            pass

@router.post("/revert/{sku}")
async def revert_sync(sku: str, type: str = "all", store: str = None, db: Session = Depends(get_db)):
    stores = [store.upper()] if store and store.upper() in ["TDO", "WDO", "KOS", "IM"] else ["TDO", "WDO", "KOS", "IM"]
    prod_tool = ProductTool(db)
    res = await prod_tool.revert_to_backup(sku=sku, revert_type=type, stores=stores)
    try:
        await clear_cache_pattern("audit:list:*")
        await clear_cache_pattern(f"audit:analytics:{sku}:*")
        await delete_cache("dashboard:stats")
    except Exception:
        pass
    return res

@router.delete("/changes/{sku}")
async def clear_product_backup(sku: str, db: Session = Depends(get_db)):
    prod_tool = ProductTool(db)
    res = await prod_tool.clear_backup(sku=sku)
    try:
        await clear_cache_pattern("audit:list:*")
        await clear_cache_pattern(f"audit:analytics:{sku}:*")
        await delete_cache("dashboard:stats")
    except Exception:
        pass
    return res

@router.delete("/changes")
async def clear_all_backups(db: Session = Depends(get_db)):
    prod_tool = ProductTool(db)
    res = await prod_tool.clear_all_backups()
    try:
        await clear_cache_pattern("audit:list:*")
        await delete_cache("dashboard:stats")
    except Exception:
        pass
    return res

@router.post("/{sku}/sync/{store_key}")
async def sync_to_store(sku: str, store_key: str, db: Session = Depends(get_db)):
    dashboard_row = db.query(models.InStockDashboard).filter(models.InStockDashboard.style == sku).first()
    if not dashboard_row:
        dashboard_row = db.query(models.TheDressOutlet).filter(models.TheDressOutlet.style == sku).first()
    if not dashboard_row:
        raise HTTPException(status_code=404, detail="Product not found")
    
    prod_tool = ProductTool(db)
    await prod_tool.update_content(
        sku=sku,
        retail_price=dashboard_row.retail_price,
        wholesale_price=dashboard_row.wholesale_price,
        stores=[store_key.upper()]
    )

    current_inventory = db.query(models.Inventory).filter(models.Inventory.style_number == dashboard_row.style).all()
    inventory_map = {i.size: i.inventory for i in current_inventory}
    if inventory_map:
        inv_tool = InventoryTool(db)
        await inv_tool.update_stock(
            sku=sku,
            sizes=inventory_map,
            stores=[store_key.upper()]
        )
    
    try:
        await clear_cache_pattern("audit:list:*")
        await clear_cache_pattern(f"audit:analytics:{sku}:*")
        await delete_cache("dashboard:stats")
    except Exception:
        pass

    return {"status": "success", "message": f"Product {dashboard_row.style} synced to {store_key.upper()}"}

@router.get("/{sku}/analytics")
async def get_sku_analytics(sku: str, timeframe: str = "7", db: Session = Depends(get_db), response: Response = None):
    cache_key = f"audit:analytics:{sku}:{timeframe}"
    try:
        cached = await get_cache(cache_key)
        if cached:
            if response: response.headers["X-Cache"] = "HIT"
            return cached

        from ..services.dashboard_service import DashboardService
        service = DashboardService(db)
        result = service.get_style_analytics(sku, timeframe)
        await set_cache(cache_key, result, ttl=21600)
        
        if response: response.headers["X-Cache"] = "MISS"
        return result
    except Exception:
        from ..services.dashboard_service import DashboardService
        service = DashboardService(db)
        return service.get_style_analytics(sku, timeframe)

@router.get("/{sku}/shopify-analytics")
async def get_sku_shopify_analytics(
    sku: str,
    timeframe: str = "90",
    store: str = "tdo",
    db: Session = Depends(get_db)
):
    """Queries Shopify Orders GraphQL for per-product analytics: sales time series, variant breakdown."""
    from ..config import STORE_CONFIGS
    from ..integrations.shopify.client import ShopifyClient
    import json
    from datetime import datetime, timedelta

    store_key = store.lower()
    config = STORE_CONFIGS.get(store_key)
    if not config:
        raise HTTPException(status_code=400, detail=f"Store '{store}' not configured")

    client = ShopifyClient(config)
    valid, code, msg = await client.validate_connection(log_to_db=False)
    if not valid:
        raise HTTPException(status_code=502, detail=f"Shopify {store_key.upper()} unavailable: {msg}")

    # Also fetch local analytics as fallback
    from ..services.dashboard_service import DashboardService
    dash_service = DashboardService(db)
    local = dash_service.get_style_analytics(sku, timeframe)

    base_sku = sku.split('~')[0].split('-')[0].strip()
    days = int(timeframe)
    since_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")

    # Look up the product's TDO product ID from the database
    from ..models import catalog as db_models
    product_row = db.query(db_models.InStockDashboard).filter(
        db_models.InStockDashboard.style == sku
    ).first()
    if not product_row:
        product_row = db.query(db_models.InStockDashboard).filter(
            db_models.InStockDashboard.style.like(f"{base_sku}%")
        ).first()

    # Use correct product ID column for this store
    product_id_col = f"{store_key}_product_id"
    product_id = getattr(product_row, product_id_col, None) if product_row else None

    if not product_id:
        return {
            "store": store_key,
            "sku": sku,
            "timeframe": timeframe,
            "sales_series": [],
            "variants": [],
            "sales_breakdown": {},
            "totals": {"total_sales": 0, "total_orders": 0, "total_returns": 0, "avg_order_value": 0},
            "local_fallback": local,
        }

    # Use Shopify REST API with product_id filter (fast, server-side filtering)
    rest_url = f"https://{config['shop_domain']}/admin/api/{config['api_version']}/orders.json"
    rest_headers = {"X-Shopify-Access-Token": config["access_token"], "Content-Type": "application/json"}

    orders = []
    try:
        params = {"product_id": product_id, "created_at_min": since_date, "status": "any", "limit": 250}
        async with httpx.AsyncClient(timeout=30.0) as c:
            while True:
                resp = await c.get(rest_url, params=params, headers=rest_headers)
                if resp.status_code != 200:
                    return {
                        "store": store_key, "sku": sku, "timeframe": timeframe,
                        "sales_series": [], "variants": [], "sales_breakdown": {},
                        "totals": {"total_sales": 0, "total_orders": 0, "avg_order_value": 0, "net_sales": 0},
                        "local_fallback": local, "error": f"REST API {resp.status_code}"
                    }
                data = resp.json()
                orders.extend(data.get("orders", []))
                link = resp.headers.get("Link", "")
                if 'rel="next"' not in link:
                    break
                m = __import__("re").search(r'page_info=([^&>]+)', link)
                if not m:
                    break
                params = {"page_info": m.group(1), "limit": 250}
    except Exception as e:
        return {
            "store": store_key, "sku": sku, "timeframe": timeframe,
            "sales_series": [], "variants": [], "sales_breakdown": {},
            "totals": {"total_sales": 0, "total_orders": 0, "avg_order_value": 0, "net_sales": 0},
            "local_fallback": local, "error": str(e)
        }

    # Process line items matching our product ID
    daily_sales = {}
    daily_orders = {}
    daily_returns = {}
    daily_return_orders = {}
    variants = []
    color_size_breakdown = {}
    return_breakdown = {}

    def matches_product(li):
        li_pid = li.get("product_id")
        if product_id and li_pid == product_id:
            return True
        li_sku = (li.get("sku") or "").upper()
        if li_sku.startswith(base_sku.upper()) or base_sku.upper() in li_sku:
            return True
        return False

    for order in orders:
        created = order.get("created_at", "")[:10]
        total_str = order.get("total_price", "0")

        line_items = order.get("line_items", [])
        matched_items = [li for li in line_items if matches_product(li)]

        if not matched_items:
            continue

        try:
            total_val = float(total_str)
        except:
            total_val = 0

        daily_sales[created] = daily_sales.get(created, 0) + total_val
        daily_orders[created] = daily_orders.get(created, 0) + 1

        for li in matched_items:
            li_sku = (li.get("sku") or "")
            qty = li.get("quantity", 1)
            try:
                unit_price = float(li.get("price", 0))
            except:
                unit_price = 0
            variant_revenue = unit_price * qty

            variants.append({
                "sku": li_sku,
                "title": li.get("title", ""),
                "quantity": qty,
                "revenue": round(variant_revenue, 2),
                "order_date": created,
            })

            parts = li_sku.replace(base_sku, "", 1).strip("- ").split("-")
            if len(parts) >= 2:
                color = parts[0].strip()
                size = parts[-1].strip()
                if color not in color_size_breakdown:
                    color_size_breakdown[color] = {}
                color_size_breakdown[color][size] = color_size_breakdown[color].get(size, 0) + qty

        # --- Process refunds (returns) ---
        for refund in order.get("refunds", []):
            for ri in refund.get("refund_line_items", []):
                ri_line_item = ri.get("line_item", {})
                refund_qty = ri.get("quantity", 0)
                if refund_qty > 0 and matches_product(ri_line_item):
                    if created not in daily_returns:
                        daily_returns[created] = 0
                    daily_returns[created] += refund_qty
                    daily_return_orders[created] = daily_return_orders.get(created, 0) + 1

                    # Parse color/size from refunded SKU
                    ref_sku = (ri_line_item.get("sku") or "")
                    ref_parts = ref_sku.replace(base_sku, "", 1).strip("- ").split("-")
                    if len(ref_parts) >= 2:
                        ref_color = ref_parts[0].strip()
                        ref_size = ref_parts[-1].strip()
                        if ref_color not in return_breakdown:
                            return_breakdown[ref_color] = {}
                        return_breakdown[ref_color][ref_size] = return_breakdown[ref_color].get(ref_size, 0) + refund_qty

    # Build sorted time series
    all_dates = sorted(set(list(daily_sales.keys()) + list(daily_orders.keys()) + list(daily_returns.keys())))
    sales_series = [
        {"period": d, "total_sales": daily_sales.get(d, 0), "orders": daily_orders.get(d, 0)}
        for d in all_dates
    ]
    returns_series = [
        {"period": d, "returns": daily_returns.get(d, 0), "return_orders": daily_return_orders.get(d, 0)}
        for d in all_dates if d in daily_returns
    ]

    total_sales = sum(s["total_sales"] for s in sales_series)
    total_orders = sum(s["orders"] for s in sales_series)
    total_returns = sum(r["returns"] for r in returns_series)
    avg_order_value = total_sales / total_orders if total_orders else 0

    return {
        "store": store_key,
        "sku": sku,
        "timeframe": timeframe,
        "sales_series": sales_series,
        "returns_series": returns_series,
        "variants": variants,
        "sales_breakdown": color_size_breakdown,
        "returns_breakdown": return_breakdown,
        "totals": {
            "total_sales": round(total_sales, 2),
            "total_orders": int(total_orders),
            "total_returns": total_returns,
            "avg_order_value": round(avg_order_value, 2),
            "line_items_count": len(variants),
        },
        "local_fallback": local if not sales_series else None,
    }
