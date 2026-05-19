import json
import logging
from redis import Redis

# Use a separate Redis DB (db=1) for Scraper to keep it clean from dashboard cache
redis_client = Redis(host='localhost', port=6379, db=1, decode_responses=True)
logger = logging.getLogger("scraper_cache")

def get_cached_styles(vendor_name: str = None):
    """Returns a set of all style numbers for a specific vendor in Redis."""
    try:
        v_norm = vendor_name.lower().strip() if vendor_name else "*"
        pattern = f"style:{v_norm}:*"
        keys = redis_client.keys(pattern)
        return {k.split(":", 2)[2] for k in keys if len(k.split(":")) >= 3}
    except Exception as e:
        logger.error(f"Redis Cache Error (get_cached_styles): {e}")
        return set()

def get_cached_results_for_vendor(vendor_name: str):
    """Retrieve all results for a specific vendor from Redis."""
    try:
        v_norm = vendor_name.lower().strip()
        pattern = f"style:{v_norm}:*"
        keys = redis_client.keys(pattern)
        results = []
        for k in keys:
            data = redis_client.get(k)
            if data:
                item_data = json.loads(data)
                if isinstance(item_data, list):
                    results.extend(item_data)
                else:
                    results.append(item_data)
        return results
    except Exception as e:
        logger.error(f"Redis Cache Error (get_cached_results): {e}")
        return []

def append_to_cache(results: list):
    """Save new results to Redis using style:vendor:style_no format."""
    try:
        to_save = {}
        for item in results:
            style_no = str(item.get("Style No", "")).strip().upper()
            vendor = item.get("Vendor") or item.get("Vendor Name") or ""
            v_norm = vendor.lower().strip()
            if style_no and v_norm:
                key = f"style:{v_norm}:{style_no}"
                to_save.setdefault(key, []).append(item)
        
        for key, items in to_save.items():
            redis_client.set(key, json.dumps(items))
        return True
    except Exception as e:
        logger.error(f"Redis Cache Error (append_to_cache): {e}")
        return False

def check_style_cache(style_no: str, vendor_name: str):
    """Check if a specific style exists in Redis for a vendor."""
    try:
        s_norm = str(style_no).strip().upper()
        v_norm = vendor_name.lower().strip()
        data = redis_client.get(f"style:{v_norm}:{s_norm}")
        if data:
            item_data = json.loads(data)
            return item_data if isinstance(item_data, list) else [item_data]
        return None
    except Exception:
        return None
