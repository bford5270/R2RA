"""
Per-unit standing evidence library.
Storage is handled by app.storage (local disk in dev, S3 in prod).
blob_ref convention: library/{item_id}/{filename}
"""
import hashlib
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import storage
from app.auth.deps import get_current_user
from app.config import settings
from app.database import get_db
from app.models.unit import Unit
from app.models.unit_evidence import UnitEvidence
from app.models.user import User

router = APIRouter(prefix="/api/units", tags=["unit-library"])

ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/pdf",
    "text/plain",
}

VALID_CATEGORIES = {"roster", "cert", "sop", "equipment", "eval", "other"}


class LibraryItemOut(BaseModel):
    id: str
    unit_id: str
    category: str
    label: str
    description: Optional[str]
    filename: Optional[str]
    content_type: Optional[str]
    hash: Optional[str]
    uploaded_by: str
    uploaded_at: str

    model_config = {"from_attributes": True}


def _require_unit(db: Session, uic: str) -> Unit:
    unit = db.query(Unit).filter(Unit.uic == uic).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    return unit


def _item_out(item: UnitEvidence) -> LibraryItemOut:
    return LibraryItemOut(
        id=item.id,
        unit_id=item.unit_id,
        category=item.category,
        label=item.label,
        description=item.description,
        filename=item.filename,
        content_type=item.content_type,
        hash=item.hash,
        uploaded_by=item.uploaded_by,
        uploaded_at=item.uploaded_at.isoformat() if item.uploaded_at else "",
    )


@router.get("/{uic}/library", response_model=list[LibraryItemOut])
def list_library(
    uic: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    unit = _require_unit(db, uic)
    items = (
        db.query(UnitEvidence)
        .filter(UnitEvidence.unit_id == unit.id)
        .order_by(UnitEvidence.uploaded_at.desc())
        .all()
    )
    return [_item_out(i) for i in items]


@router.post("/{uic}/library", status_code=status.HTTP_201_CREATED, response_model=LibraryItemOut)
def upload_library_item(
    uic: str,
    file: UploadFile,
    label: str = Form(...),
    category: str = Form("other"),
    description: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    unit = _require_unit(db, uic)

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported type '{file.content_type}'. Allowed: JPEG, PNG, WebP, GIF, PDF, TXT.",
        )
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"category must be one of {VALID_CATEGORIES}")

    content = file.file.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds {settings.max_upload_bytes // (1024 * 1024)} MB limit.",
        )

    sha256 = hashlib.sha256(content).hexdigest()
    item_id = str(uuid.uuid4())
    safe_name = (file.filename or "upload").rsplit("/", 1)[-1]
    key = f"library/{item_id}/{safe_name}"

    storage.put(key, content, file.content_type)

    item = UnitEvidence(
        id=item_id,
        unit_id=unit.id,
        category=category,
        label=label.strip(),
        description=description.strip() or None,
        blob_ref=key,
        hash=sha256,
        filename=safe_name,
        content_type=file.content_type,
        uploaded_by=current_user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _item_out(item)


@router.get("/{uic}/library/{item_id}/file")
def serve_library_file(
    uic: str,
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    unit = _require_unit(db, uic)
    item = db.get(UnitEvidence, item_id)
    if not item or item.unit_id != unit.id:
        raise HTTPException(status_code=404, detail="Item not found")
    if not item.blob_ref:
        raise HTTPException(status_code=404, detail="No file attached")
    return storage.serve(item.blob_ref, item.filename, item.content_type)


@router.delete("/{uic}/library/{item_id}", status_code=204)
def delete_library_item(
    uic: str,
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    unit = _require_unit(db, uic)
    item = db.get(UnitEvidence, item_id)
    if not item or item.unit_id != unit.id:
        raise HTTPException(status_code=404, detail="Item not found")

    if item.blob_ref:
        storage.delete(item.blob_ref)

    db.delete(item)
    db.commit()
