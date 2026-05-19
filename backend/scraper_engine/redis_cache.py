import redis
import json
import os
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

class RedisScraperCache:
    def __init__(self):
        try:
            self.client = redis.from_url(REDIS_URL, decode_responses=True)
            self.client.ping()
            self.enabled = True
        except Exception as e:
            print(f"  [WARNING] Redis connection failed for Scraper Cache: {e}")
            self.enabled = False

    def get_key(self, style: str) -> str:
        return f"scraper:cache:{style.strip().upper()}"

    def get_style_results(self, style: str) -> list[dict]:
        if not self.enabled:
            return []
        try:
            data = self.client.get(self.get_key(style))
            if data:
                return json.loads(data)
        except Exception as e:
            print(f"  [ERROR] Redis GET failed: {e}")
        return []

    def set_style_results(self, style: str, results: list[dict]):
        if not self.enabled:
            return
        try:
            # We store as JSON list of results for that style
            self.client.set(self.get_key(style), json.dumps(results))
        except Exception as e:
            print(f"  [ERROR] Redis SET failed: {e}")

    def bulk_add(self, rows: list[dict]):
        """Group rows by style and save to Redis"""
        if not self.enabled:
            return
        
        style_map = {}
        for row in rows:
            style = (row.get("Style No") or "").strip().upper()
            if not style:
                continue
            if style not in style_map:
                style_map[style] = []
            style_map[style].append(row)

        try:
            pipe = self.client.pipeline()
            for style, results in style_map.items():
                # Merge with existing results if needed or just replace?
                # For scraper cache, replacing with latest set is usually fine 
                # or we could append. Let's append to existing.
                existing = self.get_style_results(style)
                # Simple dedup based on URL
                seen_urls = {r.get("Product URL") for r in existing}
                for r in results:
                    if r.get("Product URL") not in seen_urls:
                        existing.append(r)
                
                pipe.set(self.get_key(style), json.dumps(existing))
            pipe.execute()
        except Exception as e:
            print(f"  [ERROR] Redis Bulk SET failed: {e}")

# Singleton instance
redis_cache = RedisScraperCache()
