"""Object detector module using YOLO11n for vehicle identification."""

from __future__ import annotations
import logging
from dataclasses import dataclass
from typing import List, Tuple, Dict, Any, Optional
import numpy as np

logger = logging.getLogger("astra.detector")

import os

_PROJ_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DEFAULT_YOLO_PATH = os.path.join(_PROJ_ROOT, "yolo11n.pt")

# COCO Vehicle and traffic class mapping for YOLO
COCO_VEHICLE_CLASSES = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "motorcycle",
    4: "airplane",
    5: "bus",
    6: "train",
    7: "truck",
    8: "boat",
    9: "traffic light",
    11: "stop sign",
    67: "cell phone",
}

TARGET_VEHICLE_NAMES = {"car", "truck", "bus", "motorcycle", "bicycle", "person", "train", "boat", "traffic light", "stop sign", "cell phone"}


@dataclass
class Detection:
    """Represents an object detected in a frame."""
    class_id: int
    class_name: str
    confidence: float
    bbox: Tuple[int, int, int, int]  # (x1, y1, x2, y2) in pixels
    norm_bbox: Tuple[float, float, float, float]  # (x1, y1, x2, y2) normalized [0, 1]
    center: Tuple[int, int]  # (cx, cy)

    @property
    def width(self) -> int:
        return max(0, self.bbox[2] - self.bbox[0])

    @property
    def height(self) -> int:
        return max(0, self.bbox[3] - self.bbox[1])

    @property
    def area(self) -> int:
        return self.width * self.height

    def to_dict(self) -> Dict[str, Any]:
        return {
            "class_id": self.class_id,
            "class_name": self.class_name,
            "confidence": round(self.confidence, 3),
            "bbox": list(self.bbox),
            "norm_bbox": [round(v, 4) for v in self.norm_bbox],
            "center": list(self.center),
        }


class ObjectDetector:
    """YOLO11n Vehicle Detector with fallback capabilities."""

    def __init__(
        self,
        model_path: Optional[str] = None,
        confidence_threshold: float = 0.25,
        target_classes: Optional[set] = None,
        use_cuda: bool = False,
    ):
        self.model_path = model_path or _DEFAULT_YOLO_PATH
        if not os.path.isabs(self.model_path) and not os.path.exists(self.model_path):
            self.model_path = os.path.join(_PROJ_ROOT, self.model_path)

        self.confidence_threshold = confidence_threshold
        self.target_classes = target_classes or TARGET_VEHICLE_NAMES
        self.use_cuda = use_cuda
        self.model = None
        self.backend = "heuristic_fallback"
        self._initialize_model()

    def _initialize_model(self) -> None:
        """Attempt to load Ultralytics YOLO model."""
        try:
            from ultralytics import YOLO  # type: ignore
            import torch  # type: ignore

            device = "cuda" if self.use_cuda and torch.cuda.is_available() else "cpu"
            logger.info(f"Loading YOLO detector model from {self.model_path} on device {device}...")
            self.model = YOLO(self.model_path)
            self.backend = f"yolo_{os.path.basename(self.model_path)}"
            logger.info(f"Detector successfully loaded ({self.backend})")
        except Exception as e:
            logger.warning(f"Could not load YOLO model ({e}). Using heuristic/mock detector backend.")
            self.model = None
            self.backend = "heuristic_fallback"

    def detect(self, frame: np.ndarray) -> List[Detection]:
        """Run object detection on an RGB/BGR image frame.
        
        Args:
            frame: numpy array of image frame (H, W, C)
        Returns:
            List of Detection objects
        """
        if frame is None or frame.size == 0:
            return []

        height, width = frame.shape[:2]
        detections: List[Detection] = []

        if self.model is not None:
            try:
                results = self.model(
                    frame,
                    conf=self.confidence_threshold,
                    verbose=False,
                    device="cuda" if self.use_cuda else "cpu",
                    imgsz=416,
                )
                for res in results:
                    boxes = res.boxes
                    if boxes is None:
                        continue
                    for box in boxes:
                        cls_id = int(box.cls[0].item())
                        cls_name = self.model.names.get(cls_id, str(cls_id)).lower()
                        conf = float(box.conf[0].item())

                        if cls_name not in self.target_classes and cls_id not in COCO_VEHICLE_CLASSES:
                            continue

                        # Resolve standardized class name
                        std_name = COCO_VEHICLE_CLASSES.get(cls_id, cls_name)
                        if std_name not in self.target_classes:
                            continue

                        xyxy = box.xyxy[0].cpu().numpy().astype(int)
                        x1, y1, x2, y2 = int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])
                        
                        # Bound within frame
                        x1 = max(0, min(x1, width - 1))
                        y1 = max(0, min(y1, height - 1))
                        x2 = max(x1 + 1, min(x2, width))
                        y2 = max(y1 + 1, min(y2, height))

                        norm_bbox = (
                            x1 / width,
                            y1 / height,
                            x2 / width,
                            y2 / height,
                        )
                        center = ((x1 + x2) // 2, (y1 + y2) // 2)

                        detections.append(
                            Detection(
                                class_id=cls_id,
                                class_name=std_name,
                                confidence=conf,
                                bbox=(x1, y1, x2, y2),
                                norm_bbox=norm_bbox,
                                center=center,
                            )
                        )
                return detections
            except Exception as e:
                logger.error(f"YOLO inference failed: {e}. Falling back.")

        return detections
