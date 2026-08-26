"""Camera management and worker control API routes."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import Camera, User
from backend.app.schemas import CameraCreate, CameraUpdate, CameraResponse, CameraTestResponse
from backend.app.auth import require_approved_user, require_admin, log_audit
from backend.app.camera_manager import camera_service

router = APIRouter(prefix="/cameras", tags=["Camera Management"])


@router.get("", response_model=List[CameraResponse])
def list_cameras(
    db: Session = Depends(get_db),
    user: User = Depends(require_approved_user),
):
    """Retrieve list of all registered cameras with real-time status."""
    cameras = db.query(Camera).order_by(Camera.created_at.asc()).all()
    # Update real-time status from active workers
    for cam in cameras:
        worker = camera_service.get_worker(cam.camera_id)
        if worker and worker.is_running and worker.is_connected:
            cam.status = "ONLINE"
        elif not cam.is_enabled:
            cam.status = "DISABLED"
        else:
            cam.status = "OFFLINE"
    return cameras


@router.post("", response_model=CameraResponse, status_code=status.HTTP_201_CREATED)
def create_camera(
    camera_in: CameraCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Add a new camera (Admin only). Starts background AI processing worker if enabled."""
    existing = db.query(Camera).filter(Camera.camera_id == camera_in.camera_id.strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Camera ID '{camera_in.camera_id}' already exists.",
        )

    new_camera = Camera(
        camera_id=camera_in.camera_id.strip().upper(),
        name=camera_in.name.strip(),
        url=camera_in.url.strip(),
        camera_type=camera_in.camera_type,
        location=camera_in.location.strip(),
        latitude=camera_in.latitude,
        longitude=camera_in.longitude,
        landmark=camera_in.landmark,
        zone=camera_in.zone,
        description=camera_in.description,
        username=camera_in.username,
        password=camera_in.password,
        is_enabled=camera_in.is_enabled,
        status="ONLINE" if camera_in.is_enabled else "OFFLINE",
    )
    db.add(new_camera)
    db.commit()
    db.refresh(new_camera)

    if new_camera.is_enabled:
        camera_service.start_worker_for_camera(new_camera)

    log_audit(
        db,
        action="CAMERA_ADDED",
        target_type="camera",
        target_id=new_camera.camera_id,
        details=f"Admin {admin.email} added camera {new_camera.camera_id} ({new_camera.name}) at {new_camera.location}.",
        user=admin,
        ip_address=request.client.host if request.client else None,
    )
    return new_camera


@router.get("/{camera_id}", response_model=CameraResponse)
def get_camera_details(
    camera_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_approved_user),
):
    """Retrieve details for a specific camera."""
    cam = db.query(Camera).filter(Camera.camera_id == camera_id.upper()).first()
    if not cam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found.")

    worker = camera_service.get_worker(cam.camera_id)
    if worker and worker.is_running and worker.is_connected:
        cam.status = "ONLINE"
    elif not cam.is_enabled:
        cam.status = "DISABLED"
    else:
        cam.status = "OFFLINE"
    return cam


@router.put("/{camera_id}", response_model=CameraResponse)
def update_camera(
    camera_id: str,
    cam_update: CameraUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Update camera configuration and location (Admin only)."""
    cam = db.query(Camera).filter(Camera.camera_id == camera_id.upper()).first()
    if not cam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found.")

    update_data = cam_update.dict(exclude_unset=True)
    restart_needed = "url" in update_data or "is_enabled" in update_data or "camera_type" in update_data

    for field, val in update_data.items():
        setattr(cam, field, val)

    db.commit()
    db.refresh(cam)

    if restart_needed:
        camera_service.stop_worker(cam.camera_id)
        if cam.is_enabled:
            camera_service.start_worker_for_camera(cam)

    log_audit(
        db,
        action="CAMERA_UPDATED",
        target_type="camera",
        target_id=cam.camera_id,
        details=f"Admin {admin.email} updated camera {cam.camera_id} settings.",
        user=admin,
        ip_address=request.client.host if request.client else None,
    )
    return cam


@router.delete("/{camera_id}")
def delete_camera(
    camera_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Delete a camera and stop its background worker (Admin only)."""
    cam = db.query(Camera).filter(Camera.camera_id == camera_id.upper()).first()
    if not cam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found.")

    camera_service.stop_worker(cam.camera_id)
    db.delete(cam)
    db.commit()

    log_audit(
        db,
        action="CAMERA_DELETED",
        target_type="camera",
        target_id=cam.camera_id,
        details=f"Admin {admin.email} deleted camera {cam.camera_id}.",
        user=admin,
        ip_address=request.client.host if request.client else None,
    )
    return {"message": f"Camera {camera_id} deleted successfully."}


@router.post("/{camera_id}/test", response_model=CameraTestResponse)
def test_camera(
    camera_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_approved_user),
):
    """Test connectivity for a camera source."""
    cam = db.query(Camera).filter(Camera.camera_id == camera_id.upper()).first()
    if not cam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found.")

    res = camera_service.test_camera_connection(cam)
    return res


@router.post("/{camera_id}/start")
def start_camera_worker(
    camera_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Manually start worker for a camera."""
    cam = db.query(Camera).filter(Camera.camera_id == camera_id.upper()).first()
    if not cam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found.")

    cam.is_enabled = True
    db.commit()
    camera_service.start_worker_for_camera(cam)
    return {"message": f"Worker started for camera {camera_id}."}


@router.post("/{camera_id}/stop")
def stop_camera_worker(
    camera_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Manually stop worker for a camera."""
    cam = db.query(Camera).filter(Camera.camera_id == camera_id.upper()).first()
    if not cam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found.")

    cam.is_enabled = False
    db.commit()
    camera_service.stop_worker(cam.camera_id)
    return {"message": f"Worker stopped for camera {camera_id}."}
