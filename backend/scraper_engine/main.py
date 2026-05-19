"""
Product Scraper — FastAPI Backend (v4)
Serves the React frontend + API endpoints for scraping.

Usage:
    pip install fastapi uvicorn openpyxl httpx PyMuPDF
    uvicorn main:app --reload --port 8000
"""
import uuid
import shutil
import os
import threading
from pathlib import Path
from contextlib import asynccontextmanager
import redis.asyncio as redis


from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from run import run



@asynccontextmanager
async def lifespan(app: FastAPI):
    # Connect to Redis on startup
    app.state.redis = await redis.from_url("redis://localhost:6379/0", decode_responses=True)
    yield
    # Close connection on shutdown
    await app.state.redis.close()

app = FastAPI(title="Product Scraper API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("input")
UPLOAD_DIR.mkdir(exist_ok=True)

# In-memory job store: job_id → {status, progress, error, output_file, ...}
jobs = {}


# ----------------------------
# Background worker
# ----------------------------
def run_scraper_job(job_id: str, input_path: str, vendor_name: str, force: bool):
    try:
        jobs[job_id]["status"] = "running"
        progress = jobs[job_id]["progress"]

        output_path = run(
            input_path=input_path,
            brand_name=vendor_name,
            force=force,
            progress=progress,
        )

        jobs[job_id]["status"] = "completed"
        jobs[job_id]["output_file"] = output_path

    except Exception as e:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)
        jobs[job_id]["progress"]["step"] = "error"
        jobs[job_id]["progress"]["detail"] = str(e)
        jobs[job_id]["progress"]["percent"] = 0


# ----------------------------
# Health
# ----------------------------
@app.get("/api/health")
def health():
    return {"status": "ok"}


# ----------------------------
# Run scraper
# ----------------------------
@app.post("/api/scrape")
async def scrape(
    vendor_name: str = Form(...),
    force: bool = Form(False),
    file: UploadFile = File(...)
):
    ext = Path(file.filename).suffix.lower()
    if ext not in [".csv", ".xlsx", ".pdf"]:
        return JSONResponse(status_code=400, content={"error": f"Invalid file type: {ext}. Use .pdf, .csv, or .xlsx"})

    job_id = str(uuid.uuid4())
    saved_file = UPLOAD_DIR / f"{job_id}_{file.filename}"

    with open(saved_file, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    jobs[job_id] = {
        "status": "queued",
        "vendor_name": vendor_name,
        "file": file.filename,
        "output_file": None,
        "error": None,
        "progress": {
            "step": "queued",
            "detail": "Waiting to start...",
            "percent": 0,
            "total_styles": 0,
            "cached": 0,
            "needs_search": 0,
            "total_listings": 0,
            "styles_with_results": 0,
        },
    }

    # Run in background thread
    t = threading.Thread(
        target=run_scraper_job,
        args=(job_id, str(saved_file), vendor_name, force),
        daemon=True,
    )
    t.start()

    return {"job_id": job_id, "status": "queued"}


# ----------------------------
# Check status + progress
# ----------------------------
@app.get("/api/jobs/{job_id}")
def job_status(job_id: str):
    if job_id not in jobs:
        return JSONResponse(status_code=404, content={"error": "Job not found"})
    job = jobs[job_id]
    return {
        "job_id": job_id,
        "status": job["status"],
        "vendor_name": job["vendor_name"],
        "file": job["file"],
        "error": job.get("error"),
        "progress": job["progress"],
        "has_output": job["output_file"] is not None,
    }


# ----------------------------
# Download Excel output
# ----------------------------
@app.get("/api/jobs/{job_id}/download")
def download_output(job_id: str):
    if job_id not in jobs:
        return JSONResponse(status_code=404, content={"error": "Job not found"})

    job = jobs[job_id]
    output_file = job.get("output_file")

    if not output_file or not os.path.exists(output_file):
        return JSONResponse(status_code=400, content={"error": "Output file not ready"})

    filename = os.path.basename(output_file)
    return FileResponse(
        path=output_file,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ----------------------------
# Serve React frontend (production build)
# ----------------------------
frontend_build = Path("frontend/build")
if frontend_build.exists():
    app.mount("/", StaticFiles(directory=str(frontend_build), html=True), name="frontend")

