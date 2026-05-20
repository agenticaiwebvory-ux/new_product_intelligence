import os
import json
import logging
from redis.asyncio import Redis
from typing import Optional, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("redis_client")

from redis.asyncio import Redis, ConnectionPool

from ..config import settings
REDIS_URL = settings.REDIS_URL

# Use a connection pool for better performance and resilience
pool = ConnectionPool.from_url(
    REDIS_URL,
    decode_responses=True,
    max_connections=20,
    socket_timeout=0.5,
    socket_connect_timeout=0.5,
)

redis_client = Redis(connection_pool=pool, retry_on_timeout=True)

async def set_cache(key: str, value: Any, ttl: int = 3600):
    """
    Store data in Redis with a specific TTL (seconds).
    Serializes dicts/lists to JSON automatically.
    """
    try:
        data = json.dumps(value) if isinstance(value, (dict, list)) else str(value)
        await redis_client.set(key, data, ex=ttl)
        return True
    except Exception as e:
        logger.error(f"Redis Set Error for key {key}: {e}")
        return False

async def get_cache(key: str):
    """
    Retrieve data from Redis.
    Attempts to parse JSON back into dict/list if applicable.
    """
    try:
        data = await redis_client.get(key)
        if data is None:
            return None
        try:
            return json.loads(data)
        except (ValueError, TypeError):
            return data
    except Exception as e:
        logger.error(f"Redis Get Error for key {key}: {e}")
        return None

async def delete_cache(key: str):
    """Delete a specific key from Redis."""
    try:
        await redis_client.delete(key)
        return True
    except Exception as e:
        logger.error(f"Redis Delete Error for key {key}: {e}")
        return False

async def clear_cache_pattern(pattern: str):
    """
    Clears all keys matching a specific pattern (e.g., 'audit:*').
    """
    try:
        # Use keys() for simplicity on small/medium datasets for TDO
        keys = await redis_client.keys(pattern)
        if keys:
            await redis_client.delete(*keys)
            logger.info(f"Cleared {len(keys)} keys matching pattern: {pattern}")
            return len(keys)
        return 0
    except Exception as e:
        logger.error(f"Redis Pattern Clear Error for {pattern}: {e}")
        return 0

async def acquire_lock(lock_name: str, acquire_timeout: int = 10, lock_timeout: int = 60) -> bool:
    """
    Acquire a distributed lock using Redis.
    - lock_name: The name of the lock key.
    - acquire_timeout: How long to wait to get the lock (seconds).
    - lock_timeout: How long the lock remains valid (seconds).
    Returns True if lock acquired or if Redis unavailable (bypass).
    """
    try:
        import asyncio
        locked = await asyncio.wait_for(
            redis_client.set(f"lock:{lock_name}", "locked", ex=lock_timeout, nx=True),
            timeout=1.0
        )
        if locked:
            return True
        # Lock held by another process — wait briefly then give up
        await asyncio.sleep(0.5)
        return False
    except asyncio.TimeoutError:
        logger.warning(f"Redis timeout in acquire_lock for {lock_name}. Bypassing lock.")
        return True
    except Exception as e:
        logger.warning(f"Redis error in acquire_lock for {lock_name}. Bypassing lock: {e}")
        return True

async def release_lock(lock_name: str):
    """Release a distributed lock."""
    try:
        import asyncio
        await asyncio.wait_for(redis_client.delete(f"lock:{lock_name}"), timeout=1.0)
    except asyncio.TimeoutError:
        logger.warning(f"Redis timeout in release_lock for {lock_name}. Skipping.")
    except Exception as e:
        logger.warning(f"Redis error in release_lock for {lock_name}: {e}")

__all__ = ["redis_client", "set_cache", "get_cache", "delete_cache", "clear_cache_pattern", "acquire_lock", "release_lock"]
