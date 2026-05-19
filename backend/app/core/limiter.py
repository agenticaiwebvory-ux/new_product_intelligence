import time
from fastapi import Request, HTTPException
from .redis_client import redis_client

async def rate_limit(request: Request, limit: int = 20, window: int = 60):
    """
    Simple Redis-based rate limiter.
    - limit: Max requests allowed in the window.
    - window: Time window in seconds.
    """
    if not redis_client:
        return # Skip if Redis is down
    
    # Identify by IP
    client_ip = request.client.host
    key = f"rate_limit:{client_ip}:{request.url.path}"
    
    try:
        current = await redis_client.get(key)
        if current and int(current) >= limit:
            raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
        
        # Increment and set expire if new
        pipe = redis_client.pipeline()
        await pipe.incr(key)
        await pipe.expire(key, window)
        await pipe.execute()
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        # Don't block users if Redis has an error
        pass
