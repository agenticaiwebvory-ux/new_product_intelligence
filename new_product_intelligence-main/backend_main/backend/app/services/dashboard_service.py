import logging
import time
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from ..models import catalog as models
from ..config import STORE_CONFIGS
from .catalog_service import CatalogService
import hashlib
import re

class DashboardService:
    def __init__(self, db: Session):
        self.db = db
        self.catalog_service = CatalogService(db)
        self.logger = logging.getLogger("product-intelligence.dashboard")

    def get_aggregated_stats(self, vendor: str = None, search: str = None):
        """
        Uses the global STORE_CONFIGS to report system health.
        Simplified to debug loading issues.
        """
        health = {}
        try:
            creds = self.db.query(models.StoreCredential).all()
            for c in creds:
                health[c.store_name.upper()] = {
                    "status": "error" if c.last_error else "ok",
                    "url": c.shop_domain,
                    "error": c.last_error,
                    "last_checked": c.last_checked_at.isoformat() if hasattr(c.last_checked_at, 'isoformat') else c.last_checked_at
                }
        except Exception as e:
            self.logger.error(f"Health check failed: {e}")

        # 1. Main Dashboard Stats (Exclude TDO to prevent duplicates)
        main_query = self.db.query(models.InStockDashboard).outerjoin(
            models.Product, models.InStockDashboard.tdo_product_id == models.Product.product_id
        ).filter(
            models.InStockDashboard.vendor != "The Dress Outlet",
            or_(models.Product.tags == None, ~models.Product.tags.ilike("%discontinued%"))
        )
        
        if vendor and vendor != 'ALL' and vendor != 'TDO_MERCH':
            main_query = main_query.filter(models.InStockDashboard.vendor == vendor)
        
        if search:
            search_term = f"%{search}%"
            main_query = main_query.filter(
                or_(
                    models.InStockDashboard.style.ilike(search_term),
                    models.InStockDashboard.vendor.ilike(search_term),
                    models.InStockDashboard.local_title.ilike(search_term)
                )
            )
        main_count = main_query.count()
        main_inv = self.db.query(func.sum(models.InStockDashboard.total_inventory)).outerjoin(
            models.Product, models.InStockDashboard.tdo_product_id == models.Product.product_id
        ).filter(
            models.InStockDashboard.vendor != "The Dress Outlet",
            or_(models.Product.tags == None, ~models.Product.tags.ilike("%discontinued%"))
        )
        if vendor and vendor != 'ALL' and vendor != 'TDO_MERCH':
            main_inv = main_inv.filter(models.InStockDashboard.vendor == vendor)
        if search:
            search_term = f"%{search}%"
            main_inv = main_inv.filter(or_(models.InStockDashboard.style.ilike(search_term), models.InStockDashboard.vendor.ilike(search_term), models.InStockDashboard.local_title.ilike(search_term)))
        main_inv = main_inv.scalar() or 0
        main_oos = main_query.filter(models.InStockDashboard.total_inventory <= 0).count()

        # 2. The Dress Outlet Specific Table Stats (ONLY for vendor "The Dress Outlet")
        tdo_query = self.db.query(models.TheDressOutlet).outerjoin(
            models.Product, models.TheDressOutlet.tdo_product_id == models.Product.product_id
        ).filter(
            models.TheDressOutlet.vendor == "The Dress Outlet",
            or_(models.Product.tags == None, ~models.Product.tags.ilike("%discontinued%"))
        )

        if vendor and vendor != 'ALL' and vendor != 'TDO_MERCH':
            # TDO table only has vendor "The Dress Outlet", so if another vendor is selected, this becomes empty
            if vendor != "The Dress Outlet":
                tdo_query = tdo_query.filter(models.TheDressOutlet.id == -1) 
        
        if search:
            search_term = f"%{search}%"
            tdo_query = tdo_query.filter(
                or_(
                    models.TheDressOutlet.style.ilike(search_term),
                    models.TheDressOutlet.vendor.ilike(search_term),
                    models.TheDressOutlet.local_title.ilike(search_term)
                )
            )
        tdo_count = tdo_query.count()
        
        tdo_inv_query = self.db.query(func.sum(models.TheDressOutlet.total_inventory)).outerjoin(
            models.Product, models.TheDressOutlet.tdo_product_id == models.Product.product_id
        ).filter(
            models.TheDressOutlet.vendor == "The Dress Outlet",
            or_(models.Product.tags == None, ~models.Product.tags.ilike("%discontinued%"))
        )
        if vendor and vendor != 'ALL' and vendor != 'TDO_MERCH' and vendor != "The Dress Outlet":
            tdo_inv_query = tdo_inv_query.filter(models.TheDressOutlet.id == -1)
        if search:
            search_term = f"%{search}%"
            tdo_inv_query = tdo_inv_query.filter(or_(models.TheDressOutlet.style.ilike(search_term), models.TheDressOutlet.vendor.ilike(search_term), models.TheDressOutlet.local_title.ilike(search_term)))
        tdo_inv = tdo_inv_query.scalar() or 0
        tdo_oos = tdo_query.filter(models.TheDressOutlet.total_inventory <= 0).count()

        # 3. Combine Stats
        total_count = main_count + tdo_count
        total_inv = main_inv + tdo_inv
        total_oos = main_oos + tdo_oos

        # 4. Calculate Missing Links (Where product_id is NULL, 0, or empty)
        # Main Dashboard Missing
        main_tdo_miss = main_query.filter(or_(models.InStockDashboard.tdo_product_id == None, models.InStockDashboard.tdo_product_id == 0, models.InStockDashboard.tdo_product_id == "")).count()
        main_wdo_miss = main_query.filter(or_(models.InStockDashboard.wdo_product_id == None, models.InStockDashboard.wdo_product_id == 0, models.InStockDashboard.wdo_product_id == "")).count()
        main_kos_miss = main_query.filter(or_(models.InStockDashboard.kos_product_id == None, models.InStockDashboard.kos_product_id == 0, models.InStockDashboard.kos_product_id == "")).count()
        main_im_miss = main_query.filter(or_(models.InStockDashboard.im_product_id == None, models.InStockDashboard.im_product_id == 0, models.InStockDashboard.im_product_id == "")).count()

        # TDO Table Missing
        tdo_tdo_miss = tdo_query.filter(or_(models.TheDressOutlet.tdo_product_id == None, models.TheDressOutlet.tdo_product_id == 0, models.TheDressOutlet.tdo_product_id == "")).count()
        tdo_wdo_miss = tdo_query.filter(or_(models.TheDressOutlet.wdo_product_id == None, models.TheDressOutlet.wdo_product_id == 0, models.TheDressOutlet.wdo_product_id == "")).count()
        tdo_kos_miss = tdo_query.filter(or_(models.TheDressOutlet.kos_product_id == None, models.TheDressOutlet.kos_product_id == 0, models.TheDressOutlet.kos_product_id == "")).count()
        tdo_im_miss = tdo_query.filter(or_(models.TheDressOutlet.im_product_id == None, models.TheDressOutlet.im_product_id == 0, models.TheDressOutlet.im_product_id == "")).count()

        return {
            "total_styles": total_count,
            "total_inventory": total_inv,
            "out_of_stock": total_oos,
            "tdo_missing": main_tdo_miss + tdo_tdo_miss,
            "wdo_missing": main_wdo_miss + tdo_wdo_miss,
            "kos_missing": main_kos_miss + tdo_kos_miss,
            "im_missing": main_im_miss + tdo_im_miss,
            "store_health": health,
            "vendors": self.get_designers_with_counts()
        }

    def get_designers_with_counts(self):
        vendors_dict = {}
        
        # 1. Get all vendors from Main Dashboard (All brands EXCEPT TDO)
        counts = self.db.query(
            models.InStockDashboard.vendor, 
            func.count(models.InStockDashboard.id)
        ).filter(models.InStockDashboard.vendor != "The Dress Outlet").group_by(models.InStockDashboard.vendor).all()
        
        for name, count in counts:
            if name and name.strip():
                vendors_dict[name] = count

        # 2. Add ONLY 'The Dress Outlet' from the dedicated table
        tdo_count = self.db.query(models.TheDressOutlet).filter(models.TheDressOutlet.vendor == "The Dress Outlet").count()
        if tdo_count > 0:
            vendors_dict["The Dress Outlet"] = tdo_count
        
        # 3. Format for UI
        results = []
        for name, count in sorted(vendors_dict.items()):
            results.append({"id": name, "name": name, "style_count": count})
            
        return results

    def get_unified_products(self, vendor=None, page=1, limit=50, search=None):
        start_time = time.time()
        self.logger.info(f"Fetching unified products (Page: {page}, Limit: {limit}, Search: {search}) for vendor: {vendor}")
        # 1. Fetch data via CatalogService (Source of Truth: in_stock_dashboard)
        unified_data, master_product_map, image_map, stores, total_count = self.catalog_service.get_master_catalog(vendor, page, limit, search)
        self.logger.info(f"Catalog fetched: {len(unified_data)} rows in {time.time() - start_time:.2f}s")



        # 2. BULK FETCH INVENTORY BY PRODUCT ID (Single Store Source of Truth)
        # Determine the correct product_id column based on the selected vendor
        id_column = 'tdo_product_id'
        if vendor:
            v_lower = vendor.lower()
            if 'im' in v_lower: id_column = 'im_product_id'
            elif 'wdo' in v_lower: id_column = 'wdo_product_id'
            elif 'kos' in v_lower: id_column = 'kos_product_id'
        
        target_pids = []
        for row in unified_data:
            pid = getattr(row, id_column, None)
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
                
                store_data[s.upper()] = {
                    "linked": pid is not None, 
                    "price": master_price,
                    "inventory": getattr(row, 'total_inventory', 0),
                    "status": getattr(row, f"{s.lower()}_status", "DRAFT"),
                    "title": "",
                    "description": ""
                }
                
                if pid and pid in master_product_map:
                    p_obj = master_product_map[pid]
                    store_data[s.upper()]["price"] = p_obj.price
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
            
            # Final Content Preparation (Prioritize TDO, then fallback to others for 'Live' baseline)
            primary_store = "TDO" if store_data.get("TDO", {}).get("linked") else next((s for s in ["WDO", "KOS", "IM"] if store_data.get(s, {}).get("linked")), "TDO")
            
            live_title = store_data.get(primary_store, {}).get("title")
            live_desc = store_data.get(primary_store, {}).get("description")
            live_price = store_data.get(primary_store, {}).get("price")
            live_tdo_inv = store_data.get("TDO", {}).get("inventory", 0)

            # Fallback for price from product_variants table if live_price is empty
            if not live_price and all_variants:
                variant_prices = [v.price for v in all_variants if v.price]
                if variant_prices:
                    live_price = variant_prices[0]

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
                "sop_flags": sop_flags,
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
                "im_status": getattr(row, 'im_status', 'DRAFT'),
                "im_admin_link": getattr(row, 'im_admin_link', None),
                "tags_categorized": self._parse_tags_categorized(live_tags),
                "notes": getattr(row, 'notes', ""),
                "admin_links": {s.lower(): getattr(row, f"{s.lower()}_admin_link", None) for s in stores},
                "pageviews": analytics_data.pageview if analytics_data else 0,
                "pageviews_details": pv_details,
                "sell_thru": sell_thru_val,
                "sell_thru_details": st_details,
                "most_sold_color": analytics_data.most_sold_color if analytics_data else None,
                "most_sold_size": analytics_data.most_sold_size if analytics_data else None,
                "analytics_notes": self._humanize_notes(analytics_data.notes) if analytics_data else ""
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

    def _parse_tags_categorized(self, tags_str: str) -> dict:
        """
        Parses a flat Shopify tag string into 3 tiers.
        """
        # Note: In a production environment, these should be imported from a shared config
        TOP_TAG_PREFIX = "top:"
        BESTSELLER_TAG_PREFIX = "best:"
        SPECIAL_TAGS = ["No PROM", "No Formal", "Discontinued", "Push PROM"]
        
        result = {"top": [], "bestseller": [], "special": []}
        if not tags_str:
            return result
        for raw in tags_str.split(","):
            tag = raw.strip()
            if not tag:
                continue
            tag_lower = tag.lower()
            if any(s.lower() == tag_lower for s in SPECIAL_TAGS):
                result["special"].append(tag)
            elif tag_lower.startswith(TOP_TAG_PREFIX.lower()):
                result["top"].append(tag[len(TOP_TAG_PREFIX):].strip())
            elif tag_lower.startswith(BESTSELLER_TAG_PREFIX.lower()):
                result["bestseller"].append(tag[len(BESTSELLER_TAG_PREFIX):].strip())
        return result
