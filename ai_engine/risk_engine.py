"""Multi-factor road hazard and emergency risk scoring engine."""

from __future__ import annotations
from enum import Enum
from typing import List, Dict, Any, Optional
from ai_engine.tracker import TrackedVehicle


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RiskEngine:
    """Computes comprehensive risk scores, levels, and department routing for detected events."""

    @staticmethod
    def evaluate_risk(
        event: Dict[str, Any],
        tracked_vehicles: Optional[List[TrackedVehicle]] = None,
    ) -> Dict[str, Any]:
        """Calculate numerical risk score (0-100), risk level, and department recommendation.
        
        Args:
            event: Event dictionary containing event_type, confidence, reason, related_classes
            tracked_vehicles: List of current tracked vehicles for context
        Returns:
            Dict with 'risk_level', 'risk_score', 'department', and 'summary'
        """
        event_type = event.get("event_type", "normal")
        confidence = float(event.get("confidence", 0.5))
        reason = event.get("reason", "")
        classes = event.get("related_classes", [])
        num_vehicles = len(event.get("related_vehicles", []))

        base_score = 20.0
        department = "GENERAL"

        if event_type == "possible_accident":
            base_score = 65.0
            department = "POLICE"

            # Multi-vehicle crash escalates to AMBULANCE and higher risk
            if num_vehicles >= 2:
                base_score += 10.0
                department = "AMBULANCE"

            # Vulnerable road users (motorcycle, bicycle)
            if any(c in ["motorcycle", "bicycle"] for c in classes):
                base_score += 15.0
                department = "AMBULANCE"

            # Heavy vehicles (truck, bus)
            if any(c in ["truck", "bus"] for c in classes):
                base_score += 10.0

            if reason == "vehicle_overlap":
                base_score += 10.0
            elif reason == "rapid_vehicle_convergence":
                base_score += 8.0

        elif event_type == "possible_fire":
            base_score = 75.0
            department = "FIRE"
            if confidence > 0.75:
                base_score += 15.0

        elif event_type == "possible_smoke":
            base_score = 50.0
            department = "FIRE"
            if confidence > 0.70:
                base_score += 15.0

        # Scale with confidence factor
        final_score = min(100.0, max(5.0, base_score * (0.6 + 0.4 * confidence)))

        # Categorize into RiskLevel
        if final_score >= 80.0:
            level = RiskLevel.CRITICAL
        elif final_score >= 60.0:
            level = RiskLevel.HIGH
        elif final_score >= 35.0:
            level = RiskLevel.MEDIUM
        else:
            level = RiskLevel.LOW

        return {
            "risk_level": level.value,
            "risk_score": round(final_score, 1),
            "department": department,
        }

    @staticmethod
    def compute_scene_risk(
        vehicles: List[TrackedVehicle],
        events: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Compute aggregate scene risk for a camera feed."""
        if not events and not vehicles:
            return {"risk_level": RiskLevel.LOW.value, "risk_score": 5.0, "active_hazards": 0}

        if events:
            # Find max risk among active events
            highest_score = 0.0
            highest_level = RiskLevel.LOW.value
            for ev in events:
                eval_res = RiskEngine.evaluate_risk(ev, vehicles)
                if eval_res["risk_score"] > highest_score:
                    highest_score = eval_res["risk_score"]
                    highest_level = eval_res["risk_level"]

            return {
                "risk_level": highest_level,
                "risk_score": highest_score,
                "active_hazards": len(events),
            }

        # Baseline traffic density risk
        density = len(vehicles)
        if density > 10:
            return {"risk_level": RiskLevel.MEDIUM.value, "risk_score": 40.0, "active_hazards": 0}
        elif density > 5:
            return {"risk_level": RiskLevel.LOW.value, "risk_score": 20.0, "active_hazards": 0}
        else:
            return {"risk_level": RiskLevel.LOW.value, "risk_score": 10.0, "active_hazards": 0}
