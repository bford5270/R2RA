from datetime import date, datetime
from pydantic import BaseModel


class ExerciseCreate(BaseModel):
    name: str
    start_date: date
    end_date: date
    location: str | None = None


class ExerciseOut(BaseModel):
    id: str
    name: str
    start_date: date
    end_date: date
    location: str | None
    status: str
    created_by: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ExerciseStatusUpdate(BaseModel):
    status: str  # active | closed
