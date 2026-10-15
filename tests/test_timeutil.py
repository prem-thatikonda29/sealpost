from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base, get_db
from backend.main import app
from backend.models import Job
from backend.timeutil import to_app_tz, utc_naive_now

NOON = datetime(2026, 10, 16, 12, 0)


def test_default_is_ist(monkeypatch):
    monkeypatch.delenv("APP_TIMEZONE", raising=False)
    assert to_app_tz(NOON).isoformat() == "2026-10-16T17:30:00+05:30"


def test_env_override(monkeypatch):
    monkeypatch.setenv("APP_TIMEZONE", "UTC")
    assert to_app_tz(NOON).isoformat() == "2026-10-16T12:00:00+00:00"


def test_bogus_timezone_falls_back_to_ist(monkeypatch):
    monkeypatch.setenv("APP_TIMEZONE", "Nope/Zone")
    assert to_app_tz(NOON).isoformat() == "2026-10-16T17:30:00+05:30"


def test_utc_naive_now_is_naive():
    assert utc_naive_now().tzinfo is None


def test_api_serializes_created_at_in_ist(tmp_path, monkeypatch):
    monkeypatch.delenv("APP_TIMEZONE", raising=False)
    engine = create_engine(
        f"sqlite:///{tmp_path / 't.db'}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as c:
            s = Session()
            s.add(Job(id="j1", status="done", total_rows=0, created_at=NOON))
            s.commit()
            s.close()
            body = c.get("/api/jobs/j1").json()
        assert body["created_at"].startswith("2026-10-16T17:30:00")
        assert body["created_at"].endswith("+05:30")
    finally:
        app.dependency_overrides.clear()
