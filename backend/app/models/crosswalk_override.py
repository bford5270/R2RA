from datetime import datetime
from sqlalchemy import DateTime, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CrosswalkOverride(Base):
    """Per-item SME edits that overlay the YAML base crosswalk."""
    __tablename__ = "crosswalk_overrides"

    jts_item: Mapped[str] = mapped_column(String(100), primary_key=True)
    wickets: Mapped[list] = mapped_column(JSON, default=list)
    mets: Mapped[list] = mapped_column(JSON, default=list)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    edited_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    edited_at: Mapped[datetime] = mapped_column(DateTime)


class CrosswalkMeta(Base):
    """Key-value store for document-level crosswalk metadata (e.g. status)."""
    __tablename__ = "crosswalk_meta"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[str] = mapped_column(String(200))
    updated_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
