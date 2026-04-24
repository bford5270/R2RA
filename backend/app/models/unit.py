import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Unit(Base):
    __tablename__ = "units"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    uic: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    # echelon: team | battalion | regiment | division | ...
    echelon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    parent_uic: Mapped[str | None] = mapped_column(
        String(20), ForeignKey("units.uic"), nullable=True
    )
