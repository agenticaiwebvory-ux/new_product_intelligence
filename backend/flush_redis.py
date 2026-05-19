import redis
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def flush_redis():
    redis_url = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
    print(f"Connecting to Redis at: {redis_url}")
    
    try:
        r = redis.from_url(redis_url)
        r.flushall()
        print("Successfully flushed all Redis databases.")
    except Exception as e:
        print(f"Error flushing Redis: {e}")

if __name__ == "__main__":
    flush_redis()
