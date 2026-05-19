import logging
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from dotenv import load_dotenv

load_dotenv()

from .api import products, dashboard, auth, merchandising, stores
from .core.database import Base, engine
from .core.exceptions import AppBaseException
from .config import settings, STORE_CONFIGS
from .integrations.shopify.client import ShopifyClient

logger = logging.getLogger("product-intelligence")


# Create tables
Base.metadata.create_all(bind=engine)


# check live store connection status
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: verify Shopify connections in background so server starts instantly."""
    import asyncio

    async def verify_all():
        for store_key, config in STORE_CONFIGS.items():
            try:
                client = ShopifyClient(config)
                await client.validate_connection()
                logger.info(f"{store_key.upper()} connection verified.")
            except Exception as e:
                logger.warning(f"{store_key.upper()} connection failed: {e}")

    #asyncio.create_task(verify_all())
    logger.info("Product Intelligence Hub started.")
    yield
    logger.info("Product Intelligence Hub shutting down.")


app = FastAPI(
    title="Product Intelligence Dashboard API",
    lifespan=lifespan,
    redirect_slashes=False,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.FRONTEND_URL.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/api")
app.include_router(products.router, prefix="/api/products", tags=["products"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(merchandising.router, prefix="/api/merchandising", tags=["merchandising"])
app.include_router(stores.router, prefix="/api/stores", tags=["stores"])
# app.include_router(tools.router, prefix="/api/tools", tags=["tools"])


# --- Exception Handlers ---

@app.exception_handler(AppBaseException)
async def app_base_exception_handler(request: Request, exc: AppBaseException):
    """Handles our custom application exceptions."""
    logger.error(f"App Error: {exc.message} (Status: {exc.status_code})")
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "detail": exc.message},
    )

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handles standard FastAPI/Starlette HTTPExceptions."""
    logger.error(f"HTTP Error: {exc.detail} (Status: {exc.status_code})")
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "detail": exc.detail},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handles Pydantic validation errors."""
    error_details = exc.errors()
    msg = f"Validation Error: {error_details[0]['msg']} at {error_details[0]['loc']}"
    logger.error(msg)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"success": False, "detail": msg, "errors": error_details},
    )

@app.exception_handler(Exception)
async def universal_exception_handler(request: Request, exc: Exception):
    """Catch-all for any unhandled runtime errors."""
    error_msg = str(exc)
    stack = traceback.format_exc()
    logger.error(f"UNHANDLED EXCEPTION: {error_msg}\n{stack}")
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False, 
            "detail": "An internal server error occurred. Our team has been notified.",
            "error_type": type(exc).__name__
        },
    )



@app.get("/")
async def root():
    return {"message": "Product Intelligence Dashboard API is running"}
