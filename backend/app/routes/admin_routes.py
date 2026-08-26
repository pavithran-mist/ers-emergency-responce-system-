"""Admin user management and approval API routes."""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import User, UserRole, UserStatus
from backend.app.schemas import UserResponse, UserApprovalUpdate, UserRoleUpdate
from backend.app.auth import require_admin, log_audit

router = APIRouter(prefix="/admin", tags=["Admin User Management"])


@router.get("/users", response_model=List[UserResponse])
def list_all_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """List all registered users."""
    return db.query(User).order_by(User.created_at.desc()).all()


@router.get("/users/pending", response_model=List[UserResponse])
def list_pending_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """List all users waiting for administrator approval."""
    return db.query(User).filter(User.status == UserStatus.PENDING).order_by(User.created_at.asc()).all()


@router.post("/users/{user_id}/approve", response_model=UserResponse)
def approve_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Approve a pending user registration."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    target_user.status = UserStatus.APPROVED
    db.commit()
    db.refresh(target_user)

    log_audit(
        db,
        action="USER_APPROVED",
        target_type="user",
        target_id=str(target_user.id),
        details=f"Admin {admin.email} approved user {target_user.email}.",
        user=admin,
        ip_address=request.client.host if request.client else None,
    )
    return target_user


@router.post("/users/{user_id}/reject", response_model=UserResponse)
def reject_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Reject a pending user registration."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    target_user.status = UserStatus.REJECTED
    db.commit()
    db.refresh(target_user)

    log_audit(
        db,
        action="USER_REJECTED",
        target_type="user",
        target_id=str(target_user.id),
        details=f"Admin {admin.email} rejected user {target_user.email}.",
        user=admin,
        ip_address=request.client.host if request.client else None,
    )
    return target_user


@router.post("/users/{user_id}/disable", response_model=UserResponse)
def disable_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Deactivate/disable an approved user account."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if target_user.id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin cannot disable their own account.")

    target_user.status = UserStatus.DISABLED
    db.commit()
    db.refresh(target_user)

    log_audit(
        db,
        action="USER_DISABLED",
        target_type="user",
        target_id=str(target_user.id),
        details=f"Admin {admin.email} disabled account for {target_user.email}.",
        user=admin,
        ip_address=request.client.host if request.client else None,
    )
    return target_user


@router.post("/users/{user_id}/enable", response_model=UserResponse)
def enable_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Re-enable a disabled user account."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    target_user.status = UserStatus.APPROVED
    db.commit()
    db.refresh(target_user)

    log_audit(
        db,
        action="USER_ENABLED",
        target_type="user",
        target_id=str(target_user.id),
        details=f"Admin {admin.email} re-enabled account for {target_user.email}.",
        user=admin,
        ip_address=request.client.host if request.client else None,
    )
    return target_user


@router.put("/users/{user_id}/role", response_model=UserResponse)
def change_user_role(
    user_id: int,
    role_in: UserRoleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Update user role (ADMIN or OPERATOR)."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    old_role = target_user.role
    target_user.role = role_in.role
    db.commit()
    db.refresh(target_user)

    log_audit(
        db,
        action="USER_ROLE_CHANGED",
        target_type="user",
        target_id=str(target_user.id),
        details=f"Admin {admin.email} changed role of {target_user.email} from {old_role.value} to {role_in.role.value}.",
        user=admin,
        ip_address=request.client.host if request.client else None,
    )
    return target_user
