import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.auth.security import hash_password
from app.database import get_db
from app.models.user import User
from app.schemas.assessment import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])

VALID_ROLES = {"admin", "assessor", "observer"}


def _require_admin(current_user: User) -> None:
    if current_user.global_role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")


@router.get("", response_model=list[UserOut])
def list_users(
    all: bool = Query(False, description="Include inactive users (admin only)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if all:
        _require_admin(current_user)
        return db.query(User).order_by(User.display_name).all()
    return db.query(User).filter(User.is_active == True).order_by(User.display_name).all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    if body.global_role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail=f"global_role must be one of {VALID_ROLES}")
    if db.query(User).filter(User.email == body.email.lower().strip()).first():
        raise HTTPException(status_code=409, detail="Email already in use")
    user = User(
        id=str(uuid.uuid4()),
        display_name=body.display_name.strip(),
        email=body.email.lower().strip(),
        hashed_password=hash_password(body.password),
        global_role=body.global_role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    body: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot modify your own account here")
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.global_role is not None:
        if body.global_role not in VALID_ROLES:
            raise HTTPException(status_code=422, detail=f"global_role must be one of {VALID_ROLES}")
        user.global_role = body.global_role
    db.commit()
    db.refresh(user)
    return user
