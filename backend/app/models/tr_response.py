import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TrResponse(Base):
    __tablename__ = "tr_responses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    assessment_id: Mapped[str] = mapped_column(String(36), ForeignKey("assessments.id"), index=True)
    # event_code matches NAVMC 3500.84B wicket identifiers (e.g. "HSS-OPS-7001")
    event_code: Mapped[str] = mapped_column(String(30), index=True)
    # status: unanswered | go | no_go | na  (derived from score when score is set)
    status: Mapped[str] = mapped_column(String(15), default="unanswered")
    # 1-5 Likert for the overall wicket (null = not yet scored; score drives status)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # {"components": [4, 5, null, 3, ...]} — per-component scores, index-matched to event_components
    capture_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    authored_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    last_modified_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
