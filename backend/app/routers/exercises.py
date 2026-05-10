import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.database import get_db
from app.models.exercise import Exercise
from app.models.user import User
from app.schemas.exercise import ExerciseCreate, ExerciseOut, ExerciseStatusUpdate

router = APIRouter(prefix="/api/exercises", tags=["exercises"])


@router.post("", response_model=ExerciseOut, status_code=status.HTTP_201_CREATED)
def create_exercise(
    body: ExerciseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.end_date < body.start_date:
        raise HTTPException(status_code=422, detail="end_date must be on or after start_date")
    exercise = Exercise(
        id=str(uuid.uuid4()),
        name=body.name.strip(),
        start_date=body.start_date,
        end_date=body.end_date,
        location=body.location.strip() if body.location else None,
        created_by=current_user.id,
    )
    db.add(exercise)
    db.commit()
    db.refresh(exercise)
    return exercise


@router.get("", response_model=list[ExerciseOut])
def list_exercises(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Exercise).order_by(Exercise.start_date.desc()).all()


@router.get("/{exercise_id}", response_model=ExerciseOut)
def get_exercise(
    exercise_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ex = db.get(Exercise, exercise_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return ex


@router.patch("/{exercise_id}/status", response_model=ExerciseOut)
def update_exercise_status(
    exercise_id: str,
    body: ExerciseStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.global_role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    if body.status not in {"active", "closed"}:
        raise HTTPException(status_code=422, detail="status must be active or closed")
    ex = db.get(Exercise, exercise_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Exercise not found")
    ex.status = body.status
    db.commit()
    db.refresh(ex)
    return ex
