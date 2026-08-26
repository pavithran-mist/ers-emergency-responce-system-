"""Unit tests for Temporal Verification and Incident Debounce Filter."""

import pytest
from ai_engine.temporal_verifier import TemporalVerifier


def test_temporal_verifier_min_hits():
    verifier = TemporalVerifier(window_size=5, min_hits=3, cooldown_seconds=5.0)

    candidate = {
        "event_type": "possible_accident",
        "confidence": 0.8,
        "bounding_box": [100, 100, 200, 200],
        "related_vehicles": [1, 2],
        "reason": "vehicle_overlap",
    }

    # Frame 1: 1 hit -> should not verify yet
    res1 = verifier.process_frame([candidate], timestamp=100.0)
    assert len(res1) == 0

    # Frame 2: 2 hits -> should not verify yet
    res2 = verifier.process_frame([candidate], timestamp=100.033)
    assert len(res2) == 0

    # Frame 3: 3 hits -> reaches min_hits=3 -> Verified!
    res3 = verifier.process_frame([candidate], timestamp=100.066)
    assert len(res3) == 1
    assert res3[0]["event_type"] == "possible_accident"
    assert res3[0]["temporal_hits"] == 3


def test_temporal_verifier_debounce_cooldown():
    verifier = TemporalVerifier(window_size=5, min_hits=2, cooldown_seconds=4.0)

    candidate = {
        "event_type": "possible_accident",
        "confidence": 0.8,
        "bounding_box": [100, 100, 200, 200],
        "related_vehicles": [1, 2],
    }

    # Frame 1: 1 hit
    r1 = verifier.process_frame([candidate], timestamp=10.0)
    assert len(r1) == 0

    # Frame 2: 2 hits -> Triggers first verified alert
    r2 = verifier.process_frame([candidate], timestamp=10.1)
    assert len(r2) == 1

    # Frame 3 (timestamp 10.2 within cooldown of 4.0s) -> should be suppressed
    r3 = verifier.process_frame([candidate], timestamp=10.2)
    assert len(r3) == 0

    # Frame 4 after cooldown expires (timestamp 15.0 >= 10.1 + 4.0) -> Re-triggers!
    r4 = verifier.process_frame([candidate], timestamp=15.0)
    assert len(r4) == 1
    assert r4[0]["event_type"] == "possible_accident"
