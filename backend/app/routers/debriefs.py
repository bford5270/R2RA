"""
Recorded team debriefs → transcript → AI-distilled growth opportunities.

Flow: lead records audio in the PWA → upload → background thread runs
Amazon Transcribe → Claude on Bedrock distills sustains / improves /
next-time actions → lead edits → commit (locks; surfaces on the AAR).
Raw audio is deleted once distillation succeeds. A manual transcript path
covers environments without the AWS AI services.
"""
import threading
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app import ai_debrief, storage
from app.audit import append_entry
from app.auth.deps import get_current_user, require_approved
from app.config import settings
from app.database import SessionLocal, get_db
from app.models.assessment import Assessment
from app.models.debrief import Debrief
from app.models.tr_response import TrResponse
from app.models.user import User
from app.routers.assessments import _require_assessment
from app.schemas.assessment import DebriefOut, DebriefUpdate

router = APIRouter(tags=["debriefs"], dependencies=[Depends(require_approved)])

# Transcribe media formats we accept, keyed by content type
_AUDIO_FORMATS = {
    "audio/webm": "webm",
    "video/webm": "webm",
    "audio/mp4": "mp4",
    "video/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
    "audio/x-m4a": "m4a",
    "audio/m4a": "m4a",
}


def _require_lead(assessment: Assessment, user: User) -> None:
    if assessment.lead_id != user.id and user.global_role != "admin":
        raise HTTPException(status_code=403, detail="Only the lead assessor or an admin can manage debriefs")


def _out(d: Debrief) -> DebriefOut:
    return DebriefOut(
        id=d.id,
        assessment_id=d.assessment_id,
        title=d.title,
        status=d.status,
        has_audio=bool(d.audio_blob_ref) and not d.audio_deleted,
        duration_sec=d.duration_sec,
        transcript=d.transcript,
        distilled=d.distilled,
        error=d.error,
        created_by=d.created_by,
        created_at=d.created_at,
        updated_at=d.updated_at,
        committed_at=d.committed_at,
        transcription_available=ai_debrief.is_transcription_available(),
    )


# ---------------------------------------------------------------------------
# Background pipeline
# ---------------------------------------------------------------------------


def _wicket_context(db: Session, assessment_id: str) -> str:
    """Codes of wickets scored in this assessment, for LO linking hints."""
    rows = (
        db.query(TrResponse.event_code)
        .filter(TrResponse.assessment_id == assessment_id, TrResponse.status != "unanswered")
        .all()
    )
    return "\n".join(code for (code,) in rows) or "(none scored yet)"


def _process_debrief(debrief_id: str) -> None:
    """Runs in a daemon thread: transcribe (if needed) → distill → cleanup."""
    db = SessionLocal()
    try:
        d = db.get(Debrief, debrief_id)
        if d is None:
            return
        try:
            if d.transcript is None:
                d.status = "transcribing"
                db.commit()
                media_format = _AUDIO_FORMATS.get(d.audio_content_type or "", "webm")
                transcript = ai_debrief.transcribe_audio(
                    d.audio_blob_ref, media_format, job_name=f"r2ra-debrief-{d.id}"
                )
                d.transcript = transcript
                db.commit()

            d.status = "distilling"
            db.commit()
            distilled = ai_debrief.distill_transcript(
                d.transcript, _wicket_context(db, d.assessment_id)
            )
            d.distilled = distilled
            d.status = "ready"
            d.error = None

            # Retention decision: delete raw audio once distillation succeeds.
            if d.audio_blob_ref and not d.audio_deleted:
                try:
                    storage.delete(d.audio_blob_ref)
                    d.audio_deleted = True
                except Exception:
                    pass
            d.updated_at = datetime.now(timezone.utc)
            append_entry(
                db, None, "debrief.distilled", "debrief",
                f"{d.assessment_id}/{d.id}", None,
                {"status": "ready", "audio_deleted": d.audio_deleted},
            )
            db.commit()
        except Exception as exc:  # surface pipeline errors to the UI
            db.rollback()
            d = db.get(Debrief, debrief_id)
            if d is not None:
                d.status = "failed"
                d.error = str(exc)[:2000]
                db.commit()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/api/assessments/{assessment_id}/debriefs", response_model=list[DebriefOut])
def list_debriefs(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_assessment(db, assessment_id)
    rows = (
        db.query(Debrief)
        .filter(Debrief.assessment_id == assessment_id)
        .order_by(Debrief.created_at.desc())
        .all()
    )
    return [_out(d) for d in rows]


@router.post(
    "/api/assessments/{assessment_id}/debriefs",
    response_model=DebriefOut,
    status_code=status.HTTP_201_CREATED,
)
def upload_debrief(
    assessment_id: str,
    file: UploadFile,
    title: str = Form("Team debrief"),
    duration_sec: int | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a recorded debrief. Processing starts via POST /{id}/process."""
    assessment = _require_assessment(db, assessment_id)
    _require_lead(assessment, current_user)

    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in _AUDIO_FORMATS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported audio type '{content_type}'. Allowed: {sorted(set(_AUDIO_FORMATS))}",
        )
    content = file.file.read()
    if len(content) > settings.max_audio_upload_bytes:
        raise HTTPException(status_code=413, detail="Audio exceeds the upload limit")
    if not content:
        raise HTTPException(status_code=422, detail="Empty recording")

    debrief_id = str(uuid.uuid4())
    ext = _AUDIO_FORMATS[content_type]
    key = f"debriefs/{debrief_id}/recording.{ext}"
    storage.put(key, content, content_type)

    d = Debrief(
        id=debrief_id,
        assessment_id=assessment_id,
        title=title.strip() or "Team debrief",
        status="uploaded",
        audio_blob_ref=key,
        audio_content_type=content_type,
        duration_sec=duration_sec,
        created_by=current_user.id,
    )
    db.add(d)
    append_entry(
        db, current_user.id, "debrief.upload", "debrief",
        f"{assessment_id}/{debrief_id}", None,
        {"title": d.title, "duration_sec": duration_sec},
    )
    db.commit()
    db.refresh(d)
    return _out(d)


@router.post(
    "/api/assessments/{assessment_id}/debriefs/manual",
    response_model=DebriefOut,
    status_code=status.HTTP_201_CREATED,
)
def create_manual_debrief(
    assessment_id: str,
    title: str = Form("Team debrief"),
    transcript: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manual transcript path — no audio, no Transcribe; distillation only."""
    assessment = _require_assessment(db, assessment_id)
    _require_lead(assessment, current_user)
    if not transcript.strip():
        raise HTTPException(status_code=422, detail="Transcript is required")
    d = Debrief(
        id=str(uuid.uuid4()),
        assessment_id=assessment_id,
        title=title.strip() or "Team debrief",
        status="uploaded",
        transcript=transcript.strip(),
        created_by=current_user.id,
    )
    db.add(d)
    append_entry(
        db, current_user.id, "debrief.upload", "debrief",
        f"{assessment_id}/{d.id}", None, {"title": d.title, "manual_transcript": True},
    )
    db.commit()
    db.refresh(d)
    return _out(d)


@router.post("/api/debriefs/{debrief_id}/process", response_model=DebriefOut)
def process_debrief(
    debrief_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Kick off transcription + distillation in the background."""
    d = db.get(Debrief, debrief_id)
    if not d:
        raise HTTPException(status_code=404, detail="Debrief not found")
    assessment = _require_assessment(db, d.assessment_id)
    _require_lead(assessment, current_user)
    if d.status in {"transcribing", "distilling"}:
        raise HTTPException(status_code=409, detail="Already processing")
    if d.status == "committed":
        raise HTTPException(status_code=409, detail="Debrief already committed")
    if d.transcript is None and not ai_debrief.is_transcription_available():
        raise HTTPException(
            status_code=503,
            detail="Transcription requires S3/AWS configuration. Use the manual transcript option instead.",
        )
    if d.transcript is None and (not d.audio_blob_ref or d.audio_deleted):
        raise HTTPException(status_code=422, detail="No audio to transcribe")

    d.status = "transcribing" if d.transcript is None else "distilling"
    d.error = None
    db.commit()
    db.refresh(d)

    threading.Thread(target=_process_debrief, args=(debrief_id,), daemon=True).start()
    return _out(d)


@router.get("/api/debriefs/{debrief_id}", response_model=DebriefOut)
def get_debrief(
    debrief_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    d = db.get(Debrief, debrief_id)
    if not d:
        raise HTTPException(status_code=404, detail="Debrief not found")
    return _out(d)


@router.put("/api/debriefs/{debrief_id}", response_model=DebriefOut)
def update_debrief(
    debrief_id: str,
    body: DebriefUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lead edits the distilled output (the AI drafts; a human signs)."""
    d = db.get(Debrief, debrief_id)
    if not d:
        raise HTTPException(status_code=404, detail="Debrief not found")
    assessment = _require_assessment(db, d.assessment_id)
    _require_lead(assessment, current_user)
    if d.status == "committed":
        raise HTTPException(status_code=409, detail="Debrief is committed and locked")
    before = {"title": d.title}
    if body.title is not None:
        d.title = body.title.strip() or d.title
    if body.distilled is not None:
        d.distilled = body.distilled
        if d.status in {"uploaded", "failed"}:
            d.status = "ready"
    if body.transcript is not None:
        d.transcript = body.transcript
    d.updated_at = datetime.now(timezone.utc)
    append_entry(
        db, current_user.id, "debrief.edit", "debrief",
        f"{d.assessment_id}/{d.id}", before, {"title": d.title},
    )
    db.commit()
    db.refresh(d)
    return _out(d)


@router.post("/api/debriefs/{debrief_id}/commit", response_model=DebriefOut)
def commit_debrief(
    debrief_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lock the distilled debrief; it now appears on the AAR."""
    d = db.get(Debrief, debrief_id)
    if not d:
        raise HTTPException(status_code=404, detail="Debrief not found")
    assessment = _require_assessment(db, d.assessment_id)
    _require_lead(assessment, current_user)
    if d.status != "ready":
        raise HTTPException(status_code=409, detail="Only a ready debrief can be committed")
    if not d.distilled:
        raise HTTPException(status_code=422, detail="Nothing distilled to commit")
    d.status = "committed"
    d.committed_at = datetime.now(timezone.utc)
    append_entry(
        db, current_user.id, "debrief.commit", "debrief",
        f"{d.assessment_id}/{d.id}", {"status": "ready"}, {"status": "committed"},
    )
    db.commit()
    db.refresh(d)
    return _out(d)


@router.delete("/api/debriefs/{debrief_id}", status_code=204)
def delete_debrief(
    debrief_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    d = db.get(Debrief, debrief_id)
    if not d:
        raise HTTPException(status_code=404, detail="Debrief not found")
    assessment = _require_assessment(db, d.assessment_id)
    _require_lead(assessment, current_user)
    if d.audio_blob_ref and not d.audio_deleted:
        storage.delete(d.audio_blob_ref)
    append_entry(
        db, current_user.id, "debrief.delete", "debrief",
        f"{d.assessment_id}/{d.id}", {"title": d.title, "status": d.status}, None,
    )
    db.delete(d)
    db.commit()
