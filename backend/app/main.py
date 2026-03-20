"""
FastAPI main application entry point.
"""
import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.limiter import limiter
from app.api.v1 import health, excel, transform, merge, analyze, ai
from app.utils.file_cleanup import cleanup_outputs_dir, DEFAULT_MAX_AGE_SECONDS

# Load environment variables from `backend/.env` (if present).
# This must happen before we read any `os.getenv(...)` values.
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create uploads directory if it doesn't exist
uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)

# Create outputs directory if it doesn't exist
outputs_dir = Path("outputs")
outputs_dir.mkdir(exist_ok=True)

# Run periodic cleanup every hour (seconds)
CLEANUP_INTERVAL_SECONDS = 3600

# Max upload file size (default 50MB)
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", 50 * 1024 * 1024))

# Max age for temporary files
UPLOAD_MAX_AGE_SECONDS = int(os.getenv("UPLOAD_MAX_AGE_SECONDS", 24 * 3600))  # default 24 hours



async def _periodic_cleanup():
    """Background task: clean temporary file directories every CLEANUP_INTERVAL_SECONDS."""
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
        try:
            n_outputs = cleanup_outputs_dir(outputs_dir, DEFAULT_MAX_AGE_SECONDS)
            if n_outputs:
                logger.info("Periodic cleanup: removed %d file(s) from outputs/", n_outputs)

            n_uploads = cleanup_outputs_dir(uploads_dir, UPLOAD_MAX_AGE_SECONDS)
            if n_uploads:
                logger.info("Periodic cleanup: removed %d file(s) from uploads/", n_uploads)
        except Exception as e:
            logger.warning("Periodic cleanup failed: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    # Startup: Rebuild file storage from disk
    from app.api.v1.excel import _rebuild_file_storage_from_disk
    try:
        _rebuild_file_storage_from_disk()
        logger.info("File storage rebuilt from disk on startup")
    except Exception as e:
        logger.warning("Could not rebuild file storage from disk: %s", e)

    # Cleanup old output files on startup
    try:
        n_out = cleanup_outputs_dir(outputs_dir, DEFAULT_MAX_AGE_SECONDS)
        if n_out:
            logger.info("Startup cleanup: removed %d file(s) from outputs/", n_out)

        n_up = cleanup_outputs_dir(uploads_dir, UPLOAD_MAX_AGE_SECONDS)
        if n_up:
            logger.info("Startup cleanup: removed %d file(s) from uploads/", n_up)
    except Exception as e:
        logger.warning("Startup output cleanup failed: %s", e)

    # Start background cleanup task
    cleanup_task = asyncio.create_task(_periodic_cleanup())

    yield

    # Shutdown: cancel background task
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Excel Data Transformation Tool API",
    description="Backend API for Excel file transformation operations",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.middleware("http")
async def validate_file_size(request: Request, call_next):
    """Reject files larger than MAX_FILE_SIZE."""
    if request.method == "POST":
        content_type = request.headers.get("content-type", "")
        if "multipart/form-data" in content_type:
            content_length = request.headers.get("content-length")
            if content_length:
                try:
                    size = int(content_length)
                    if size > MAX_FILE_SIZE:
                        return JSONResponse(
                            status_code=413,
                            content={
                                "detail": f"File too large. Maximum size is {MAX_FILE_SIZE / (1024*1024):.0f}MB"
                            },
                        )
                except ValueError:
                    pass
    response = await call_next(request)
    return response


# CORS: allow origins from env (e.g. production frontend URL) or localhost for dev
_allowed_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000",
).strip().split(",")
allowed_origins = [o.strip() for o in _allowed_origins if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(excel.router, prefix="/api/v1", tags=["excel"])
app.include_router(transform.router, prefix="/api/v1", tags=["transform"])
app.include_router(merge.router, prefix="/api/v1", tags=["merge"])
app.include_router(analyze.router, prefix="/api/v1", tags=["analyze"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["AI Assistant"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Excel Data Transformation Tool API"}

