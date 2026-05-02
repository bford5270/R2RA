import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.database import get_db
from app.models.assessment import Assessment, AssessmentAssignment
from app.models.response import Response
from app.models.unit import Unit
from app.models.user import User
from app.models.tr_response import TrResponse
import hashlib
import json

from app.audit import append_entry
from app.models.signature import Signature
from app.schemas.assessment import (
    AssessmentCreate,
    AssessmentOut,
    AssignmentOut,
    AssignmentUpsert,
    AuditLogOut,
    ResponseOut,
    ResponseUpsert,
    SignatureOut,
    StatusAdvance,
    TrResponseOut,
    TrResponseUpsert,
)

router = APIRouter(prefix="/api/assessments", tags=["assessments"])


def _snapshot_hash(db: Session, assessment_id: str) -> str:
    """SHA-256 of a stable JSON snapshot of all responses at time of signing."""
    responses = (
        db.query(Response)
        .filter(Response.assessment_id == assessment_id)
        .order_by(Response.item_id)
        .all()
    )
    payload = json.dumps(
        [{"item_id": r.item_id, "status": r.status, "note": r.note, "version": r.version}
         for r in responses],
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def _unit_upsert(db: Session, uic: str, name: str) -> Unit:
    unit = db.query(Unit).filter(Unit.uic == uic).first()
    if unit is None:
        unit = Unit(id=str(uuid.uuid4()), uic=uic, name=name)
        db.add(unit)
        db.flush()
    return unit


def _assessment_out(assessment: Assessment, unit: Unit) -> AssessmentOut:
    return AssessmentOut(
        id=assessment.id,
        unit_id=assessment.unit_id,
        unit_uic=unit.uic,
        unit_name=unit.name,
        mission_type=assessment.mission_type,
        lead_id=assessment.lead_id,
        status=assessment.status,
        service=assessment.service,
        component=assessment.component,
        unique_identifier=assessment.unique_identifier,
        started_at=assessment.started_at,
    )


# ---------------------------------------------------------------------------
# Create assessment
# ---------------------------------------------------------------------------


@router.post("", response_model=AssessmentOut, status_code=status.HTTP_201_CREATED)
def create_assessment(
    body: AssessmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    unit = _unit_upsert(db, body.unit_uic.strip().upper(), body.unit_name.strip())
    assessment = Assessment(
        id=str(uuid.uuid4()),
        unit_id=unit.id,
        mission_type=body.mission_type,
        lead_id=current_user.id,
        service=body.service,
        component=body.component,
        unique_identifier=body.unique_identifier,
    )
    db.add(assessment)
    # Lead is automatically assigned to all sections
    assignment = AssessmentAssignment(
        id=str(uuid.uuid4()),
        assessment_id=assessment.id,
        user_id=current_user.id,
        role="lead",
        scope_type="section",
        scope_ids=[],  # empty = all sections
    )
    db.add(assignment)
    db.commit()
    db.refresh(assessment)
    return _assessment_out(assessment, unit)


# ---------------------------------------------------------------------------
# List assessments
# ---------------------------------------------------------------------------


@router.get("", response_model=list[AssessmentOut])
def list_assessments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(Assessment, Unit)
        .join(Unit, Assessment.unit_id == Unit.id)
        .order_by(Assessment.started_at.desc())
        .all()
    )
    return [_assessment_out(a, u) for a, u in rows]


# ---------------------------------------------------------------------------
# Get single assessment
# ---------------------------------------------------------------------------


@router.get("/{assessment_id}", response_model=AssessmentOut)
def get_assessment(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = (
        db.query(Assessment, Unit)
        .join(Unit, Assessment.unit_id == Unit.id)
        .filter(Assessment.id == assessment_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return _assessment_out(row[0], row[1])


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------


@router.get("/{assessment_id}/responses", response_model=list[ResponseOut])
def list_responses(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_assessment(db, assessment_id)
    responses = (
        db.query(Response)
        .filter(Response.assessment_id == assessment_id)
        .all()
    )
    return responses


@router.put(
    "/{assessment_id}/responses/{item_id}",
    response_model=ResponseOut,
)
def upsert_response(
    assessment_id: str,
    item_id: str,
    body: ResponseUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assessment = _require_assessment(db, assessment_id)
    if assessment.status == "certified":
        raise HTTPException(status_code=403, detail="Assessment is certified and locked")
    response = (
        db.query(Response)
        .filter(
            Response.assessment_id == assessment_id,
            Response.item_id == item_id,
        )
        .first()
    )
    before = None
    if response is None:
        response = Response(
            id=str(uuid.uuid4()),
            assessment_id=assessment_id,
            item_id=item_id,
            authored_by=current_user.id,
            last_modified_by=current_user.id,
        )
        db.add(response)
    else:
        before = {"status": response.status, "note": response.note}
        response.last_modified_by = current_user.id
        response.version = response.version + 1

    response.status = body.status
    response.note = body.note
    response.capture_data = body.capture_data
    response.updated_at = datetime.now(timezone.utc)

    after = {"status": body.status, "note": body.note}
    append_entry(
        db, current_user.id, "response.upsert", "response",
        f"{assessment_id}/{item_id}", before, after,
    )
    db.commit()
    db.refresh(response)
    return response


# ---------------------------------------------------------------------------
# Status progression
# ---------------------------------------------------------------------------

# Valid forward transitions only; no going backwards.
_TRANSITIONS: dict[str, str] = {
    "draft":             "in_progress",
    "in_progress":       "ready_for_review",
    "ready_for_review":  "certified",
}


@router.patch("/{assessment_id}/status", response_model=AssessmentOut)
def advance_status(
    assessment_id: str,
    body: StatusAdvance,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assessment = _require_assessment(db, assessment_id)
    expected_next = _TRANSITIONS.get(assessment.status)
    if body.status != expected_next:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot transition from '{assessment.status}' to '{body.status}'",
        )
    if body.status == "certified":
        if not body.print_name or not body.print_name.strip():
            raise HTTPException(status_code=422, detail="print_name is required when certifying")

    old_status = assessment.status
    now = datetime.now(timezone.utc)
    assessment.status = body.status

    if body.status == "certified":
        assessment.certified_at = now
        sig = Signature(
            id=str(uuid.uuid4()),
            assessment_id=assessment_id,
            role=body.signer_role or "lead_assessor",
            signer_id=current_user.id,
            print_name=body.print_name.strip(),
            method="local",
            signed_at=now,
            payload_hash=_snapshot_hash(db, assessment_id),
        )
        db.add(sig)

    append_entry(
        db, current_user.id, "assessment.status", "assessment",
        assessment_id, {"status": old_status}, {"status": body.status},
    )
    db.commit()
    db.refresh(assessment)
    unit = db.get(Unit, assessment.unit_id)
    return _assessment_out(assessment, unit)


# ---------------------------------------------------------------------------
# T&R responses
# ---------------------------------------------------------------------------


@router.get("/{assessment_id}/tr-responses", response_model=list[TrResponseOut])
def list_tr_responses(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_assessment(db, assessment_id)
    return db.query(TrResponse).filter(TrResponse.assessment_id == assessment_id).all()


@router.put("/{assessment_id}/tr-responses/{event_code:path}", response_model=TrResponseOut)
def upsert_tr_response(
    assessment_id: str,
    event_code: str,
    body: TrResponseUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assessment = _require_assessment(db, assessment_id)
    if assessment.status == "certified":
        raise HTTPException(status_code=403, detail="Assessment is certified and locked")
    tr = (
        db.query(TrResponse)
        .filter(TrResponse.assessment_id == assessment_id, TrResponse.event_code == event_code)
        .first()
    )
    tr_before = None
    if tr is None:
        tr = TrResponse(
            id=str(uuid.uuid4()),
            assessment_id=assessment_id,
            event_code=event_code,
            authored_by=current_user.id,
            last_modified_by=current_user.id,
        )
        db.add(tr)
    else:
        tr_before = {"status": tr.status, "note": tr.note}
        tr.last_modified_by = current_user.id
        tr.version = tr.version + 1

    tr.status = body.status
    tr.score = body.score
    tr.capture_data = body.capture_data
    tr.note = body.note
    tr.updated_at = datetime.now(timezone.utc)

    append_entry(
        db, current_user.id, "tr_response.upsert", "tr_response",
        f"{assessment_id}/{event_code}", tr_before,
        {"status": body.status, "score": body.score, "note": body.note},
    )
    db.commit()
    db.refresh(tr)
    return tr


# ---------------------------------------------------------------------------
# Readiness summary — score roll-up + JTS feed-forward
# ---------------------------------------------------------------------------

@router.get("/{assessment_id}/readiness-summary")
def get_readiness_summary(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Compute and return:
      wickets   — per-wicket effective score + derived_status
      chapters  — chapter-level score aggregation (weakest-link principle)
      jts_forward — suggested JTS item status derived from mapped wicket scores
    """
    from app.routers.content import _load_tr
    from app.routers.crosswalk import _load_crosswalk

    _require_assessment(db, assessment_id)

    tr_responses = db.query(TrResponse).filter(TrResponse.assessment_id == assessment_id).all()
    by_code: dict[str, TrResponse] = {r.event_code: r for r in tr_responses}

    framework = _load_tr()
    wickets: list[dict] = framework["wickets"]
    crosswalk: dict[str, dict] = _load_crosswalk()

    # --- Wicket-level scores ---
    wicket_summaries: dict[str, dict] = {}
    for w in wickets:
        code: str = w["event_code"]
        resp = by_code.get(code)
        if resp is None:
            continue

        comp_raw = (resp.capture_data or {}).get("components", [])
        comp_scores: list[int | None] = [c if isinstance(c, int) else None for c in comp_raw]
        scored = [c for c in comp_scores if c is not None]

        explicit_score = resp.score
        auto_score = min(scored) if scored else None   # weakest-link across components
        effective_score = explicit_score if explicit_score is not None else auto_score

        if effective_score is not None:
            derived_status = "go" if effective_score >= 4 else "no_go"
        elif resp.status in ("go", "no_go", "na"):
            derived_status = resp.status
        else:
            derived_status = "unanswered"

        wicket_summaries[code] = {
            "score": effective_score,
            "component_scores": comp_scores,
            "derived_status": derived_status,
            "explicit_score": explicit_score,
        }

    # --- Chapter-level aggregation ---
    chapter_data: dict[int, dict] = {}
    for w in wickets:
        ch: int = w.get("chapter", 0)
        if ch not in chapter_data:
            chapter_data[ch] = {"scores": [], "go": 0, "no_go": 0, "total": 0}
        chapter_data[ch]["total"] += 1
        s = wicket_summaries.get(w["event_code"])
        if s and s["score"] is not None:
            chapter_data[ch]["scores"].append(s["score"])
            if s["derived_status"] == "go":
                chapter_data[ch]["go"] += 1
            elif s["derived_status"] == "no_go":
                chapter_data[ch]["no_go"] += 1

    chapter_summaries = {
        str(ch): {
            "mean_score": round(sum(d["scores"]) / len(d["scores"]), 1) if d["scores"] else None,
            "go_count": d["go"],
            "no_go_count": d["no_go"],
            "scored_count": len(d["scores"]),
            "total_count": d["total"],
        }
        for ch, d in chapter_data.items()
    }

    # --- JTS feed-forward ---
    # Weakest-link: if any mapped wicket is NO-GO (<4) the JTS item is flagged
    jts_forward: dict[str, dict] = {}
    for jts_item, entry in crosswalk.items():
        wicket_codes = [w["event_code"] for w in entry.get("wickets", [])]
        if not wicket_codes:
            continue
        scores = [
            wicket_summaries[c]["score"]
            for c in wicket_codes
            if c in wicket_summaries and wicket_summaries[c]["score"] is not None
        ]
        if scores:
            mean_s = round(sum(scores) / len(scores), 1)
            min_s = min(scores)
            suggested = "yes" if min_s >= 4 else ("marginal" if min_s >= 3 else "no")
        else:
            mean_s = min_s = None
            suggested = None

        jts_forward[jts_item] = {
            "supporting_wickets": wicket_codes,
            "mean_score": mean_s,
            "min_score": min_s,
            "scored_count": len(scores),
            "total_wickets": len(wicket_codes),
            "suggested_status": suggested,
        }

    return {"wickets": wicket_summaries, "chapters": chapter_summaries, "jts_forward": jts_forward}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _require_assessment(db: Session, assessment_id: str) -> Assessment:
    a = db.get(Assessment, assessment_id)
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return a


def _assignment_out(a: AssessmentAssignment, u: User) -> AssignmentOut:
    return AssignmentOut(
        id=a.id,
        assessment_id=a.assessment_id,
        user_id=a.user_id,
        display_name=u.display_name,
        email=u.email,
        role=a.role,
        scope_ids=a.scope_ids or [],
        status=a.status,
        assigned_at=a.assigned_at,
    )


# ---------------------------------------------------------------------------
# Assignments
# ---------------------------------------------------------------------------


@router.get("/{assessment_id}/assignments", response_model=list[AssignmentOut])
def list_assignments(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_assessment(db, assessment_id)
    rows = (
        db.query(AssessmentAssignment, User)
        .join(User, AssessmentAssignment.user_id == User.id)
        .filter(AssessmentAssignment.assessment_id == assessment_id)
        .all()
    )
    return [_assignment_out(a, u) for a, u in rows]


@router.put("/{assessment_id}/assignments/{user_id}", response_model=AssignmentOut)
def upsert_assignment(
    assessment_id: str,
    user_id: str,
    body: AssignmentUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assessment = _require_assessment(db, assessment_id)
    if assessment.lead_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the lead assessor can manage assignments")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    assignment = (
        db.query(AssessmentAssignment)
        .filter(
            AssessmentAssignment.assessment_id == assessment_id,
            AssessmentAssignment.user_id == user_id,
        )
        .first()
    )
    assign_before = None
    if assignment is None:
        assignment = AssessmentAssignment(
            id=str(uuid.uuid4()),
            assessment_id=assessment_id,
            user_id=user_id,
            role=body.role,
            scope_ids=body.scope_ids,
            status="assigned",
        )
        db.add(assignment)
    else:
        assign_before = {"role": assignment.role, "scope_ids": assignment.scope_ids}
        assignment.role = body.role
        assignment.scope_ids = body.scope_ids
    append_entry(
        db, current_user.id, "assignment.upsert", "assignment",
        f"{assessment_id}/{user_id}", assign_before, {"role": body.role, "scope_ids": body.scope_ids},
    )
    db.commit()
    db.refresh(assignment)
    return _assignment_out(assignment, user)


@router.delete("/{assessment_id}/assignments/{assignment_id}", status_code=204)
def delete_assignment(
    assessment_id: str,
    assignment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assessment = _require_assessment(db, assessment_id)
    if assessment.lead_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the lead assessor can manage assignments")
    assignment = db.get(AssessmentAssignment, assignment_id)
    if not assignment or assignment.assessment_id != assessment_id:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if assignment.role == "lead":
        raise HTTPException(status_code=400, detail="Cannot remove the lead assignment")
    append_entry(
        db, current_user.id, "assignment.delete", "assignment",
        f"{assessment_id}/{assignment.user_id}",
        {"role": assignment.role, "user_id": assignment.user_id}, None,
    )
    db.delete(assignment)
    db.commit()


# ---------------------------------------------------------------------------
# Signatures
# ---------------------------------------------------------------------------


@router.get("/{assessment_id}/signatures", response_model=list[SignatureOut])
def list_signatures(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_assessment(db, assessment_id)
    return (
        db.query(Signature)
        .filter(Signature.assessment_id == assessment_id)
        .order_by(Signature.signed_at.desc())
        .all()
    )


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------


from app.models.audit_log import AuditLog as AuditLogModel  # noqa: E402


@router.get("/{assessment_id}/audit", response_model=list[AuditLogOut])
def get_audit_log(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_assessment(db, assessment_id)
    rows = (
        db.query(AuditLogModel)
        .filter(AuditLogModel.entity_id.like(f"{assessment_id}%"))
        .order_by(AuditLogModel.ts.desc())
        .limit(200)
        .all()
    )
    return rows
