"""AI Vision status, detection telemetry, and analytics API routes."""

import os
from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.database import get_db
from backend.app.models import Camera, Incident, User
from backend.app.schemas import AIStatusResponse
from backend.app.auth import require_approved_user
from backend.app.camera_manager import camera_service
from backend.app.config import settings

router = APIRouter(prefix="/ai", tags=["AI Vision Engine"])


@router.get("/status", response_model=AIStatusResponse)
def get_ai_status(
    db: Session = Depends(get_db),
    user: User = Depends(require_approved_user),
):
    """Retrieve runtime AI vision engine status and backend details."""
    total_cams = db.query(func.count(Camera.id)).scalar() or 0
    active_workers = len([w for w in camera_service.workers.values() if w.is_running])

    # Check model backends
    custom_accident_exists = os.path.exists(settings.ACCIDENT_MODEL_PATH)
    custom_fire_exists = os.path.exists(settings.FIRE_MODEL_PATH)

    accident_backend = f"custom_model ({settings.ACCIDENT_MODEL_PATH})" if custom_accident_exists else "heuristic"
    fire_smoke_backend = f"custom_model ({settings.FIRE_MODEL_PATH})" if custom_fire_exists else "heuristic"

    # Compute global FPS and active detections across workers
    total_fps = 0.0
    total_vehicles = 0
    total_hazards = 0

    for worker in camera_service.workers.values():
        tel = worker.get_telemetry()
        total_fps += tel.get("fps", 0.0)
        total_vehicles += tel.get("vehicle_count", 0)
        total_hazards += len(tel.get("hazards", []))

    avg_fps = round(total_fps / max(1, active_workers), 1) if active_workers > 0 else 0.0

    return {
        "ai_status": "ACTIVE" if active_workers > 0 else "IDLE",
        "total_cameras": total_cams,
        "active_workers": active_workers,
        "detector_backend": "yolo11n",
        "accident_backend": accident_backend,
        "fire_smoke_backend": fire_smoke_backend,
        "global_fps": avg_fps,
        "total_vehicles_detected": total_vehicles,
        "active_hazards": total_hazards,
    }


@router.get("/detections")
def get_live_detections(
    user: User = Depends(require_approved_user),
):
    """Retrieve live detection snapshots from all active camera workers."""
    snapshots: List[Dict[str, Any]] = []
    for cam_id, worker in camera_service.workers.items():
        if worker.is_running:
            snapshots.append(worker.get_telemetry())
    return snapshots


@router.get("/statistics")
def get_ai_statistics(
    db: Session = Depends(get_db),
    user: User = Depends(require_approved_user),
):
    """Retrieve statistical analytics for incident risk, vehicle types, and locations."""
    # Risk breakdown
    risk_counts = (
        db.query(Incident.risk, func.count(Incident.id))
        .group_by(Incident.risk)
        .all()
    )
    risk_data = {r: count for r, count in risk_counts}

    # Event types breakdown
    event_counts = (
        db.query(Incident.event_type, func.count(Incident.id))
        .group_by(Incident.event_type)
        .all()
    )
    event_data = {e: count for e, count in event_counts}

    # Top incident locations
    loc_counts = (
        db.query(Incident.location, func.count(Incident.id))
        .group_by(Incident.location)
        .order_by(func.count(Incident.id).desc())
        .limit(5)
        .all()
    )
    location_data = [{"location": loc, "count": count} for loc, count in loc_counts]

    # Backend usage breakdown
    backend_counts = (
        db.query(Incident.backend, func.count(Incident.id))
        .group_by(Incident.backend)
        .all()
    )
    backend_data = {b: count for b, count in backend_counts}

    return {
        "risk_breakdown": {
            "CRITICAL": risk_data.get("CRITICAL", 0),
            "HIGH": risk_data.get("HIGH", 0),
            "MEDIUM": risk_data.get("MEDIUM", 0),
            "LOW": risk_data.get("LOW", 0),
        },
        "event_breakdown": {
            "possible_accident": event_data.get("possible_accident", 0),
            "possible_fire": event_data.get("possible_fire", 0),
            "possible_smoke": event_data.get("possible_smoke", 0),
        },
        "top_locations": location_data,
        "backend_distribution": backend_data,
    }
