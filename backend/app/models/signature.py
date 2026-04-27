import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Signature(Base):
    __tablename__ = "signatures"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    assessment_id: Mapped[str] = mapped_column(String(36), ForeignKey("assessments.id"), index=True)
    # role: role2_team_chief | tmd | arst_chief
    role: Mapped[str] = mapped_column(String(30))
    signer_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    # method: local | totp | cac
    method: Mapped[str] = mapped_column(String(10))
    signed_at: Mapped[datetime] = mapped_column(DateTime)
    # official printed name/title (e.g. "Capt. Jane Smith, USMC, TMD")
    print_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # sha256 of the assessment snapshot at time of signing
    payload_hash: Mapped[str] = mapped_column(String(64))
