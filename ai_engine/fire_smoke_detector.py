"""Fire and smoke detection module with trained model support and color/texture heuristic fallback."""

from __future__ import annotations
import os
import time
import logging
from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Any, Optional
import numpy as np
import cv2

logger = logging.getLogger("astra.firesmoke")


@dataclass
class FireSmokeEvent:
    """Represents a detected possible fire or possible smoke event."""
    event_type: str  # 'possible_fire' or 'possible_smoke'
    confidence: float
    bounding_box: Tuple[int, int, int, int]  # (x1, y1, x2, y2)
    reason: str
    backend: str = "custom_model"  # 'custom_model' or 'heuristic'
    timestamp: float = field(default_factory=time.time)
    risk: str = "HIGH"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_type": self.event_type,
            "confidence": round(self.confidence, 3),
            "bounding_box": list(self.bounding_box),
            "reason": self.reason,
            "backend": self.backend,
            "timestamp": self.timestamp,
            "risk": self.risk,
        }


class FireSmokeDetector:
    """Detects fire and smoke with a trained model and a temporal optical fallback."""

    def __init__(
        self,
        custom_model_path: str = "models/fire_detection.pt",
        min_fire_area: int = 200,
        min_smoke_area: int = 1500,
        enable_heuristic_fire: bool = True,
        enable_heuristic_smoke: bool = False,
    ):
        self.custom_model_path = custom_model_path
        self.min_fire_area = min_fire_area
        self.min_smoke_area = min_smoke_area
        self.enable_heuristic_fire = enable_heuristic_fire
        self.enable_heuristic_smoke = enable_heuristic_smoke
        
        self.model = None
        self.backend = "heuristic"
        self._load_model_if_available()

        # Temporal history for dynamic flicker calculation
        self.prev_fire_mask: Optional[np.ndarray] = None

    def _load_model_if_available(self) -> None:
        """Check if custom trained fire/smoke YOLO model exists."""
        if os.path.exists(self.custom_model_path):
            try:
                from ultralytics import YOLO  # type: ignore
                logger.info(f"Loading custom fire/smoke YOLO model from {self.custom_model_path}...")
                self.model = YOLO(self.custom_model_path)
                self.backend = "custom_model"
                logger.info("Fire/smoke YOLO model loaded successfully.")
            except Exception as e:
                logger.warning(f"Failed to load fire model ({e}). Using optical flame fallback.")
                self.model = None
                self.backend = "heuristic"
        else:
            self.model = None
            self.backend = "heuristic"

    def detect(self, frame: np.ndarray, timestamp: Optional[float] = None) -> List[FireSmokeEvent]:
        """Detect possible fire and smoke in an image frame."""
        if frame is None or frame.size == 0:
            return []

        if timestamp is None:
            timestamp = time.time()

        events: List[FireSmokeEvent] = []

        # 1. Custom YOLO Deep Learning Model
        if self.model is not None:
            try:
                # A higher threshold is intentional: emergency alerts should favour
                # precision and require a human operator to review the incident.
                results = self.model(frame, conf=0.60, verbose=False, imgsz=416)
                for res in results:
                    boxes = res.boxes
                    if boxes is None:
                        continue
                    for box in boxes:
                        cls_id = int(box.cls[0].item())
                        cls_name = self.model.names.get(cls_id, "").lower()
                        conf = float(box.conf[0].item())

                        xyxy = box.xyxy[0].cpu().numpy().astype(int)
                        bbox = (int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3]))

                        if "fire" in cls_name or "flame" in cls_name:
                            events.append(
                                FireSmokeEvent(
                                    event_type="possible_fire",
                                    confidence=conf,
                                    bounding_box=bbox,
                                    reason="custom_fire_model",
                                    backend="custom_model",
                                    timestamp=timestamp,
                                    risk="CRITICAL" if conf > 0.70 else "HIGH",
                                )
                            )
                        elif "smoke" in cls_name:
                            events.append(
                                FireSmokeEvent(
                                    event_type="possible_smoke",
                                    confidence=conf,
                                    bounding_box=bbox,
                                    reason="custom_smoke_model",
                                    backend="custom_model",
                                    timestamp=timestamp,
                                    risk="HIGH" if conf > 0.70 else "MEDIUM",
                                )
                            )
                if events:
                    return events
            except Exception as e:
                logger.error(f"Fire/smoke YOLO model inference failed: {e}.")

        # 2. High-Luminance Flame Optics Engine
        if self.enable_heuristic_fire:
            fire_events = self._detect_fire_heuristic(frame, timestamp)
            events.extend(fire_events)

        if self.enable_heuristic_smoke:
            smoke_events = self._detect_smoke_heuristic(frame, timestamp)
            events.extend(smoke_events)

        return events

    def _detect_fire_heuristic(self, frame: np.ndarray, timestamp: float) -> List[FireSmokeEvent]:
        """Detect flame characteristics via high-luminance glowing core & chromatic radiant gradient."""
        events: List[FireSmokeEvent] = []
        try:
            h, w = frame.shape[:2]
            total_frame_area = w * h
            
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            b, g, r = cv2.split(frame)

            # 1. Flame Chromatic Signature:
            # - Intense red dominance: R > G > B
            # - High red channel intensity: R > 195
            # - Low blue channel: B < 130
            # - Distinct red-to-green margin: R - G > 20
            rgb_flame = (r > g) & (g > b) & (r > 195) & (b < 130) & ((r.astype(np.int16) - g.astype(np.int16)) > 20)

            # 2. HSV flame hue (Red-Orange-Yellow spectrum)
            lower_flame1 = np.array([0, 90, 160], dtype=np.uint8)
            upper_flame1 = np.array([32, 255, 255], dtype=np.uint8)
            lower_flame2 = np.array([170, 90, 160], dtype=np.uint8)
            upper_flame2 = np.array([180, 255, 255], dtype=np.uint8)

            mask_hsv1 = cv2.inRange(hsv, lower_flame1, upper_flame1)
            mask_hsv2 = cv2.inRange(hsv, lower_flame2, upper_flame2)
            mask_hsv = cv2.bitwise_or(mask_hsv1, mask_hsv2)

            # Combined candidate flame pixels
            candidate_mask = np.where(rgb_flame & (mask_hsv > 0), 255, 0).astype(np.uint8)

            # Morphological consolidation
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            cleaned = cv2.morphologyEx(candidate_mask, cv2.MORPH_OPEN, kernel)
            cleaned = cv2.dilate(cleaned, kernel, iterations=2)

            contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            for cnt in contours:
                area = cv2.contourArea(cnt)
                # Ignore tiny noise and massive whole-room backgrounds (> 40% screen)
                if self.min_fire_area <= area <= (total_frame_area * 0.40):
                    bx, by, bw, bh = cv2.boundingRect(cnt)
                    
                    # Distinguish real emissive flame from flat matte clothing:
                    # Flames have an intensely bright luminous core (peak brightness > 215)
                    roi_r = r[by : by + bh, bx : bx + bw]
                    roi_v = hsv[by : by + bh, bx : bx + bw, 2]

                    max_val = int(np.max(roi_v)) if roi_v.size > 0 else 0
                    max_r = int(np.max(roi_r)) if roi_r.size > 0 else 0

                    # Must have an emissive glowing core (peak value > 210) to reject dull clothing fabrics
                    if max_val >= 205 and max_r >= 210:
                        conf = min(0.94, 0.62 + (max_val / 255.0) * 0.30)
                        events.append(
                            FireSmokeEvent(
                                event_type="possible_fire",
                                confidence=conf,
                                bounding_box=(bx, by, bx + bw, by + bh),
                                reason="radiant_flame_intensity",
                                backend="heuristic",
                                timestamp=timestamp,
                                risk="CRITICAL" if area > 1200 else "HIGH",
                            )
                        )
        except Exception as e:
            logger.debug(f"Optical flame detection error: {e}")

        return events

    def _detect_smoke_heuristic(self, frame: np.ndarray, timestamp: float) -> List[FireSmokeEvent]:
        """Detect smoke dispersion characteristics with diffuse cloud texture filtering."""
        events: List[FireSmokeEvent] = []
        try:
            h, w = frame.shape[:2]
            total_frame_area = w * h
            
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            b, g, r = cv2.split(frame)

            s_channel = hsv[:, :, 1]
            v_channel = hsv[:, :, 2]
            rg_diff = np.abs(r.astype(np.int16) - g.astype(np.int16))
            gb_diff = np.abs(g.astype(np.int16) - b.astype(np.int16))

            smoke_mask = (s_channel < 25) & (v_channel > 110) & (v_channel < 205) & (rg_diff < 8) & (gb_diff < 8)
            smoke_bin = np.where(smoke_mask, 255, 0).astype(np.uint8)

            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (11, 11))
            cleaned = cv2.morphologyEx(smoke_bin, cv2.MORPH_CLOSE, kernel)
            cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel)

            contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            for cnt in contours:
                area = cv2.contourArea(cnt)
                if self.min_smoke_area <= area <= (total_frame_area * 0.65):
                    bx, by, bw, bh = cv2.boundingRect(cnt)
                    bbox_area = bw * bh
                    fill_ratio = area / max(1.0, bbox_area)

                    if 0.20 <= fill_ratio <= 1.0:
                        conf = min(0.85, 0.50 + fill_ratio * 0.32)
                        events.append(
                            FireSmokeEvent(
                                event_type="possible_smoke",
                                confidence=conf,
                                bounding_box=(bx, by, bx + bw, by + bh),
                                reason="low_chrominance_dispersion",
                                backend="heuristic",
                                timestamp=timestamp,
                                risk="HIGH" if area > 4000 else "MEDIUM",
                            )
                        )
        except Exception as e:
            logger.debug(f"Heuristic smoke detection error: {e}")

        return events
