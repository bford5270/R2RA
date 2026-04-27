"""
Evidence attachment — upload files or text notes to a response.

Storage: local disk at settings.uploads_dir/{evidence_id}/{filename}
Future: swap blob_ref for an S3 key and update _serve() accordingly.
"""
import hashlib
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.config import settings
from app.database import get_db
from app.models.evidence import Evidence
from app.models.response import Response
from app.models.user import User
from app.routers.assessments import _require_assessment

router = APIRouter(tags=["evidence"])

ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/pdf",
    "text/plain",
}


def _uploads_root() -> Path:
    p = Path(settings.uploads_dir).resolve()
    p.mkdir(parents=True, exist_ok=True)
    return p


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------


@router.post(
    "/api/assessments/{assessment_id}/responses/{item_id}/evidence",
    status_code=status.HTTP_201_CREATED,
)
def upload_evidence(
    assessment_id: str,
    item_id: str,
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_assessment(db, assessment_id)

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{file.content_type}'. Allowed: JPEG, PNG, WebP, GIF, PDF, TXT.",
        )

    # Read content once for size check + hash
    content = file.file.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds {settings.max_upload_bytes // (1024*1024)} MB limit.",
        )

    sha256 = hashlib.sha256(content).hexdigest()
    ev_id = str(uuid.uuid4())

    # Persist to disk
    dest_dir = _uploads_root() / ev_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(file.filename or "upload").name  # strip any path components
    dest = dest_dir / safe_name
    dest.write_bytes(content)

    # DB record
    ev = Evidence(
        id=ev_id,
        assessment_id=assessment_id,
        type="photo" if file.content_type.startswith("image/") else "document",
        blob_ref=str(dest.relative_to(_uploads_root().parent)),
        hash=sha256,
        filename=safe_name,
        content_type=file.content_type,
        uploaded_by=current_user.id,
    )
    db.add(ev)

    # Append evidence_id to the response (create response row if missing)
    resp = (
        db.query(Response)
        .filter(Response.assessment_id == assessment_id, Response.item_id == item_id)
        .first()
    )
    if resp is None:
        resp = Response(
            id=str(uuid.uuid4()),
            assessment_id=assessment_id,
            item_id=item_id,
            status="unanswered",
            authored_by=current_user.id,
            last_modified_by=current_user.id,
            evidence_ids=[ev_id],
        )
        db.add(resp)
    else:
        existing = list(resp.evidence_ids or [])
        existing.append(ev_id)
        resp.evidence_ids = existing

    db.commit()
    db.refresh(ev)
    return _ev_out(ev)


# ---------------------------------------------------------------------------
# Serve file
# ---------------------------------------------------------------------------


@router.get("/api/assessments/{assessment_id}/responses/{item_id}/evidence")
def list_evidence(
    assessment_id: str,
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_assessment(db, assessment_id)
    resp = (
        db.query(Response)
        .filter(Response.assessment_id == assessment_id, Response.item_id == item_id)
        .first()
    )
    if not resp or not resp.evidence_ids:
        return []
    evs = db.query(Evidence).filter(Evidence.id.in_(resp.evidence_ids)).all()
    id_order = {eid: i for i, eid in enumerate(resp.evidence_ids)}
    evs.sort(key=lambda e: id_order.get(e.id, 999))
    return [_ev_out(e) for e in evs]


@router.get("/api/evidence/{evidence_id}/file")
def serve_evidence_file(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ev = db.get(Evidence, evidence_id)
    if ev is None:
        raise HTTPException(status_code=404, detail="Evidence not found")
    path = _uploads_root().parent / ev.blob_ref
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(path, media_type=ev.content_type, filename=ev.filename)


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


@router.delete("/api/assessments/{assessment_id}/responses/{item_id}/evidence/{evidence_id}", status_code=204)
def delete_evidence(
    assessment_id: str,
    item_id: str,
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_assessment(db, assessment_id)
    ev = db.get(Evidence, evidence_id)
    if ev is None:
        raise HTTPException(status_code=404, detail="Evidence not found")
    if ev.assessment_id != assessment_id:
        raise HTTPException(status_code=403, detail="Evidence does not belong to this assessment")

    # Remove from disk
    if ev.blob_ref:
        file_path = _uploads_root().parent / ev.blob_ref
        ev_dir = file_path.parent
        if file_path.exists():
            file_path.unlink()
        if ev_dir.exists() and not any(ev_dir.iterdir()):
            shutil.rmtree(ev_dir, ignore_errors=True)

    # Remove from response.evidence_ids
    resp = (
        db.query(Response)
        .filter(Response.assessment_id == assessment_id, Response.item_id == item_id)
        .first()
    )
    if resp and resp.evidence_ids:
        resp.evidence_ids = [eid for eid in resp.evidence_ids if eid != evidence_id]

    db.delete(ev)
    db.commit()


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _ev_out(ev: Evidence) -> dict:
    return {
        "id": ev.id,
        "filename": ev.filename,
        "content_type": ev.content_type,
        "type": ev.type,
        "hash": ev.hash,
        "uploaded_by": ev.uploaded_by,
        "uploaded_at": ev.uploaded_at.isoformat() if ev.uploaded_at else None,
    }
