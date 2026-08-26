"""Pydantic schemas for request validation and response models."""

from __future__ import annotations
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from backend.app.models import UserRole, UserStatus, IncidentStatus, IncidentDepartment


# ==========================================
# AUTH & USER SCHEMAS
# ==========================================

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: UserRole
    status: UserStatus
    created_at: datetime


class UserApprovalUpdate(BaseModel):
    action: str  # 'approve', 'reject', 'disable', 'enable'
    role: Optional[UserRole] = None


class UserRoleUpdate(BaseModel):
    role: UserRole


# ==========================================
# CAMERA SCHEMAS
# ==========================================

class CameraBase(BaseModel):
    camera_id: str
    name: str
    url: str
    camera_type: str = "synthetic"  # synthetic, rtsp, ip_stream, webcam, video_file, phone_stream
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    landmark: Optional[str] = None
    zone: Optional[str] = None
    description: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    is_enabled: bool = True


class CameraCreate(CameraBase):
    pass


class CameraUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    camera_type: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    landmark: Optional[str] = None
    zone: Optional[str] = None
    description: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    is_enabled: Optional[bool] = None
    status: Optional[str] = None


class CameraResponse(CameraBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    created_at: datetime
    updated_at: datetime


class CameraTestResponse(BaseModel):
    camera_id: str
    status: str
    is_connected: bool
    message: str
    fps: float = 0.0


# ==========================================
# INCIDENT & ALERT SCHEMAS
# ==========================================

class IncidentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    incident_id: str
    camera_id: str
    camera_name: str
    event_type: str
    risk: str
    confidence: float
    reason: str
    backend: str
    status: IncidentStatus
    department: IncidentDepartment
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    landmark: Optional[str] = None
    zone: Optional[str] = None
    bounding_box: Optional[str] = None
    notes: Optional[str] = None
    acknowledged_by: Optional[str] = None
    resolved_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class IncidentStatusUpdate(BaseModel):
    status: IncidentStatus
    notes: Optional[str] = None


class IncidentNotesUpdate(BaseModel):
    notes: str


class IncidentSummaryStats(BaseModel):
    total_incidents: int
    new_incidents: int
    acknowledged_incidents: int
    resolved_incidents: int
    critical_incidents: int
    high_risk_incidents: int
    police_alerts: int
    fire_alerts: int
    ambulance_alerts: int


# ==========================================
# SYSTEM SETTING & AUDIT SCHEMAS
# ==========================================

class SystemSettingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    key: str
    value: str
    description: Optional[str] = None
    category: str
    updated_at: datetime


class SystemSettingsUpdateBatch(BaseModel):
    settings: Dict[str, str]


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: datetime


# ==========================================
# AI STATUS & TELEMETRY SCHEMAS
# ==========================================

class AIStatusResponse(BaseModel):
    ai_status: str  # ACTIVE / IDLE
    total_cameras: int
    active_workers: int
    detector_backend: str
    accident_backend: str
    fire_smoke_backend: str
    global_fps: float
    total_vehicles_detected: int
    active_hazards: int
