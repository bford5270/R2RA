"""
Admin-only crosswalk editor.

Provides CRUD for per-item DB overrides that layer on top of the YAML base
crosswalk. On export, base + overrides are merged and serialised back to YAML
so the SME can commit the result to the repo.
"""
from datetime import datetime, timezone

import yaml
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.database import get_db
from app.models.crosswalk_override import CrosswalkMeta, CrosswalkOverride
from app.models.user import User
from app.routers.crosswalk import _load_crosswalk

router = APIRouter(prefix="/api/crosswalk-editor", tags=["crosswalk-editor"])

VALID_STATUSES = {"draft-needs-sme-review", "approved"}
VALID_CONFIDENCE = {"high", "medium", "low"}


def _admin(user: User) -> None:
    if user.global_role != "admin":
        raise HTTPException(403, "Admin only")


def _db_status(db: Session) -> str:
    meta = db.get(CrosswalkMeta, "status")
    return meta.value if meta else "draft-needs-sme-review"


def _merged_entry(base: dict, ov: CrosswalkOverride | None) -> dict:
    entry = {
        "jts_item": base["jts_item"],
        "wickets": base.get("wickets", []),
        "mets": base.get("mets", []),
        "note": base.get("note"),
        "_overridden": False,
        "_edited_by": None,
        "_edited_at": None,
    }
    if ov is not None:
        entry["wickets"] = ov.wickets or []
        entry["mets"] = ov.mets or []
        entry["note"] = ov.note
        entry["_overridden"] = True
        entry["_edited_by"] = ov.edited_by
        entry["_edited_at"] = ov.edited_at.isoformat() if ov.edited_at else None
    return entry


# ---------------------------------------------------------------------------
# GET /full  — all base entries merged with DB overrides
# ---------------------------------------------------------------------------

@router.get("/full")
def get_full(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    _admin(current_user)
    base_index = _load_crosswalk()
    overrides = {r.jts_item: r for r in db.query(CrosswalkOverride).all()}
    entries = [_merged_entry(base, overrides.get(jts_item)) for jts_item, base in base_index.items()]
    return {
        "status": _db_status(db),
        "entries": entries,
    }


# ---------------------------------------------------------------------------
# GET /status, PATCH /status
# ---------------------------------------------------------------------------

@router.get("/status")
def get_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    _admin(current_user)
    return {"status": _db_status(db)}


@router.patch("/status")
def set_status(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    _admin(current_user)
    new_status = body.get("status", "")
    if new_status not in VALID_STATUSES:
        raise HTTPException(422, f"status must be one of {sorted(VALID_STATUSES)}")
    meta = db.get(CrosswalkMeta, "status")
    if meta is None:
        meta = CrosswalkMeta(key="status")
        db.add(meta)
    meta.value = new_status
    meta.updated_by = current_user.id
    meta.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": new_status}


# ---------------------------------------------------------------------------
# PUT /{jts_item}  — save override
# ---------------------------------------------------------------------------

@router.put("/{jts_item:path}")
def save_override(
    jts_item: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    _admin(current_user)
    base_index = _load_crosswalk()
    if jts_item not in base_index:
        raise HTTPException(404, f"JTS item '{jts_item}' not found in crosswalk base")

    # Basic validation of inbound wicket/met confidence values
    for w in body.get("wickets", []):
        if w.get("confidence") not in VALID_CONFIDENCE:
            raise HTTPException(422, f"Invalid confidence '{w.get('confidence')}' in wicket")
    for m in body.get("mets", []):
        if m.get("confidence") not in VALID_CONFIDENCE:
            raise HTTPException(422, f"Invalid confidence '{m.get('confidence')}' in MET")

    ov = db.get(CrosswalkOverride, jts_item)
    if ov is None:
        ov = CrosswalkOverride(jts_item=jts_item)
        db.add(ov)
    ov.wickets = body.get("wickets", [])
    ov.mets = body.get("mets", [])
    ov.note = body.get("note") or None
    ov.edited_by = current_user.id
    ov.edited_at = datetime.now(timezone.utc)
    db.commit()
    return _merged_entry(base_index[jts_item], ov)


# ---------------------------------------------------------------------------
# DELETE /{jts_item}  — revert to YAML base
# ---------------------------------------------------------------------------

@router.delete("/{jts_item:path}")
def revert_override(
    jts_item: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    _admin(current_user)
    ov = db.get(CrosswalkOverride, jts_item)
    if ov:
        db.delete(ov)
        db.commit()
    return {"jts_item": jts_item, "reverted": True}


# ---------------------------------------------------------------------------
# GET /export.yaml  — merged YAML download
# ---------------------------------------------------------------------------

@router.get("/export.yaml", response_class=PlainTextResponse)
def export_yaml(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> str:
    _admin(current_user)
    base_index = _load_crosswalk()
    overrides = {r.jts_item: r for r in db.query(CrosswalkOverride).all()}
    status = _db_status(db)

    merged_mappings = []
    for jts_item, base in base_index.items():
        ov = overrides.get(jts_item)
        entry: dict = {"jts_item": jts_item}
        if ov is not None:
            entry["wickets"] = ov.wickets or []
            entry["mets"] = ov.mets or []
            if ov.note:
                entry["note"] = ov.note
        else:
            entry["wickets"] = base.get("wickets", [])
            entry["mets"] = base.get("mets", [])
            if base.get("note"):
                entry["note"] = base["note"]
        merged_mappings.append(entry)

    doc = {
        "version": "0.1",
        "status": status,
        "source_frameworks": {
            "jts": {"id": "jts_r2", "version": "2024.0"},
            "hsstr": {"id": "hss_tr", "version": "3500.84B-ch2"},
            "mets": {"id": "mct_hss_seed", "version": "0.1"},
        },
        "mappings": merged_mappings,
    }
    header = (
        "# Crosswalk — exported from SME editor\n"
        "# Commit this file to content/crosswalk/jts_r2__hss_tr.yaml\n"
        "# to make edits permanent.\n\n"
    )
    return header + yaml.dump(doc, allow_unicode=True, sort_keys=False, default_flow_style=False)
