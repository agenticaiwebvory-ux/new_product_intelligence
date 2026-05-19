from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class PeriodMetrics(BaseModel):
    days_30: float = 0
    days_60: float = 0
    days_90: float = 0


class VariantItem(BaseModel):
    id: int
    color: Optional[str] = None
    size: Optional[str] = None
    inventory: int = 0
    price: Optional[float] = None
    sold: int = 0
    sold_30: int = 0
    sold_60: int = 0
    sold_90: int = 0


class MerchandisingReportItem(BaseModel):
    sku: Optional[str] = None
    style: str
    product_id: Optional[int] = None
    status: Optional[str] = None
    handle: Optional[str] = None
    vendor: Optional[str] = None
    image_url: Optional[str] = None
    retail_price: Optional[float] = None
    total_inventory: int = 0
    top_tags: List[str] = Field(default_factory=list)
    tags_categorized: Dict[str, List[str]] = Field(default_factory=dict)
    notes: Optional[str] = None
    variants: List[VariantItem] = Field(default_factory=list)
    pageviews: PeriodMetrics = Field(default_factory=PeriodMetrics)
    units_sold: PeriodMetrics = Field(default_factory=PeriodMetrics)
    sell_thru_details: PeriodMetrics = Field(default_factory=PeriodMetrics)
    pageviews_details: PeriodMetrics = Field(default_factory=PeriodMetrics)
    returns: PeriodMetrics = Field(default_factory=PeriodMetrics)
    return_rates: PeriodMetrics = Field(default_factory=PeriodMetrics)
    units_sold_30_by_variant: Dict[str, int] = Field(default_factory=dict)
    units_sold_60_by_variant: Dict[str, int] = Field(default_factory=dict)
    units_sold_by_variant: Dict[str, int] = Field(default_factory=dict)
    admin_link: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class MerchandisingReportResponse(BaseModel):
    total_count: int
    page: int
    limit: int
    data: List[MerchandisingReportItem]


class TagUpdateRequest(BaseModel):
    style: str
    tags_categorized: Dict[str, List[str]]
