"""Incident management and lifecycle control API routes."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.database import get_db
from backend.app.models import Incident, IncidentStatus, IncidentDepartment, User
from backend.app.schemas import (
    IncidentResponse,
    IncidentStatusUpdate,
    IncidentNotesUpdate,
    IncidentSummaryStats,
)
from backend.app.auth import require_approved_user, log_audit

router = APIRouter(prefix="/incidents", tags=["Incident Management"])


@router.get("", response_model=List[IncidentResponse])
def list_incidents(
    risk: Optional[str] = Query(None, description="Filter by risk: LOW, MEDIUM, HIGH, CRITICAL"),
    department: Optional[IncidentDepartment] = Query(None, description="Filter by department: POLICE, FIRE, AMBULANCE, GENERAL"),
    status_filter: Optional[IncidentStatus] = Query(None, alias="status", description="Filter by status: NEW, REVIEWING, ACKNOWLEDGED, RESOLVED"),
    camera_id: Optional[str] = Query(None, description="Filter by camera ID"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(require_approved_user),
):
    """Retrieve filtered list of AI-detected incidents with attached location metadata."""
    query = db.query(Incident)

    if risk:
        query = query.filter(Incident.risk == risk.upper())
    if department:
        query = query.filter(Incident.department == department)
    if status_filter:
        query = query.filter(Incident.status == status_filter)
    if camera_id:
        query = query.filter(Incident.camera_id == camera_id.upper())

    return query.order_by(Incident.created_at.desc()).offset(offset).limit(limit).all()


@router.get("/summary", response_model=IncidentSummaryStats)
def get_incident_summary(
    db: Session = Depends(get_db),
    user: User = Depends(require_approved_user),
):
    """Retrieve statistical summary counts of incidents and department queues."""
    total = db.query(func.count(Incident.id)).scalar() or 0
    new_cnt = db.query(func.count(Incident.id)).filter(Incident.status == IncidentStatus.NEW).scalar() or 0
    ack_cnt = db.query(func.count(Incident.id)).filter(Incident.status == IncidentStatus.ACKNOWLEDGED).scalar() or 0
    res_cnt = db.query(func.count(Incident.id)).filter(Incident.status == IncidentStatus.RESOLVED).scalar() or 0
    crit_cnt = db.query(func.count(Incident.id)).filter(Incident.risk == "CRITICAL").scalar() or 0
    high_cnt = db.query(func.count(Incident.id)).filter(Incident.risk == "HIGH").scalar() or 0

    police_cnt = db.query(func.count(Incident.id)).filter(Incident.department == IncidentDepartment.POLICE).scalar() or 0
    fire_cnt = db.query(func.count(Incident.id)).filter(Incident.department == IncidentDepartment.FIRE).scalar() or 0
    amb_cnt = db.query(func.count(Incident.id)).filter(Incident.department == IncidentDepartment.AMBULANCE).scalar() or 0

    return {
        "total_incidents": total,
        "new_incidents": new_cnt,
        "acknowledged_incidents": ack_cnt,
        "resolved_incidents": res_cnt,
        "critical_incidents": crit_cnt,
        "high_risk_incidents": high_cnt,
        "police_alerts": police_cnt,
        "fire_alerts": fire_cnt,
        "ambulance_alerts": amb_cnt,
    }


@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(
    incident_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_approved_user),
):
    """Retrieve detailed information for a specific incident."""
    inc = db.query(Incident).filter((Incident.incident_id == incident_id) | (Incident.id == int(incident_id) if incident_id.isdigit() else False)).first()
    if not inc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found.")
    return inc


@router.post("/{incident_id}/acknowledge", response_model=IncidentResponse)
def acknowledge_incident(
    incident_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_approved_user),
):
    """Mark an incident as ACKNOWLEDGED by an operator or admin."""
    inc = db.query(Incident).filter((Incident.incident_id == incident_id) | (Incident.id == int(incident_id) if incident_id.isdigit() else False)).first()
    if not inc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found.")

    inc.status = IncidentStatus.ACKNOWLEDGED
    inc.acknowledged_by = user.email
    db.commit()
    db.refresh(inc)

    log_audit(
        db,
        action="INCIDENT_ACKNOWLEDGED",
        target_type="incident",
        target_id=inc.incident_id,
        details=f"User {user.email} acknowledged incident {inc.incident_id} ({inc.event_type} at {inc.camera_name}).",
        user=user,
        ip_address=request.client.host if request.client else None,
    )
    return inc


@router.post("/{incident_id}/resolve", response_model=IncidentResponse)
def resolve_incident(
    incident_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_approved_user),
):
    """Mark an incident as RESOLVED."""
    inc = db.query(Incident).filter((Incident.incident_id == incident_id) | (Incident.id == int(incident_id) if incident_id.isdigit() else False)).first()
    if not inc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found.")

    inc.status = IncidentStatus.RESOLVED
    inc.resolved_by = user.email
    db.commit()
    db.refresh(inc)

    log_audit(
        db,
        action="INCIDENT_RESOLVED",
        target_type="incident",
        target_id=inc.incident_id,
        details=f"User {user.email} resolved incident {inc.incident_id}.",
        user=user,
        ip_address=request.client.host if request.client else None,
    )
    return inc


@router.post("/{incident_id}/notes", response_model=IncidentResponse)
def add_incident_notes(
    incident_id: str,
    notes_in: IncidentNotesUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_approved_user),
):
    """Append or update operator notes on an incident."""
    inc = db.query(Incident).filter((Incident.incident_id == incident_id) | (Incident.id == int(incident_id) if incident_id.isdigit() else False)).first()
    if not inc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found.")

    existing_notes = inc.notes or ""
    inc.notes = f"{existing_notes}\n[{user.email}]: {notes_in.notes}".strip()
    db.commit()
    db.refresh(inc)

    log_audit(
        db,
        action="INCIDENT_NOTES_ADDED",
        target_type="incident",
        target_id=inc.incident_id,
        details=f"User {user.email} added notes to incident {inc.incident_id}.",
        user=user,
        ip_address=request.client.host if request.client else None,
    )
    return inc
