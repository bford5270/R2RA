"""
Read-only routes that serve JTS R2 framework content from the content/ directory.
No persistence layer — these are static reads of the content JSON files.
"""

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.config import settings

router = APIRouter(tags=["content"])

from functools import lru_cache

CONTENT_DIR = Path(settings.content_dir).resolve()
JTS_R2_DIR = CONTENT_DIR / "frameworks" / "jts_r2"
HSS_TR_PATH = CONTENT_DIR / "frameworks" / "hss_tr.json"

# Map event-code prefix → chapter number (derived from NAVMC 3500.84B page order)
_CHAPTER_MAP: dict[str, int] = {
    "HSS-OPS":  3, "HSS-PLAN": 3, "HSS-SVCS": 3, "HSS-DENT": 3, "HSS-CBRN": 3,
    "HSS-MCCS": 4, "HSS-MATN": 4,
    "HSS-MED":  5,
    "L03A-HSS": 6, "L03A-PCC": 6, "L03A-TCCC": 6, "L03A-EFWB": 6,
    "CLIN-HSS": 7,
    "8427-MED": 8,
    "8403-MED": 9,
    "HSS-MW":   10,
}


def _load_json(path: Path) -> dict:
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Content file not found: {path.name}")
    with path.open(encoding="utf-8") as f:
        return json.load(f)


@router.get("/jts_r2/manifest")
async def get_manifest():
    return _load_json(JTS_R2_DIR / "_manifest.json")


@router.get("/jts_r2/sections")
async def list_sections():
    manifest = _load_json(JTS_R2_DIR / "_manifest.json")
    return manifest["sections_manifest"]


@router.get("/jts_r2/sections/{section_id}")
async def get_section(section_id: str):
    manifest = _load_json(JTS_R2_DIR / "_manifest.json")
    entry = next((s for s in manifest["sections_manifest"] if s["id"] == section_id), None)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Section '{section_id}' not in manifest")
    return _load_json(JTS_R2_DIR / entry["file"])


@lru_cache(maxsize=1)
def _load_tr() -> dict:
    with HSS_TR_PATH.open(encoding="utf-8") as f:
        import json as _json
        data = _json.load(f)
    # Annotate each wicket with its chapter number
    for w in data["wickets"]:
        ec: str = w["event_code"]
        chapter = 3  # default fallback
        for prefix, ch in _CHAPTER_MAP.items():
            if ec.startswith(prefix + "-") or ec.startswith(prefix):
                chapter = ch
                break
        w["chapter"] = chapter
    return data


@router.get("/tr")
async def get_tr_framework():
    return _load_tr()
