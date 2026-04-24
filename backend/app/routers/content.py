"""
Read-only routes that serve JTS R2 framework content from the content/ directory.
No persistence layer — these are static reads of the content JSON files.
"""

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.config import settings

router = APIRouter(tags=["content"])

CONTENT_DIR = Path(settings.content_dir).resolve()
JTS_R2_DIR = CONTENT_DIR / "frameworks" / "jts_r2"


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
