"""
Scenario cases + learning-objective feedback.

Cases: role2builder case exports (JSON/PDF/etc.) attached to an assessment,
optionally tagged with the wickets they exercised. Storage via app.storage
(local disk in dev, S3 in prod); blob_ref key: cases/{case_id}/{filename}.

LO feedback: per-evaluator, per-wicket feedback on whether the scenario and
evaluation supported the learning objective (rating 1-5, keep/change/drop,
free text). Rolls up into the AAR.
"""
import hashlib
import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app import storage
from app.audit import append_entry
from app.auth.deps import get_current_user, require_approved
from app.config import settings
from app.database import get_db
from app.models.scenario_case import LoFeedback, ScenarioCase
from app.models.user import User
from app.routers.assessments import _require_assessment
from app.schemas.assessment import LoFeedbackOut, LoFeedbackUpsert, ScenarioCaseOut
from app.upload_validation import validate_upload

router = APIRouter(tags=["scenario-cases"], dependencies=[Depends(require_approved)])

_RECOMMENDATIONS = {"keep", "change", "drop"}


def _case_out(c: ScenarioCase) -> ScenarioCaseOut:
    return ScenarioCaseOut(
        id=c.id,
        assessment_id=c.assessment_id,
        label=c.label,
        source_ref=c.source_ref,
        event_codes=c.event_codes or [],
        filename=c.filename,
        content_type=c.content_type,
        hash=c.hash,
        uploaded_by=c.uploaded_by,
        uploaded_at=c.uploaded_at,
    )


# ---------------------------------------------------------------------------
# Cases
# ---------------------------------------------------------------------------


@router.get("/api/assessments/{assessment_id}/cases", response_model=list[ScenarioCaseOut])
def list_cases(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_assessment(db, assessment_id)
    rows = (
        db.query(ScenarioCase)
        .filter(ScenarioCase.assessment_id == assessment_id)
        .order_by(ScenarioCase.uploaded_at.desc())
        .all()
    )
    return [_case_out(c) for c in rows]


@router.post(
    "/api/assessments/{assessment_id}/cases",
    response_model=ScenarioCaseOut,
    status_code=status.HTTP_201_CREATED,
)
def upload_case(
    assessment_id: str,
    file: UploadFile,
    label: str = Form(...),
    source_ref: str | None = Form(None),
    event_codes: str | None = Form(None),  # JSON array string
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_assessment(db, assessment_id)
    if not label.strip():
        raise HTTPException(status_code=422, detail="Label is required")

    codes: list[str] = []
    if event_codes:
        try:
            parsed = json.loads(event_codes)
            if not isinstance(parsed, list) or not all(isinstance(c, str) for c in parsed):
                raise ValueError
            codes = parsed
        except ValueError:
            raise HTTPException(status_code=422, detail="event_codes must be a JSON array of strings")

    content = file.file.read()
    validate_upload(content, file.content_type or "", settings.max_upload_bytes)

    case_id = str(uuid.uuid4())
    safe_name = (file.filename or "case").rsplit("/", 1)[-1]
    key = f"cases/{case_id}/{safe_name}"
    storage.put(key, content, file.content_type or "application/octet-stream")

    case = ScenarioCase(
        id=case_id,
        assessment_id=assessment_id,
        label=label.strip(),
        source_ref=(source_ref or "").strip() or None,
        event_codes=codes,
        blob_ref=key,
        hash=hashlib.sha256(content).hexdigest(),
        filename=safe_name,
        content_type=file.content_type or "application/octet-stream",
        uploaded_by=current_user.id,
    )
    db.add(case)
    append_entry(
        db, current_user.id, "case.upload", "scenario_case",
        f"{assessment_id}/{case_id}", None,
        {"label": case.label, "filename": safe_name, "source_ref": case.source_ref},
    )
    db.commit()
    db.refresh(case)
    return _case_out(case)


@router.get("/api/cases/{case_id}/file")
def serve_case_file(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    case = db.get(ScenarioCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return storage.serve(case.blob_ref, case.filename, case.content_type)


@router.delete("/api/assessments/{assessment_id}/cases/{case_id}", status_code=204)
def delete_case(
    assessment_id: str,
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assessment = _require_assessment(db, assessment_id)
    case = db.get(ScenarioCase, case_id)
    if not case or case.assessment_id != assessment_id:
        raise HTTPException(status_code=404, detail="Case not found")
    if case.uploaded_by != current_user.id and assessment.lead_id != current_user.id and current_user.global_role != "admin":
        raise HTTPException(status_code=403, detail="Only the uploader, lead, or an admin can delete a case")
    # Un-link any feedback that referenced this case
    db.query(LoFeedback).filter(LoFeedback.case_id == case_id).update({"case_id": None})
    storage.delete(case.blob_ref)
    append_entry(
        db, current_user.id, "case.delete", "scenario_case",
        f"{assessment_id}/{case_id}", {"label": case.label, "filename": case.filename}, None,
    )
    db.delete(case)
    db.commit()


# ---------------------------------------------------------------------------
# Learning-objective feedback
# ---------------------------------------------------------------------------


def _fb_out(f: LoFeedback, u: User) -> LoFeedbackOut:
    return LoFeedbackOut(
        id=f.id,
        assessment_id=f.assessment_id,
        event_code=f.event_code,
        case_id=f.case_id,
        rating=f.rating,
        recommendation=f.recommendation,
        comment=f.comment,
        created_by=f.created_by,
        author_name=u.display_name,
        updated_at=f.updated_at,
    )


@router.get("/api/assessments/{assessment_id}/lo-feedback", response_model=list[LoFeedbackOut])
def list_lo_feedback(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_assessment(db, assessment_id)
    rows = (
        db.query(LoFeedback, User)
        .join(User, LoFeedback.created_by == User.id)
        .filter(LoFeedback.assessment_id == assessment_id)
        .all()
    )
    return [_fb_out(f, u) for f, u in rows]


@router.put(
    "/api/assessments/{assessment_id}/lo-feedback/{event_code:path}",
    response_model=LoFeedbackOut,
)
def upsert_lo_feedback(
    assessment_id: str,
    event_code: str,
    body: LoFeedbackUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_assessment(db, assessment_id)
    if body.rating is not None and not (1 <= body.rating <= 5):
        raise HTTPException(status_code=422, detail="rating must be 1-5")
    if body.recommendation is not None and body.recommendation not in _RECOMMENDATIONS:
        raise HTTPException(status_code=422, detail=f"recommendation must be one of {_RECOMMENDATIONS}")
    if body.case_id is not None:
        case = db.get(ScenarioCase, body.case_id)
        if not case or case.assessment_id != assessment_id:
            raise HTTPException(status_code=422, detail="case_id does not belong to this assessment")

    fb = (
        db.query(LoFeedback)
        .filter(
            LoFeedback.assessment_id == assessment_id,
            LoFeedback.event_code == event_code,
            LoFeedback.created_by == current_user.id,
        )
        .first()
    )
    before = None
    if fb is None:
        fb = LoFeedback(
            id=str(uuid.uuid4()),
            assessment_id=assessment_id,
            event_code=event_code,
            created_by=current_user.id,
        )
        db.add(fb)
    else:
        before = {"rating": fb.rating, "recommendation": fb.recommendation, "comment": fb.comment}

    fb.rating = body.rating
    fb.recommendation = body.recommendation
    fb.comment = body.comment
    fb.case_id = body.case_id
    fb.updated_at = datetime.now(timezone.utc)

    append_entry(
        db, current_user.id, "lo_feedback.upsert", "lo_feedback",
        f"{assessment_id}/{event_code}", before,
        {"rating": body.rating, "recommendation": body.recommendation, "comment": body.comment},
    )
    db.commit()
    db.refresh(fb)
    return _fb_out(fb, current_user)
