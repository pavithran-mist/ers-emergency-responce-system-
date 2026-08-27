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


import base64
import cv2
import time
import logging
from datetime import datetime, timezone
from typing import Optional
import numpy as np
from pydantic import BaseModel

from backend.app.database import SessionLocal
from backend.app.models import Incident, IncidentStatus, IncidentDepartment
from backend.app.ws_manager import ws_manager
from ai_engine.detector import ObjectDetector
from ai_engine.accident_detector import AccidentDetector
from ai_engine.fire_smoke_detector import FireSmokeDetector
from ai_engine.temporal_verifier import TemporalVerifier

logger = logging.getLogger("astra.mobile_ai")

_shared_detector = ObjectDetector(confidence_threshold=0.20)
_shared_accident = AccidentDetector()
_shared_fire = FireSmokeDetector(enable_heuristic_fire=True, enable_heuristic_smoke=False)
_shared_temporal_verifier = TemporalVerifier(window_size=4, min_hits=2, cooldown_seconds=5.0)


class FrameDetectRequest(BaseModel):
    image_base64: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@router.post("/detect-frame")
def detect_mobile_frame(
    req: FrameDetectRequest,
):
    """Run live YOLO inference on frames streamed from phone browser camera, persist emergency incidents, and broadcast alerts."""
    try:
        data = req.image_base64
        if "," in data:
            data = data.split(",", 1)[1]
        img_bytes = base64.b64decode(data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            return {"status": "error", "detections": [], "hazards": [], "created_incidents": []}

        current_time = time.time()

        # 1. YOLO vehicle & object detector
        detections = _shared_detector.detect(frame)

        # 2. Fire and smoke detector
        fire_events = _shared_fire.detect(frame, timestamp=current_time)

        # 3. Accident detector
        accident_events = _shared_accident.detect(frame, [], timestamp=current_time)

        raw_hazards = [e.to_dict() for e in fire_events] + [e.to_dict() for e in accident_events]

        # 4. Temporal verification filter
        verified_hazards = _shared_temporal_verifier.process_frame(raw_hazards, timestamp=current_time)

        # 5. Automatically record incident and broadcast live emergency dispatch alert
        created_incidents = []
        if verified_hazards:
            db: Session = SessionLocal()
            try:
                for vh in verified_hazards:
                    now_utc = datetime.now(timezone.utc)
                    timestamp_str = now_utc.strftime("%Y%m%d%H%M%S")
                    rand_suffix = int(time.time() * 1000) % 1000
                    incident_id = f"INC-MOBILE-{timestamp_str}-{rand_suffix:03d}"

                    event_type = vh.get("event_type", "possible_fire")
                    dept = (
                        IncidentDepartment.FIRE
                        if "fire" in event_type or "smoke" in event_type
                        else IncidentDepartment.POLICE
                    )

                    inc = Incident(
                        incident_id=incident_id,
                        camera_id="CAM-MOBILE",
                        camera_name="Mobile Device Live Scanner",
                        event_type=event_type,
                        risk=vh.get("risk", "CRITICAL"),
                        confidence=float(vh.get("confidence", 0.88)),
                        reason=vh.get("reason", "Mobile AI optical detection"),
                        backend=vh.get("backend", "yolo_model"),
                        status=IncidentStatus.NEW,
                        department=dept,
                        location="Mobile Field Scanner Location",
                        latitude=req.latitude if req.latitude is not None else 28.6139,
                        longitude=req.longitude if req.longitude is not None else 77.2090,
                        landmark="Live Field GPS Position",
                        zone="Mobile Patrol Sector",
                        bounding_box=str(vh.get("bounding_box", [0, 0, 0, 0])),
                        notes=f"Emergency incident detected directly by Mobile Phone Camera ({vh.get('backend', 'yolo_model')}).",
                        created_at=now_utc,
                    )
                    db.add(inc)
                    db.commit()
                    db.refresh(inc)

                    alert_payload = {
                        "type": "NEW_INCIDENT",
                        "incident": {
                            "id": inc.id,
                            "incident_id": inc.incident_id,
                            "camera_id": inc.camera_id,
                            "camera_name": inc.camera_name,
                            "event_type": inc.event_type,
                            "risk": inc.risk,
                            "confidence": inc.confidence,
                            "reason": inc.reason,
                            "backend": inc.backend,
                            "status": inc.status.value,
                            "department": inc.department.value,
                            "location": inc.location,
                            "latitude": inc.latitude,
                            "longitude": inc.longitude,
                            "landmark": inc.landmark,
                            "zone": inc.zone,
                            "bounding_box": inc.bounding_box,
                            "notes": inc.notes,
                            "created_at": inc.created_at.isoformat(),
                        },
                    }
                    ws_manager.broadcast_sync(alert_payload)
                    created_incidents.append(alert_payload["incident"])
                    logger.info(f"Recorded Mobile Camera Incident {incident_id} ({event_type}) and broadcast alert.")
            except Exception as e:
                logger.error(f"Error persisting mobile camera incident: {e}")
            finally:
                db.close()

        return {
            "status": "success",
            "detections": [d.to_dict() for d in detections],
            "hazards": raw_hazards,
            "created_incidents": created_incidents,
            "vehicle_count": len(detections),
            "risk_level": "CRITICAL" if raw_hazards else "LOW",
        }
    except Exception as e:
        return {"status": "error", "error": str(e), "detections": [], "hazards": [], "created_incidents": []}
