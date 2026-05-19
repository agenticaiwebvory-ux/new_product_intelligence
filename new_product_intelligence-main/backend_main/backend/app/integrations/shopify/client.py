import httpx
import logging
import sqlite3
from ...config import settings, STORE_CONFIGS
from ...core.exceptions import ShopifyError

logger = logging.getLogger(__name__)

class ShopifyClient:
    def __init__(self, store_config: dict):
        """
        Uses the global store configuration (TDO, WDO, or KOS) provided at startup.
        """
        if not store_config:
            raise ValueError("Shopify Configuration Missing")
            
        self.store_name = store_config.get("store_name", "Unknown")
        self.store_url = store_config.get("shop_domain", "").replace("https://", "").replace("http://", "").strip("/")
        self.access_token = store_config.get("access_token", "").replace("'", "").replace('"', "").strip()
        self.api_version = store_config.get("api_version", "2024-04")
        
        # Senior's refresh credentials
        self.client_id = store_config.get("client_id")
        self.client_secret = store_config.get("client_secret")

        self.headers = {
            "X-Shopify-Access-Token": self.access_token,
            "Content-Type": "application/json"
        }

    async def validate_connection(self, log_to_db: bool = True):
        """
        Senior's Logic: Validates token and attempts refresh if it fails (401/403).
        """
        is_valid, code, msg = await self._check_shop_api()
        
        if not is_valid and code in (401, 403):
            logger.info(f"Token expired for {self.store_name}. Attempting refresh...")
            new_token = await self.refresh_token()
            if new_token:
                self.access_token = new_token
                self.headers["X-Shopify-Access-Token"] = new_token
                is_valid, code, msg = await self._check_shop_api()
        
        # Senior's Update: Persist the error reason to the database
        if log_to_db:
            self._log_status_to_db(is_valid, code, msg)
        
        return is_valid, code, msg

    def _log_status_to_db(self, is_valid, code, msg):
        """
        Saves the connection health and error reason to the database.
        """
        try:
            from datetime import datetime
            conn = sqlite3.connect(settings.DB_URL, timeout=30)
            error_val = None if is_valid else f"HTTP {code}: {msg}"
            conn.execute("""
                UPDATE store_credentials 
                SET last_error=?, last_checked_at=? 
                WHERE lower(store_name)=lower(?)
            """, (error_val, datetime.now().isoformat(), self.store_name.lower()))
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Failed to log status to DB: {e}")

    async def _check_shop_api(self):
        query = "{ shop { name } }"
        url = f"https://{self.store_url}/admin/api/{self.api_version}/graphql.json"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json={"query": query}, headers=self.headers)
                if response.status_code == 200:
                    return True, 200, "OK"
                return False, response.status_code, response.text[:100]
        except Exception as e:
            return False, 500, str(e)

    async def refresh_token(self):
        """
        Standardized Token Refresh logic from senior's shopify_token_refresh.py
        """
        url = f"https://{self.store_url}/admin/oauth/access_token"
        payload = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "client_credentials",
        }
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    new_token = resp.json().get("access_token")
                    if new_token:
                        self._save_token_to_db(new_token)
                        from ...config import refresh_store_configs
                        refresh_store_configs()
                        return new_token
                return None
        except Exception as e:
            logger.error(f"Refresh failed for {self.store_name}: {e}")
            return None

    def _save_token_to_db(self, new_token: str):
        """
        Persists the new token to the store_credentials table.
        """
        try:
            conn = sqlite3.connect(settings.DB_URL, timeout=30)
            conn.execute("""
                UPDATE store_credentials SET access_token=? WHERE lower(store_name)=lower(?)
            """, (new_token, self.store_name.lower()))
            conn.commit()
            conn.close()
            logger.info(f"Token updated in DB for {self.store_name}")
        except Exception as e:
            logger.error(f"Failed to save token to DB: {e}")

    async def graphql_query(self, query: str, variables: dict = None):
        """
        Standard GraphQL query executor.
        """
        url = f"https://{self.store_url}/admin/api/{self.api_version}/graphql.json"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                url, 
                json={"query": query, "variables": variables}, 
                headers=self.headers
            )
            
            if response.status_code != 200:
                raise ShopifyError(f"Shopify [{self.store_name}] Failed: {response.status_code}", status_code=response.status_code)
                
            data = response.json()
            if "errors" in data:
                raise ShopifyError(f"Shopify Error: {data['errors']}")
            return data.get("data", {})
