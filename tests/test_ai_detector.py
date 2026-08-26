"""Unit tests for YOLO object detector and vehicle tracker."""

import pytest
import numpy as np
from ai_engine.detector import ObjectDetector, Detection, COCO_VEHICLE_CLASSES
from ai_engine.tracker import VehicleTracker, TrackedVehicle, compute_iou


def test_detector_initialization():
    detector = ObjectDetector(confidence_threshold=0.4)
    assert detector is not None
    assert detector.confidence_threshold == 0.4


def test_detector_empty_frame():
    detector = ObjectDetector()
    detections = detector.detect(None)
    assert detections == []

    empty_frame = np.zeros((0, 0, 3), dtype=np.uint8)
    assert detector.detect(empty_frame) == []


def test_compute_iou():
    box1 = (10, 10, 50, 50)
    box2 = (10, 10, 50, 50)
    assert pytest.approx(compute_iou(box1, box2), 0.01) == 1.0

    box3 = (100, 100, 150, 150)
    assert compute_iou(box1, box3) == 0.0

    # Partial overlap
    box4 = (30, 30, 70, 70)
    iou = compute_iou(box1, box4)
    assert 0.0 < iou < 1.0


def test_vehicle_tracker_association():
    tracker = VehicleTracker(max_age=5)
    
    # Frame 1: Vehicle at (100, 100, 150, 150)
    det1 = Detection(
        class_id=2,
        class_name="car",
        confidence=0.9,
        bbox=(100, 100, 150, 150),
        norm_bbox=(0.1, 0.1, 0.15, 0.15),
        center=(125, 125),
    )
    tracks_f1 = tracker.update([det1], timestamp=1000.0)
    assert len(tracks_f1) == 1
    t1_id = tracks_f1[0].track_id
    assert tracks_f1[0].class_name == "car"

    # Frame 2: Vehicle moved slightly to (105, 100, 155, 150)
    det2 = Detection(
        class_id=2,
        class_name="car",
        confidence=0.92,
        bbox=(105, 100, 155, 150),
        norm_bbox=(0.105, 0.1, 0.155, 0.15),
        center=(130, 125),
    )
    tracks_f2 = tracker.update([det2], timestamp=1000.033)
    assert len(tracks_f2) == 1
    assert tracks_f2[0].track_id == t1_id
    assert tracks_f2[0].speed > 0
