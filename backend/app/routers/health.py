from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    app: str
    cui_banner: str


@router.get("/api/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", app=settings.app_name, cui_banner=settings.cui_banner)
