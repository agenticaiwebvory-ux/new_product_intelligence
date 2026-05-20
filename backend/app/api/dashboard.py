from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..services.dashboard_service import DashboardService
from ..core.redis_client import get_cache, set_cache
from ..services.store_service import StoreService
import logging

logger = logging.getLogger("product-intelligence.api")
router = APIRouter()
import anyio

@router.get("/stats")
async def get_dashboard_stats(
    vendor: str = None,
    store: str = None,
    search: str = None,
    tags: str = None,
    date_from: str = None,
    date_to: str = None,
    db: Session = Depends(get_db), 
    response: Response = None
):
    cache_key = f"dashboard:stats:v3:{vendor}:{store}:{search}:{tags}:{date_from}:{date_to}"
    try:
        # 1. Try Cache
        cached = await get_cache(cache_key)
        if cached:
            if response: response.headers["X-Cache"] = "HIT"
            return cached

        # 2. Cache Miss
        service = DashboardService(db)
        
        # Run heavy queries in a thread pool
        stats_data = await anyio.to_thread.run_sync(lambda: service.get_aggregated_stats(vendor=vendor, store=store, search=search, tags=tags, date_from=date_from, date_to=date_to))
        designers_data = await anyio.to_thread.run_sync(lambda: service.get_designers_with_counts(store=store, tags=tags))
        
        result = {
            "stats": stats_data,
            "designers": designers_data
        }

        # 3. Store in Cache (1 Hour)
        await set_cache(cache_key, result, ttl=3600)
        
        if response: response.headers["X-Cache"] = "MISS"
        return result
    except Exception as e:
        # Redis unavailable — log and fall back to direct DB query
        logger.warning(f"Cache miss (Redis error) for {cache_key}: {e}")
        service = DashboardService(db)
        stats_data = await anyio.to_thread.run_sync(lambda: service.get_aggregated_stats(vendor=vendor, store=store, search=search, tags=tags, date_from=date_from, date_to=date_to))
        designers_data = await anyio.to_thread.run_sync(lambda: service.get_designers_with_counts(store=store, tags=tags))
        return {
            "stats": stats_data,
            "designers": designers_data
        }


@router.post("/sync-designers")
async def sync_designers(db: Session = Depends(get_db)):
    # Since we use direct vendor names now, we can simply return success
    # as the categorization is automatic from the products table.
    return {"status": "success", "message": "Designers are automatically synced from catalog vendors."}


# store connection test
@router.get("/check-connections")
async def check_connections():
    return await StoreService().check_connections()


@router.get("/analytics")
async def get_dashboard_analytics(
    vendor: str = None,
    store: str = None,
    search: str = None,
    tags: str = None,
    date_from: str = None,
    date_to: str = None,
    db: Session = Depends(get_db),
):
    service = DashboardService(db)
    data = await anyio.to_thread.run_sync(
        lambda: service.get_analytics(
            vendor=vendor, store=store, search=search,
            tags=tags, date_from=date_from, date_to=date_to
        )
    )
    return data


@router.get("/sales-trend")
async def get_sales_trend(days: int = 90):
    from ..config import STORE_CONFIGS
    from datetime import datetime, timedelta
    import httpx, re

    since = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    stores_data = {}

    for store_key in ["tdo", "wdo", "kos", "im"]:
        config = STORE_CONFIGS.get(store_key)
        if not config:
            continue

        url = f"https://{config['shop_domain']}/admin/api/{config['api_version']}/orders.json"
        headers = {"X-Shopify-Access-Token": config["access_token"], "Content-Type": "application/json"}

        daily_sales = {}
        daily_orders = {}
        daily_nets = {}
        daily_returns = {}
        total_items = 0

        try:
            params = {"created_at_min": since, "status": "any", "limit": 250}
            async with httpx.AsyncClient(timeout=30.0) as c:
                for page in range(5):
                    resp = await c.get(url, params=params, headers=headers)
                    if resp.status_code != 200:
                        break
                    data = resp.json()
                    orders = data.get("orders", [])
                    if not orders:
                        break

                    for order in orders:
                        created = order.get("created_at", "")[:10]
                        total_str = order.get("total_price", "0")
                        subtotal_str = order.get("subtotal_price", "0")
                        try:
                            total_val = float(total_str)
                        except:
                            total_val = 0
                        try:
                            subtotal_val = float(subtotal_str)
                        except:
                            subtotal_val = 0

                        daily_sales[created] = daily_sales.get(created, 0) + total_val
                        daily_nets[created] = daily_nets.get(created, 0) + subtotal_val
                        daily_orders[created] = daily_orders.get(created, 0) + 1
                        total_items += len(order.get("line_items", []))

                        for refund in order.get("refunds", []):
                            refund_total = 0
                            for ri in refund.get("refund_line_items", []):
                                refund_total += ri.get("quantity", 0)
                            if refund_total > 0:
                                daily_returns[created] = daily_returns.get(created, 0) + refund_total

                    link = resp.headers.get("Link", "")
                    if 'rel="next"' not in link:
                        break
                    m = re.search(r'page_info=([^&>]+)', link)
                    if not m:
                        break
                    params = {"page_info": m.group(1), "limit": 250}

        except Exception as e:
            logger.warning(f"Sales trend Shopify [{store_key}] error: {e}")
            continue

        all_dates = sorted(set(list(daily_sales.keys()) + list(daily_returns.keys())))
        series = [
            {
                "period": d,
                "sales": round(daily_sales.get(d, 0), 2),
                "net_sales": round(daily_nets.get(d, 0), 2),
                "returns": daily_returns.get(d, 0),
                "orders": daily_orders.get(d, 0),
            }
            for d in all_dates
        ]

        total_sales = sum(s["sales"] for s in series)
        total_orders = sum(s["orders"] for s in series)
        total_returns = sum(s["returns"] for s in series)

        stores_data[store_key] = {
            "series": series,
            "summary": {
                "total_sales": round(total_sales, 2),
                "total_orders": total_orders,
                "total_returns": total_returns,
                "avg_order_value": round(total_sales / total_orders, 2) if total_orders else 0,
                "line_items": total_items,
            }
        }

    return {
        "days": days,
        "since": since,
        "stores": stores_data,
    }
