from datetime import datetime

from pydantic import BaseModel, field_validator


VALID_MISSION_TYPES = {"r2lm_non_split", "r2lm_split", "r2e", "arst"}
VALID_RESPONSE_STATUSES = {"yes", "no", "na", "unanswered"}
VALID_STATUSES = {"draft", "in_progress", "ready_for_review", "certified"}
VALID_TR_STATUSES = {"go", "no_go", "na", "unanswered"}


class AssessmentCreate(BaseModel):
    unit_uic: str
    unit_name: str
    mission_type: str
    service: str | None = None
    component: str | None = None
    unique_identifier: str | None = None

    @field_validator("mission_type")
    @classmethod
    def validate_mission_type(cls, v: str) -> str:
        if v not in VALID_MISSION_TYPES:
            raise ValueError(f"mission_type must be one of {VALID_MISSION_TYPES}")
        return v


class AssessmentOut(BaseModel):
    id: str
    unit_id: str
    unit_uic: str
    unit_name: str
    mission_type: str
    lead_id: str
    status: str
    service: str | None
    component: str | None
    unique_identifier: str | None
    started_at: datetime

    model_config = {"from_attributes": True}


class StatusAdvance(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(f"status must be one of {VALID_STATUSES}")
        return v


class ResponseUpsert(BaseModel):
    status: str
    note: str | None = None
    capture_data: dict | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_RESPONSE_STATUSES:
            raise ValueError(f"status must be one of {VALID_RESPONSE_STATUSES}")
        return v


class ResponseOut(BaseModel):
    item_id: str
    status: str
    note: str | None
    capture_data: dict | None
    authored_by: str
    last_modified_by: str
    version: int
    updated_at: datetime

    model_config = {"from_attributes": True}


class TrResponseUpsert(BaseModel):
    status: str
    note: str | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_TR_STATUSES:
            raise ValueError(f"status must be one of {VALID_TR_STATUSES}")
        return v


class TrResponseOut(BaseModel):
    event_code: str
    status: str
    note: str | None
    authored_by: str
    last_modified_by: str
    version: int
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: str
    display_name: str
    email: str
    global_role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    is_active: bool | None = None
    global_role: str | None = None


class UserCreate(BaseModel):
    display_name: str
    email: str
    password: str
    global_role: str = "assessor"


class AssignmentOut(BaseModel):
    id: str
    assessment_id: str
    user_id: str
    display_name: str
    email: str
    role: str
    scope_ids: list[str]
    status: str
    assigned_at: datetime


class AssignmentUpsert(BaseModel):
    role: str = "contributor"
    scope_ids: list[str] = []
