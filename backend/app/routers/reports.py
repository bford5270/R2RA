from collections import defaultdict

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.database import get_db
from app.models.assessment import Assessment
from app.models.response import Response
from app.models.unit import Unit
from app.models.user import User

router = APIRouter(prefix="/api/reports", tags=["reports"])


class SectionStats(BaseModel):
    yes: int = 0
    no: int = 0
    na: int = 0
    unanswered: int = 0


class ReadinessRow(BaseModel):
    unit_uic: str
    unit_name: str
    assessment_id: str
    status: str
    mission_type: str
    started_at: str
    certified_at: str | None
    total_answered: int
    total_yes: int
    total_no: int
    total_na: int
    by_section: dict[str, SectionStats]


@router.get("/readiness", response_model=list[ReadinessRow])
def readiness_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Latest assessment per unit (by started_at desc).
    rows = (
        db.query(Assessment, Unit)
        .join(Unit, Assessment.unit_id == Unit.id)
        .order_by(Assessment.started_at.desc())
        .all()
    )

    seen: set[str] = set()
    latest: list[tuple[Assessment, Unit]] = []
    for a, u in rows:
        if u.id not in seen:
            seen.add(u.id)
            latest.append((a, u))

    # Fetch all responses for these assessments in one query.
    assessment_ids = [a.id for a, _ in latest]
    if not assessment_ids:
        return []

    responses = (
        db.query(Response)
        .filter(Response.assessment_id.in_(assessment_ids))
        .all()
    )

    # Index responses by assessment_id.
    by_assessment: dict[str, list[Response]] = defaultdict(list)
    for r in responses:
        by_assessment[r.assessment_id].append(r)

    result: list[ReadinessRow] = []
    for assessment, unit in latest:
        rs = by_assessment[assessment.id]

        by_section: dict[str, SectionStats] = defaultdict(SectionStats)
        total_yes = total_no = total_na = 0

        for r in rs:
            prefix = r.item_id.split(".")[0]
            s = by_section[prefix]
            if r.status == "yes":
                s.yes += 1
                total_yes += 1
            elif r.status == "no":
                s.no += 1
                total_no += 1
            elif r.status == "na":
                s.na += 1
                total_na += 1
            else:
                s.unanswered += 1

        result.append(ReadinessRow(
            unit_uic=unit.uic,
            unit_name=unit.name,
            assessment_id=assessment.id,
            status=assessment.status,
            mission_type=assessment.mission_type,
            started_at=assessment.started_at.isoformat(),
            certified_at=assessment.certified_at.isoformat() if assessment.certified_at else None,
            total_answered=total_yes + total_no + total_na,
            total_yes=total_yes,
            total_no=total_no,
            total_na=total_na,
            by_section=dict(by_section),
        ))

    result.sort(key=lambda r: r.unit_name)
    return result
