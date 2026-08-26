"""System Audit Trail API routes."""

from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import AuditLog, User
from backend.app.schemas import AuditLogResponse
from backend.app.auth import require_admin

router = APIRouter(prefix="/admin", tags=["Audit Logs"])


@router.get("/audit-logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Retrieve chronologically ordered system audit trail logs (Admin only)."""
    return (
        db.query(AuditLog)
        .order_by(AuditLog.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
