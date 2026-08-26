"""Authentication and registration route handlers."""

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.config import settings
from backend.app.models import User, UserRole, UserStatus
from backend.app.schemas import UserRegister, UserLogin, Token, UserResponse
from backend.app.auth import hash_password, verify_password, create_access_token, get_current_user, log_audit

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(
    user_in: UserRegister,
    request: Request,
    db: Session = Depends(get_db),
):
    """Register a new user account. Account status starts as PENDING until reviewed by an admin."""
    existing = db.query(User).filter(User.email == user_in.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    # Check if this is the initial default admin seed
    is_default_admin = (user_in.email.lower() == settings.DEFAULT_ADMIN_EMAIL.lower())
    initial_role = UserRole.ADMIN if is_default_admin else UserRole.OPERATOR
    initial_status = UserStatus.APPROVED if is_default_admin else UserStatus.PENDING

    new_user = User(
        email=user_in.email.lower(),
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name,
        role=initial_role,
        status=initial_status,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_audit(
        db,
        action="USER_REGISTERED",
        target_type="user",
        target_id=str(new_user.id),
        details=f"New user registered ({new_user.email}) - Status: {new_user.status.value}",
        user=new_user,
        ip_address=request.client.host if request.client else None,
    )

    return new_user


@router.post("/login", response_model=Token)
def login_user(
    credentials: UserLogin,
    request: Request,
    db: Session = Depends(get_db),
):
    """Authenticate user with email and password. Rejects pending, rejected, or disabled accounts."""
    user = db.query(User).filter(User.email == credentials.email.lower()).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if user.status == UserStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is pending administrator approval. Please wait for an administrator to review your request.",
        )
    if user.status == UserStatus.REJECTED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your registration request has been rejected by the administrator.",
        )
    if user.status == UserStatus.DISABLED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact your system administrator.",
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(
        data={"sub": user.email, "role": user.role.value, "id": user.id},
        expires_delta=access_token_expires,
    )

    log_audit(
        db,
        action="USER_LOGIN",
        target_type="user",
        target_id=str(user.id),
        details=f"User {user.email} logged in successfully.",
        user=user,
        ip_address=request.client.host if request.client else None,
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
):
    """Retrieve current logged in user details."""
    return current_user


@router.post("/logout")
def logout_user(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Log out current user."""
    log_audit(
        db,
        action="USER_LOGOUT",
        target_type="user",
        target_id=str(current_user.id),
        details=f"User {current_user.email} logged out.",
        user=current_user,
        ip_address=request.client.host if request.client else None,
    )
    return {"message": "Logged out successfully."}
