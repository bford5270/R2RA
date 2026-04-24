import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Response(Base):
    __tablename__ = "responses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    assessment_id: Mapped[str] = mapped_column(String(36), ForeignKey("assessments.id"), index=True)
    # item_id matches source IDs in content JSON (e.g. "pdp.1", "cra.3")
    item_id: Mapped[str] = mapped_column(String(50), index=True)
    # status: unanswered | yes | no | na
    status: Mapped[str] = mapped_column(String(15), default="unanswered")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    # capture_data: JSON dict for sub-fields (e.g. course names on binary+capture items)
    capture_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # evidence_ids: JSON array of evidence.id references
    evidence_ids: Mapped[list] = mapped_column(JSON, default=list)
    authored_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    last_modified_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    assignment_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("assessment_assignments.id"), nullable=True
    )
    # review_status: pending | accepted | needs_rework
    review_status: Mapped[str] = mapped_column(String(20), default="pending")
    # monotonic version for deterministic conflict detection on sync
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class ResponseComment(Base):
    __tablename__ = "response_comments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    response_id: Mapped[str] = mapped_column(String(36), ForeignKey("responses.id"), index=True)
    author_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
