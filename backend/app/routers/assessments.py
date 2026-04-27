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
from app.schemas.assessment import (
    AssessmentCreate,
    AssessmentOut,
    AssignmentOut,
    AssignmentUpsert,
    ResponseOut,
    ResponseUpsert,
    StatusAdvance,
    TrResponseOut,
    TrResponseUpsert,
)

router = APIRouter(prefix="/api/assessments", tags=["assessments"])


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
    _require_assessment(db, assessment_id)
    response = (
        db.query(Response)
        .filter(
            Response.assessment_id == assessment_id,
            Response.item_id == item_id,
        )
        .first()
    )
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
        response.last_modified_by = current_user.id
        response.version = response.version + 1

    response.status = body.status
    response.note = body.note
    response.capture_data = body.capture_data
    response.updated_at = datetime.now(timezone.utc)

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
    assessment.status = body.status
    if body.status == "certified":
        assessment.certified_at = datetime.now(timezone.utc)
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
    _require_assessment(db, assessment_id)
    tr = (
        db.query(TrResponse)
        .filter(TrResponse.assessment_id == assessment_id, TrResponse.event_code == event_code)
        .first()
    )
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
        tr.last_modified_by = current_user.id
        tr.version = tr.version + 1

    tr.status = body.status
    tr.note = body.note
    tr.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(tr)
    return tr


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
        assignment.role = body.role
        assignment.scope_ids = body.scope_ids
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
    db.delete(assignment)
    db.commit()
