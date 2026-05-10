import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    unit_id: Mapped[str] = mapped_column(String(36), ForeignKey("units.id"), index=True)
    framework_id: Mapped[str] = mapped_column(String(50), default="jts_r2")
    framework_version: Mapped[str] = mapped_column(String(20), default="2024.0")
    # mission_type: r2lm_non_split | r2lm_split | r2e | arst
    mission_type: Mapped[str] = mapped_column(String(30))
    lead_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    # status: draft | in_progress | ready_for_review | certified
    status: Mapped[str] = mapped_column(String(30), default="draft")
    unique_identifier: Mapped[str | None] = mapped_column(String(100), nullable=True)
    scenario_ref: Mapped[str | None] = mapped_column(String(300), nullable=True)
    service: Mapped[str | None] = mapped_column(String(20), nullable=True)
    component: Mapped[str | None] = mapped_column(String(20), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    certified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class AssessmentAssignment(Base):
    __tablename__ = "assessment_assignments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    assessment_id: Mapped[str] = mapped_column(String(36), ForeignKey("assessments.id"), index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    # role: lead | contributor | observer | oic
    role: Mapped[str] = mapped_column(String(20))
    # scope_type: section | item
    scope_type: Mapped[str] = mapped_column(String(10), default="section")
    # scope_ids: JSON array of section IDs or item IDs
    scope_ids: Mapped[list] = mapped_column(JSON, default=list)
    # status: assigned | in_progress | ready_for_review | accepted
    status: Mapped[str] = mapped_column(String(30), default="assigned")
    assigned_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
