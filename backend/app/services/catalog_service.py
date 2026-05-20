import time
from sqlalchemy import or_, case
from sqlalchemy.orm import Session
from ..models.catalog import Product, Inventory, InStockDashboard, ProductAsset, TheDressOutlet, MainKos
from ..config import STORE_CONFIGS, settings, TDO_VENDOR_NAME
import logging

logger = logging.getLogger(__name__)

class CatalogService:
    def __init__(self, db: Session):
        self.db = db

    def get_master_catalog(self, vendor=None, page=1, limit=50, search=None, date_from=None, date_to=None, status=None):
        start_time = time.time()
        offset = (page - 1) * limit
        logger.info(f"get_master_catalog started (Page: {page}, Limit: {limit}, Search: {search}) for vendor: {vendor}")
        """
        OPTIMIZED: Supports server-side pagination, search, and date range filtering on products.published_at.
        """
        # 1. Get active stores
        stores = list(STORE_CONFIGS.keys()) if STORE_CONFIGS else []
        if not stores:
            logger.warning("No stores configured in STORE_CONFIGS.")
            return [], {}, {}, [], 0

        total_count = 0
        unified_data = []

        # 2. Base Dashboard Query
        if vendor == TDO_VENDOR_NAME:
            # Join with MainKos for pageviews AND Product for live tags
            query = self.db.query(TheDressOutlet).outerjoin(
                MainKos, TheDressOutlet.tdo_product_id == MainKos.product_id
            ).outerjoin(
                Product, TheDressOutlet.tdo_product_id == Product.product_id
            ).filter(
                TheDressOutlet.vendor == TDO_VENDOR_NAME,
                TheDressOutlet.style.isnot(None),
                ~TheDressOutlet.style.like("D/%"),
                ~TheDressOutlet.style.like("S/%"),
                or_(Product.tags == None, ~Product.tags.ilike("%discontinued%"))
            )

            if status:
                query = query.filter(Product.status == status)
            if date_from:
                query = query.filter(Product.published_at >= date_from)
            if date_to:
                query = query.filter(Product.published_at <= date_to + "T23:59:59Z")

            if search:
                search_term = f"%{search}%"
                query = query.filter(
                    or_(
                        TheDressOutlet.style.ilike(search_term),
                        TheDressOutlet.vendor.ilike(search_term)
                    )
                )
            
            # Complex Sort
            query = query.order_by(
                case((TheDressOutlet.style.like('#%'), 1), else_=0),
                MainKos.pageview.desc(),
                TheDressOutlet.style.asc()
            )
            
            total_count = query.count()
            unified_data = query.offset(offset).limit(limit).all()
        else:
            base_query = self.db.query(InStockDashboard).outerjoin(
                Product, InStockDashboard.tdo_product_id == Product.product_id
            ).filter(
                InStockDashboard.style.isnot(None),
                ~InStockDashboard.style.like("D/%"),
                ~InStockDashboard.style.like("S/%"),
                or_(Product.tags == None, ~Product.tags.ilike("%discontinued%"))
            )

            if status:
                base_query = base_query.filter(Product.status == status)
            if date_from:
                base_query = base_query.filter(Product.published_at >= date_from)
            if date_to:
                base_query = base_query.filter(Product.published_at <= date_to + "T23:59:59Z")

            if vendor:
                if vendor == "Unassigned / Missing Vendor":
                    base_query = base_query.filter((InStockDashboard.vendor == None) | (InStockDashboard.vendor == ""))
                else:
                    base_query = base_query.filter(InStockDashboard.vendor == vendor)
            
            if search:
                search_term = f"%{search}%"
                base_query = base_query.filter(
                    or_(
                        InStockDashboard.style.ilike(search_term),
                        InStockDashboard.vendor.ilike(search_term),
                        Product.title.ilike(search_term),
                        Product.tags.ilike(search_term)
                    )
                )

            if not vendor:
                # Combined case (Standard Catalog + TDO Catalog)
                q1 = base_query.filter(InStockDashboard.vendor != TDO_VENDOR_NAME)
                q2 = self.db.query(TheDressOutlet).outerjoin(
                    Product, TheDressOutlet.tdo_product_id == Product.product_id
                ).filter(
                    TheDressOutlet.vendor == TDO_VENDOR_NAME,
                    TheDressOutlet.style.isnot(None),
                    ~TheDressOutlet.style.like("D/%"),
                    ~TheDressOutlet.style.like("S/%"),
                    or_(Product.tags == None, ~Product.tags.ilike("%discontinued%"))
                )

                if status:
                    q2 = q2.filter(Product.status == status)
                if date_from:
                    q2 = q2.filter(Product.published_at >= date_from)
                if date_to:
                    q2 = q2.filter(Product.published_at <= date_to + "T23:59:59Z")

                if search:
                    search_term = f"%{search}%"
                    q2 = q2.filter(
                        or_(
                            TheDressOutlet.style.ilike(search_term),
                            TheDressOutlet.vendor.ilike(search_term),
                            Product.title.ilike(search_term),
                            Product.tags.ilike(search_term)
                        )
                    )
                
                total_count = q1.count() + q2.count()
                
                # Fetching for combined view (simple merged slicing)
                data_in_stock = q1.all()
                data_tdo = q2.all()
                all_merged = data_in_stock + data_tdo
                # Sort: Styles starting with # at the end
                all_merged.sort(key=lambda x: (1 if x.style.startswith('#') else 0, x.style))
                unified_data = all_merged[offset : offset + limit]
            else:
                total_count = base_query.count()
                unified_data = base_query.offset(offset).limit(limit).all()

        
        # 3. Optimize Data Fetch
        master_product_map = {}
        image_map = {}
        
        limited_pids = []
        for row in unified_data:
            for s in stores:
                pid = getattr(row, f"{s.lower()}_product_id", None)
                if pid:
                    try:
                        limited_pids.append(int(pid))
                    except:
                        pass

        if limited_pids:
            products = self.db.query(Product).filter(Product.product_id.in_(limited_pids)).all()
            assets = self.db.query(ProductAsset).filter(ProductAsset.product_id.in_(limited_pids)).order_by(ProductAsset.position.asc()).all()
            
            master_product_map = {p.product_id: p for p in products}
            
            for a in assets:
                if a.product_id not in image_map:
                    image_map[a.product_id] = a.url

        # 4. Final step: Inventory calculation
        if limited_pids:
            all_variants = self.db.query(Inventory).filter(Inventory.product_id.in_(limited_pids)).all()
            
            pid_inv_map = {}
            for v in all_variants:
                if v.product_id not in pid_inv_map:
                    pid_inv_map[v.product_id] = []
                pid_inv_map[v.product_id].append(v)
            
            for row in unified_data:
                target_pid = getattr(row, 'tdo_product_id', None)
                if not target_pid:
                    try: target_pid = int(getattr(row, 'product_id', 0))
                    except: target_pid = None

                if not target_pid or target_pid not in pid_inv_map:
                    row.total_inventory = 0
                    continue
                
                variants = pid_inv_map[target_pid]
                row.total_inventory = sum(v.inventory or 0 for v in variants)

        return unified_data, master_product_map, image_map, stores, total_count
