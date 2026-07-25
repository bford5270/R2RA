import collections
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import JWTError
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit import append_entry
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
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    TotpCompleteRequest,
    TotpConfirmRequest,
    TotpEnrollResponse,
    TotpUnenrollRequest,
    UserOut,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

_INVALID = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid credentials",
    headers={"WWW-Authenticate": "Bearer"},
)

# ---------------------------------------------------------------------------
# In-memory sliding-window rate limiter for login attempts
# Keyed by IP; max 10 attempts per 60-second window.
# Thread-safe for single-process deployments (uvicorn workers=1 on EB).
# ---------------------------------------------------------------------------
_LOGIN_WINDOW = 60        # seconds
_LOGIN_MAX_ATTEMPTS = 10
_login_attempts: dict[str, collections.deque] = {}
_login_lock = threading.Lock()


def _check_login_rate(ip: str) -> None:
    now = time.monotonic()
    cutoff = now - _LOGIN_WINDOW
    with _login_lock:
        dq = _login_attempts.setdefault(ip, collections.deque())
        while dq and dq[0] < cutoff:
            dq.popleft()
        if len(dq) >= _LOGIN_MAX_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many login attempts. Try again in a minute.",
            )
        dq.append(now)


# ---------------------------------------------------------------------------
# Login / token
# ---------------------------------------------------------------------------


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    _check_login_rate(request.client.host if request.client else "unknown")
    email = body.email.strip()
    # Case-insensitive lookup — mobile keyboards autocapitalize email fields.
    user: User | None = (
        db.query(User).filter(func.lower(User.email) == email.lower()).first()
    )
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
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the current user's password. Requires current password."""
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    current_user.hashed_password = hash_password(body.new_password)
    db.commit()


@router.delete("/totp", status_code=status.HTTP_204_NO_CONTENT)
def totp_unenroll(
    body: TotpUnenrollRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove TOTP from the current user's account. Requires current password."""
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    current_user.totp_secret = None
    db.commit()


# ---------------------------------------------------------------------------
# User registration (bootstrap + open self-registration → pending approval)
# ---------------------------------------------------------------------------


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    """
    Account request endpoint.

    - First run (0 users): bootstrap — creates the account with the requested
      role (normally admin) so the instance can be set up.
    - After that: open self-registration. The account is created with
      global_role="pending": the user can sign in and browse the read-only
      framework content, but an administrator must approve the account
      (assign assessor/observer/admin) before they can touch assessment data.
    """
    _check_login_rate(request.client.host if request.client else "unknown")

    display_name = body.display_name.strip()
    email = body.email.lower().strip()
    if not display_name or not email:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Name and email are required")
    if len(body.password) < 8:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Password must be at least 8 characters")

    if db.query(User).filter(func.lower(User.email) == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")

    is_bootstrap = db.query(User).count() == 0

    if is_bootstrap:
        if body.global_role not in {"admin", "assessor", "observer"}:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid role")
        role = body.global_role
    else:
        # Requested role is ignored for self-registration — approval assigns it.
        role = "pending"

    user = User(
        id=str(uuid.uuid4()),
        display_name=display_name,
        email=email,
        hashed_password=hash_password(body.password),
        global_role=role,
    )
    db.add(user)
    append_entry(
        db,
        actor_id=user.id,
        action="user.register",
        entity_type="user",
        entity_id=user.id,
        after={"display_name": display_name, "email": email, "global_role": role},
    )
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

