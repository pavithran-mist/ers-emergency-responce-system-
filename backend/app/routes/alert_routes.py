"""Dedicated department alert triage routes for Police, Fire, and Ambulance dispatch centers."""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import Incident, IncidentDepartment, IncidentStatus, User
from backend.app.schemas import IncidentResponse
from backend.app.auth import require_approved_user

router = APIRouter(prefix="/alerts", tags=["Department Alerts"])


@router.get("/police", response_model=List[IncidentResponse])
def get_police_alerts(
    status_filter: Optional[IncidentStatus] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(require_approved_user),
):
    """Retrieve alerts routed to Police Department (Traffic accidents, collisions, lane blockages).
    
    DISCLAIMER: ASTRA is a monitoring/decision-support system and does NOT automatically contact police.
    """
    query = db.query(Incident).filter(Incident.department.in_([IncidentDepartment.POLICE, IncidentDepartment.GENERAL]))
    if status_filter:
        query = query.filter(Incident.status == status_filter)
    return query.order_by(Incident.created_at.desc()).limit(limit).all()


@router.get("/fire", response_model=List[IncidentResponse])
def get_fire_station_alerts(
    status_filter: Optional[IncidentStatus] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(require_approved_user),
):
    """Retrieve alerts routed to Fire Department (Possible fire, possible smoke, vehicle fires).
    
    DISCLAIMER: ASTRA does NOT automatically contact fire emergency services.
    """
    query = db.query(Incident).filter(Incident.department == IncidentDepartment.FIRE)
    if status_filter:
        query = query.filter(Incident.status == status_filter)
    return query.order_by(Incident.created_at.desc()).limit(limit).all()


@router.get("/ambulance", response_model=List[IncidentResponse])
def get_ambulance_alerts(
    status_filter: Optional[IncidentStatus] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(require_approved_user),
):
    """Retrieve alerts routed to Ambulance/Medical Response (High-risk accidents, multi-vehicle crashes).
    
    DISCLAIMER: ASTRA does NOT automatically dispatch ambulances.
    """
    query = db.query(Incident).filter(Incident.department == IncidentDepartment.AMBULANCE)
    if status_filter:
        query = query.filter(Incident.status == status_filter)
    return query.order_by(Incident.created_at.desc()).limit(limit).all()
