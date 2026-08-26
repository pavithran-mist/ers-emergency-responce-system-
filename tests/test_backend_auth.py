"""Integration tests for authentication, approval workflow, and RBAC."""

import time
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["platform"] == "ASTRA AI"
    assert data["status"] == "OPERATIONAL"


def test_admin_login():
    # Login with seeded superadmin credentials
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@astra.ai", "password": "Admin@12345"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "admin@astra.ai"
    assert data["user"]["role"] == "ADMIN"
    assert data["user"]["status"] == "APPROVED"


def test_user_registration_and_approval_flow():
    # 1. Register new operator with unique timestamp email
    unique_suffix = int(time.time() * 1000) % 1000000
    email = f"operator_{unique_suffix}@astra.ai"
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "full_name": "Test Operator",
        },
    )
    assert reg_res.status_code == 201
    user_data = reg_res.json()
    user_id = user_data["id"]
    assert user_data["status"] == "PENDING"
    assert user_data["role"] == "OPERATOR"

    # 2. Attempt login while PENDING -> should be rejected with 403
    pending_login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    assert pending_login.status_code == 403
    assert "pending administrator approval" in pending_login.json()["detail"].lower()

    # 3. Admin logs in and approves the pending user
    admin_login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@astra.ai", "password": "Admin@12345"},
    )
    admin_token = admin_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Check pending list
    pending_list = client.get("/api/v1/admin/users/pending", headers=headers)
    assert pending_list.status_code == 200
    assert any(u["email"] == email for u in pending_list.json())

    # Approve user
    appr_res = client.post(f"/api/v1/admin/users/{user_id}/approve", headers=headers)
    assert appr_res.status_code == 200
    assert appr_res.json()["status"] == "APPROVED"

    # 4. Operator logs in successfully after approval
    op_login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    assert op_login.status_code == 200
    assert "access_token" in op_login.json()
