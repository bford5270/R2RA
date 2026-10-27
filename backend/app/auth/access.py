"""
Per-assessment access control (STRATEGY §8, server-hard enforcement).

Who can do what on one assessment:

- admin (global role)        read + write everything, certify
- lead (assessment.lead_id)  read + write everything, certify
- assignment role "oic"      read, certify (sign-off only, cannot edit)
- assignment role "observer" read only
- other assignment roles     read all; write only inside scope_ids
                             (empty scope = all sections)
- T&R tasking holder         read; T&R scoring is checked in its own route

Anyone else gets 404, not 403, so assessment ids can't be probed.
"""
import json
from functools import lru_cache
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.assessment import Assessment, AssessmentAssignment
from app.models.tr_tasking import TrTasking
from app.models.user import User

_NOT_FOUND = HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")
_READ_ONLY_ROLES = {"observer", "oic"}


def _assignment(db: Session, assessment_id: str, user_id: str) -> AssessmentAssignment | None:
    return (
        db.query(AssessmentAssignment)
        .filter(
            AssessmentAssignment.assessment_id == assessment_id,
            AssessmentAssignment.user_id == user_id,
        )
        .first()
    )


def _has_tasking(db: Session, assessment_id: str, user_id: str) -> bool:
    return (
        db.query(TrTasking.id)
        .filter(TrTasking.assessment_id == assessment_id, TrTasking.user_id == user_id)
        .first()
        is not None
    )


def is_lead_or_admin(assessment: Assessment, user: User) -> bool:
    return user.global_role == "admin" or assessment.lead_id == user.id


def can_read(db: Session, assessment: Assessment, user: User) -> bool:
    if is_lead_or_admin(assessment, user):
        return True
    if _assignment(db, assessment.id, user.id) is not None:
        return True
    return _has_tasking(db, assessment.id, user.id)


def require_read(db: Session, assessment_id: str, user: User) -> Assessment:
    """Load an assessment the user may see, or 404."""
    assessment = db.get(Assessment, assessment_id)
    if assessment is None or not can_read(db, assessment, user):
        raise _NOT_FOUND
    return assessment


def visible_assessment_filter(user: User):
    """SQL filter limiting an Assessment query to what the user may see."""
    if user.global_role == "admin":
        return None
    assigned = select(AssessmentAssignment.assessment_id).where(
        AssessmentAssignment.user_id == user.id
    )
    tasked = select(TrTasking.assessment_id).where(TrTasking.user_id == user.id)
    return or_(
        Assessment.lead_id == user.id,
        Assessment.id.in_(assigned),
        Assessment.id.in_(tasked),
    )


@lru_cache(maxsize=1)
def _section_prefixes() -> dict[str, str]:
    """section id -> item_prefix, from the JTS R2 manifest."""
    path = Path(settings.content_dir).resolve() / "frameworks" / "jts_r2" / "_manifest.json"
    with path.open(encoding="utf-8") as f:
        manifest = json.load(f)
    return {s["id"]: s["item_prefix"] for s in manifest["sections_manifest"]}


def _item_in_scope(item_id: str, scope_ids: list[str]) -> bool:
    prefixes = _section_prefixes()
    for section_id in scope_ids:
        prefix = prefixes.get(section_id)
        # item ids look like "pdp.4" (section prefix + "." + number)
        if prefix and (item_id == prefix or item_id.startswith(prefix + ".")):
            return True
        # item-level scope (scope_type "item") lists item ids directly
        if item_id == section_id:
            return True
    return False


def require_write(db: Session, assessment: Assessment, user: User, item_id: str | None = None) -> None:
    """
    Raise unless the user may edit this assessment (and this item, if given).
    Call require_read first so non-members still get a 404.
    """
    if is_lead_or_admin(assessment, user):
        return
    a = _assignment(db, assessment.id, user.id)
    if a is None or a.role in _READ_ONLY_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Read-only access to this assessment")
    if item_id is not None and a.scope_ids and not _item_in_scope(item_id, a.scope_ids):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This item is outside your assigned sections")


def require_certify(db: Session, assessment: Assessment, user: User) -> None:
    if is_lead_or_admin(assessment, user):
        return
    a = _assignment(db, assessment.id, user.id)
    if a is None or a.role != "oic":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the lead, OIC or an admin can advance this assessment")
