"""Multi-camera lifecycle and AI vision worker orchestration service."""

from __future__ import annotations
import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session

from backend.app.database import SessionLocal
from backend.app.models import Camera, Incident, IncidentStatus, IncidentDepartment
from backend.app.ws_manager import ws_manager
from ai_engine.stream_worker import CameraStreamWorker

logger = logging.getLogger("astra.camera_manager")


class CameraService:
    """Orchestrates multi-camera video ingest and AI Vision workers."""

    def __init__(self):
        self.workers: Dict[str, CameraStreamWorker] = {}
        self.loop: Optional[asyncio.AbstractEventLoop] = None

    def set_event_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self.loop = loop

    def initialize_cameras(self) -> None:
        """Start AI vision workers for all enabled cameras in the database."""
        db: Session = SessionLocal()
        try:
            cameras = db.query(Camera).filter(Camera.is_enabled == True).all()
            logger.info(f"Initializing {len(cameras)} enabled cameras from database...")
            for cam in cameras:
                self.start_worker_for_camera(cam)
        except Exception as e:
            logger.error(f"Error initializing cameras: {e}")
        finally:
            db.close()

    def start_worker_for_camera(self, camera: Camera) -> None:
        """Create and start AI vision worker for a specific camera."""
        cam_id = camera.camera_id
        if cam_id in self.workers and self.workers[cam_id].is_running:
            return

        def on_incident(payload: Dict[str, Any]) -> None:
            self._handle_incident_event(camera, payload)

        def on_telemetry(telemetry: Dict[str, Any]) -> None:
            self._handle_telemetry_event(telemetry)

        worker = CameraStreamWorker(
            camera_id=camera.camera_id,
            camera_name=camera.name,
            stream_url=camera.url,
            camera_type=camera.camera_type,
            on_incident_callback=on_incident,
            on_telemetry_callback=on_telemetry,
        )
        worker.start()
        self.workers[cam_id] = worker
        logger.info(f"Worker active for camera {cam_id} ({camera.name})")

    def stop_worker(self, camera_id: str) -> None:
        """Stop worker for a specific camera."""
        if camera_id in self.workers:
            self.workers[camera_id].stop()
            del self.workers[camera_id]
            logger.info(f"Stopped worker for camera {camera_id}")

    def stop_all(self) -> None:
        """Stop all running camera workers."""
        for cam_id, worker in list(self.workers.items()):
            worker.stop()
        self.workers.clear()

    def get_worker(self, camera_id: str) -> Optional[CameraStreamWorker]:
        return self.workers.get(camera_id)

    def test_camera_connection(self, camera: Camera) -> Dict[str, Any]:
        """Test stream connectivity for a camera configuration."""
        test_worker = CameraStreamWorker(
            camera_id=f"TEST-{camera.camera_id}",
            camera_name=camera.name,
            stream_url=camera.url,
            camera_type=camera.camera_type,
        )
        try:
            connected = test_worker._init_source()
            test_worker._release_source()
            return {
                "camera_id": camera.camera_id,
                "status": "ONLINE" if connected else "OFFLINE",
                "is_connected": connected,
                "message": "Connection test successful." if connected else "Failed to open camera stream.",
            }
        except Exception as e:
            return {
                "camera_id": camera.camera_id,
                "status": "ERROR",
                "is_connected": False,
                "message": f"Connection error: {str(e)}",
            }

    def _handle_incident_event(self, camera: Camera, payload: Dict[str, Any]) -> None:
        """Persist verified incident with registered camera location and dispatch WebSocket alert."""
        db: Session = SessionLocal()
        try:
            # Generate unique incident ID
            now_utc = datetime.now(timezone.utc)
            timestamp_str = now_utc.strftime("%Y%m%d%H%M%S")
            rand_suffix = int(time.time() * 1000) % 1000
            incident_id = f"INC-{timestamp_str}-{rand_suffix:03d}"

            # Map department enum
            dept_str = payload.get("department", "GENERAL")
            try:
                dept_enum = IncidentDepartment(dept_str)
            except ValueError:
                dept_enum = IncidentDepartment.GENERAL

            # Location-aware binding: pull directly from registered camera metadata
            incident = Incident(
                incident_id=incident_id,
                camera_id=camera.camera_id,
                camera_name=camera.name,
                event_type=payload.get("event_type", "possible_accident"),
                risk=payload.get("risk", "HIGH"),
                confidence=float(payload.get("confidence", 0.8)),
                reason=payload.get("reason", "anomaly"),
                backend=payload.get("backend", "heuristic"),
                status=IncidentStatus.NEW,
                department=dept_enum,
                # Location details
                location=camera.location or "Registered Road Location",
                latitude=camera.latitude,
                longitude=camera.longitude,
                landmark=camera.landmark,
                zone=camera.zone,
                bounding_box=str(payload.get("bounding_box", [0, 0, 0, 0])),
                notes=f"Detected via {payload.get('backend', 'heuristic')} engine at {camera.name}.",
                created_at=now_utc,
            )
            db.add(incident)
            db.commit()
            db.refresh(incident)

            # Build real-time alert payload
            alert_data = {
                "type": "NEW_INCIDENT",
                "incident": {
                    "id": incident.id,
                    "incident_id": incident.incident_id,
                    "camera_id": incident.camera_id,
                    "camera_name": incident.camera_name,
                    "event_type": incident.event_type,
                    "risk": incident.risk,
                    "confidence": incident.confidence,
                    "reason": incident.reason,
                    "backend": incident.backend,
                    "status": incident.status.value,
                    "department": incident.department.value,
                    "location": incident.location,
                    "latitude": incident.latitude,
                    "longitude": incident.longitude,
                    "landmark": incident.landmark,
                    "zone": incident.zone,
                    "created_at": incident.created_at.isoformat(),
                }
            }

            # Asynchronously broadcast via WebSocket
            if self.loop and self.loop.is_running():
                asyncio.run_coroutine_threadsafe(ws_manager.broadcast(alert_data), self.loop)

        except Exception as e:
            logger.error(f"Error handling incident event in database ({e})")
            db.rollback()
        finally:
            db.close()

    def _handle_telemetry_event(self, telemetry: Dict[str, Any]) -> None:
        """Broadcast live telemetry to WebSocket clients."""
        if self.loop and self.loop.is_running():
            msg = {"type": "CAMERA_TELEMETRY", "telemetry": telemetry}
            asyncio.run_coroutine_threadsafe(ws_manager.broadcast(msg), self.loop)


camera_service = CameraService()
