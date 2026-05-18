"""
Authentication utilities for the Product Intelligence Dashboard.
Provides password hashing and JWT token management.

Referenced by: app/api/auth.py
"""

import jwt
import logging
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash

from ..config import settings

logger = logging.getLogger("product-intelligence")

# -------------------------------------------
# Password Hashing (werkzeug — same as testing)
# -------------------------------------------

def get_password_hash(password: str) -> str:
    """Hash a plaintext password using werkzeug's PBKDF2."""
    return generate_password_hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a stored hash."""
    return check_password_hash(hashed_password, plain_password)


# -------------------------------------------
# JWT Token Management
# -------------------------------------------

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24


def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """
    Create a JWT access token.
    
    Args:
        data: Dict with at minimum {"sub": username, "role": role}
        expires_delta: Optional custom expiry. Defaults to 24 hours.
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    """
    Decode and validate a JWT token.
    
    Returns:
        The decoded payload dict, or None if invalid/expired.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("JWT token expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"JWT decode error: {e}")
        return None
