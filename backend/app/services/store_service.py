from typing import Dict, List

from ..config import STORE_CONFIGS
from ..integrations.shopify.client import ShopifyClient


class StoreService:
    def list_store_keys(self) -> List[str]:
        return sorted(STORE_CONFIGS.keys())

    async def check_connections(self) -> Dict[str, bool]:
        results = {}
        for store_key in self.list_store_keys():
            config = STORE_CONFIGS.get(store_key)
            if not config:
                results[store_key] = False
                continue
            client = ShopifyClient(config)
            is_valid, _, _ = await client.validate_connection()
            results[store_key] = is_valid
        return results
