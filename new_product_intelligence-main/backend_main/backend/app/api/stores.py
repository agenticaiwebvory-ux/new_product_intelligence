from fastapi import APIRouter

from ..services.store_service import StoreService

router = APIRouter()


@router.get("/")
async def list_stores():
    return {"stores": StoreService().list_store_keys()}


@router.get("/connections")
async def check_store_connections():
    return await StoreService().check_connections()
