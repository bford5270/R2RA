import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Debrief(Base):
    """
    A recorded team debrief. Audio is uploaded, transcribed (Amazon
    Transcribe), and distilled by Claude on Bedrock into structured
    sustains / opportunities for growth / next-time actions. Raw audio is
    deleted once distillation succeeds (data-minimization decision).

    status: uploaded | transcribing | distilling | ready | committed | failed
    """

    __tablename__ = "debriefs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    assessment_id: Mapped[str] = mapped_column(String(36), ForeignKey("assessments.id"), index=True)
    title: Mapped[str] = mapped_column(String(200), default="Team debrief")
    status: Mapped[str] = mapped_column(String(20), default="uploaded")
    audio_blob_ref: Mapped[str | None] = mapped_column(String(500), nullable=True)
    audio_content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    audio_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    duration_sec: Mapped[int | None] = mapped_column(Integer, nullable=True)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    # {"sustains": [...], "improves": [...], "next_time": [...]}
    # each item: {"text": str, "event_codes": [str]}
    distilled: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    committed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
