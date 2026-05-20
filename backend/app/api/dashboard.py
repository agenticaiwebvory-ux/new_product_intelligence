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
