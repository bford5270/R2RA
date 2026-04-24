from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from app.config import settings

# Strip async driver prefix for the sync engine used by FastAPI + Alembic
_sync_url = settings.database_url.replace("sqlite+aiosqlite", "sqlite")

engine = create_engine(
    _sync_url,
    connect_args={"check_same_thread": False},  # required for SQLite
    echo=settings.debug,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
