"""
SnapDance Animator Service — FastAPI microservice
Receives a source image + driver video, returns an animated mp4.

Modes:
  DEMO  (default) — returns the driver video as-is (wiring test)
  REAL             — runs identity-locked reenactment model
"""

import os
import shutil
import uuid
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse

from runner import animate

app = FastAPI(title="SnapDance Animator")

WORK_DIR = Path(__file__).parent / "work"
WORK_DIR.mkdir(exist_ok=True)


@app.post("/animate")
async def animate_endpoint(
    source_image: UploadFile = File(...),
    driver_video: UploadFile = File(...),
):
    """
    Accepts multipart form-data:
      - source_image: the user's photo (jpg/png)
      - driver_video: the dance driver clip (mp4)
    Returns: the animated mp4 file.
    """
    job_id = uuid.uuid4().hex

    # Save uploads to work directory
    img_path = WORK_DIR / f"{job_id}_source{Path(source_image.filename).suffix}"
    drv_path = WORK_DIR / f"{job_id}_driver.mp4"
    out_path = WORK_DIR / f"{job_id}_output.mp4"

    try:
        with open(img_path, "wb") as f:
            shutil.copyfileobj(source_image.file, f)
        with open(drv_path, "wb") as f:
            shutil.copyfileobj(driver_video.file, f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploads: {e}")

    # Run the animation pipeline (demo or real)
    try:
        result_path = animate(
            source_image_path=str(img_path),
            driver_video_path=str(drv_path),
            output_path=str(out_path),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Animation failed: {e}")

    if not Path(result_path).exists():
        raise HTTPException(status_code=500, detail="Output file was not created")

    return FileResponse(
        path=result_path,
        media_type="video/mp4",
        filename="animated.mp4",
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
