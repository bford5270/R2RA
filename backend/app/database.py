from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool
from typing import Generator

from app.config import settings

# Strip async driver prefixes; normalize postgres:// shorthand (AWS RDS uses it)
_sync_url = (
    settings.database_url
    .replace("sqlite+aiosqlite", "sqlite")
    .replace("postgresql+asyncpg", "postgresql")
    .replace("postgres://", "postgresql://")
)
# Name the driver: SQLAlchemy 2.1 defaults postgresql:// to psycopg 3, which
# the image doesn't install (that crash-looped prod on Oct 28, 2026).
if _sync_url.startswith("postgresql://"):
    _sync_url = "postgresql+psycopg2://" + _sync_url[len("postgresql://"):]

# SQLite requires check_same_thread=False; Postgres does not accept it
_is_sqlite = _sync_url.startswith("sqlite")

# Aurora Serverless v2 auto-pause (SecondsUntilAutoPause=300) only engages at
# zero client connections, and a pooled connection counts even when idle. The
# default QueuePool held 5 connections open indefinitely, pinning the cluster
# at its 0.5-ACU floor around the clock (~$44/mo) — see docs/COST.md. NullPool
# opens per checkout and closes on release, so an idle app lets the cluster
# pause. Pooling buys nothing here anyway: intra-VPC connect is single-digit ms
# at pilot traffic, and a pause terminates server-side connections, so a pool
# would hand out dead ones without pool_pre_ping.
#
# SQLite keeps its driver default — NullPool would give an in-memory dev DB a
# fresh empty database per connection.
_engine_kwargs = {} if _is_sqlite else {"poolclass": NullPool}

if _is_sqlite:
    _connect_args = {"check_same_thread": False}
else:
    # Must comfortably exceed the ~15 s Aurora resume, or the first request
    # after an idle period fails instead of waiting for the cluster to wake.
    _connect_args = {"connect_timeout": settings.db_connect_timeout_sec}

engine = create_engine(
    _sync_url,
    connect_args=_connect_args,
    echo=settings.debug,
    **_engine_kwargs,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
