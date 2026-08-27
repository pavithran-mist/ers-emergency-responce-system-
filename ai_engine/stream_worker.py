"""Camera stream worker that executes end-to-end AI vision pipeline on live video feeds."""

from __future__ import annotations
import threading
import time
import random
import logging
import os
from typing import Callable, Optional, Dict, Any, List
import numpy as np
import cv2

from ai_engine.detector import ObjectDetector, Detection
from ai_engine.tracker import VehicleTracker, TrackedVehicle
from ai_engine.accident_detector import AccidentDetector
from ai_engine.fire_smoke_detector import FireSmokeDetector
from ai_engine.temporal_verifier import TemporalVerifier
from ai_engine.risk_engine import RiskEngine, RiskLevel
from ai_engine.synthetic_feed import SyntheticTrafficGenerator

logger = logging.getLogger("astra.worker")


class CameraStreamWorker:
    """Processes a video feed (RTSP/IP/Webcam/File/Synthetic) through the ASTRA AI Vision pipeline."""

    def __init__(
        self,
        camera_id: str,
        camera_name: str,
        stream_url: str,
        camera_type: str = "synthetic",
        custom_accident_model: Optional[str] = None,
        custom_fire_model: Optional[str] = None,
        on_incident_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
        on_telemetry_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ):
        self.camera_id = camera_id
        self.camera_name = camera_name
        self.stream_url = stream_url
        self.camera_type = camera_type.lower()
        self.on_incident_callback = on_incident_callback
        self.on_telemetry_callback = on_telemetry_callback
        # Synthetic feeds are capped deliberately so the demo does not consume all CPU.
        # Real camera feeds process as quickly as the inference hardware permits.
        self.synthetic_target_fps = max(1, int(os.getenv("ASTRA_SYNTHETIC_FPS", "30")))
        self.use_cuda = os.getenv("ASTRA_USE_CUDA", "false").strip().lower() in {"1", "true", "yes"}

        # Initialize AI Pipeline Modules with Real Deep Learning YOLO models & Radiant Core Engine
        self.detector = ObjectDetector(confidence_threshold=0.25, use_cuda=self.use_cuda)
        self.tracker = VehicleTracker(max_age=15, iou_threshold=0.20)
        self.accident_detector = AccidentDetector(custom_model_path=custom_accident_model)
        self.fire_smoke_detector = FireSmokeDetector(custom_model_path=custom_fire_model, enable_heuristic_fire=True, enable_heuristic_smoke=False)
        self.temporal_verifier = TemporalVerifier(window_size=5, min_hits=2, cooldown_seconds=5.0)

        # Worker state
        self.is_running = False
        self.is_connected = False
        self.thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

        # Latest telemetry & frame buffer
        self.latest_raw_frame: Optional[np.ndarray] = None
        self.latest_annotated_frame: Optional[np.ndarray] = None
        self.latest_jpeg: Optional[bytes] = None
        self.latest_telemetry: Dict[str, Any] = {
            "camera_id": self.camera_id,
            "status": "STOPPED",
            "fps": 0.0,
            "vehicle_count": 0,
            "vehicles": [],
            "risk_level": "LOW",
            "risk_score": 0.0,
            "hazards": [],
            "ai_backend": {
                "detector": self.detector.backend,
                "accident": self.accident_detector.backend,
                "fire_smoke": self.fire_smoke_detector.backend,
            },
        }

        # Video source
        self.cap: Optional[cv2.VideoCapture] = None
        self.synthetic_gen: Optional[SyntheticTrafficGenerator] = None

    def start(self) -> None:
        """Start the background processing thread."""
        if self.is_running:
            return
        self.is_running = True
        self.thread = threading.Thread(target=self._run_loop, daemon=True, name=f"ASTRA-{self.camera_id}")
        self.thread.start()
        logger.info(f"Started AI Vision worker for camera {self.camera_id} ({self.camera_type})")

    def stop(self) -> None:
        """Stop worker and release camera source."""
        self.is_running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2.0)
        self._release_source()
        with self._lock:
            self.is_connected = False
            self.latest_telemetry["status"] = "STOPPED"
        logger.info(f"Stopped AI Vision worker for camera {self.camera_id}")

    def _init_source(self) -> bool:
        """Open video stream source."""
        if self.camera_type == "synthetic" or self.stream_url.lower() in ["synthetic", "demo", "sim", "mock"]:
            self.synthetic_gen = SyntheticTrafficGenerator()
            self.is_connected = True
            return True

        try:
            # Handle webcam integer index
            if self.stream_url.isdigit() or self.camera_type == "webcam":
                cam_idx = int(self.stream_url) if self.stream_url.isdigit() else 0
                self.cap = cv2.VideoCapture(cam_idx, cv2.CAP_DSHOW)
                if not self.cap or not self.cap.isOpened():
                    self.cap = cv2.VideoCapture(cam_idx)
                if self.cap and self.cap.isOpened():
                    self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                    self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                    self.cap.set(cv2.CAP_PROP_FPS, 30)
                    self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            else:
                self.cap = cv2.VideoCapture(self.stream_url)
                if self.cap and self.cap.isOpened():
                    self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

            if self.cap is not None and self.cap.isOpened():
                self.is_connected = True
                self.synthetic_gen = None
                logger.info(f"Successfully connected to real video source: {self.stream_url}")
                return True
            else:
                logger.warning(f"Could not connect to camera source '{self.stream_url}'. Retrying in loop...")
                self.is_connected = False
                with self._lock:
                    self.latest_telemetry["status"] = "OFFLINE"
                return False
        except Exception as e:
            logger.error(f"Error opening camera {self.camera_id} source ({e}).")
            self.is_connected = False
            return False

    def _release_source(self) -> None:
        if self.cap is not None:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None
        self.synthetic_gen = None

    def _run_loop(self) -> None:
        """Main high-FPS AI vision loop."""
        frame_times: List[float] = []
        last_telemetry_emit = 0.0
        frame_counter = 0
        last_detections: Optional[List[Detection]] = None

        while self.is_running:
            if not self.is_connected:
                if not self._init_source():
                    time.sleep(2.0)
                    continue

            # 1. Grab Frame
            frame = None
            if self.synthetic_gen is not None:
                frame = self.synthetic_gen.get_next_frame()
                time.sleep(1.0 / self.synthetic_target_fps)
            elif self.cap is not None:
                ret, frame = self.cap.read()
                if not ret or frame is None:
                    self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, frame = self.cap.read()
                    if not ret:
                        time.sleep(0.1)
                        self.is_connected = False
                        continue

            if frame is None:
                continue

            current_time = time.time()

            # 2. YOLO Object & Vehicle Detection
            detections = self.detector.detect(frame)

            # If in synthetic mode with mock detector, generate ground-truth simulated detections
            if self.synthetic_gen is not None and not detections:
                detections = self._extract_synthetic_detections(frame)

            # 3. Vehicle & Object Tracking
            tracked = self.tracker.update(detections, timestamp=current_time)

            # 4. Accident Detection (Custom Deep Learning YOLO Model)
            raw_accidents = self.accident_detector.detect(frame, tracked, timestamp=current_time)

            # 5. Fire & Smoke Detection (Custom Deep Learning YOLO Model)
            raw_fire_smoke = self.fire_smoke_detector.detect(frame, timestamp=current_time)

            # Collect raw candidate hazards
            raw_candidates = [ev.to_dict() for ev in raw_accidents] + [ev.to_dict() for ev in raw_fire_smoke]

            # 6. Temporal Verification & Debounce
            verified_hazards = self.temporal_verifier.process_frame(raw_candidates, timestamp=current_time)

            # 7. Risk Engine Scoring
            scene_risk = RiskEngine.compute_scene_risk(tracked, raw_candidates)

            # Calculate FPS
            frame_times.append(time.time())
            frame_times = [t for t in frame_times if (current_time - t) <= 1.0]
            current_fps = round(len(frame_times), 1)

            # 8. Annotate Frame with HUD & Bounding Boxes
            annotated = self._render_annotations(
                frame.copy(),
                tracked,
                raw_candidates,
                scene_risk,
                current_fps,
            )

            # 9. Encode JPEG buffer
            _, jpeg_buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 80])
            jpeg_bytes = jpeg_buf.tobytes()

            # 10. Update Telemetry State
            telemetry = {
                "camera_id": self.camera_id,
                "camera_name": self.camera_name,
                "status": "ONLINE",
                "fps": current_fps,
                "vehicle_count": len(tracked),
                "vehicles": [t.to_dict() for t in tracked],
                "risk_level": scene_risk["risk_level"],
                "risk_score": scene_risk["risk_score"],
                "hazards": raw_candidates,
                "ai_backend": {
                    "detector": self.detector.backend,
                    "accident": self.accident_detector.backend,
                    "fire_smoke": self.fire_smoke_detector.backend,
                },
                "timestamp": current_time,
            }

            with self._lock:
                self.latest_raw_frame = frame
                self.latest_annotated_frame = annotated
                self.latest_jpeg = jpeg_bytes
                self.latest_telemetry = telemetry

            # Dispatch Verified Incidents to Callback
            if verified_hazards and self.on_incident_callback:
                for hazard in verified_hazards:
                    risk_eval = RiskEngine.evaluate_risk(hazard, tracked)
                    incident_payload = {
                        "camera_id": self.camera_id,
                        "camera_name": self.camera_name,
                        "event_type": hazard.get("event_type"),
                        "risk": risk_eval["risk_level"],
                        "confidence": hazard.get("confidence", 0.8),
                        "reason": hazard.get("reason", "unknown"),
                        "backend": hazard.get("backend", "heuristic"),
                        "department": risk_eval["department"],
                        "bounding_box": hazard.get("bounding_box", [0, 0, 0, 0]),
                        "timestamp": current_time,
                    }
                    try:
                        self.on_incident_callback(incident_payload)
                    except Exception as e:
                        logger.error(f"Error in on_incident_callback: {e}")

            # Emit Periodic Telemetry (e.g. 5 times a sec)
            if (current_time - last_telemetry_emit) >= 0.2:
                last_telemetry_emit = current_time
                if self.on_telemetry_callback:
                    try:
                        self.on_telemetry_callback(telemetry)
                    except Exception as e:
                        logger.debug(f"Telemetry callback error: {e}")

    def _extract_synthetic_detections(self, frame: np.ndarray) -> List[Detection]:
        """Generate accurate detections directly from synthetic vehicle positions."""
        if not self.synthetic_gen:
            return []
        h, w = frame.shape[:2]
        dets: List[Detection] = []
        cls_map = {"car": 2, "truck": 7, "bus": 5, "motorcycle": 3}
        
        for v in self.synthetic_gen.vehicles:
            x1 = max(0, int(v.x - v.width // 2))
            y1 = max(0, int(v.y - v.height // 2))
            x2 = min(w, int(v.x + v.width // 2))
            y2 = min(h, int(v.y + v.height // 2))
            if x2 > x1 and y2 > y1:
                dets.append(
                    Detection(
                        class_id=cls_map.get(v.vtype, 2),
                        class_name=v.vtype,
                        confidence=0.88 + random.uniform(0.01, 0.08),
                        bbox=(x1, y1, x2, y2),
                        norm_bbox=(x1 / w, y1 / h, x2 / w, y2 / h),
                        center=((x1 + x2) // 2, (y1 + y2) // 2),
                    )
                )
        return dets

    def _render_annotations(
        self,
        frame: np.ndarray,
        tracked: List[TrackedVehicle],
        hazards: List[Dict[str, Any]],
        scene_risk: Dict[str, Any],
        fps: float,
    ) -> np.ndarray:
        """Render high-contrast bounding boxes, HUD telemetry, and emergency alerts."""
        h, w = frame.shape[:2]

        # Top HUD Banner (Dark translucent panel)
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (w, 42), (15, 18, 24), -1)
        cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)

        # Status & Telemetry text
        # LIVE indicator (green circle)
        cv2.circle(frame, (18, 21), 6, (0, 255, 100), -1)
        cv2.putText(frame, "LIVE", (30, 26), cv2.FONT_HERSHEY_DUPLEX, 0.55, (255, 255, 255), 1)

        # Camera info
        cv2.putText(frame, f"CAM: {self.camera_id} | AI: ACTIVE", (85, 26), cv2.FONT_HERSHEY_DUPLEX, 0.50, (0, 220, 255), 1)

        # Risk Banner badge
        risk_level = scene_risk.get("risk_level", "LOW")
        risk_colors = {
            "LOW": (50, 200, 50),
            "MEDIUM": (0, 180, 240),
            "HIGH": (0, 120, 255),
            "CRITICAL": (30, 30, 240),
        }
        r_color = risk_colors.get(risk_level, (50, 200, 50))
        cv2.putText(frame, f"RISK: {risk_level}", (w - 200, 26), cv2.FONT_HERSHEY_DUPLEX, 0.55, r_color, 2)
        cv2.putText(frame, f"FPS: {fps}", (w - 75, 26), cv2.FONT_HERSHEY_DUPLEX, 0.50, (200, 200, 200), 1)

        # Draw Vehicle Bounding Boxes
        for tv in tracked:
            x1, y1, x2, y2 = tv.bbox
            color = (0, 230, 255)  # Cyan
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

            label = f"{tv.class_name.upper()} {int(tv.confidence * 100)}%"
            t_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)[0]
            cv2.rectangle(frame, (x1, max(0, y1 - 18)), (x1 + t_size[0] + 6, max(18, y1)), color, -1)
            cv2.putText(frame, label, (x1 + 3, max(14, y1 - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (10, 10, 10), 1)

        # Draw Hazard / Incident Bounding Boxes
        for hz in hazards:
            ev_type = hz.get("event_type", "")
            bbox = hz.get("bounding_box", [0, 0, 0, 0])
            conf = int(hz.get("confidence", 0.5) * 100)
            reason = hz.get("reason", "anomaly")
            backend = hz.get("backend", "heuristic")
            risk = hz.get("risk", "HIGH")

            bx1, by1, bx2, by2 = bbox
            if bx2 <= bx1 or by2 <= by1:
                continue

            hazard_color = (0, 0, 255) if "accident" in ev_type or risk == "CRITICAL" else (0, 140, 255)
            cv2.rectangle(frame, (bx1, by1), (bx2, by2), hazard_color, 3)

            # Flashing tag banner
            title = f"{ev_type.upper().replace('_', ' ')} [{risk}] {conf}%"
            subtitle = f"{reason} ({backend})"

            ts1 = cv2.getTextSize(title, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)[0]
            ts2 = cv2.getTextSize(subtitle, cv2.FONT_HERSHEY_SIMPLEX, 0.40, 1)[0]
            box_w = max(ts1[0], ts2[0]) + 10

            cv2.rectangle(frame, (bx1, max(0, by1 - 36)), (bx1 + box_w, max(36, by1)), hazard_color, -1)
            cv2.putText(frame, title, (bx1 + 5, max(15, by1 - 20)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)
            cv2.putText(frame, subtitle, (bx1 + 5, max(30, by1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (230, 240, 255), 1)

        return frame

    def get_latest_jpeg(self) -> Optional[bytes]:
        """Retrieve the latest encoded JPEG frame."""
        with self._lock:
            return self.latest_jpeg

    def get_telemetry(self) -> Dict[str, Any]:
        """Retrieve the latest telemetry snapshot."""
        with self._lock:
            return dict(self.latest_telemetry)
