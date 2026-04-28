"""
Storage abstraction — local disk (dev) or S3 (prod).

Switch: set AWS_S3_BUCKET in the environment. When absent, local disk is used
and the app behaves exactly as it did before this abstraction was added.

blob_ref convention (same for both backends):
  evidence/{evidence_id}/{filename}
  library/{item_id}/{filename}
"""
from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse, StreamingResponse, Response

from app.config import settings


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _s3():
    """Lazy import + instantiate boto3 client. Only called when S3 is active."""
    import boto3  # type: ignore[import]
    kwargs: dict = {"region_name": settings.aws_region}
    if settings.aws_access_key_id:
        kwargs["aws_access_key_id"] = settings.aws_access_key_id
        kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
    return boto3.client("s3", **kwargs)


def _local_path(key: str) -> Path:
    return Path(settings.uploads_dir) / key


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def put(key: str, content: bytes, content_type: str) -> str:
    """
    Store content under the given key. Returns key (stored as blob_ref).
    S3 uploads always use AES-256 server-side encryption.
    """
    if settings.aws_s3_bucket:
        _s3().put_object(
            Bucket=settings.aws_s3_bucket,
            Key=key,
            Body=content,
            ContentType=content_type,
            ServerSideEncryption="AES256",
        )
    else:
        dest = _local_path(key)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(content)
    return key


def serve(key: str, filename: str, content_type: str) -> Response:
    """
    Return a FastAPI Response that streams the file to the client.
    Raises HTTP 404 if the file is not found.
    """
    if settings.aws_s3_bucket:
        try:
            obj = _s3().get_object(Bucket=settings.aws_s3_bucket, Key=key)
        except Exception as exc:
            # boto3 raises botocore.exceptions.ClientError for 404
            raise HTTPException(status_code=404, detail="File not found") from exc
        body = obj["Body"]

        def _stream():
            while True:
                chunk = body.read(65_536)
                if not chunk:
                    break
                yield chunk

        return StreamingResponse(
            _stream(),
            media_type=content_type,
            headers={"Content-Disposition": f'inline; filename="{filename}"'},
        )
    else:
        path = _local_path(key)
        if not path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        return FileResponse(path, media_type=content_type, filename=filename)


def delete(key: str) -> None:
    """Delete the file at key. Silent no-op if already gone."""
    if settings.aws_s3_bucket:
        try:
            _s3().delete_object(Bucket=settings.aws_s3_bucket, Key=key)
        except Exception:
            pass
    else:
        path = _local_path(key)
        if path.exists():
            path.unlink()
        # Remove empty parent dir
        try:
            path.parent.rmdir()
        except OSError:
            pass
