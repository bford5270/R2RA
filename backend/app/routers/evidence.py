"""
Evidence attachment — upload files to a response item.

Storage is handled by app.storage (local disk in dev, S3 in prod).
blob_ref is the logical storage key: evidence/{evidence_id}/{filename}
"""
import hashlib
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app import storage
from app.auth.deps import get_current_user
from app.config import settings
from app.database import get_db
from app.models.evidence import Evidence
from app.models.response import Response
from app.models.user import User
from app.routers.assessments import _require_assessment
from app.upload_validation import validate_upload

router = APIRouter(tags=["evidence"])


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

    content = file.file.read()
    validate_upload(content, file.content_type or "", settings.max_upload_bytes)

    sha256 = hashlib.sha256(content).hexdigest()
    ev_id = str(uuid.uuid4())
    safe_name = (file.filename or "upload").rsplit("/", 1)[-1]
    key = f"evidence/{ev_id}/{safe_name}"

    storage.put(key, content, file.content_type)

    ev = Evidence(
        id=ev_id,
        assessment_id=assessment_id,
        type="photo" if file.content_type.startswith("image/") else "document",
        blob_ref=key,
        hash=sha256,
        filename=safe_name,
        content_type=file.content_type,
        uploaded_by=current_user.id,
    )
    db.add(ev)

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
# List
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


# ---------------------------------------------------------------------------
# Serve
# ---------------------------------------------------------------------------

@router.get("/api/evidence/{evidence_id}/file")
def serve_evidence_file(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ev = db.get(Evidence, evidence_id)
    if ev is None:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return storage.serve(ev.blob_ref, ev.filename, ev.content_type)


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

@router.delete(
    "/api/assessments/{assessment_id}/responses/{item_id}/evidence/{evidence_id}",
    status_code=204,
)
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

    storage.delete(ev.blob_ref)

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
