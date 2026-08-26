"""Integration tests for incident lifecycle, location persistence, and department alert queues."""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.main import app
from backend.app.database import SessionLocal
from backend.app.models import Incident, IncidentStatus, IncidentDepartment

client = TestClient(app)


def get_admin_auth_header():
    res = client.post("/api/v1/auth/login", json={"email": "admin@astra.ai", "password": "Admin@12345"})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function", autouse=True)
def seed_test_incidents():
    db: Session = SessionLocal()
    db.query(Incident).filter(Incident.incident_id.in_(["INC-TEST-001", "INC-TEST-002"])).delete(synchronize_session=False)
    db.commit()

    inc1 = Incident(
        incident_id="INC-TEST-001",
        camera_id="CAM-001",
        camera_name="Main Expressway",
        event_type="possible_accident",
        risk="HIGH",
        confidence=0.87,
        reason="rapid_vehicle_convergence",
        backend="heuristic",
        status=IncidentStatus.NEW,
        department=IncidentDepartment.POLICE,
        location="NH-48 KM 42, North Corridor",
        latitude=12.9716,
        longitude=77.5946,
        landmark="Near Electronic City Toll",
        zone="Sector 4 - Highway Zone",
        notes="Automated hazard alert",
        created_at=datetime.now(timezone.utc),
    )
    db.add(inc1)

    inc2 = Incident(
        incident_id="INC-TEST-002",
        camera_id="CAM-003",
        camera_name="Industrial Logistics Flyover",
        event_type="possible_fire",
        risk="CRITICAL",
        confidence=0.92,
        reason="chromatic_flame_intensity",
        backend="heuristic",
        status=IncidentStatus.NEW,
        department=IncidentDepartment.FIRE,
        location="Ring Road Flyover Ramp 3",
        latitude=19.0760,
        longitude=72.8777,
        landmark="Near Chemical Plant Terminal",
        zone="Industrial Corridor",
        notes="Flames detected near barrier",
        created_at=datetime.now(timezone.utc),
    )
    db.add(inc2)
    db.commit()
    db.close()


def test_list_incidents_and_summary():
    headers = get_admin_auth_header()
    res = client.get("/api/v1/incidents", headers=headers)
    assert res.status_code == 200
    incidents = res.json()
    assert len(incidents) >= 2

    # Verify location fields
    test_inc = next((i for i in incidents if i["incident_id"] == "INC-TEST-001"), None)
    assert test_inc is not None
    assert test_inc["location"] == "NH-48 KM 42, North Corridor"
    assert test_inc["latitude"] == 12.9716
    assert test_inc["longitude"] == 77.5946
    assert test_inc["landmark"] == "Near Electronic City Toll"

    # Test summary stats
    sum_res = client.get("/api/v1/incidents/summary", headers=headers)
    assert sum_res.status_code == 200
    summary = sum_res.json()
    assert summary["total_incidents"] >= 2
    assert summary["police_alerts"] >= 1
    assert summary["fire_alerts"] >= 1


def test_department_alert_queues():
    headers = get_admin_auth_header()

    # Police queue
    police_res = client.get("/api/v1/alerts/police", headers=headers)
    assert police_res.status_code == 200
    police_items = police_res.json()
    assert any(i["incident_id"] == "INC-TEST-001" for i in police_items)

    # Fire queue
    fire_res = client.get("/api/v1/alerts/fire", headers=headers)
    assert fire_res.status_code == 200
    fire_items = fire_res.json()
    assert any(i["incident_id"] == "INC-TEST-002" for i in fire_items)


def test_incident_acknowledge_and_resolve_lifecycle():
    headers = get_admin_auth_header()

    # Acknowledge
    ack_res = client.post("/api/v1/incidents/INC-TEST-001/acknowledge", headers=headers)
    assert ack_res.status_code == 200
    assert ack_res.json()["status"] == "ACKNOWLEDGED"
    assert ack_res.json()["acknowledged_by"] == "admin@astra.ai"

    # Add notes
    notes_res = client.post(
        "/api/v1/incidents/INC-TEST-001/notes",
        headers=headers,
        json={"notes": "Patrol vehicle dispatched to scene."},
    )
    assert notes_res.status_code == 200
    assert "Patrol vehicle dispatched" in notes_res.json()["notes"]

    # Resolve
    res_res = client.post("/api/v1/incidents/INC-TEST-001/resolve", headers=headers)
    assert res_res.status_code == 200
    assert res_res.json()["status"] == "RESOLVED"
    assert res_res.json()["resolved_by"] == "admin@astra.ai"
