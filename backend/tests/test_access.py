"""
Per-assessment access control and login throttling.

Runs against a throwaway SQLite file; no Postgres or AWS needed:
    cd backend && DEBUG=true pytest tests/
"""
import os
import tempfile

_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_db.name}"
os.environ["DEBUG"] = "true"
os.environ["CONTENT_DIR"] = os.path.join(os.path.dirname(__file__), "..", "..", "content")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import app.models  # noqa: E402,F401  (registers every table)
from app.database import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models.base import Base  # noqa: E402
from app.routers import auth as auth_router  # noqa: E402

Base.metadata.create_all(engine)
client = TestClient(app)


def _register(name: str, role: str = "assessor") -> str:
    auth_router._login_attempts.clear()
    r = client.post("/api/auth/register", json={
        "display_name": name, "email": f"{name}@example.com",
        "password": "correct-horse-1", "global_role": role,
    })
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _login(name: str) -> str:
    auth_router._login_attempts.clear()
    r = client.post("/api/auth/login", json={"email": f"{name}@example.com", "password": "correct-horse-1"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def world():
    _register("admin", "admin")  # first user bootstraps as admin
    admin = _login("admin")
    users = {}
    for name in ("lead", "contrib", "observer", "outsider"):
        uid = _register(name)
        r = client.patch(f"/api/users/{uid}", json={"global_role": "assessor"}, headers=_h(admin))
        assert r.status_code == 200, r.text
        users[name] = (uid, _login(name))

    lead = users["lead"][1]
    r = client.post("/api/assessments", json={
        "unit_uic": "M12345", "unit_name": "Test Surg Co", "mission_type": "r2lm_non_split",
    }, headers=_h(lead))
    assert r.status_code == 201, r.text
    aid = r.json()["id"]

    r = client.put(f"/api/assessments/{aid}/assignments/{users['contrib'][0]}",
                   json={"role": "contributor", "scope_ids": ["c2"]}, headers=_h(lead))
    assert r.status_code == 200, r.text
    r = client.put(f"/api/assessments/{aid}/assignments/{users['observer'][0]}",
                   json={"role": "observer", "scope_ids": []}, headers=_h(lead))
    assert r.status_code == 200, r.text
    return {"aid": aid, "admin": admin, **{k: v[1] for k, v in users.items()}}


def test_outsider_cannot_see_or_touch_assessment(world):
    aid, t = world["aid"], world["outsider"]
    assert client.get(f"/api/assessments/{aid}", headers=_h(t)).status_code == 404
    assert client.get(f"/api/assessments/{aid}/responses", headers=_h(t)).status_code == 404
    r = client.put(f"/api/assessments/{aid}/responses/c2.1", json={"status": "yes"}, headers=_h(t))
    assert r.status_code == 404
    assert aid not in [a["id"] for a in client.get("/api/assessments", headers=_h(t)).json()]


def test_members_and_admin_can_read(world):
    aid = world["aid"]
    for who in ("lead", "contrib", "observer", "admin"):
        assert client.get(f"/api/assessments/{aid}", headers=_h(world[who])).status_code == 200, who
        assert aid in [a["id"] for a in client.get("/api/assessments", headers=_h(world[who])).json()], who


def test_contributor_writes_only_inside_scope(world):
    aid, t = world["aid"], world["contrib"]
    ok = client.put(f"/api/assessments/{aid}/responses/c2.1", json={"status": "yes"}, headers=_h(t))
    assert ok.status_code == 200, ok.text
    out = client.put(f"/api/assessments/{aid}/responses/pdp.1", json={"status": "yes"}, headers=_h(t))
    assert out.status_code == 403


def test_observer_is_read_only(world):
    aid, t = world["aid"], world["observer"]
    r = client.put(f"/api/assessments/{aid}/responses/c2.1", json={"status": "no"}, headers=_h(t))
    assert r.status_code == 403


def test_only_lead_oic_or_admin_advance_status(world):
    aid = world["aid"]
    r = client.patch(f"/api/assessments/{aid}/status", json={"status": "in_progress"}, headers=_h(world["contrib"]))
    assert r.status_code == 403
    r = client.patch(f"/api/assessments/{aid}/status", json={"status": "in_progress"}, headers=_h(world["lead"]))
    assert r.status_code == 200, r.text


def test_login_is_throttled_per_account():
    auth_router._login_attempts.clear()
    codes = [
        client.post("/api/auth/login", json={"email": "lead@example.com", "password": "wrong"}).status_code
        for _ in range(auth_router._ACCOUNT_MAX_ATTEMPTS + 1)
    ]
    assert codes[-1] == 429
    auth_router._login_attempts.clear()
