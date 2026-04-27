import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def _sha256(data: str) -> str:
    return hashlib.sha256(data.encode()).hexdigest()


def append_entry(
    db: Session,
    actor_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
) -> AuditLog:
    ts = datetime.now(timezone.utc)

    last = db.query(AuditLog).order_by(AuditLog.ts.desc()).first()
    prev_hash = last.hash if last else None

    payload = json.dumps(
        {
            "actor_id": actor_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "before": before,
            "after": after,
            "ts": ts.isoformat(),
            "prev_hash": prev_hash,
        },
        sort_keys=True,
        default=str,
    )
    row = AuditLog(
        id=str(uuid.uuid4()),
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        before=before,
        after=after,
        ts=ts,
        prev_hash=prev_hash,
        hash=_sha256(payload),
    )
    db.add(row)
    return row
