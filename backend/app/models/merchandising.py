from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from ..core.database import MerchBase


class MerchProduct(MerchBase):
    __tablename__ = "merch_products"
    __table_args__ = {"extend_existing": True}

    product_id = Column(Integer, primary_key=True)
    style = Column(String, index=True)
    total_inventory = Column(Integer)
    admin_link = Column(String)
    price = Column(Float)
    tags = Column(String)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)


class MerchAnalytics(MerchBase):
    __tablename__ = "analytics"
    __table_args__ = {"extend_existing": True}

    product_id = Column(Integer, primary_key=True)
    style_no = Column(String, index=True)
    pageview_30 = Column(Integer)
    pageview_60 = Column(Integer)
    pageview_90 = Column(Integer)
    shipstation_30 = Column(Integer)
    shipstation_60 = Column(Integer)
    shipstation_90 = Column(Integer)
    return_30 = Column(Integer)
    return_60 = Column(Integer)
    return_90 = Column(Integer)
    returnrate_30 = Column(Float)
    returnrate_60 = Column(Float)
    returnrate_90 = Column(Float)
    notes = Column(String)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)


class MerchShopifyProduct(MerchBase):
    __tablename__ = "products"
    __table_args__ = {"extend_existing": True}

    product_id = Column(Integer, primary_key=True)
    store_name = Column(String)
    sku = Column(String, index=True)
    handle = Column(String)
    title = Column(String)
    body_html = Column(Text)
    vendor = Column(String)
    product_type = Column(String)
    tags = Column(Text)
    price = Column(Float)
    compare_at_price = Column(Float)
    status = Column(String)
    published_at = Column(String)
    seo_title = Column(String)
    seo_description = Column(Text)
    total_inventory = Column(Integer)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)


class MerchProductAsset(MerchBase):
    __tablename__ = "product_assets"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, index=True)
    store_name = Column(String)
    asset_type = Column(String)
    url = Column(Text)
    alt_text = Column(Text)
    position = Column(Integer)
    mime_type = Column(String)
    shopify_media_id = Column(String)
    created_at = Column(DateTime)


class MerchProductVariant(MerchBase):
    __tablename__ = "product_variants"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, index=True)
    store_name = Column(String)
    sku = Column(String)
    style_number = Column(String)
    color = Column(String)
    size = Column(String)
    price = Column(Float)
    compare_at_price = Column(Float)
    inventory = Column(Integer)
    created_at = Column(DateTime)
