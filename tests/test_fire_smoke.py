"""Unit tests for fire and smoke heuristic detection."""

import pytest
import numpy as np
import cv2
from ai_engine.fire_smoke_detector import FireSmokeDetector


def test_fire_smoke_init():
    detector = FireSmokeDetector(custom_model_path="models/non_existent.pt")
    assert detector.backend in ["yolo_model", "heuristic", "custom_model"]


def test_fire_heuristic_detection():
    detector = FireSmokeDetector(min_fire_area=100, enable_heuristic_fire=True)

    # Create dark frame with bright orange/yellow flame patch
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    # Draw bright flame color (BGR: high red, medium green, low blue)
    cv2.circle(frame, (320, 240), 40, (20, 140, 240), -1)

    events = detector.detect(frame, timestamp=100.0)
    assert len(events) >= 1
    fire_ev = next((e for e in events if e.event_type == "possible_fire"), None)
    assert fire_ev is not None
    assert fire_ev.backend == "heuristic"
    assert fire_ev.confidence > 0.5


def test_smoke_heuristic_detection():
    detector = FireSmokeDetector(min_smoke_area=200, enable_heuristic_smoke=True)

    # Create dark frame with grayish diffuse smoke region
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.rectangle(frame, (200, 150), (440, 300), (140, 140, 140), -1)

    events = detector.detect(frame, timestamp=100.0)
    smoke_ev = next((e for e in events if e.event_type == "possible_smoke"), None)
    assert smoke_ev is not None
    assert smoke_ev.backend == "heuristic"
