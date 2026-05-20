import logging
import time
import re

from sqlalchemy.orm import Session
from ..models.catalog import Inventory, InStockDashboard, Product
from ..integrations.shopify.client import ShopifyClient
from ..config import STORE_CONFIGS

logger = logging.getLogger(__name__)

class InventoryTool:
    def __init__(self, db: Session):
        self.db = db
        self.logger = logger

    async def update_product_batch(self, dashboard_id: int = None, sku: str = None, sizes_map: dict = None, price: float = None, compare_at_price: float = None, stores: list = ["TDO", "WDO", "KOS", "IM"], merge: bool = True):
        """
        Unified Batch Update for both Price and Inventory using Product ID.
        This is significantly faster (seconds vs minutes) and more reliable than SKU matching.
        """
        self.logger.info(f"update_product_batch started for {sku or dashboard_id}, stores: {stores}")
        # Find ALL matching rows to ensure full sync between InStockDashboard and TheDressOutlet
        from ..models.catalog import TheDressOutlet
        dashboard_row = self.db.query(InStockDashboard).filter(InStockDashboard.style == (sku or "")).first()
        source_row = self.db.query(TheDressOutlet).filter(TheDressOutlet.style == (sku or "")).first()
        
        if dashboard_id is not None:
            if not dashboard_row: dashboard_row = self.db.query(InStockDashboard).get(dashboard_id)
            if not source_row: source_row = self.db.query(TheDressOutlet).get(dashboard_id)

        target_rows = [r for r in [dashboard_row, source_row] if r]
        if not target_rows:
            self.logger.error("No target rows found for batch update")
            return
        
        # Primary row for metadata lookup
        target_row = target_rows[0]

        # 0. INITIAL SNAPSHOT (If no backup exists yet and this is not a revert/push)
        if hasattr(target_row, 'backup_sizes') and target_row.backup_sizes is None:
            target_row.backup_sizes = target_row.sizes
            target_row.backup_total_inventory = target_row.total_inventory
            self.db.commit()

        # 1. Update LOCAL Database tables (Immediate UI feedback)
        for row in target_rows:
            if sizes_map:
                if merge:
                    def parse_sizes(s_str):
                        if not s_str: return {}
                        res = {}
                        for p in s_str.split(','):
                            m = re.search(r'(.+)\((\d+)\)', p.strip())
                            if m: res[m.group(1)] = int(m.group(2))
                        return res
                    current_sizes = parse_sizes(row.sizes)
                    for s_name, s_qty in sizes_map.items():
                        current_sizes[str(s_name)] = int(s_qty)
                else:
                    current_sizes = {str(k): int(v) for k, v in sizes_map.items()}
                
                size_parts = [f"{s}({q})" for s, q in current_sizes.items()]
                row.sizes = ", ".join(size_parts)
                row.total_inventory = sum(current_sizes.values())
                effective_sizes = current_sizes # For Shopify push
            else:
                effective_sizes = None
            
            if price is not None:
                row.retail_price = float(price)
                if row.tdo_product_id:
                    cache = self.db.query(Product).get(row.tdo_product_id)
                    if cache:
                        cache.price = float(price)
            
        self.db.commit()

        # 2. SHOPIFY BATCH PUSH
        for store_key in stores:
            try:
                store_config = STORE_CONFIGS.get(store_key.lower())
                if not store_config: continue

                pid = getattr(target_row, f"{store_key.lower()}_product_id")
                if not pid: continue

                client = ShopifyClient(store_config)
                is_valid, _, _ = await client.validate_connection(log_to_db=False)
                if not is_valid: continue

                # A. Fetch Variant Metadata (IDs and InventoryItem IDs)
                # OPTIMIZATION: Always fetch fresh from Shopify if we are doing a push/revert
                # to ensure we have the absolute latest GIDs even if local cache is stale/empty.
                shopify_pid = f"gid://shopify/Product/{pid}"
                query = """query($id: ID!) { product(id: $id) { variants(first: 100) { edges { node { id sku inventoryItem { id } selectedOptions { name value } } } } } }"""
                v_data = await client.graphql_query(query, {"id": shopify_pid})
                
                product_node = v_data.get("product")
                if not product_node:
                    self.logger.warning(f"Product {pid} not found on {store_key}")
                    continue
                    
                variants = product_node.get("variants", {}).get("edges", [])
                if not variants: continue

                # B. Build Bulk Update Inputs
                variant_updates = []
                inventory_updates = []
                loc_id = store_config.get('location_id')
                if not loc_id:
                    loc_data = await client.graphql_query("{ locations(first: 1) { edges { node { id } } } }")
                    loc_node = loc_data.get("locations", {}).get("edges", [])
                    if loc_node: loc_id = loc_node[0]["node"]["id"]

                for v_edge in variants:
                    v_node = v_edge["node"]
                    v_id = v_node["id"]
                    v_sku = v_node.get("sku")
                    v_inv_id = v_node["inventoryItem"]["id"]
                    
                    # Extract Size
                    v_size = "Default"
                    for opt in v_node["selectedOptions"]:
                        if opt["name"].lower() in ["size", "option2"]: v_size = opt["value"]

                    update_payload = {"id": v_id}
                    has_update = False

                    # Match Price
                    if price is not None:
                        # Logic: WDO uses wholesale_price, others use retail_price
                        target_price = price
                        if store_key.upper() == "WDO" and hasattr(target_row, 'wholesale_price'):
                            target_price = target_row.wholesale_price
                        update_payload["price"] = str(target_price)
                        if compare_at_price: update_payload["compareAtPrice"] = str(compare_at_price)
                        has_update = True

                    if has_update: variant_updates.append(update_payload)

                    # Match Inventory
                    if effective_sizes:
                        # Match by size name or full SKU
                        target_qty = effective_sizes.get(v_size)
                        if target_qty is None:
                            # Try SKU matching if size name fails
                            for s, q in effective_sizes.items():
                                if v_sku and (f"-{s}" in v_sku or f" {s}" in v_sku):
                                    target_qty = q; break
                        
                        if target_qty is not None:
                            inventory_updates.append({
                                "inventoryItemId": v_inv_id,
                                "locationId": loc_id if "gid://" in str(loc_id) else f"gid://shopify/Location/{loc_id}",
                                "quantity": int(target_qty)
                            })

                # C. Execute Price Batch Update
                if variant_updates:
                    p_res = await client.graphql_query(
                        "mutation pv($id: ID!, $v: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $id, variants: $v) { userErrors { message } } }",
                        {"id": shopify_pid, "v": variant_updates}
                    )
                    if p_res.get("productVariantsBulkUpdate", {}).get("userErrors"):
                        self.logger.error(f"Price Batch Error for {store_key}: {p_res['productVariantsBulkUpdate']['userErrors']}")

                # D. Execute Inventory Batch Update
                if inventory_updates:
                    i_res = await client.graphql_query(
                        """mutation invSet($input: InventorySetQuantitiesInput!) { 
                            inventorySetQuantities(input: $input) { inventoryLevels { quantity } userErrors { message } } 
                        }""",
                        {"input": {
                            "name": "available",
                            "reason": "correction",
                            "ignoreCompareQuantity": True,
                            "quantities": inventory_updates
                        }}
                    )
                    if i_res.get("inventorySetQuantities", {}).get("userErrors"):
                        self.logger.error(f"Inventory Batch Error for {store_key}: {i_res['inventorySetQuantities']['userErrors']}")

                # E. Update Local Inventory Cache (ONLY if this was a live sync)
                if stores and len(stores) > 0:
                    from ..models.catalog import Inventory
                    if price is not None:
                        self.db.query(Inventory).filter(Inventory.product_id == pid).update({"price": float(price)})
                    if sizes_map:
                        for s, q in sizes_map.items():
                            self.db.query(Inventory).filter(Inventory.product_id == pid, Inventory.size == s).update({"inventory": int(q)})
                
                    self.db.commit()
                    self.logger.info(f"Successfully synced batch for {store_key}")

            except Exception as e:
                self.logger.error(f"Batch sync failed for {store_key}: {str(e)}")

        self.db.commit()
        return True

    async def update_stock(self, dashboard_id: int = None, sizes: dict = None, is_absolute: bool = True, stores: list = ["TDO"], sku: str = None):
        """Legacy method redirected to batch for speed."""
        return await self.update_product_batch(dashboard_id=dashboard_id, sku=sku, sizes_map=sizes, stores=stores)
