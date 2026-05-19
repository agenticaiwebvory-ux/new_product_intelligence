from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime

class InventoryBase(BaseModel):
    size: Optional[str] = None
    quantity: int

class Inventory(InventoryBase):
    id: int
    product_id: int
    
    model_config = ConfigDict(from_attributes=True)

class AssetBase(BaseModel):
    url: str
    alt: Optional[str] = None
    position: int = 0

class Asset(AssetBase):
    id: int
    product_id: int
    
    model_config = ConfigDict(from_attributes=True)

class ProductBase(BaseModel):
    id: Optional[int] = None
    shopify_product_id: Optional[str] = None
    style_number: Optional[str] = None
    color: Optional[str] = None
    title: str
    handle: Optional[str] = None
    description: Optional[str] = None
    vendor: Optional[str] = None
    product_type: Optional[str] = None
    tags: Optional[str] = None
    price: Optional[float] = None
    compare_at_price: Optional[float] = None
    retail_price: Optional[float] = None
    wholesale_price: Optional[float] = None
    status: Optional[str] = None
    # audit_status: Optional[str] = "pending"
    # audit_notes: Optional[str] = None
    total_inventory: int = 0
    total_units: int = 0
    is_tdo: bool = False
    is_wdo: bool = False
    is_kos: bool = False
    # sop_issues: List[str] = []

class Product(ProductBase):
    inventory_items: List[Inventory] = []
    assets: List[Asset] = []

    model_config = ConfigDict(from_attributes=True)
