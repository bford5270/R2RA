import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TrTasking(Base):
    """
    S3T tasking: a set of T&R wickets (PECLs) and/or METs assigned to one
    evaluator on one assessment. The evaluator completes only their assigned
    wickets and returns the tasking to S3T. One tasking per (assessment, user).
    """

    __tablename__ = "tr_taskings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    assessment_id: Mapped[str] = mapped_column(String(36), ForeignKey("assessments.id"), index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    # JSON array of wicket event codes (e.g. ["HSS-OPS-7001", ...])
    event_codes: Mapped[list] = mapped_column(JSON, default=list)
    # JSON array of MET ids the tasking was framed around (display/traceability;
    # the authoritative work list is event_codes)
    mets: Mapped[list] = mapped_column(JSON, default=list)
    # Optional S3T instructions to the evaluator
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    # status: assigned | returned
    status: Mapped[str] = mapped_column(String(20), default="assigned")
    assigned_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    assigned_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    returned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
