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
    scenario_ref: str | None = None
    exercise_id: str | None = None

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
    scenario_ref: str | None = None
    exercise_id: str | None = None
    started_at: datetime
    certified_at: datetime | None = None

    model_config = {"from_attributes": True}


class ScenarioUpdate(BaseModel):
    scenario_ref: str | None = None


class StatusAdvance(BaseModel):
    status: str
    # Required when status == "certified"
    print_name: str | None = None
    signer_role: str | None = None

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
    status: str | None = None     # optional when score is supplied; derived automatically
    score: int | None = None      # 1–5 Likert; drives status when provided
    note: str | None = None
    capture_data: dict | None = None  # {"components": [4, 5, null, 3, ...]}

    def model_post_init(self, _context: object) -> None:
        if self.score is not None:
            if self.score not in {1, 2, 3, 4, 5}:
                raise ValueError("score must be 1–5")
            # Derive status from score when not explicitly supplied
            if not self.status or self.status == "unanswered":
                self.status = "go" if self.score >= 4 else "no_go"
        if self.status is None:
            self.status = "unanswered"
        elif self.status not in VALID_TR_STATUSES:
            raise ValueError(f"status must be one of {VALID_TR_STATUSES}")


class TrResponseOut(BaseModel):
    event_code: str
    status: str
    score: int | None
    capture_data: dict | None
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


class SignatureOut(BaseModel):
    id: str
    assessment_id: str
    role: str
    signer_id: str
    print_name: str | None
    method: str
    signed_at: datetime
    payload_hash: str

    model_config = {"from_attributes": True}


class AuditLogOut(BaseModel):
    id: str
    actor_id: str | None
    action: str
    entity_type: str
    entity_id: str
    before: dict | None
    after: dict | None
    ts: datetime

    model_config = {"from_attributes": True}
