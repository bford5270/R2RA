"""
Serves the JTS ↔ T&R crosswalk data.

The crosswalk YAML uses short item prefixes (pdp, c2, mroe, …).
The manifest section IDs use full names (predeployment_prep, c2, mroe, …).
We derive the item prefix from the section ID by checking which prefixes
exist in the loaded crosswalk index and picking the one that is a prefix
of, or matches, the section ID.

DB overrides (written by the SME editor) are merged on top of the YAML base
so assessors always see the latest curated mappings.
"""
from functools import lru_cache
from pathlib import Path

import yaml
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.config import settings
from app.database import get_db
from app.models.crosswalk_override import CrosswalkOverride
from app.models.user import User

router = APIRouter(prefix="/api/crosswalk", tags=["crosswalk"])

# Section-ID → item-prefix map (manual, derived from content layer).
# Any section not listed has no crosswalk entries yet.
_SECTION_PREFIX: dict[str, str] = {
    "predeployment_prep": "pdp",
    "c2":                 "c2",
    "mroe":               "mroe",
    "communications":     "comms",
    "orsop":              "orsop",
    "clinical_readiness": "cra",
    "clinical_capabilities": "cc",
    "blood_resources":    "blood",
    "facilities":         "fac",
    "arsra_appendix":     "arsra",
}


@lru_cache(maxsize=1)
def _load_crosswalk() -> dict[str, dict]:
    """Parse the crosswalk YAML once and index by jts_item."""
    crosswalk_path = Path(settings.content_dir) / "crosswalk" / "jts_r2__hss_tr.yaml"
    with open(crosswalk_path, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return {entry["jts_item"]: entry for entry in data.get("mappings", [])}


@router.get("/{section_id}")
def get_crosswalk_for_section(
    section_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    prefix = _SECTION_PREFIX.get(section_id)
    if not prefix:
        return []
    base_index = _load_crosswalk()
    base_entries = {
        item_id: entry
        for item_id, entry in base_index.items()
        if item_id.startswith(prefix + ".")
    }
    if not base_entries:
        return []

    overrides = {
        r.jts_item: r
        for r in db.query(CrosswalkOverride).filter(
            CrosswalkOverride.jts_item.in_(list(base_entries.keys()))
        ).all()
    }

    result = []
    for item_id, entry in base_entries.items():
        ov = overrides.get(item_id)
        if ov is not None:
            merged = dict(entry)
            merged["wickets"] = ov.wickets or []
            merged["mets"] = ov.mets or []
            merged["note"] = ov.note
            result.append(merged)
        else:
            result.append(entry)
    return result
