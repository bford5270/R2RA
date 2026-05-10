from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from app.config import settings

# Strip async driver prefixes; normalize postgres:// shorthand (AWS RDS uses it)
_sync_url = (
    settings.database_url
    .replace("sqlite+aiosqlite", "sqlite")
    .replace("postgresql+asyncpg", "postgresql")
    .replace("postgres://", "postgresql://")
)

# SQLite requires check_same_thread=False; Postgres does not accept it
_is_sqlite = _sync_url.startswith("sqlite")
_connect_args = {"check_same_thread": False} if _is_sqlite else {}

engine = create_engine(
    _sync_url,
    connect_args=_connect_args,
    echo=settings.debug,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
