import logging
import time
import re
from datetime import datetime

from sqlalchemy.orm import Session
from ..models.catalog import Product, InStockDashboard
from ..integrations.shopify.client import ShopifyClient
from ..config import settings, STORE_CONFIGS, TDO_VENDOR_NAME
from ..core.exceptions import ProductNotFoundError, AppBaseException, DatabaseError

logger = logging.getLogger(__name__)

class ProductTool:
    def __init__(self, db: Session):
        self.db = db

    async def update_content(self, dashboard_id: int = None, title: str = None, description: str = None, meta_title: str = None, meta_description: str = None, retail_price: float = None, wholesale_price: float = None, notes: str = None, vendor: str = None, color: str = None, stores: list = ["TDO", "WDO", "KOS", "IM"], local_only: bool = False, create_backup: bool = True, skip_content: bool = False, sku: str = None, is_tdo_table: bool = False):
        start_time = time.time()
        logger.info(f"update_content started for sku: {sku or dashboard_id}")
        # 0. FIND THE ROW (Smart Routing)
        dashboard_row = None
        source_row = None
        
        if sku:
            # Look for BOTH dashboard and source rows to ensure full sync
            dashboard_row = self.db.query(InStockDashboard).filter(InStockDashboard.style == sku).first()
            from ..models.catalog import TheDressOutlet
            source_row = self.db.query(TheDressOutlet).filter(TheDressOutlet.style == sku).first()
        elif dashboard_id is not None:
            if is_tdo_table:
                from ..models.catalog import TheDressOutlet
                source_row = self.db.query(TheDressOutlet).get(dashboard_id)
            else:
                dashboard_row = self.db.query(InStockDashboard).get(dashboard_id)
        
        # If the vendor is TDO_VENDOR_NAME, also find and update the source table
        if dashboard_row and dashboard_row.vendor == TDO_VENDOR_NAME and not source_row:
            from ..models.catalog import TheDressOutlet
            source_row = self.db.query(TheDressOutlet).filter(TheDressOutlet.style == dashboard_row.style).first()
        elif source_row and not dashboard_row:
            # Maybe there is a dashboard row we missed
            dashboard_row = self.db.query(InStockDashboard).filter(InStockDashboard.style == source_row.style).first()
        
        if not dashboard_row and not source_row:
            raise ProductNotFoundError(sku or str(dashboard_id))
        
        # Primary row to update for sync logic
        target_row = dashboard_row or source_row
        
        # 0. INITIAL SNAPSHOT (If no backup exists yet)
        if target_row.backup_title is None:
            # Capture what's currently in our 'Product' table (live cache)
            # Find the linked TDO product
            tdo_pid = target_row.tdo_product_id
            if tdo_pid:
                tdo_live = self.db.query(Product).get(tdo_pid)
                if tdo_live:
                    target_row.backup_title = tdo_live.title or ""
                    target_row.backup_description = tdo_live.body_html or ""
                    target_row.backup_retail_price = tdo_live.price
                    target_row.backup_meta_title = tdo_live.seo_title or ""
                    target_row.backup_meta_description = tdo_live.seo_description or ""
                    target_row.backup_total_inventory = target_row.total_inventory
                    target_row.backup_sizes = target_row.sizes if target_row.sizes is not None else ""
                    target_row.backup_created_at = datetime.utcnow()
            else:
                # If not linked, lock it with empty values to avoid constant attempts
                target_row.backup_title = target_row.local_title or ""
            
            # WDO for wholesale price backup
            wdo_pid = target_row.wdo_product_id
            if wdo_pid:
                wdo_live = self.db.query(Product).get(wdo_pid)
                if wdo_live:
                    target_row.backup_wholesale_price = wdo_live.price
                    if target_row.backup_meta_title is None:
                        target_row.backup_meta_title = target_row.local_meta_title or wdo_live.seo_title or ""
                    if target_row.backup_description is None:
                        target_row.backup_description = target_row.local_description or wdo_live.body_html or ""

        results = {}
        success_count = 0
        total_requested = len(stores)

        # 1. Update LOCAL MASTER (Staging/Draft)
        # We update BOTH rows to ensure consistency between the unified view and the direct source table.
        for row in [dashboard_row, source_row]:
            if not row: continue
            
            if retail_price is not None: row.retail_price = float(retail_price)
            if wholesale_price is not None: row.wholesale_price = float(wholesale_price)
            if vendor is not None: row.vendor = vendor
            
            if title:
                new_title = title.get("TDO") if isinstance(title, dict) else title
                if new_title: row.local_title = new_title
            if description:
                new_desc = description.get("TDO") if isinstance(description, dict) else description
                if new_desc: row.local_description = new_desc
            
            if meta_title:
                new_mt = meta_title.get("TDO") if isinstance(meta_title, dict) else meta_title
                if new_mt: row.local_meta_title = new_mt
            
            if meta_description:
                new_md = meta_description.get("TDO") if isinstance(meta_description, dict) else meta_description
                if new_md: row.local_meta_description = new_md
            
            if notes is not None:
                row.notes = notes
            
        self.db.commit()

        if local_only:
            # Sync staged price to Product cache so get_unified_products returns correct store_prices
            if retail_price is not None or wholesale_price is not None:
                for row in [dashboard_row, source_row]:
                    if not row: continue
                    if retail_price is not None and row.tdo_product_id:
                        tdo_cache = self.db.query(Product).get(row.tdo_product_id)
                        if tdo_cache:
                            tdo_cache.price = float(retail_price)
                    if wholesale_price is not None and row.wdo_product_id:
                        wdo_cache = self.db.query(Product).get(row.wdo_product_id)
                        if wdo_cache:
                            wdo_cache.price = float(wholesale_price)
                self.db.commit()

            # Create backup for local-only edits so they appear on ChangesPage
            if create_backup:
                tdo_pid = target_row.tdo_product_id
                if tdo_pid:
                    tdo_live = self.db.query(Product).get(tdo_pid)
                    if tdo_live and target_row.backup_retail_price is None:
                        target_row.backup_retail_price = tdo_live.price
                wdo_pid = target_row.wdo_product_id
                if wdo_pid:
                    wdo_live = self.db.query(Product).get(wdo_pid)
                    if wdo_live and target_row.backup_wholesale_price is None:
                        target_row.backup_wholesale_price = wdo_live.price
                target_row.backup_created_at = datetime.utcnow()
                self.db.commit()

            return {
                "status": "success",
                "message": "Saved to local drafts. Sync required to Shopify.",
                "details": {s: "Draft Saved" for s in stores}
            }

        # 2. SNAPSHOT CURRENT LIVE STATE (For Undo/Revert)
        if create_backup:
            # We save what is currently in the Product/Live Cache tables as a backup
            try:
                tdo_pid = target_row.tdo_product_id
                if tdo_pid:
                    tdo_live = self.db.query(Product).get(tdo_pid)
                    if tdo_live:
                        target_row.backup_title = tdo_live.title
                        target_row.backup_description = tdo_live.body_html
                        target_row.backup_retail_price = tdo_live.price
                        # Note: We only backup sizes if no backup exists yet to avoid overwriting original with staged
                        if target_row.backup_sizes is None:
                            target_row.backup_total_inventory = target_row.total_inventory
                            target_row.backup_sizes = target_row.sizes
                    target_row.backup_created_at = datetime.utcnow()
                
                # WDO Backup for wholesale price
                wdo_pid = target_row.wdo_product_id
                if wdo_pid:
                    wdo_live = self.db.query(Product).get(wdo_pid)
                    if wdo_live:
                        target_row.backup_wholesale_price = wdo_live.price
                        if target_row.backup_meta_title is None:
                            target_row.backup_meta_title = wdo_live.seo_title or ""
                        if target_row.backup_meta_description is None:
                            target_row.backup_meta_description = wdo_live.seo_description or ""
                
                # Also capture TDO specific SEO for backup
                if tdo_pid:
                    tdo_live = self.db.query(Product).get(tdo_pid)
                    if tdo_live:
                        if target_row.backup_meta_title is None:
                            target_row.backup_meta_title = tdo_live.seo_title or ""
                        if target_row.backup_meta_description is None:
                            target_row.backup_meta_description = tdo_live.seo_description or ""
                
                self.db.commit()
            except Exception as e:
                logger.error(f"Backup snapshot failed: {e}")
                self.db.rollback()
                raise DatabaseError(f"Could not create backup: {e}")
        # 3. Update LIVE (Shopify + Live Cache)
        for store_key in stores:
            try:
                store_config = STORE_CONFIGS.get(store_key.lower())
                if not store_config:
                    results[store_key] = "Config Missing"
                    continue

                pid = getattr(target_row, f"{store_key.lower()}_product_id")
                if not pid:
                    results[store_key] = "Not Linked"
                    continue

                # Store-specific Content Overrides
                store_title = title.get(store_key) if isinstance(title, dict) else title
                store_description = description.get(store_key) if isinstance(description, dict) else description
                
                # If no specific fix was provided for this store, use the draft (unless skip_content is True)
                if not skip_content:
                    if not store_title: store_title = target_row.local_title
                    if not store_description: store_description = target_row.local_description
                    if not meta_title: meta_title = target_row.local_meta_title
                    if not meta_description: meta_description = target_row.local_meta_description

                # DETERMINISTIC PRICE LOGIC
                target_price = retail_price if store_key.upper() == "TDO" else wholesale_price

                # A. Shopify Sync
                client = ShopifyClient(store_config)
                # DISABLE log_to_db during push to avoid SQLite write contention
                is_valid, err_code, err_msg = await client.validate_connection(log_to_db=False)
                if not is_valid:
                    results[store_key] = f"Connection Failed: {err_msg}"
                    continue

                shopify_pid = f"gid://shopify/Product/{pid}"
                content_input = {"id": shopify_pid}
                
                # Core Shopify Content Fields: Title & Description
                if store_title: content_input["title"] = store_title
                if store_description: content_input["descriptionHtml"] = store_description
                
                # Core Shopify Content Fields: SEO Meta Data (Title & Description)
                if meta_title or meta_description:
                    content_input["seo"] = {}
                    if meta_title: content_input["seo"]["title"] = meta_title
                    if meta_description: content_input["seo"]["description"] = meta_description

                sync_success = True
                if len(content_input) > 1:
                    c_res = await client.graphql_query(
                        "mutation p($i: ProductInput!) { productUpdate(input: $i) { userErrors { message } } }", 
                        {"i": content_input}
                    )
                    if c_res.get("productUpdate", {}).get("userErrors"):
                        results[store_key] = f"Shopify Error: {c_res['productUpdate']['userErrors'][0]['message']}"
                        sync_success = False

                # Dynamic Price Sync
                if sync_success and target_price is not None:
                    # (Price sync logic...)
                    v_data = await client.graphql_query(
                        "query($id: ID!) { product(id: $id) { variants(first: 100) { edges { node { id } } } } }", 
                        {"id": shopify_pid}
                    )
                    variants = v_data.get("product", {}).get("variants", {}).get("edges", [])
                    if variants:
                        price_updates = [{"id": v["node"]["id"], "price": str(target_price)} for v in variants]
                        p_res = await client.graphql_query(
                            "mutation pv($id: ID!, $v: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $id, variants: $v) { userErrors { message } } }", 
                            {"id": shopify_pid, "v": price_updates}
                        )
                        if p_res.get("productVariantsBulkUpdate", {}).get("userErrors"):
                            results[store_key] = f"Price Sync Error: {p_res['productVariantsBulkUpdate']['userErrors'][0]['message']}"
                            sync_success = False

                # B. Update Live Cache (The 'Product' table) only on successful sync
                if sync_success:
                    product_cache = self.db.query(Product).get(pid)
                    if product_cache:
                        if store_title: product_cache.title = store_title
                        if store_description: product_cache.body_html = store_description
                        if meta_title: product_cache.seo_title = meta_title
                        if meta_description: product_cache.seo_description = meta_description
                        if target_price: product_cache.price = float(target_price)
                        # Sync inventory cache so UI is consistent
                        product_cache.total_inventory = target_row.total_inventory
                    
                    from app.models.catalog import Inventory
                    # 1. Update Price in Cache
                    if target_price:
                        self.db.query(Inventory).filter(Inventory.product_id == pid).update({"price": float(target_price)})
                    
                    # 2. Update Quantities in Cache (Sizes)
                    if target_row.sizes:
                        # Parse "2(10), 4(5)" -> dict
                        size_parts = target_row.sizes.split(',')
                        for part in size_parts:
                            match = re.search(r'(.+)\((\d+)\)', part.strip())
                            if match:
                                s_name, s_qty = match.groups()
                                self.db.query(Inventory).filter(
                                    Inventory.product_id == pid,
                                    Inventory.size == s_name.strip()
                                ).update({"inventory": int(s_qty)})
                
                # FINAL SYNC SUCCESS MARKER
                if sync_success:
                    self.db.commit()
                    results[store_key] = "Success"
                    success_count += 1

            except Exception as e:
                results[store_key] = f"Error: {str(e)}"
        
        # Final status calculation: Count both "Success" (data pushed) and "Skipped" (content was same/skipped)
        success_count = sum(1 for r in results.values() if r in ["Success", "Skipped"])
        is_all_success = success_count == total_requested
        
        logger.info(f"update_content finished in {time.time() - start_time:.2f}s with results: {results}")
        return {
            "status": "success" if is_all_success else "partial_success" if success_count > 0 else "failed",
            "message": "Sync completed successfully" if is_all_success else f"Sync completed with {success_count}/{total_requested} stores successful",
            "summary": f"{success_count}/{total_requested} stores synced",
            "details": results
        }

    async def revert_to_backup(self, dashboard_id: int = None, stores: list = ["TDO", "WDO", "KOS", "IM"], sku: str = None, revert_type: str = "all"):
        """
        revert_type can be: 'all', 'content', 'price', 'inventory'
        """
        start_time = time.time()
        logger.info(f"revert_to_backup ({revert_type}) started for sku: {sku or dashboard_id}")
        
        # 1. FIND THE ROW
        target_row = None
        if sku:
            target_row = self.db.query(InStockDashboard).filter(InStockDashboard.style == sku).first()
            if not target_row:
                from ..models.catalog import TheDressOutlet
                target_row = self.db.query(TheDressOutlet).filter(TheDressOutlet.style == sku).first()
        elif dashboard_id is not None:
            target_row = self.db.query(InStockDashboard).get(dashboard_id)
            if not target_row:
                from ..models.catalog import TheDressOutlet
                target_row = self.db.query(TheDressOutlet).get(dashboard_id)
            
        if not target_row:
            raise ProductNotFoundError(sku or str(dashboard_id))

        # 2. VALIDATE BACKUP DATA
        if target_row.backup_sizes is None and target_row.backup_retail_price is None:
            raise AppBaseException("No backup data found to revert to.", 400)

        # 3. RESTORE LOCAL DRAFTS (Immediate DB update)
        if revert_type in ["all", "content"]:
            if target_row.backup_title: target_row.local_title = target_row.backup_title
            if target_row.backup_description: target_row.local_description = target_row.backup_description
        
        if revert_type in ["all", "price"]:
            if target_row.backup_retail_price: target_row.retail_price = target_row.backup_retail_price
            if target_row.backup_wholesale_price: target_row.wholesale_price = target_row.backup_wholesale_price
        
        # Parse backup sizes "2(10), 14(5)" -> dict
        size_map = {}
        if revert_type in ["all", "inventory"]:
            if target_row.backup_sizes:
                parts = [p.strip() for p in target_row.backup_sizes.split(",")]
                for p in parts:
                    match = re.search(r'(.+)\((\d+)\)', p)
                    if match: size_map[match.group(1)] = int(match.group(2))
        
        self.db.commit()

        # 4. PERFORM UNIFIED BATCH SYNC TO SHOPIFY
        from .inventory_tool import InventoryTool
        inv_tool = InventoryTool(self.db)
        
        # Sync content (Title/Desc) via update_content but SKIP stock/price as we do it in batch
        if revert_type in ["all", "content"]:
            await self.update_content(
                sku=sku, dashboard_id=dashboard_id,
                title=target_row.local_title,
                description=target_row.local_description,
                meta_title=target_row.local_meta_title,
                meta_description=target_row.local_meta_description,
                stores=stores,
                local_only=False,
                create_backup=False,
                skip_content=False # Restore title/desc too
            )

        # High-speed Price & Inventory Batch Update
        if revert_type in ["all", "price", "inventory"]:
            await inv_tool.update_product_batch(
                sku=sku, dashboard_id=dashboard_id,
                sizes_map=size_map if (revert_type in ["all", "inventory"] and size_map) else None,
                price=target_row.retail_price if revert_type in ["all", "price"] else None,
                stores=stores,
                merge=False # Important: Replace instead of Merge for Reverts
            )

        # 5. CLEANUP BACKUP FIELDS (only if fully reverted)
        if revert_type == "all":
            target_row.backup_title = None
            target_row.backup_description = None
            target_row.backup_meta_title = None
            target_row.backup_meta_description = None
            target_row.backup_retail_price = None
            target_row.backup_wholesale_price = None
            target_row.backup_total_inventory = None
            target_row.backup_sizes = None
            target_row.backup_created_at = None
        elif revert_type == "price":
            target_row.backup_retail_price = None
            target_row.backup_wholesale_price = None
            target_row.backup_created_at = None
        elif revert_type == "inventory":
            target_row.backup_total_inventory = None
            target_row.backup_sizes = None
            target_row.backup_created_at = None
        elif revert_type == "content":
            target_row.backup_title = None
            target_row.backup_description = None
            target_row.backup_created_at = None

        self.db.commit()

        logger.info(f"revert_to_backup finished in {time.time() - start_time:.2f}s")
        return {"status": "success", "message": "Revert successful (Batch)"}

    async def clear_backup(self, sku: str):
        """Nullify all backup fields for a product without reverting."""
        target = self.db.query(InStockDashboard).filter(InStockDashboard.style == sku).first()
        if not target:
            from ..models.catalog import TheDressOutlet
            target = self.db.query(TheDressOutlet).filter(TheDressOutlet.style == sku).first()
        if not target:
            raise ProductNotFoundError(sku)
        for col in ('backup_title', 'backup_description', 'backup_meta_title',
                    'backup_meta_description', 'backup_retail_price',
                    'backup_wholesale_price', 'backup_total_inventory',
                    'backup_sizes', 'backup_created_at'):
            setattr(target, col, None)
        self.db.commit()
        return {"status": "success", "message": f"Backup cleared for {sku}"}

    async def clear_all_backups(self):
        """Nullify all backup fields across both tables."""
        from ..models.catalog import TheDressOutlet
        backup_cols = ['backup_title', 'backup_description', 'backup_meta_title',
                       'backup_meta_description', 'backup_retail_price',
                       'backup_wholesale_price', 'backup_total_inventory',
                       'backup_sizes', 'backup_created_at']
        updates = {c: None for c in backup_cols}
        main_count = self.db.query(InStockDashboard).filter(
            InStockDashboard.backup_retail_price.isnot(None)
        ).update(updates, synchronize_session=False)
        tdo_count = self.db.query(TheDressOutlet).filter(
            TheDressOutlet.backup_retail_price.isnot(None)
        ).update(updates, synchronize_session=False)
        self.db.commit()
        return {"status": "success", "message": f"Cleared backups for {main_count + tdo_count} products"}
