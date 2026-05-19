from fastapi import APIRouter, Depends, HTTPException, Response, Request
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
import logging

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

@router.get("/")
async def get_products(
    vendor: Optional[str] = None, 
    page: int = 1,
    limit: int = 50,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    response: Response = None
):
    cache_key = f"audit:list:v2:{vendor}:{page}:{limit}:{search}:{date_from}:{date_to}"
    try:
        # 1. Try Cache
        cached = await get_cache(cache_key)
        if cached:
            if response: response.headers["X-Cache"] = "HIT"
            return cached

        # 2. Cache Miss: Offload sync DB work to thread pool
        from ..services.dashboard_service import DashboardService
        service = DashboardService(db)
        
        result = await anyio.to_thread.run_sync(
            lambda: service.get_unified_products(vendor=vendor, page=page, limit=limit, search=search, date_from=date_from, date_to=date_to)
        )
        
        await set_cache(cache_key, result, ttl=3600)
        
        if response: response.headers["X-Cache"] = "MISS"
        return result
    except Exception as e:
        # Redis unavailable — log and fall back to direct DB query
        logger.warning(f"Cache miss (Redis error) for {cache_key}: {e}")
        from ..services.dashboard_service import DashboardService
        service = DashboardService(db)
        return await anyio.to_thread.run_sync(
            lambda: service.get_unified_products(vendor=vendor, page=page, limit=limit, search=search, date_from=date_from, date_to=date_to)
        )

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
    if not await acquire_lock(lock_name):
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

        # 4. Invalidate List Cache & Analytics Cache (Always do this)
        try:
            await clear_cache_pattern("audit:list:*")
            await clear_cache_pattern(f"audit:analytics:{update.sku}:*")
            await delete_cache("dashboard:stats")
            logger.info(f"Invalidated cache for SKU {update.sku} and dashboard stats")
        except Exception:
            pass

        if not product:
            raise HTTPException(status_code=404, detail=f"Style {update.sku} not found")
        
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

        return results
    finally:
        await release_lock(lock_name)

@router.post("/revert/{sku}")
async def revert_sync(sku: str, type: str = "all", db: Session = Depends(get_db)):
    prod_tool = ProductTool(db)
    return await prod_tool.revert_to_backup(sku=sku, revert_type=type)

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
