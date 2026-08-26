"""Unit tests for Risk Scoring and Department Triage Engine."""

import pytest
from ai_engine.risk_engine import RiskEngine, RiskLevel


def test_risk_evaluation_accident():
    ev = {
        "event_type": "possible_accident",
        "confidence": 0.85,
        "reason": "vehicle_overlap",
        "related_vehicles": [1, 2],
        "related_classes": ["car", "motorcycle"],
    }
    result = RiskEngine.evaluate_risk(ev)
    assert result["risk_level"] in [RiskLevel.HIGH.value, RiskLevel.CRITICAL.value]
    assert result["department"] == "AMBULANCE"
    assert result["risk_score"] > 60.0


def test_risk_evaluation_fire():
    ev = {
        "event_type": "possible_fire",
        "confidence": 0.90,
        "reason": "chromatic_flame_intensity",
        "related_vehicles": [],
        "related_classes": [],
    }
    result = RiskEngine.evaluate_risk(ev)
    assert result["risk_level"] == RiskLevel.CRITICAL.value
    assert result["department"] == "FIRE"
    assert result["risk_score"] >= 80.0


def test_risk_evaluation_minor():
    ev = {
        "event_type": "possible_accident",
        "confidence": 0.30,
        "reason": "sudden_stopping",
        "related_vehicles": [1],
        "related_classes": ["car"],
    }
    result = RiskEngine.evaluate_risk(ev)
    assert result["risk_level"] in [RiskLevel.MEDIUM.value, RiskLevel.LOW.value]
