import os
import sqlite3
import logging
from typing import Optional

from pydantic import ConfigDict
from pydantic_settings import BaseSettings

# Dynamically locate the project root for portability
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Logging
LOG_FILE = os.path.join(BASE_DIR, "product-intelligence.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("product-intelligence")
logger.info(f"Logging initialized. File: {LOG_FILE}")


class Settings(BaseSettings):
    """Central configuration — reads from .env automatically."""

    DB_URL: str 
    DATABASE_URL: Optional[str] = None
    AUTH_DB_URL: str 
    REDIS_URL: str

    OPENAI_API_KEY: Optional[str] = None
    AI_MODEL: str
    AI_MAX_RETRIES: int
    PROJECT_NAME: str = "Product Intelligence Hub"
    SECRET_KEY: str 
    FRONTEND_URL: str
    API_PREFIX: str = "/api"

    model_config = ConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()


# ------------------------------------
# Store Credentials Loader
# ------------------------------------
def load_store_configs() -> dict:
    """Load TDO, WDO, KOS credentials from the database into memory."""
    try:
        conn = sqlite3.connect(settings.DB_URL, timeout=10)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(
            """
            SELECT store_name, shop_name, shop_domain,
                   client_id, client_secret, access_token, api_version
            FROM store_credentials
            WHERE store_name IN ('tdo','wdo','kos','im')
            """
        )
        rows = cur.fetchall()
        conn.close()

        stores = {}
        for row in rows:
            stores[row["store_name"].lower()] = dict(row)
        logger.info(f"Loaded credentials for {list(stores.keys())}")
        return stores
    except Exception as e:
        logger.warning(f"Store config load failed: {e}")
        return {}


STORE_CONFIGS = load_store_configs()

def refresh_store_configs():
    """Manually refresh the global store configs from DB."""
    global STORE_CONFIGS, TDO, WDO, KOS, IM
    STORE_CONFIGS = load_store_configs()
    TDO = STORE_CONFIGS.get("tdo")
    WDO = STORE_CONFIGS.get("wdo")
    KOS = STORE_CONFIGS.get("kos")
    IM = STORE_CONFIGS.get("im")
    return STORE_CONFIGS

TDO = STORE_CONFIGS.get("tdo")
WDO = STORE_CONFIGS.get("wdo")
KOS = STORE_CONFIGS.get("kos")
IM = STORE_CONFIGS.get("im")

TOP_TAG_PREFIX = "top:"
BESTSELLER_TAG_PREFIX = "best:"
SPECIAL_TAGS = ["No PROM", "No Formal", "Discontinued", "Push PROM"]

# Vendor / mode sentinels — import these everywhere instead of inline literals
TDO_VENDOR_NAME = "The Dress Outlet"
MERCH_MODE_KEY = "TDO_MERCH"
