import logging
import time

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from ..config import BESTSELLER_TAG_PREFIX, SPECIAL_TAGS, TOP_TAG_PREFIX
from ..core.database import get_merch_db
from ..core.redis_client import clear_cache_pattern, delete_cache, get_cache, set_cache
from ..integrations.shopify.client import ShopifyClient
from ..schemas.merchandising import MerchandisingReportResponse, TagUpdateRequest
from ..services.merchandising_service import MerchandisingService
from ..config import STORE_CONFIGS

logger = logging.getLogger("product-intelligence.merchandising.api")
router = APIRouter()


@router.get("/report", response_model=MerchandisingReportResponse)
async def get_merchandising_report(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    sort_by: str = Query(None),
    vendor: str = Query(None),
    search: str = Query(None),
    time_range: str = Query("90"),
    date_from: str = Query(None),
    date_to: str = Query(None),
    db: Session = Depends(get_merch_db),
    response: Response = None,
):
    cache_key = f"merch:report:{page}:{limit}:{sort_by}:{vendor}:{search}:{time_range}:{date_from}:{date_to}"
    cached = await get_cache(cache_key)
    if cached:
        if response:
            response.headers["X-Cache"] = "HIT"
        return cached

    service = MerchandisingService(db)
    result = service.get_report(page=page, limit=limit, sort_by=sort_by, vendor=vendor, search=search, time_range=time_range, date_from=date_from, date_to=date_to)
    await set_cache(cache_key, result, ttl=21600)
    if response:
        response.headers["X-Cache"] = "MISS"
    return result


@router.get("/stats")
async def get_merchandising_stats(
    vendor: str = Query(None),
    search: str = Query(None),
    time_range: str = Query("90"),
    date_from: str = Query(None),
    date_to: str = Query(None),
    db: Session = Depends(get_merch_db),
    response: Response = None,
):
    cache_key = f"merch:stats:{vendor}:{search}:{time_range}:{date_from}:{date_to}"
    cached = await get_cache(cache_key)
    if cached:
        if response:
            response.headers["X-Cache"] = "HIT"
        return cached

    service = MerchandisingService(db)
    result = service.get_stats(vendor=vendor, search=search, time_range=time_range, date_from=date_from, date_to=date_to)
    await set_cache(cache_key, result, ttl=21600)
    if response:
        response.headers["X-Cache"] = "MISS"
    return result


@router.get("/export")
def export_merchandising_report(
    sort_by: str = Query(None),
    vendor: str = Query(None),
    search: str = Query(None),
    time_range: str = Query("90"),
    date_from: str = Query(None),
    date_to: str = Query(None),
    db: Session = Depends(get_merch_db),
):
    service = MerchandisingService(db)
    filename = f"merchandising_report_{int(time.time())}.csv"
    return Response(
        content=service.get_csv(sort_by=sort_by, vendor=vendor, search=search, time_range=time_range, date_from=date_from, date_to=date_to),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/update-tags")
async def update_product_tags(payload: TagUpdateRequest, db: Session = Depends(get_merch_db)):
    service = MerchandisingService(db)
    product_id = service.find_product_id(payload.style)
    if not product_id:
        raise HTTPException(status_code=404, detail=f"Style or SKU '{payload.style}' not found in merchandising catalog.")

    store_config = STORE_CONFIGS.get("tdo")
    if not store_config:
        raise HTTPException(status_code=502, detail="TDO Shopify credentials are not configured.")

    tag_string = _build_tag_string(payload.tags_categorized)
    try:
        client = ShopifyClient(store_config)
        await client.graphql_query(
            """
            mutation productUpdate($input: ProductInput!) {
              productUpdate(input: $input) {
                product { id tags }
                userErrors { field message }
              }
            }
            """,
            {"input": {"id": f"gid://shopify/Product/{product_id}", "tags": tag_string}},
        )
    except Exception as exc:
        logger.error("Shopify tag update failed for %s: %s", payload.style, exc)
        raise HTTPException(status_code=502, detail=str(exc))

    service.update_local_tags(product_id, tag_string)
    await clear_cache_pattern("merch:report:*")
    await clear_cache_pattern("merch:stats:*")
    await delete_cache("dashboard:stats")
    return {"status": "success", "style": payload.style, "tags": tag_string}


def _build_tag_string(tags_categorized: dict) -> str:
    tags = []
    for tag in tags_categorized.get("top", []):
        tags.append(tag if str(tag).lower().startswith(TOP_TAG_PREFIX) else f"{TOP_TAG_PREFIX}{tag}")
    for tag in tags_categorized.get("bestseller", []):
        tags.append(tag if str(tag).lower().startswith(BESTSELLER_TAG_PREFIX) else f"{BESTSELLER_TAG_PREFIX}{tag}")
    for tag in tags_categorized.get("special", []):
        if tag in SPECIAL_TAGS:
            tags.append(tag)
    tags.extend(tags_categorized.get("others", []))
    return ", ".join(str(tag).strip() for tag in tags if str(tag).strip())
