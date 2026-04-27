import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user, require_admin
from app.auth.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.auth.totp import generate_totp_secret, get_totp_uri, verify_totp
from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    TotpCompleteRequest,
    TotpConfirmRequest,
    TotpEnrollResponse,
    UserOut,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

_INVALID = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


# ---------------------------------------------------------------------------
# Login / token
# ---------------------------------------------------------------------------


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user: User | None = db.query(User).filter(User.email == body.email).first()
    if not user or not user.is_active or not verify_password(body.password, user.hashed_password):
        raise _INVALID

    if user.totp_secret:
        partial = create_access_token(
            subject=user.id,
            extra={"totp_pending": True},
            expires_delta=timedelta(minutes=5),
        )
        return LoginResponse(access_token=partial, totp_required=True)

    token = create_access_token(subject=user.id)
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return LoginResponse(access_token=token)


@router.post("/totp/complete", response_model=LoginResponse)
def totp_complete(body: TotpCompleteRequest, db: Session = Depends(get_db)):
    """Exchange a partial token + TOTP code for a full access token."""
    try:
        payload = decode_access_token(body.partial_token)
    except JWTError:
        raise _INVALID

    if not payload.get("totp_pending"):
        raise _INVALID

    user_id: str | None = payload.get("sub")
    user = db.get(User, user_id) if user_id else None
    if not user or not user.is_active or not user.totp_secret:
        raise _INVALID

    if not verify_totp(user.totp_secret, body.code):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid TOTP code")

    token = create_access_token(subject=user.id)
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return LoginResponse(access_token=token)


# ---------------------------------------------------------------------------
# Current user
# ---------------------------------------------------------------------------


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return UserOut(
        id=current_user.id,
        display_name=current_user.display_name,
        email=current_user.email,
        global_role=current_user.global_role,
        totp_enrolled=current_user.totp_secret is not None,
        created_at=current_user.created_at,
        last_login_at=current_user.last_login_at,
    )


# ---------------------------------------------------------------------------
# TOTP enrollment
# ---------------------------------------------------------------------------


@router.post("/totp/enroll", response_model=TotpEnrollResponse)
def totp_enroll(current_user: User = Depends(get_current_user)):
    """Generate a new TOTP secret. Client must confirm with /totp/confirm."""
    if current_user.totp_secret:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="TOTP already enrolled")
    secret = generate_totp_secret()
    uri = get_totp_uri(secret, current_user.email)
    return TotpEnrollResponse(secret=secret, uri=uri)


@router.post("/totp/confirm", status_code=status.HTTP_204_NO_CONTENT)
def totp_confirm(
    body: TotpConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Activate TOTP after the user verifies their authenticator app scanned correctly."""
    if current_user.totp_secret:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="TOTP already enrolled")
    if not verify_totp(body.secret, body.code):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid TOTP code")
    current_user.totp_secret = body.secret
    db.commit()


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the current user's password. Requires current password."""
    current_pw = body.get("current_password", "")
    new_pw = body.get("new_password", "")
    if not verify_password(current_pw, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if len(new_pw) < 8:
        raise HTTPException(status_code=422, detail="New password must be at least 8 characters")
    current_user.hashed_password = hash_password(new_pw)
    db.commit()


@router.delete("/totp", status_code=status.HTTP_204_NO_CONTENT)
def totp_unenroll(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove TOTP from the current user's account."""
    current_user.totp_secret = None
    db.commit()


# ---------------------------------------------------------------------------
# User registration (bootstrap + admin-only)
# ---------------------------------------------------------------------------


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """
    Bootstrap endpoint: open only when no users exist yet (first-run admin seed).
    After that, only an admin can create accounts via /admin/users (future).
    Returns 409 if a user already exists and the caller is unauthenticated.
    """
    existing_count: int = db.query(User).count()
    if existing_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Registration is closed; contact your administrator",
        )

    if body.global_role not in {"admin", "assessor", "observer"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid role")

    user = User(
        id=str(uuid.uuid4()),
        display_name=body.display_name,
        email=body.email,
        hashed_password=hash_password(body.password),
        global_role=body.global_role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut(
        id=user.id,
        display_name=user.display_name,
        email=user.email,
        global_role=user.global_role,
        totp_enrolled=False,
        created_at=user.created_at,
        last_login_at=None,
    )
