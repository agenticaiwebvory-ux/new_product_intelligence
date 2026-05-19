from fastapi import HTTPException, status

class AppBaseException(Exception):
    """Base class for all app-specific exceptions."""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)

class ShopifyError(AppBaseException):
    """Raised when a Shopify API operation fails."""
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message, status_code)

class DatabaseError(AppBaseException):
    """Raised when a database operation fails."""
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message, status_code)

class ProductNotFoundError(AppBaseException):
    """Raised when a product is not found in any catalog."""
    def __init__(self, sku: str):
        super().__init__(f"Product with SKU '{sku}' not found.", 404)

class PermissionError(AppBaseException):
    """Raised when a user lacks permission for an action."""
    def __init__(self, message: str = "Permission denied"):
        super().__init__(message, 403)
