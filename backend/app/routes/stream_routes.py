"""Live video streaming endpoints with real-time AI bounding box HUD overlays."""

import time
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from backend.app.camera_manager import camera_service

router = APIRouter(prefix="/stream", tags=["Live Camera Video Streaming"])


def generate_mjpeg_frames(camera_id: str):
    """Generator for multipart/x-mixed-replace live JPEG frames."""
    worker = camera_service.get_worker(camera_id)
    if not worker:
        return

    try:
        while worker.is_running:
            jpeg_bytes = worker.get_latest_jpeg()
            if jpeg_bytes is not None:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + jpeg_bytes + b"\r\n"
                )
            time.sleep(0.015)  # High FPS smooth stream delivery
    except (GeneratorExit, Exception):
        return


@router.get("/{camera_id}/live")
def stream_camera_live(camera_id: str):
    """Stream live annotated video feed with AI bounding boxes and hazard HUD."""
    cam_id = camera_id.upper()
    worker = camera_service.get_worker(cam_id)
    if not worker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera worker '{cam_id}' not found or not active.",
        )

    return StreamingResponse(
        generate_mjpeg_frames(cam_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )
