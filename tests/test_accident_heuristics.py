"""Unit tests for dual-backend accident detector and kinematic heuristics."""

import pytest
import numpy as np
from ai_engine.accident_detector import AccidentDetector, AccidentEvent
from ai_engine.tracker import TrackedVehicle


def test_accident_detector_init():
    detector = AccidentDetector(custom_model_path="models/non_existent.pt")
    assert detector.backend == "heuristic"
    assert detector.model is None


def test_vehicle_overlap_detection():
    detector = AccidentDetector(overlap_threshold=0.15)

    v1 = TrackedVehicle(
        track_id=1,
        class_name="car",
        confidence=0.9,
        bbox=(100, 100, 200, 200),
        center=(150, 150),
    )
    v2 = TrackedVehicle(
        track_id=2,
        class_name="truck",
        confidence=0.85,
        bbox=(120, 120, 220, 220),  # Heavy overlap
        center=(170, 170),
    )

    events = detector.detect(frame=None, tracked_vehicles=[v1, v2], timestamp=100.0)
    assert len(events) >= 1
    ev = events[0]
    assert ev.event_type == "possible_accident"
    assert ev.backend == "heuristic"
    assert ev.reason == "vehicle_overlap"
    assert set(ev.related_vehicles) == {1, 2}
    assert ev.risk in ["HIGH", "CRITICAL"]


def test_rapid_convergence_detection():
    detector = AccidentDetector(convergence_threshold=5.0)

    # Two vehicles rapidly closing distance
    v1 = TrackedVehicle(
        track_id=1,
        class_name="car",
        confidence=0.9,
        bbox=(50, 100, 100, 150),
        center=(75, 125),
        velocity=(15.0, 0.0),  # moving right fast
    )
    v2 = TrackedVehicle(
        track_id=2,
        class_name="car",
        confidence=0.88,
        bbox=(140, 100, 190, 150),
        center=(165, 125),
        velocity=(-15.0, 0.0),  # moving left fast
    )

    events = detector.detect(frame=None, tracked_vehicles=[v1, v2], timestamp=100.0)
    assert len(events) >= 1
    reasons = [e.reason for e in events]
    assert "rapid_vehicle_convergence" in reasons
    assert events[0].event_type == "possible_accident"


def test_sudden_stopping_detection():
    detector = AccidentDetector(deceleration_threshold=10.0)

    v = TrackedVehicle(
        track_id=1,
        class_name="car",
        confidence=0.9,
        bbox=(100, 100, 150, 150),
        center=(125, 125),
        speed_history=[15.0, 16.0, 14.0, 1.0],  # Dropped from 16 to 1
    )

    events = detector.detect(frame=None, tracked_vehicles=[v], timestamp=100.0)
    assert len(events) >= 1
    assert events[0].reason == "sudden_stopping"
    assert events[0].event_type == "possible_accident"
