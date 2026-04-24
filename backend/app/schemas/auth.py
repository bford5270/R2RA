from datetime import datetime

from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    totp_required: bool = False


class TotpCompleteRequest(BaseModel):
    partial_token: str
    code: str


class TotpEnrollResponse(BaseModel):
    secret: str
    uri: str


class TotpConfirmRequest(BaseModel):
    """Client sends back the secret from /enroll plus the code to activate TOTP."""
    secret: str
    code: str


class RegisterRequest(BaseModel):
    display_name: str
    email: str
    password: str
    global_role: str = "assessor"


class UserOut(BaseModel):
    id: str
    display_name: str
    email: str
    global_role: str
    totp_enrolled: bool
    created_at: datetime
    last_login_at: datetime | None = None

    model_config = {"from_attributes": True}
