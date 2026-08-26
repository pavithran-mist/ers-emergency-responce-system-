"""SQLAlchemy Database models for ASTRA AI Platform."""

from __future__ import annotations
import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    Text,
    Enum,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from backend.app.database import Base


def utc_now() -> datetime:
    """Helper to return current timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    OPERATOR = "OPERATOR"


class UserStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    DISABLED = "DISABLED"


class IncidentStatus(str, enum.Enum):
    NEW = "NEW"
    REVIEWING = "REVIEWING"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"


class IncidentDepartment(str, enum.Enum):
    POLICE = "POLICE"
    FIRE = "FIRE"
    AMBULANCE = "AMBULANCE"
    GENERAL = "GENERAL"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.OPERATOR, nullable=False)
    status = Column(Enum(UserStatus), default=UserStatus.PENDING, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)


class Camera(Base):
    __tablename__ = "cameras"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(String(64), unique=True, index=True, nullable=False)  # e.g., CAM-001
    name = Column(String(255), nullable=False)
    url = Column(String(512), nullable=False)  # RTSP/IP/Webcam/File/Synthetic URL
    camera_type = Column(String(64), default="synthetic", nullable=False)  # rtsp, ip_stream, webcam, video_file, phone_stream, synthetic
    location = Column(String(255), nullable=False)  # Address / location string
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    landmark = Column(String(255), nullable=True)
    zone = Column(String(128), nullable=True)
    description = Column(Text, nullable=True)
    username = Column(String(128), nullable=True)
    password = Column(String(128), nullable=True)
    status = Column(String(64), default="ONLINE", nullable=False)  # ONLINE, OFFLINE, ERROR
    is_enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String(64), unique=True, index=True, nullable=False)  # e.g. INC-20260824-001
    camera_id = Column(String(64), ForeignKey("cameras.camera_id"), nullable=False, index=True)
    camera_name = Column(String(255), nullable=False)
    
    # Event Classification
    event_type = Column(String(64), nullable=False, index=True)  # possible_accident, possible_fire, possible_smoke
    risk = Column(String(32), nullable=False, index=True)  # LOW, MEDIUM, HIGH, CRITICAL
    confidence = Column(Float, nullable=False)
    reason = Column(String(255), nullable=False)
    backend = Column(String(64), default="heuristic", nullable=False)  # custom_model, heuristic
    
    # Workflow State & Department Dispatch
    status = Column(Enum(IncidentStatus), default=IncidentStatus.NEW, nullable=False, index=True)
    department = Column(Enum(IncidentDepartment), default=IncidentDepartment.GENERAL, nullable=False, index=True)
    
    # Location Metadata (Copied from camera for historical integrity)
    location = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    landmark = Column(String(255), nullable=True)
    zone = Column(String(128), nullable=True)
    
    # Audit & Operator Notes
    bounding_box = Column(String(128), nullable=True)  # [x1, y1, x2, y2]
    notes = Column(Text, nullable=True)
    acknowledged_by = Column(String(255), nullable=True)
    resolved_by = Column(String(255), nullable=True)
    
    created_at = Column(DateTime, default=utc_now, nullable=False, index=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(128), unique=True, index=True, nullable=False)
    value = Column(Text, nullable=False)
    description = Column(String(255), nullable=True)
    category = Column(String(64), default="general", nullable=False)  # general, contacts, alerts, ai
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    user_email = Column(String(255), nullable=True)
    action = Column(String(128), nullable=False, index=True)
    target_type = Column(String(64), nullable=True)  # USER, CAMERA, INCIDENT, SETTING
    target_id = Column(String(128), nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(64), nullable=True)
    timestamp = Column(DateTime, default=utc_now, nullable=False, index=True)
