"""
S3T evaluator taskings for the T&R stream.

Workflow: S3T (the assessment lead or an admin) assigns a set of PECL wickets
and/or METs to an evaluator. The evaluator sees only their tasking, scores
those wickets, and returns the tasking to S3T. Returned taskings soft-lock the
evaluator's wickets (lead can reopen).
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.audit import append_entry
from app.auth.deps import get_current_user, require_approved
from app.database import get_db
from app.models.assessment import Assessment
from app.models.exercise import Exercise
from app.models.tr_response import TrResponse
from app.models.tr_tasking import TrTasking
from app.models.unit import Unit
from app.models.user import User
from app.schemas.assessment import MyTrTaskingOut, TrTaskingOut, TrTaskingUpsert

router = APIRouter(tags=["tr-taskings"], dependencies=[Depends(require_approved)])


def _require_assessment(db: Session, assessment_id: str) -> Assessment:
    a = db.get(Assessment, assessment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return a


def _require_s3t(assessment: Assessment, current_user: User) -> None:
    if assessment.lead_id != current_user.id and current_user.global_role != "admin":
        raise HTTPException(status_code=403, detail="Only the lead assessor or an admin can manage taskings")


def _out(t: TrTasking, u: User) -> TrTaskingOut:
    return TrTaskingOut(
        id=t.id,
        assessment_id=t.assessment_id,
        user_id=t.user_id,
        display_name=u.display_name,
        email=u.email,
        event_codes=t.event_codes or [],
        mets=t.mets or [],
        note=t.note,
        status=t.status,
        assigned_at=t.assigned_at,
        returned_at=t.returned_at,
    )


@router.get("/api/assessments/{assessment_id}/tr-taskings", response_model=list[TrTaskingOut])
def list_tr_taskings(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_assessment(db, assessment_id)
    rows = (
        db.query(TrTasking, User)
        .join(User, TrTasking.user_id == User.id)
        .filter(TrTasking.assessment_id == assessment_id)
        .all()
    )
    return [_out(t, u) for t, u in rows]


@router.put("/api/assessments/{assessment_id}/tr-taskings/{user_id}", response_model=TrTaskingOut)
def upsert_tr_tasking(
    assessment_id: str,
    user_id: str,
    body: TrTaskingUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assessment = _require_assessment(db, assessment_id)
    _require_s3t(assessment, current_user)
    if not body.event_codes:
        raise HTTPException(status_code=422, detail="Tasking must include at least one wicket")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="User not found")
    if user.global_role == "pending":
        raise HTTPException(status_code=422, detail="User is awaiting account approval")

    tasking = (
        db.query(TrTasking)
        .filter(TrTasking.assessment_id == assessment_id, TrTasking.user_id == user_id)
        .first()
    )
    before = None
    if tasking is None:
        tasking = TrTasking(
            id=str(uuid.uuid4()),
            assessment_id=assessment_id,
            user_id=user_id,
            event_codes=body.event_codes,
            mets=body.mets,
            note=body.note,
            assigned_by=current_user.id,
        )
        db.add(tasking)
    else:
        before = {"event_codes": tasking.event_codes, "mets": tasking.mets, "status": tasking.status}
        tasking.event_codes = body.event_codes
        tasking.mets = body.mets
        tasking.note = body.note
        # Re-tasking reopens a returned tasking
        tasking.status = "assigned"
        tasking.returned_at = None
        tasking.assigned_by = current_user.id

    append_entry(
        db, current_user.id, "tr_tasking.assign", "tr_tasking",
        f"{assessment_id}/{user_id}", before,
        {"event_codes": body.event_codes, "mets": body.mets, "note": body.note},
    )
    db.commit()
    db.refresh(tasking)
    return _out(tasking, user)


@router.delete("/api/assessments/{assessment_id}/tr-taskings/{tasking_id}", status_code=204)
def delete_tr_tasking(
    assessment_id: str,
    tasking_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assessment = _require_assessment(db, assessment_id)
    _require_s3t(assessment, current_user)
    tasking = db.get(TrTasking, tasking_id)
    if not tasking or tasking.assessment_id != assessment_id:
        raise HTTPException(status_code=404, detail="Tasking not found")
    append_entry(
        db, current_user.id, "tr_tasking.delete", "tr_tasking",
        f"{assessment_id}/{tasking.user_id}",
        {"event_codes": tasking.event_codes, "status": tasking.status}, None,
    )
    db.delete(tasking)
    db.commit()


@router.post("/api/tr-taskings/{tasking_id}/return", response_model=TrTaskingOut)
def return_tr_tasking(
    tasking_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Evaluator returns their completed tasking to S3T."""
    tasking = db.get(TrTasking, tasking_id)
    if not tasking:
        raise HTTPException(status_code=404, detail="Tasking not found")
    if tasking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the assigned evaluator can return this tasking")
    if tasking.status == "returned":
        raise HTTPException(status_code=409, detail="Tasking already returned")
    tasking.status = "returned"
    tasking.returned_at = datetime.now(timezone.utc)
    append_entry(
        db, current_user.id, "tr_tasking.return", "tr_tasking",
        f"{tasking.assessment_id}/{tasking.user_id}",
        {"status": "assigned"}, {"status": "returned"},
    )
    db.commit()
    db.refresh(tasking)
    return _out(tasking, current_user)


@router.post("/api/tr-taskings/{tasking_id}/reopen", response_model=TrTaskingOut)
def reopen_tr_tasking(
    tasking_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """S3T reopens a returned tasking so the evaluator can revise."""
    tasking = db.get(TrTasking, tasking_id)
    if not tasking:
        raise HTTPException(status_code=404, detail="Tasking not found")
    assessment = _require_assessment(db, tasking.assessment_id)
    _require_s3t(assessment, current_user)
    if tasking.status != "returned":
        raise HTTPException(status_code=409, detail="Tasking is not returned")
    tasking.status = "assigned"
    tasking.returned_at = None
    append_entry(
        db, current_user.id, "tr_tasking.reopen", "tr_tasking",
        f"{tasking.assessment_id}/{tasking.user_id}",
        {"status": "returned"}, {"status": "assigned"},
    )
    db.commit()
    db.refresh(tasking)
    user = db.get(User, tasking.user_id)
    return _out(tasking, user)


@router.get("/api/tr-taskings/mine", response_model=list[MyTrTaskingOut])
def my_tr_taskings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The current user's taskings across assessments, with progress counts."""
    rows = (
        db.query(TrTasking, Assessment, Unit)
        .join(Assessment, TrTasking.assessment_id == Assessment.id)
        .join(Unit, Assessment.unit_id == Unit.id)
        .filter(TrTasking.user_id == current_user.id)
        .order_by(TrTasking.assigned_at.desc())
        .all()
    )
    out: list[MyTrTaskingOut] = []
    for tasking, assessment, unit in rows:
        codes = set(tasking.event_codes or [])
        scored = (
            db.query(TrResponse)
            .filter(
                TrResponse.assessment_id == tasking.assessment_id,
                TrResponse.event_code.in_(codes),
                TrResponse.status != "unanswered",
            )
            .count()
            if codes
            else 0
        )
        exercise = db.get(Exercise, assessment.exercise_id) if assessment.exercise_id else None
        out.append(
            MyTrTaskingOut(
                id=tasking.id,
                assessment_id=tasking.assessment_id,
                unit_name=unit.name,
                unit_uic=unit.uic,
                exercise_name=exercise.name if exercise else None,
                event_codes=tasking.event_codes or [],
                mets=tasking.mets or [],
                note=tasking.note,
                status=tasking.status,
                assigned_at=tasking.assigned_at,
                returned_at=tasking.returned_at,
                scored_count=scored,
            )
        )
    return out
