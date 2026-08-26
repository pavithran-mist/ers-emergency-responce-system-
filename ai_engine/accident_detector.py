"""Dual-backend accident detection module (Custom YOLO Model & Motion Heuristics)."""

from __future__ import annotations
import os
import math
import time
import logging
from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Any, Optional
import numpy as np

from ai_engine.tracker import TrackedVehicle, compute_iou

logger = logging.getLogger("astra.accident")


@dataclass
class AccidentEvent:
    """Represents a detected possible accident event."""
    event_type: str = "possible_accident"
    confidence: float = 0.0
    bounding_box: Tuple[int, int, int, int] = (0, 0, 0, 0)
    related_vehicles: List[int] = field(default_factory=list)
    related_classes: List[str] = field(default_factory=list)
    reason: str = "unknown"
    backend: str = "heuristic"  # 'custom_model' or 'heuristic'
    timestamp: float = field(default_factory=time.time)
    risk: str = "HIGH"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_type": self.event_type,
            "confidence": round(self.confidence, 3),
            "bounding_box": list(self.bounding_box),
            "related_vehicles": self.related_vehicles,
            "related_classes": self.related_classes,
            "reason": self.reason,
            "backend": self.backend,
            "timestamp": self.timestamp,
            "risk": self.risk,
        }


class AccidentDetector:
    """Detects possible accidents using either a custom trained model or kinematic heuristics."""

    def __init__(
        self,
        custom_model_path: str = "models/road_accident.pt",
        overlap_threshold: float = 0.15,
        convergence_threshold: float = 8.0,
        deceleration_threshold: float = 12.0,
        angular_deviation_threshold: float = 55.0,
    ):
        self.custom_model_path = custom_model_path
        self.overlap_threshold = overlap_threshold
        self.convergence_threshold = convergence_threshold
        self.deceleration_threshold = deceleration_threshold
        self.angular_deviation_threshold = angular_deviation_threshold
        
        self.model = None
        self.backend = "heuristic"
        self._load_custom_model_if_available()

    def _load_custom_model_if_available(self) -> None:
        """Check if custom trained YOLO road accident model exists."""
        if os.path.exists(self.custom_model_path):
            try:
                from ultralytics import YOLO  # type: ignore
                logger.info(f"Loading custom accident model from {self.custom_model_path}...")
                self.model = YOLO(self.custom_model_path)
                self.backend = "custom_model"
                logger.info("Custom accident model loaded successfully.")
            except Exception as e:
                logger.warning(f"Failed to load custom accident model ({e}). Using heuristic backend.")
                self.model = None
                self.backend = "heuristic"
        else:
            self.model = None
            self.backend = "heuristic"

    def detect(
        self,
        frame: Optional[np.ndarray],
        tracked_vehicles: List[TrackedVehicle],
        timestamp: Optional[float] = None,
    ) -> List[AccidentEvent]:
        """Detect possible accidents in current frame."""
        if timestamp is None:
            timestamp = time.time()

        events: List[AccidentEvent] = []

        # 1. Try Custom Model if loaded and frame is available
        if self.model is not None and frame is not None and frame.size > 0:
            try:
                results = self.model(frame, conf=0.4, verbose=False)
                for res in results:
                    boxes = res.boxes
                    if boxes is None:
                        continue
                    for box in boxes:
                        cls_id = int(box.cls[0].item())
                        cls_name = self.model.names.get(cls_id, "accident").lower()
                        conf = float(box.conf[0].item())

                        if "accident" in cls_name or "crash" in cls_name or cls_id == 0:
                            xyxy = box.xyxy[0].cpu().numpy().astype(int)
                            bbox = (int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3]))

                            # Find overlapping tracked vehicles
                            involved_ids = []
                            involved_classes = []
                            for tv in tracked_vehicles:
                                if compute_iou(bbox, tv.bbox) > 0.05:
                                    involved_ids.append(tv.track_id)
                                    involved_classes.append(tv.class_name)

                            risk = "CRITICAL" if conf > 0.75 else "HIGH"
                            events.append(
                                AccidentEvent(
                                    event_type="possible_accident",
                                    confidence=conf,
                                    bounding_box=bbox,
                                    related_vehicles=involved_ids,
                                    related_classes=involved_classes,
                                    reason="custom_model_detection",
                                    backend="custom_model",
                                    timestamp=timestamp,
                                    risk=risk,
                                )
                            )
                if events:
                    return events
            except Exception as e:
                logger.error(f"Custom model inference error: {e}. Falling back to heuristic.")

        # 2. Heuristic Detection Backend
        heuristic_events = self._detect_heuristics(tracked_vehicles, timestamp)
        events.extend(heuristic_events)

        return events

    def _detect_heuristics(
        self,
        vehicles: List[TrackedVehicle],
        timestamp: float,
    ) -> List[AccidentEvent]:
        """Kinematic heuristic evaluation on tracked vehicle pairs and dynamics."""
        events: List[AccidentEvent] = []
        n = len(vehicles)
        if n < 1:
            return events

        ROAD_VEHICLES = {"car", "truck", "bus", "motorcycle", "bicycle"}
        MOTORIZED_VEHICLES = {"car", "truck", "bus", "motorcycle"}

        # Pairwise vehicle interactions
        for i in range(n):
            v1 = vehicles[i]
            for j in range(i + 1, n):
                v2 = vehicles[j]

                # An accident requires at least one participant to be a road vehicle
                # (e.g. car+car, car+motorcycle, car+person). Two people or person+phone is NOT a vehicle accident.
                has_road_vehicle = (v1.class_name in ROAD_VEHICLES) or (v2.class_name in ROAD_VEHICLES)
                if not has_road_vehicle:
                    continue

                # A. Vehicle Overlap / IoU Collision
                iou = compute_iou(v1.bbox, v2.bbox)
                if iou >= self.overlap_threshold:
                    # Enclosing union bounding box
                    u_bbox = (
                        min(v1.bbox[0], v2.bbox[0]),
                        min(v1.bbox[1], v2.bbox[1]),
                        max(v1.bbox[2], v2.bbox[2]),
                        max(v1.bbox[3], v2.bbox[3]),
                    )
                    confidence = min(0.95, 0.50 + iou * 0.8)
                    risk = "CRITICAL" if (iou > 0.35 or "motorcycle" in [v1.class_name, v2.class_name] or "person" in [v1.class_name, v2.class_name]) else "HIGH"

                    events.append(
                        AccidentEvent(
                            event_type="possible_accident",
                            confidence=confidence,
                            bounding_box=u_bbox,
                            related_vehicles=[v1.track_id, v2.track_id],
                            related_classes=[v1.class_name, v2.class_name],
                            reason="vehicle_overlap" if (v1.class_name in ROAD_VEHICLES and v2.class_name in ROAD_VEHICLES) else "vehicle_pedestrian_impact",
                            backend="heuristic",
                            timestamp=timestamp,
                            risk=risk,
                        )
                    )
                    continue

                # B. Rapid Vehicle Convergence
                # Vector from v1 to v2
                dx = v2.center[0] - v1.center[0]
                dy = v2.center[1] - v1.center[1]
                distance = math.hypot(dx, dy)

                if 0 < distance < 120 and (v1.class_name in ROAD_VEHICLES or v2.class_name in ROAD_VEHICLES):
                    # Relative velocity: (v1 -> v2)
                    rel_vx = v1.velocity[0] - v2.velocity[0]
                    rel_vy = v1.velocity[1] - v2.velocity[1]

                    # Dot product of relative velocity and displacement vector
                    # Positive means closing distance rapidly
                    approach_rate = (rel_vx * dx + rel_vy * dy) / distance

                    if approach_rate > self.convergence_threshold:
                        u_bbox = (
                            min(v1.bbox[0], v2.bbox[0]),
                            min(v1.bbox[1], v2.bbox[1]),
                            max(v1.bbox[2], v2.bbox[2]),
                            max(v1.bbox[3], v2.bbox[3]),
                        )
                        confidence = min(0.90, 0.55 + (approach_rate / 30.0) * 0.35)
                        risk = "HIGH" if approach_rate > 15.0 else "MEDIUM"
                        events.append(
                            AccidentEvent(
                                event_type="possible_accident",
                                confidence=confidence,
                                bounding_box=u_bbox,
                                related_vehicles=[v1.track_id, v2.track_id],
                                related_classes=[v1.class_name, v2.class_name],
                                reason="rapid_vehicle_convergence",
                                backend="heuristic",
                                timestamp=timestamp,
                                risk=risk,
                            )
                        )

        # Single vehicle anomalies (Sudden stopping or abnormal trajectory deviation)
        # Apply ONLY to motorized road vehicles (car, truck, bus, motorcycle)
        for v in vehicles:
            if v.class_name not in MOTORIZED_VEHICLES:
                continue

            # C. Sudden Stopping (High deceleration after fast movement)
            if len(v.speed_history) >= 4:
                recent_max_speed = max(v.speed_history[:-1])
                current_speed = v.speed_history[-1]
                decel = recent_max_speed - current_speed

                if recent_max_speed > 10.0 and decel > self.deceleration_threshold and current_speed < 2.0:
                    events.append(
                        AccidentEvent(
                            event_type="possible_accident",
                            confidence=min(0.85, 0.50 + (decel / 25.0) * 0.35),
                            bounding_box=v.bbox,
                            related_vehicles=[v.track_id],
                            related_classes=[v.class_name],
                            reason="sudden_stopping",
                            backend="heuristic",
                            timestamp=timestamp,
                            risk="MEDIUM",
                        )
                    )

            # D. Abnormal Trajectory / Sharp Deviation
            if len(v.history) >= 6:
                p_start = v.history[-6]
                p_mid = v.history[-3]
                p_curr = v.history[-1]

                v1_x, v1_y = p_mid[0] - p_start[0], p_mid[1] - p_start[1]
                v2_x, v2_y = p_curr[0] - p_mid[0], p_curr[1] - p_mid[1]

                m1 = math.hypot(v1_x, v1_y)
                m2 = math.hypot(v2_x, v2_y)

                if m1 > 5.0 and m2 > 5.0:
                    dot = (v1_x * v2_x + v1_y * v2_y) / (m1 * m2)
                    dot = max(-1.0, min(1.0, dot))
                    angle_diff = math.degrees(math.acos(dot))

                    if angle_diff > self.angular_deviation_threshold:
                        events.append(
                            AccidentEvent(
                                event_type="possible_accident",
                                confidence=min(0.82, 0.45 + (angle_diff / 180.0) * 0.37),
                                bounding_box=v.bbox,
                                related_vehicles=[v.track_id],
                                related_classes=[v.class_name],
                                reason="abnormal_trajectory",
                                backend="heuristic",
                                timestamp=timestamp,
                                risk="HIGH" if angle_diff > 90.0 else "MEDIUM",
                            )
                        )

        return events
