"""Integration tests for camera management and location registration."""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def get_admin_auth_header():
    res = client.post("/api/v1/auth/login", json={"email": "admin@astra.ai", "password": "Admin@12345"})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_list_cameras():
    headers = get_admin_auth_header()
    res = client.get("/api/v1/cameras", headers=headers)
    assert res.status_code == 200
    cams = res.json()
    assert len(cams) >= 3
    # Check that location and landmark are present
    assert cams[0]["location"] is not None
    assert "CAM-" in cams[0]["camera_id"]


def test_create_and_delete_camera():
    headers = get_admin_auth_header()
    cam_id = "CAM-TEST-99"

    # 1. Create camera
    create_res = client.post(
        "/api/v1/cameras",
        headers=headers,
        json={
            "camera_id": cam_id,
            "name": "Test Highway Camera",
            "url": "synthetic",
            "camera_type": "synthetic",
            "location": "Airport Expressway KM 12",
            "latitude": 13.1986,
            "longitude": 77.7066,
            "landmark": "Near Terminal 2 Approach",
            "zone": "Airport Security Corridor",
            "description": "High-res monitoring camera",
            "is_enabled": True,
        },
    )
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["camera_id"] == cam_id
    assert data["latitude"] == 13.1986
    assert data["longitude"] == 77.7066

    # 2. Test connectivity
    test_res = client.post(f"/api/v1/cameras/{cam_id}/test", headers=headers)
    assert test_res.status_code == 200
    assert test_res.json()["is_connected"] is True

    # 3. Delete camera
    del_res = client.delete(f"/api/v1/cameras/{cam_id}", headers=headers)
    assert del_res.status_code == 200
