import logging
import time
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from ..models import catalog as models
from ..models.merchandising import MerchAnalytics
from ..config import STORE_CONFIGS, TDO_VENDOR_NAME, MERCH_MODE_KEY
from ..utils.tag_utils import parse_tags_categorized
from .catalog_service import CatalogService
import re

class DashboardService:
    def __init__(self, db: Session):
        self.db = db
        self.catalog_service = CatalogService(db)
        self.logger = logging.getLogger("product-intelligence.dashboard")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_stat_block(self, model, base_filter, vendor, search, date_from, date_to, *, is_tdo_table=False):
        """
        Builds count / inventory / OOS / missing-link stats for one catalog table.
        Returns (count, inventory, oos, miss_tdo, miss_wdo, miss_kos, miss_im).
        """
        q = self.db.query(model).outerjoin(
            models.Product, getattr(model, 'tdo_product_id') == models.Product.product_id
        ).filter(*base_filter)

        if date_from:
            q = q.filter(models.Product.published_at >= date_from)
        if date_to:
            q = q.filter(models.Product.published_at <= date_to + "T23:59:59Z")

        if vendor and vendor not in ('ALL', MERCH_MODE_KEY):
            if is_tdo_table:
                # TDO table only holds TDO_VENDOR_NAME; force empty for mismatched vendor
                if vendor != TDO_VENDOR_NAME:
                    q = q.filter(model.id == -1)
            else:
                q = q.filter(model.vendor == vendor)

        if search:
            st = f"%{search}%"
            q = q.filter(or_(
                model.style.ilike(st),
                model.vendor.ilike(st),
                model.local_title.ilike(st),
            ))

        count = q.count()

        inv_q = self.db.query(func.sum(model.total_inventory)).outerjoin(
            models.Product, getattr(model, 'tdo_product_id') == models.Product.product_id
        ).filter(*base_filter)
        if date_from:
            inv_q = inv_q.filter(models.Product.published_at >= date_from)
        if date_to:
            inv_q = inv_q.filter(models.Product.published_at <= date_to + "T23:59:59Z")
        if vendor and vendor not in ('ALL', MERCH_MODE_KEY):
            if is_tdo_table and vendor != TDO_VENDOR_NAME:
                inv_q = inv_q.filter(model.id == -1)
            elif not is_tdo_table:
                inv_q = inv_q.filter(model.vendor == vendor)
        if search:
            st = f"%{search}%"
            inv_q = inv_q.filter(or_(model.style.ilike(st), model.vendor.ilike(st), model.local_title.ilike(st)))

        inv = inv_q.scalar() or 0
        oos = q.filter(model.total_inventory <= 0).count()

        def _miss(col):
            return q.filter(or_(col == None, col == 0, col == "")).count()

        return (
            count, inv, oos,
            _miss(model.tdo_product_id),
            _miss(model.wdo_product_id),
            _miss(model.kos_product_id),
            _miss(model.im_product_id),
        )

    def get_aggregated_stats(self, vendor: str = None, store: str = None, search: str = None, tags: str = None, status: str = None, date_from: str = None, date_to: str = None):
        """
        Aggregates catalog stats across both product tables.
        """
        health = {}
        try:
            creds = self.db.query(models.StoreCredential).all()
            for c in creds:
                health[c.store_name.upper()] = {
                    "status": "error" if c.last_error else "ok",
                    "url": c.shop_domain,
                    "error": c.last_error,
                    "last_checked": c.last_checked_at.isoformat() if hasattr(c.last_checked_at, 'isoformat') else c.last_checked_at,
                }
        except Exception as e:
            self.logger.error(f"Health check failed: {e}")

        # Build store filter
        store_filter = []
        if store and store != 'ALL':
            store_col = getattr(models.InStockDashboard, f"{store.lower()}_product_id", None)
            if store_col is not None:
                store_filter.append(store_col.isnot(None))

        # Build tags filter
        tags_filter = []
        if tags:
            st = f"%{tags}%"
            tags_filter.append(models.Product.tags.ilike(st))

        # Build status filter
        status_filter = []
        if status:
            status_filter.append(models.Product.status == status)

        # 1. Main catalog (InStockDashboard) — excludes TDO_VENDOR_NAME rows to prevent duplicates
        main_base = [
            models.InStockDashboard.vendor != TDO_VENDOR_NAME,
            or_(models.Product.tags == None, ~models.Product.tags.ilike("%discontinued%")),
        ] + store_filter + tags_filter + status_filter
        mc, mi, mo, mt, mw, mk, mim = self._build_stat_block(
            models.InStockDashboard, main_base, vendor, search, date_from, date_to, is_tdo_table=False
        )

        # Build TDO store filter
        tdo_store_filter = []
        if store and store != 'ALL':
            tdo_store_col = getattr(models.TheDressOutlet, f"{store.lower()}_product_id", None)
            if tdo_store_col is not None:
                tdo_store_filter.append(tdo_store_col.isnot(None))

        # 2. TDO-specific table (TheDressOutlet) — only TDO_VENDOR_NAME rows
        tdo_base = [
            models.TheDressOutlet.vendor == TDO_VENDOR_NAME,
            or_(models.Product.tags == None, ~models.Product.tags.ilike("%discontinued%")),
        ] + tdo_store_filter + tags_filter + status_filter
        tc, ti, to_, tt, tw, tk, tim = self._build_stat_block(
            models.TheDressOutlet, tdo_base, vendor, search, date_from, date_to, is_tdo_table=True
        )

        # Total sold (sum of 90d sell_thru from MainKos, outerjoined with Product for date filter)
        total_sold = 0
        try:
            sold_q = self.db.query(func.coalesce(func.sum(models.MainKos.sell_thru), 0)).outerjoin(
                models.Product,
                models.MainKos.product_id == models.Product.product_id
            ).outerjoin(
                models.InStockDashboard,
                models.InStockDashboard.tdo_product_id == models.MainKos.product_id
            ).outerjoin(
                models.TheDressOutlet,
                models.TheDressOutlet.tdo_product_id == models.MainKos.product_id
            ).filter(
                or_(models.MainKos.time_frame == "90", models.MainKos.time_frame == "90d")
            )
            if date_from:
                sold_q = sold_q.filter(models.Product.published_at >= date_from)
            if date_to:
                sold_q = sold_q.filter(models.Product.published_at <= date_to + "T23:59:59Z")
            if store and store != 'ALL':
                store_col_main = getattr(models.InStockDashboard, f"{store.lower()}_product_id", None)
                store_col_tdo = getattr(models.TheDressOutlet, f"{store.lower()}_product_id", None)
                store_filters = []
                if store_col_main is not None:
                    store_filters.append(store_col_main.isnot(None))
                if store_col_tdo is not None:
                    store_filters.append(store_col_tdo.isnot(None))
                if store_filters:
                    sold_q = sold_q.filter(or_(*store_filters))
            if search:
                st = f"%{search}%"
                sold_q = sold_q.filter(or_(
                    models.InStockDashboard.style.ilike(st),
                    models.TheDressOutlet.style.ilike(st),
                ))
            if tags:
                tst = f"%{tags}%"
                sold_q = sold_q.filter(models.Product.tags.ilike(tst))
            if status:
                sold_q = sold_q.filter(models.Product.status == status)
            total_sold = sold_q.scalar() or 0
        except Exception as e:
            self.logger.warning(f"Total sold query failed: {e}")

        return {
            "total_styles": mc + tc,
            "total_inventory": mi + ti,
            "out_of_stock": mo + to_,
            "tdo_missing": mt + tt,
            "wdo_missing": mw + tw,
            "kos_missing": mk + tk,
            "im_missing": mim + tim,
            "total_sold": total_sold,
            "store_health": health,
            "vendors": self.get_designers_with_counts(store=store, tags=tags, status=status),
        }

    def get_designers_with_counts(self, store=None, tags=None, status=None):
        vendors_dict = {}

        # Filter for InStockDashboard (exclude TDO vendor)
        main_filter = [models.InStockDashboard.vendor != TDO_VENDOR_NAME]
        if store and store != 'ALL':
            store_col = getattr(models.InStockDashboard, f"{store.lower()}_product_id", None)
            if store_col is not None:
                main_filter.append(store_col.isnot(None))

        main_q = self.db.query(
            models.InStockDashboard.vendor,
            func.count(models.InStockDashboard.id)
        ).outerjoin(
            models.Product,
            models.InStockDashboard.tdo_product_id == models.Product.product_id
        ).filter(*main_filter)
        if tags:
            main_q = main_q.filter(models.Product.tags.ilike(f"%{tags}%"))
        if status:
            main_q = main_q.filter(models.Product.status == status)
        counts = main_q.group_by(models.InStockDashboard.vendor).all()

        for name, count in counts:
            if name and name.strip():
                vendors_dict[name] = count

        # Filter for TheDressOutlet (only TDO vendor)
        tdo_filter = [models.TheDressOutlet.vendor == TDO_VENDOR_NAME]
        if store and store != 'ALL':
            tdo_store_col = getattr(models.TheDressOutlet, f"{store.lower()}_product_id", None)
            if tdo_store_col is not None:
                tdo_filter.append(tdo_store_col.isnot(None))

        tdo_q = self.db.query(models.TheDressOutlet).outerjoin(
            models.Product,
            models.TheDressOutlet.tdo_product_id == models.Product.product_id
        ).filter(*tdo_filter)
        if tags:
            tdo_q = tdo_q.filter(models.Product.tags.ilike(f"%{tags}%"))
        if status:
            tdo_q = tdo_q.filter(models.Product.status == status)
        tdo_count = tdo_q.count()
        if tdo_count > 0:
            vendors_dict[TDO_VENDOR_NAME] = tdo_count

        results = []
        for name, count in sorted(vendors_dict.items()):
            results.append({"id": name, "name": name, "style_count": count})
        return results

    def get_unified_products(self, vendor=None, page=1, limit=50, search=None, status=None, date_from=None, date_to=None):
        start_time = time.time()
        self.logger.info(f"Fetching unified products (Page: {page}, Limit: {limit}, Search: {search}, DateFrom: {date_from}, DateTo: {date_to}) for vendor: {vendor}")
        # 1. Fetch data via CatalogService (Source of Truth: in_stock_dashboard)
        unified_data, master_product_map, image_map, stores, total_count = self.catalog_service.get_master_catalog(
            vendor, page, limit, search, date_from=date_from, date_to=date_to, status=status
        )
        self.logger.info(f"Catalog fetched: {len(unified_data)} rows in {time.time() - start_time:.2f}s")

        # 2. BULK FETCH INVENTORY BY PRODUCT ID (Multi-Store Source of Truth)
        id_column = 'tdo_product_id'
        if vendor:
            v_lower = vendor.lower()
            if 'im' in v_lower: id_column = 'im_product_id'
            elif 'wdo' in v_lower: id_column = 'wdo_product_id'
            elif 'kos' in v_lower: id_column = 'kos_product_id'

        target_pids = []
        for row in unified_data:
            for col in ['tdo_product_id', 'wdo_product_id', 'kos_product_id', 'im_product_id']:
                pid = getattr(row, col, None)
                if pid:
                    try: target_pids.append(int(pid))
                    except: pass

        inventory_items = []
        if target_pids:
            inventory_items = self.db.query(models.Inventory).filter(models.Inventory.product_id.in_(target_pids)).all()

        # Build inventory maps: product_id -> [list of variants]
        inv_map = {}
        for item in inventory_items:
            if item.product_id not in inv_map:
                inv_map[item.product_id] = []
            inv_map[item.product_id].append(item)

        # BULK FETCH ANALYTICS (from main_kos)
        tdo_ids = [r.tdo_product_id for r in unified_data if getattr(r, 'tdo_product_id', None)]
        styles = [r.style for r in unified_data if getattr(r, 'style', None)]

        analytics_map = {}
        if tdo_ids or styles:
            # Query by both Product ID and Style for maximum coverage
            query = self.db.query(models.MainKos)
            filters = []
            if tdo_ids: filters.append(models.MainKos.product_id.in_(tdo_ids))
            if styles: filters.append(models.MainKos.style.in_(styles))

            from sqlalchemy import or_
            kos_items = query.filter(or_(*filters)).all()

            for item in kos_items:
                # Standardize timeframe key
                tf = str(item.time_frame or "90").lower().replace("d", "")

                # Style-based grouping
                if item.style:
                    if item.style not in analytics_map: analytics_map[item.style] = {}
                    analytics_map[item.style][tf] = item
                
                # ID-based grouping (Fallback)
                if item.product_id:
                    pid_str = str(item.product_id)
                    if pid_str not in analytics_map: analytics_map[pid_str] = {}
                    analytics_map[pid_str][tf] = item

        # BULK FETCH RETURNS DATA (from MerchAnalytics in tdo_merch.db)
        from ..core.database import MerchSessionLocal
        returns_map = {}
        if styles:
            merch_session = MerchSessionLocal()
            try:
                merch_rows = merch_session.query(MerchAnalytics).filter(MerchAnalytics.style_no.in_(styles)).all()
                for mr in merch_rows:
                    returns_map[mr.style_no] = mr
            finally:
                merch_session.close()

        results = []
        for row in unified_data:
            # Helper to find analytics data (dict of timeframes)
            p_analytics = analytics_map.get(row.style) or analytics_map.get(str(getattr(row, 'tdo_product_id', ''))) or {}
            
            # Default to 90d for the 'flat' analytics fields
            analytics_data = p_analytics.get("90") or p_analytics.get("30") or (list(p_analytics.values())[0] if p_analytics else None)
            
            store_data = {}
            master_price = row.retail_price
            image_url = None
            
            # 3. Map Multi-Store status
            for s in stores:
                raw_pid = getattr(row, f"{s.lower()}_product_id", None)
                pid = None
                if raw_pid:
                    try:
                        pid = int(raw_pid)
                    except:
                        pass
                
                store_color_vars = {}
                store_variants_list = inv_map.get(pid, []) if pid else []
                store_flat_variants = []
                
                for v in store_variants_list:
                    c = v.color or "Default"
                    if c not in store_color_vars:
                        store_color_vars[c] = {}
                    store_color_vars[c][v.size] = v.inventory
                    store_flat_variants.append({
                        "size": v.size,
                        "inventory": v.inventory,
                        "color": c,
                        "sku": v.sku
                    })
                
                store_color_totals = {c: sum(sizes.values()) for c, sizes in store_color_vars.items()}
                store_total_inv = sum(store_color_totals.values()) if store_color_totals else 0
                
                store_data[s.upper()] = {
                    "linked": pid is not None,
                    "product_id": pid,
                    "price": master_price,
                    "inventory": store_total_inv,
                    # Status comes from DB; None means not published yet — never default to DRAFT
                    "status": getattr(row, f"{s.lower()}_status", None),
                    "title": "",
                    "description": "",
                    "color_variants": store_color_vars,
                    "color_totals": store_color_totals,
                    "variants": store_flat_variants,
                }
                
                if pid and pid in master_product_map:
                    p_obj = master_product_map[pid]
                    store_data[s.upper()]["price"] = p_obj.price
                    if not store_color_totals:
                        store_data[s.upper()]["inventory"] = p_obj.total_inventory
                    store_data[s.upper()]["title"] = p_obj.title
                    store_data[s.upper()]["description"] = p_obj.body_html
                    store_data[s.upper()]["seo_title"] = p_obj.seo_title
                    store_data[s.upper()]["seo_description"] = p_obj.seo_description
                    if not image_url: image_url = image_map.get(pid)
                
            # 3.5 Calculate Image Count for the UI badge (Dynamic based on active stores)
            all_pids = []
            for s in stores:
                val = getattr(row, f"{s.lower()}_product_id", None)
                if val:
                    try:
                        all_pids.append(int(val))
                    except:
                        pass
            
            product_images = []
            for pid in all_pids:
                if pid in master_product_map:
                    p_obj = master_product_map[pid]
                    if p_obj.assets:
                        product_images.extend([a.url for a in p_obj.assets])
            
            image_count = len(set(product_images)) # Unique URLs

            # 4. Stock Risk logic
            qty = getattr(row, 'total_inventory', 0) or 0
            risk_level = "STABLE"
            if qty < 10: risk_level = "REORDER_SOON"
            if qty < 3: risk_level = "CRITICAL"

            # 6. Lightweight Inventory Mapping (Exact Values from Variants Table)
            style_name = row.style
            
            size_map = {}
            color_variants = {}
            color_totals = {}
            
            # Use target product ID to isolate inventory to a single store
            target_pid = getattr(row, id_column, None)
            all_variants = inv_map.get(target_pid, []) if target_pid else []
            style_val = row.style or ""
            style_color = style_val.split('-')[1] if '-' in style_val else None
            
            for v in all_variants:
                c = v.color or "Default"
                if c not in color_variants:
                    color_variants[c] = {}
                color_variants[c][v.size] = v.inventory
                
            color_totals = {c: sum(sizes.values()) for c, sizes in color_variants.items()}
            
            filtered_variants = [
                v for v in all_variants 
                if not style_color or style_color.lower() in (v.sku or "").lower()
            ] if style_color else all_variants
            
            size_map = {v.size: v.inventory for v in filtered_variants}

            # 6b. Draft Overlay (Ensure Editor Hub shows local drafts)
            if row.sizes:
                draft_sizes = {}
                for p in row.sizes.split(','):
                    m = re.search(r'(.+)\((\d+)\)', p.strip())
                    if m: draft_sizes[m.group(1)] = int(m.group(2))
                
                if draft_sizes:
                    # Determine target color for overlay
                    target_color = "Default"
                    if color_variants:
                        if style_color and style_color in color_variants:
                            target_color = style_color
                        else:
                            # Use first color as target if style-color is ambiguous
                            target_color = list(color_variants.keys())[0]
                    
                    if target_color not in color_variants:
                        color_variants[target_color] = {}
                    
                    # Overwrite variant inventory with local draft
                    for s, q in draft_sizes.items():
                        color_variants[target_color][s] = q
                    
                    # Re-calculate totals and active size_map
                    color_totals = {c: sum(sizes.values()) for c, sizes in color_variants.items()}
                    
                    colors_list = list(color_variants.keys())
                    active_c = style_color or (colors_list[0] if colors_list else "Default")
                    if target_color == active_c:
                         size_map = draft_sizes
            
            # Final Content Preparation: keep TDO as the dashboard baseline.
            primary_store = "TDO"
            
            live_title = store_data.get(primary_store, {}).get("title")
            live_desc = store_data.get(primary_store, {}).get("description")
            live_price = store_data.get(primary_store, {}).get("price")
            live_tdo_inv = store_data.get("TDO", {}).get("inventory", 0)

            # Sync Status (SINGLE SOURCE OF TRUTH)
            live_tags = ""
            for s in ["TDO", "WDO", "KOS", "IM"]:
                raw_pid = getattr(row, f"{s.lower()}_product_id", None)
                if raw_pid and int(raw_pid) in master_product_map:
                    live_tags = master_product_map[int(raw_pid)].tags or ""
                    break

            sync_status = {
                "title": bool(row.local_title and live_title and row.local_title != live_title),
                "description": bool(row.local_description and live_desc and row.local_description != live_desc),
                "price": bool(row.retail_price and live_price and float(row.retail_price) != float(live_price)),
                "wholesale": False 
            }
            
            if row.wholesale_price is not None:
                live_wdo_price = store_data.get("WDO", {}).get("price")
                sync_status["wholesale"] = bool(live_wdo_price and float(row.wholesale_price) != float(live_wdo_price))

            row_total_inventory = getattr(row, 'total_inventory', 0)
            is_dirty_inventory = row_total_inventory != live_tdo_inv

            final_retail = row.retail_price
            final_wholesale = row.wholesale_price

            # 3.7 Parse Multi-Timeframe Analytics Details
            pv_details = {"days_7": 0, "days_30": 0, "days_60": 0, "days_90": 0}
            st_details = {"days_7": 0, "days_30": 0, "days_60": 0, "days_90": 0}
            
            for tf_key, tf_item in p_analytics.items():
                ui_key = f"days_{tf_key}"
                if ui_key in pv_details:
                    pv_details[ui_key] = tf_item.pageview or 0
                    
                    # Sell Thru Fallback Logic
                    st_val = tf_item.sell_thru or 0
                    if not st_val or st_val == 0:
                        # Check JSON notes
                        notes = (tf_item.notes or "").strip()
                        if notes.startswith('{'):
                            try:
                                import json
                                data = json.loads(notes)
                                # For timeframe specific notes, we might have a nested breakdown
                                # But usually each MainKos row is already for a specific timeframe
                                if "total_sold" in data:
                                    st_val = data["total_sold"]
                                else:
                                    # Fallback to breakdown sum
                                    breakdown = data.get(f"{tf_key}d") or data.get(tf_key) or data.get("sku_breakdown", {})
                                    if isinstance(breakdown, dict):
                                        st_val = sum(breakdown.values())
                            except: pass
                    st_details[ui_key] = st_val

            # Use the most robust Sell Thru (usually 90d) for the flat field
            sell_thru_val = st_details.get("days_90") or st_details.get("days_30") or 0
            table_prefix = "tdo" if hasattr(row, "__tablename__") and row.__tablename__ == 'the_dress_outlet' else "main"
            sales_30_nested, sales_30_flat = self._parse_variant_sales_map(p_analytics.get("30"), "30")
            sales_60_nested, sales_60_flat = self._parse_variant_sales_map(p_analytics.get("60"), "60")
            sales_90_nested, sales_90_flat = self._parse_variant_sales_map(p_analytics.get("90"), "90")
            sales_7_nested, sales_7_flat = self._parse_variant_sales_map(p_analytics.get("7"), "7")

            results.append({
                "internal_id": f"{table_prefix}_{row.id}",
                "product_id": row.tdo_product_id,
                "tdo_product_id": row.tdo_product_id,
                "wdo_product_id": row.wdo_product_id,
                "kos_product_id": row.kos_product_id,
                "im_product_id": row.im_product_id,
                "style": row.style,
                "vendor": row.vendor,
                "title": row.local_title,
                "body_html": row.local_description,
                "image_url": image_url,
                "image_count": image_count,
                "sop_flags": [],
                "stock_risk": risk_level,
                "store_prices": store_data, 
                "total_inventory": row_total_inventory,
                "live_inventory": live_tdo_inv,
                "color_variants": color_variants,
                "color_totals": color_totals,
                "is_dirty_inventory": is_dirty_inventory,
                "is_dirty_price": sync_status["price"],
                "staged_price": final_retail,
                "wholesale_price": final_wholesale,
                "staged_sizes": row.sizes,
                "backup_title": row.backup_title,
                "backup_description": row.backup_description,
                "backup_retail_price": getattr(row, 'backup_retail_price', None),
                "backup_wholesale_price": getattr(row, 'backup_wholesale_price', None),
                "backup_sizes": getattr(row, 'backup_sizes', None),
                "sync_status": sync_status,
                "im_status": getattr(row, 'im_status', None),
                "im_admin_link": getattr(row, 'im_admin_link', None),
                "tags_categorized": parse_tags_categorized(live_tags),
                "notes": getattr(row, 'notes', ""),
                "admin_links": {s.lower(): getattr(row, f"{s.lower()}_admin_link", None) for s in stores},
                "pageviews": analytics_data.pageview if analytics_data else 0,
                "pageviews_details": pv_details,
                "sell_thru": sell_thru_val,
                "sell_thru_details": st_details,
                "sales_breakdown": sales_90_nested,
                "units_sold_7_by_variant": sales_7_flat,
                "units_sold_30_by_variant": sales_30_flat,
                "units_sold_60_by_variant": sales_60_flat,
                "units_sold_by_variant": sales_90_flat,
                "most_sold_color": analytics_data.most_sold_color if analytics_data else None,
                "most_sold_size": analytics_data.most_sold_size if analytics_data else None,
                "analytics_notes": self._humanize_notes(analytics_data.notes) if analytics_data else "",
                "returns_details": {
                    "days_30": returns_map[row.style].return_30 if row.style in returns_map else 0,
                    "days_60": returns_map[row.style].return_60 if row.style in returns_map else 0,
                    "days_90": returns_map[row.style].return_90 if row.style in returns_map else 0,
                },
                "return_rates_details": {
                    "days_30": float(returns_map[row.style].returnrate_30) if row.style in returns_map and returns_map[row.style].returnrate_30 is not None else None,
                    "days_60": float(returns_map[row.style].returnrate_60) if row.style in returns_map and returns_map[row.style].returnrate_60 is not None else None,
                    "days_90": float(returns_map[row.style].returnrate_90) if row.style in returns_map and returns_map[row.style].returnrate_90 is not None else None,
                },
            })
        
        self.logger.info(f"Unified products returned {len(results)} rows in {time.time() - start_time:.2f}s")
        return {
            "products": results,
            "total_count": total_count,
            "page": page,
            "total_pages": (total_count + limit - 1) // limit,
            "limit": limit
        }

    def _humanize_notes(self, notes: str) -> str:
        """
        Converts raw JSON analytics notes into a readable human string.
        """
        if not notes or not notes.strip().startswith('{'):
            return notes or ""
        
        try:
            import json
            data = json.loads(notes)
            # Find the first breakdown we can find
            tf_keys = ["90d", "60d", "30d", "7d", "90", "60", "30", "7", "sku_breakdown"]
            breakdown = None
            active_tf = "Analytics"
            for k in tf_keys:
                if k in data:
                    breakdown = data[k]
                    active_tf = f"{k}"
                    break
            
            if not breakdown or not isinstance(breakdown, dict):
                # Check for top_color/top_size directly
                if "top_color" in data or "top_size" in data:
                    res = f"Top Color: {data.get('top_color', 'N/A')}, Top Size: {data.get('top_size', 'N/A')}"
                    if "total_sold" in data: res += f" [Total Sold: {data['total_sold']}]"
                    return res
                return notes # Fallback

            # Sort breakdown by sales
            sorted_items = sorted(breakdown.items(), key=lambda x: x[1], reverse=True)
            top_items = sorted_items[:8] # Show top 8
            
            summary = f"Top Sellers ({active_tf}): "
            summary += ", ".join([f"{k.split('-', 1)[-1] if '-' in k else k} ({v})" for k, v in top_items])
            
            if len(sorted_items) > 8:
                summary += f" ... (+{len(sorted_items) - 8} more)"
            
            if "total_sold" in data:
                summary += f" [Total Units Sold: {data['total_sold']}]"
            else:
                summary += f" [Total Units Sold: {sum(breakdown.values())}]"
                
            return summary
        except:
            return notes

    def _parse_variant_sales_map(self, analytics_item, timeframe: str):
        if not analytics_item or not analytics_item.notes:
            return {}, {}

        notes = analytics_item.notes.strip()
        if not notes.startswith("{"):
            return {}, {}

        try:
            import json
            data = json.loads(notes)
            breakdown = data.get(f"{timeframe}d") or data.get(timeframe) or data.get("sku_breakdown", {})
            if not isinstance(breakdown, dict):
                return {}, {}

            nested = {}
            flat = {}
            for key, count in breakdown.items():
                parts = str(key).split("-")
                if len(parts) >= 3:
                    color = "-".join(parts[1:-1]).strip()
                    size = parts[-1].strip()
                else:
                    color = "Default"
                    size = str(key).strip()

                try:
                    sold_count = int(count)
                except (TypeError, ValueError):
                    sold_count = 0

                nested.setdefault(color, {})[size] = sold_count
                flat[f"{color.lower()}-{size.lower()}"] = sold_count

            return nested, flat
        except Exception as e:
            self.logger.warning(f"Variant sales parse failed for timeframe {timeframe}: {e}")
            return {}, {}

    def get_style_analytics(self, sku: str, timeframe: str = "7"):
        """
        Fetches analytics for a specific SKU and timeframe from main_kos.
        Parses the notes (JSON or Text) to build a sales breakdown.
        """
        query = self.db.query(models.MainKos).filter(models.MainKos.style == sku)
        
        # Match the timeframe
        rows = query.all()
        analytics_data = None
        for r in rows:
            if r.time_frame:
                tf_val = str(r.time_frame).lower().strip()
                if tf_val == timeframe or tf_val == f"{timeframe}d":
                    analytics_data = r
                    break
        
        # Fallback: SKU match if exact fails
        if not analytics_data:
            base_sku = sku.split('-')[0].split('~')[0].strip()
            rows = self.db.query(models.MainKos).filter(models.MainKos.style.like(f"{base_sku}%")).all()
            for r in rows:
                if r.time_frame:
                    tf_val = str(r.time_frame).lower().strip()
                    if tf_val == timeframe or tf_val == f"{timeframe}d":
                        analytics_data = r
                        break
                    
        if not analytics_data:
            return {
                "pageviews": "0",
                "sell_thru": "0",
                "most_sold_color": None,
                "most_sold_size": None,
                "sales_breakdown": {},
                "analytics_notes": f"No data found for {timeframe}D"
            }

        # Parsing the notes (Support both JSON and Legacy text format)
        notes = (analytics_data.notes or "").strip()
        total_sold = analytics_data.sell_thru or "0"
        sales_breakdown = {}
        
        # 1. JSON Parsing (Exclusive)
        if notes.startswith('{'):
            try:
                import json
                data = json.loads(notes)
                tf_key = f"{timeframe}d"
                breakdown = data.get(tf_key) or data.get(timeframe) or data.get("sku_breakdown", {})
                
                if isinstance(breakdown, dict):
                    for key, count in breakdown.items():
                        parts = key.split('-')
                        if len(parts) >= 3:
                            color = "-".join(parts[1:-1]).strip()
                            size = parts[-1].strip()
                            if color not in sales_breakdown: sales_breakdown[color] = {}
                            sales_breakdown[color][size] = int(count)
                        else:
                            if key not in sales_breakdown: sales_breakdown[key] = {}
                            sales_breakdown[key]["ANY"] = int(count)
                    
                    total_sold_calc = sum(breakdown.values())
                    if not total_sold or total_sold == "0" or total_sold == 0:
                        total_sold = total_sold_calc
                
                if "total_sold" in data:
                    total_sold = data["total_sold"]

                # Extract top color/size from breakdown if missing in DB or to override
                if isinstance(breakdown, dict) and breakdown:
                    # Calculate sums by color and size
                    c_sums = {}
                    s_sums = {}
                    for k, v in breakdown.items():
                        p = k.split('-')
                        if len(p) >= 3:
                            c = "-".join(p[1:-1]).strip()
                            s = p[-1].strip()
                            c_sums[c] = c_sums.get(c, 0) + v
                            s_sums[s] = s_sums.get(s, 0) + v
                    
                    if c_sums:
                        top_c = max(c_sums, key=c_sums.get)
                        analytics_data.most_sold_color = f"{top_c}({c_sums[top_c]})"
                    if s_sums:
                        top_s = max(s_sums, key=s_sums.get)
                        analytics_data.most_sold_size = f"{top_s}({s_sums[top_s]})"

                # Direct override from JSON if present
                if "top_color" in data:
                    analytics_data.most_sold_color = data["top_color"]
                if "top_size" in data:
                    analytics_data.most_sold_size = data["top_size"]

            except Exception as e:
                self.logger.warning(f"JSON parse failed for {sku}: {e}")

        return {
            "pageviews": f"{analytics_data.pageview:,}" if analytics_data.pageview else "0",
            "sell_thru": str(total_sold),
            "most_sold_color": analytics_data.most_sold_color,
            "most_sold_size": analytics_data.most_sold_size,
            "sales_breakdown": sales_breakdown,
            "analytics_notes": notes
        }

    # ------------------------------------------------------------------
    # Changed products (pending backup diffs)
    # ------------------------------------------------------------------
    def get_changed_products(self, page=1, limit=50, search=None, sort_by="newest"):
        """Return products where backup data differs from current values."""
        from sqlalchemy import or_

        def _diff_fields(row):
            """Build a diff dict for a dashboard row."""
            changes = {}
            pairs = [
                ("title", "local_title", "backup_title"),
                ("retail_price", "retail_price", "backup_retail_price"),
                ("wholesale_price", "wholesale_price", "backup_wholesale_price"),
                ("sizes", "sizes", "backup_sizes"),
                ("total_inventory", "total_inventory", "backup_total_inventory"),
            ]
            for field, current_col, backup_col in pairs:
                current = getattr(row, current_col, None)
                backup = getattr(row, backup_col, None)
                if backup is not None and current != backup:
                    changes[field] = {"before": backup, "after": current}
            return changes

        offset = (page - 1) * limit

        def _backup_exists_filter(model):
            return or_(
                model.backup_retail_price != getattr(model, "retail_price"),
                model.backup_wholesale_price != getattr(model, "wholesale_price"),
                model.backup_total_inventory != getattr(model, "total_inventory"),
                model.backup_sizes != getattr(model, "sizes"),
                model.backup_title != getattr(model, "local_title"),
            )

        # Determine sort order
        if sort_by == "oldest":
            order = models.InStockDashboard.backup_created_at.asc().nullslast()
            order_tdo = models.TheDressOutlet.backup_created_at.asc().nullslast()
        else:
            order = models.InStockDashboard.backup_created_at.desc().nullslast()
            order_tdo = models.TheDressOutlet.backup_created_at.desc().nullslast()

        # Query InStockDashboard where backup differs
        main_q = self.db.query(models.InStockDashboard).filter(
            _backup_exists_filter(models.InStockDashboard),
            models.InStockDashboard.backup_retail_price.isnot(None),
        )

        # Query TheDressOutlet where backup differs
        tdo_q = self.db.query(models.TheDressOutlet).filter(
            _backup_exists_filter(models.TheDressOutlet),
            models.TheDressOutlet.backup_retail_price.isnot(None),
        )

        # Apply search
        if search:
            st = f"%{search}%"
            search_filter = or_(
                models.InStockDashboard.style.ilike(st),
                models.InStockDashboard.vendor.ilike(st),
            )
            main_q = main_q.filter(search_filter)

            search_filter_tdo = or_(
                models.TheDressOutlet.style.ilike(st),
                models.TheDressOutlet.vendor.ilike(st),
            )
            tdo_q = tdo_q.filter(search_filter_tdo)

        main_count = main_q.count()
        tdo_count = tdo_q.count()
        total_count = main_count + tdo_count

        main_rows = main_q.order_by(order).offset(offset).limit(limit).all()
        tdo_rows = tdo_q.order_by(order_tdo).offset(offset).limit(limit).all()

        def _format_item(row, source_table):
            changes = _diff_fields(row)
            if not changes:
                return None
            ts = row.backup_created_at
            return {
                "style": row.style,
                "vendor": row.vendor,
                "source_table": source_table,
                "changes": changes,
                "total_inventory": row.total_inventory,
                "changes_made_at": ts.isoformat() if ts else None,
            }

        items = []
        for row in main_rows:
            item = _format_item(row, "in_stock_dashboard")
            if item:
                items.append(item)

        for row in tdo_rows:
            item = _format_item(row, "the_dress_outlet")
            if item:
                items.append(item)

        # Combined sort
        if sort_by == "newest":
            items.sort(key=lambda x: x.get("changes_made_at") or "", reverse=True)
        else:
            items.sort(key=lambda x: x.get("changes_made_at") or "")

        return {
            "items": items,
            "total_count": total_count,
            "page": page,
            "total_pages": max(1, (total_count + limit - 1) // limit),
        }

    # _parse_tags_categorized removed — use parse_tags_categorized() from app.utils.tag_utils instead.
