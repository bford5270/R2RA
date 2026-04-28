import uuid
from datetime import datetime

from sqlalchemy import DateTime, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AuditLog(Base):
    """Append-only, hash-chained audit log. Never update or delete rows."""

    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True)  # null = system
    action: Mapped[str] = mapped_column(String(50))   # e.g. response.update, assessment.certify
    entity_type: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[str] = mapped_column(String(120))
    before: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    after: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ts: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
    # SHA-256 of the previous row's hash (null for the first row)
    prev_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # SHA-256 of (actor_id, action, entity_type, entity_id, before, after, ts, prev_hash)
    hash: Mapped[str] = mapped_column(String(64), unique=True)
