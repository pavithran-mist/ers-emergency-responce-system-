"""System settings and dynamic Content Management System (CMS) API routes."""

from typing import List, Dict
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import SystemSetting, User
from backend.app.schemas import SystemSettingResponse, SystemSettingsUpdateBatch
from backend.app.auth import require_approved_user, require_admin, log_audit

router = APIRouter(prefix="/admin/settings", tags=["System Settings & CMS"])

DEFAULT_SETTINGS = [
    ("site_title", "ASTRA AI - Road Safety & Visual Emergency Command", "Application page title", "general"),
    ("organization_name", "National Highway Safety & Emergency Authority", "Organization name", "general"),
    ("logo_text", "ASTRA AI", "Logo display text", "general"),
    ("police_emergency_phone", "100 / 112", "Emergency contact for Police Control Room", "emergency"),
    ("fire_emergency_phone", "101", "Emergency contact for Fire Rescue Control", "emergency"),
    ("ambulance_emergency_phone", "108 / 102", "Emergency contact for Emergency Medical Services", "emergency"),
    ("general_inquiry_email", "command@highway-safety.gov", "General safety inquiry email", "emergency"),
    ("dashboard_main_heading", "Real-Time Road Safety & Visual Emergency Command Center", "Main dashboard banner text", "general"),
    ("detection_sensitivity", "0.40", "YOLO Object Detection Confidence Threshold [0.10 - 0.90]", "detection"),
    ("accident_iou_threshold", "0.15", "Accident Overlap IoU Threshold [0.05 - 0.50]", "detection"),
    ("convergence_threshold", "8.0", "Rapid Vehicle Convergence Rate Threshold", "detection"),
    ("fire_sensitivity", "0.45", "Fire Detection Sensitivity Threshold", "detection"),
]


def seed_default_settings(db: Session) -> None:
    """Ensure standard CMS settings exist in database."""
    for key, val, desc, cat in DEFAULT_SETTINGS:
        existing = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if not existing:
            db.add(SystemSetting(key=key, value=val, description=desc, category=cat))
    db.commit()


@router.get("", response_model=List[SystemSettingResponse])
def get_system_settings(
    db: Session = Depends(get_db),
    user: User = Depends(require_approved_user),
):
    """Retrieve all configurable system settings and CMS values."""
    seed_default_settings(db)
    return db.query(SystemSetting).all()


@router.put("", response_model=List[SystemSettingResponse])
def update_system_settings(
    batch_in: SystemSettingsUpdateBatch,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Batch update configurable CMS parameters (Admin only)."""
    for key, val in batch_in.settings.items():
        setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if setting:
            setting.value = str(val)
        else:
            db.add(SystemSetting(key=key, value=str(val), category="custom"))

    db.commit()

    log_audit(
        db,
        action="SETTINGS_UPDATED",
        target_type="settings",
        target_id="batch",
        details=f"Admin {admin.email} updated {len(batch_in.settings)} system settings.",
        user=admin,
        ip_address=request.client.host if request.client else None,
    )

    return db.query(SystemSetting).all()
