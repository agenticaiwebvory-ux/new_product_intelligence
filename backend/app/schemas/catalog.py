from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime


class InventoryBase(BaseModel):
    size: str
    quantity: int


class Inventory(InventoryBase):
    id: int
    product_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ProductBase(BaseModel):
    style_number: str
    color: str
    title: str
    retail_price: Optional[float] = None
    total_units: int = 0
    handle: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[str] = None


class Product(ProductBase):
    id: int
    vendor: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    inventory_items: List[Inventory] = []

    model_config = ConfigDict(from_attributes=True)
