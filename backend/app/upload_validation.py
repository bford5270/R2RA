"""
File upload validation — magic-byte checks independent of client-supplied Content-Type.

Allowed formats: JPEG, PNG, WebP, GIF, PDF, plain text.
"""
from fastapi import HTTPException

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "text/plain",
}

# (offset, bytes_to_match) — first matching signature wins
_MAGIC: list[tuple[int, bytes, str]] = [
    (0, b"\xff\xd8\xff",           "image/jpeg"),
    (0, b"\x89PNG\r\n\x1a\n",     "image/png"),
    (0, b"RIFF",                   "image/webp"),   # also need bytes[8:12] == WEBP
    (0, b"GIF87a",                 "image/gif"),
    (0, b"GIF89a",                 "image/gif"),
    (0, b"%PDF-",                  "application/pdf"),
]


def _detect_mime(data: bytes) -> str | None:
    """Return detected MIME type from magic bytes, or None if unrecognised."""
    for offset, sig, mime in _MAGIC:
        if data[offset : offset + len(sig)] == sig:
            if mime == "image/webp" and data[8:12] != b"WEBP":
                continue
            return mime
    # Plain text: no non-printable bytes in first 512 bytes (heuristic)
    sample = data[:512]
    if sample and all(b >= 0x09 for b in sample):
        return "text/plain"
    return None


def validate_upload(content: bytes, declared_content_type: str, max_bytes: int) -> None:
    """
    Raises HTTPException if:
    - declared content-type is not in the allow-list
    - actual magic bytes don't match an allowed type
    - file exceeds max_bytes
    """
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds {max_bytes // (1024 * 1024)} MB limit.",
        )

    if declared_content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{declared_content_type}'. Allowed: JPEG, PNG, WebP, GIF, PDF, TXT.",
        )

    detected = _detect_mime(content)
    if detected is None:
        raise HTTPException(
            status_code=415,
            detail="File content does not match any allowed type.",
        )
    # Allow text/plain heuristic to pass for any declared text type
    if detected == "text/plain" and declared_content_type == "text/plain":
        return
    if detected != declared_content_type:
        raise HTTPException(
            status_code=415,
            detail=f"File content (detected: {detected}) does not match declared type '{declared_content_type}'.",
        )
