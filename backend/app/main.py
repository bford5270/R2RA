import sys

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.routers import assessments, auth, content, crosswalk, crosswalk_editor, evidence, exercises, health, reports, unit_library, users

_INSECURE_DEFAULTS = {"change-me-in-production", "change-me-use-openssl-rand-hex-32", "replace-with-a-random-secret-in-production", "secret"}
if not settings.debug and settings.secret_key.lower() in _INSECURE_DEFAULTS:
    sys.exit("FATAL: SECRET_KEY is set to an insecure default. Set a strong random value before starting in production.")

app = FastAPI(
    title=settings.app_name,
    description="Role 2 Readiness Assessment — unofficial digital tool",
    version="0.1.0",
    docs_url="/api/docs" if settings.debug else None,
    redoc_url=None,
)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        if not settings.debug:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: blob:; "
                "font-src 'self'; "
                "connect-src 'self'; "
                "frame-ancestors 'none';"
            )
        return response


app.add_middleware(SecurityHeadersMiddleware)
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
app.include_router(crosswalk_editor.router)
app.include_router(users.router)
app.include_router(exercises.router)
app.include_router(reports.router)
app.include_router(unit_library.router)
