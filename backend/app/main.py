from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import assessments, auth, content, crosswalk, evidence, health, reports, users

app = FastAPI(
    title=settings.app_name,
    description="Role 2 Readiness Assessment — unofficial digital tool",
    version="0.1.0",
    docs_url="/api/docs" if settings.debug else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://localhost:\d+",  # any localhost port (dev only)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(content.router, prefix="/api/content")
app.include_router(assessments.router)
app.include_router(evidence.router)
app.include_router(crosswalk.router)
app.include_router(users.router)
app.include_router(reports.router)
