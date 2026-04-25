"""
Serves the JTS ↔ T&R crosswalk data.

The crosswalk YAML uses short item prefixes (pdp, c2, mroe, …).
The manifest section IDs use full names (predeployment_prep, c2, mroe, …).
We derive the item prefix from the section ID by checking which prefixes
exist in the loaded crosswalk index and picking the one that is a prefix
of, or matches, the section ID.
"""
from functools import lru_cache
from pathlib import Path

import yaml
from fastapi import APIRouter, Depends, HTTPException

from app.auth.deps import get_current_user
from app.config import settings
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
) -> list[dict]:
    prefix = _SECTION_PREFIX.get(section_id)
    if not prefix:
        return []
    index = _load_crosswalk()
    return [
        entry for item_id, entry in index.items()
        if item_id.startswith(prefix + ".")
    ]
