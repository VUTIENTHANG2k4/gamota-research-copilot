"""Sign-in (APP_USERS / AUTH_SECRET). Token checks need no database; the API checks need PostgreSQL."""
import os
import time

import pytest

os.environ.setdefault("SKIP_STARTUP_JOBS", "1")
from fastapi.testclient import TestClient  # noqa: E402

from api import auth, main  # noqa: E402
from app import db  # noqa: E402


@pytest.fixture
def users(monkeypatch):
    monkeypatch.setenv("APP_USERS", "giamkhao:pw-1, thang:pw:2")
    monkeypatch.setenv("AUTH_SECRET", "test-secret")
    monkeypatch.setattr(auth, "FAIL_DELAY_S", 0)


def test_users_parsing(users):
    assert auth.users() == {"giamkhao": "pw-1", "thang": "pw:2"}  # a password may contain ':'
    assert auth.enabled()


def test_off_when_no_users(monkeypatch):
    monkeypatch.setenv("APP_USERS", "")
    assert not auth.enabled() and auth.require_user(None) is None


def test_token_roundtrip_expiry_and_tamper(users, monkeypatch):
    t = auth.issue("giamkhao")["token"]
    assert auth.verify(t) == "giamkhao"
    assert auth.verify(t, now=time.time() + auth.TOKEN_DAYS * 86400 + 5) is None  # expired
    body, sig = t.split(".")
    assert auth.verify(body + "." + sig[:-2] + "xx") is None  # bad signature
    assert auth.verify("garbage") is None
    monkeypatch.setenv("AUTH_SECRET", "rotated")
    assert auth.verify(t) is None  # changing the secret signs everyone out
    monkeypatch.setenv("AUTH_SECRET", "test-secret")
    monkeypatch.setenv("APP_USERS", "thang:pw:2")
    assert auth.verify(t) is None  # removed account


def test_password_check(users):
    assert auth.check_password("giamkhao", "pw-1")
    assert not auth.check_password("giamkhao", "wrong")
    assert not auth.check_password("nobody", "pw-1")


@pytest.fixture
def client():
    try:
        with db.connect() as conn:
            db.init_schema(conn)
    except Exception as e:
        pytest.skip(f"database not available: {e}")
    return TestClient(main.app)


def test_api_requires_login_when_enabled(users, client):
    assert client.get("/api/auth/config").json() == {"enabled": True}
    assert client.get("/api/health").status_code == 200  # public
    assert client.get("/api/about").status_code == 200  # public (limitations page)
    assert client.get("/api/runs").status_code == 401
    assert client.post("/api/runs", json={"question": "Câu hỏi thử nghiệm"}).status_code == 401
    assert client.get("/api/runs", headers={"Authorization": "Bearer nope"}).status_code == 401
    assert client.post("/api/auth/login", json={"username": "giamkhao", "password": "x"}).status_code == 401
    tok = client.post("/api/auth/login", json={"username": "giamkhao", "password": "pw-1"}).json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    assert client.get("/api/runs", headers=h).status_code == 200
    assert client.get("/api/auth/me", headers=h).json() == {"username": "giamkhao", "enabled": True}


def test_records_who_created_and_reviewed(users, client):
    from api import store
    tok = client.post("/api/auth/login", json={"username": "thang", "password": "pw:2"}).json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    rid = store.create_run("Câu hỏi ghi người tạo", created_by="thang")
    try:
        assert [r for r in client.get("/api/runs", headers=h).json() if r["id"] == rid][0]["created_by"] == "thang"
        assert client.get(f"/api/runs/{rid}", headers=h).json()["created_by"] == "thang"
        store.set_review(rid, "C-00000001", "rejected", "thang")
        assert store.get_reviews(rid)["C-00000001"]["reviewed_by"] == "thang"
    finally:
        store.delete_run(rid)


def test_open_when_disabled(monkeypatch, client):
    monkeypatch.setenv("APP_USERS", "")
    assert client.get("/api/auth/config").json() == {"enabled": False}
    assert client.get("/api/runs").status_code == 200
    assert client.post("/api/auth/login", json={"username": "a", "password": "b"}).status_code == 409
