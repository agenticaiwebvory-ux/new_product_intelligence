from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Product(Base):
    __tablename__ = "products"

    product_id = Column(Integer, primary_key=True)
    store_name = Column(String)
    sku = Column(String)
    handle = Column(String, index=True)
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
    focus_keyword = Column(String)
    google_product_category = Column(String)
    custom_label_0 = Column(String)
    custom_label_1 = Column(String)
    custom_label_2 = Column(String)
    custom_label_3 = Column(String)
    custom_label_4 = Column(String)
    gtin = Column(String)
    mpn = Column(String)
    age_group = Column(String)
    gender = Column(String)
    condition = Column(String)
    google_feed_status = Column(String)
    meta_product_category = Column(String)
    meta_sync_status = Column(String)
    has_video = Column(Integer)
    has_size_chart = Column(Integer)
    has_model_specs = Column(Integer)
    # audit_status = Column(String)
    # audit_notes = Column(Text)
    total_inventory = Column(Integer)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

    inventory_items = relationship("Inventory", back_populates="product")
    assets = relationship("ProductAsset", back_populates="product")
    
    @property
    def style_number(self):
        return self.sku.split('-')[0] if self.sku else None

class Inventory(Base):
    __tablename__ = "product_variants"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.product_id"))
    store_name = Column(String)
    sku = Column(String)
    style_number = Column(String)
    color = Column(String)
    size = Column(String)
    price = Column(Float)
    compare_at_price = Column(Float)
    inventory = Column(Integer)
    created_at = Column(DateTime)

    product = relationship("Product", back_populates="inventory_items")

class ProductAsset(Base):
    __tablename__ = "product_assets"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.product_id"))
    store_name = Column(String)
    asset_type = Column(String)
    url = Column(Text)
    alt_text = Column(Text)
    position = Column(Integer)
    mime_type = Column(String)
    shopify_media_id = Column(String)
    created_at = Column(DateTime)

    product = relationship("Product", back_populates="assets")

class InStockDashboard(Base):
    __tablename__ = "in_stock_dashboard"
    id = Column(Integer, primary_key=True)
    style = Column(String)
    tdo_product_id = Column(Integer)
    wdo_product_id = Column(Integer)
    kos_product_id = Column(Integer)
    vendor = Column(String)
    tdo_admin_link = Column(String)
    wdo_admin_link = Column(String)
    kos_admin_link = Column(String)
    retail_price = Column(Float)
    wholesale_price = Column(Float)
    compare_at_price = Column(Float)
    color = Column(String)
    sizes = Column(String)
    total_inventory = Column(Integer)
    tdo_status = Column(String)
    wdo_status = Column(String)
    kos_status = Column(String)
    local_title = Column(String)
    local_description = Column(Text)
    local_meta_title = Column(String)
    local_meta_description = Column(Text)
    tdo_price = Column(Float)
    tdo_compare_at_price = Column(Float)
    wdo_price = Column(Float)
    wdo_compare_at_price = Column(Float)
    kos_price = Column(Float)
    kos_compare_at_price = Column(Float)

    # IM Store Columns
    im_product_id = Column(Integer)
    im_admin_link = Column(String)
    im_price = Column(Float)
    im_compare_at_price = Column(Float)
    im_status = Column(String)
    
    # Backup columns (for Undo functionality)
    backup_title = Column(String)
    backup_description = Column(Text)
    backup_meta_title = Column(String)
    backup_meta_description = Column(Text)
    backup_retail_price = Column(Float)
    backup_wholesale_price = Column(Float)
    backup_total_inventory = Column(Integer)
    backup_sizes = Column(String) # Snapshot of size breakdown like "2(1), 14(1)"
    backup_created_at = Column(DateTime) # When the backup snapshot was created
    
    # issues = Column(Text)
    has_video = Column(Integer)
    match_method = Column(String)
    matched = Column(Integer)
    notes = Column(Text)

class TheDressOutlet(Base):
    __tablename__ = "the_dress_outlet"
    id = Column(Integer, primary_key=True)
    style = Column(String)
    tdo_product_id = Column(Integer)
    wdo_product_id = Column(Integer)
    kos_product_id = Column(Integer)
    vendor = Column(String)
    tdo_admin_link = Column(String)
    wdo_admin_link = Column(String)
    kos_admin_link = Column(String)
    retail_price = Column(Float)
    wholesale_price = Column(Float)
    compare_at_price = Column(Float)
    tdo_price = Column(Float)
    tdo_compare_at_price = Column(Float)
    wdo_price = Column(Float)
    wdo_compare_at_price = Column(Float)
    kos_price = Column(Float)
    kos_compare_at_price = Column(Float)
    color = Column(String)
    sizes = Column(String)
    tdo_status = Column(String)
    wdo_status = Column(String)
    kos_status = Column(String)
    local_title = Column(String)
    local_description = Column(Text)
    local_meta_title = Column(String)
    local_meta_description = Column(Text)

    # IM Store Columns
    im_product_id = Column(Integer)
    im_admin_link = Column(String)
    im_price = Column(Float)
    im_compare_at_price = Column(Float)
    im_status = Column(String)

    backup_title = Column(String)
    backup_description = Column(Text)
    backup_meta_title = Column(String)
    backup_meta_description = Column(Text)
    backup_retail_price = Column(Float)
    backup_wholesale_price = Column(Float)
    total_inventory = Column(Integer)
    backup_total_inventory = Column(Integer)
    backup_sizes = Column(String)
    backup_created_at = Column(DateTime)
    # issues = Column(Text)
    has_video = Column(Integer)
    match_method = Column(String)
    matched = Column(Integer)
    notes = Column(Text)

class ChangeLog(Base):
    __tablename__ = "changelog"

    id = Column(Integer, primary_key=True)
    store_name = Column(String)
    product_id = Column(Integer)
    style_number = Column(String)
    change_type = Column(String)
    field_changed = Column(String)
    old_value = Column(Text)
    new_value = Column(Text)
    user_name = Column(String)
    created_at = Column(DateTime, default=func.now())

class StoreCredential(Base):
    __tablename__ = "store_credentials"
    id = Column(Integer, primary_key=True)
    store_name = Column(String, nullable=False)
    shop_name = Column(String)
    shop_domain = Column(String)
    client_id = Column(String)
    client_secret = Column(String)
    access_token = Column(String)
    api_version = Column(String, default="2024-04")
    last_error = Column(Text)
    last_checked_at = Column(DateTime, onupdate=func.now())

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="user")
    created_at = Column(DateTime, server_default=func.now())
    
    # HITL specific permissions
    perm_email = Column(Integer, default=1)
    perm_whatsapp = Column(Integer, default=1)
    perm_freshdesk = Column(Integer, default=1)
    perm_settings = Column(Integer, default=1)
    perm_freshdesk_digest = Column(Integer, default=1)
    perm_external = Column(Integer, default=1)
    perm_inventory = Column(Integer, default=12)
    perm_dashboard = Column(Integer, default=1)
    
    # Operational fields (will be added to DB if missing)
    last_login = Column(DateTime)

class MainKos(Base):
    __tablename__ = "main_kos"
    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, index=True)
    pageview = Column(Integer, default=0)
    sell_thru = Column(Integer, default=0)
    style = Column(String)
    most_sold_color = Column(String)
    most_sold_size = Column(String)
    notes = Column(String)
    time_frame = Column(String, nullable=True)
    source = Column(String, nullable=True)
