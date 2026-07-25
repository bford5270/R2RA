import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ScenarioCase(Base):
    """
    A role2builder case (or other scenario document) the evaluation was based
    on, attached to an assessment. Optionally tagged with the wickets it
    exercised.
    """

    __tablename__ = "scenario_cases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    assessment_id: Mapped[str] = mapped_column(String(36), ForeignKey("assessments.id"), index=True)
    label: Mapped[str] = mapped_column(String(200))
    # role2builder case id / URL, if known
    source_ref: Mapped[str | None] = mapped_column(String(300), nullable=True)
    # wickets this case exercised (JSON array of event codes)
    event_codes: Mapped[list] = mapped_column(JSON, default=list)
    blob_ref: Mapped[str] = mapped_column(String(500))
    hash: Mapped[str] = mapped_column(String(64))
    filename: Mapped[str] = mapped_column(String(300))
    content_type: Mapped[str] = mapped_column(String(100))
    uploaded_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class LoFeedback(Base):
    """
    Per-evaluator feedback on a wicket's learning objective: did the scenario
    and evaluation support the LO, and should it be kept/changed/dropped next
    time. One row per (assessment, event_code, author).
    """

    __tablename__ = "lo_feedback"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    assessment_id: Mapped[str] = mapped_column(String(36), ForeignKey("assessments.id"), index=True)
    event_code: Mapped[str] = mapped_column(String(30), index=True)
    case_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("scenario_cases.id"), nullable=True)
    # 1-5: how well the scenario/evaluation supported the learning objective
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # keep | change | drop
    recommendation: Mapped[str | None] = mapped_column(String(10), nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
