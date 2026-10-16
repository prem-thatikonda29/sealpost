import csv
import io
import json
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base, get_db
from backend.main import app
from backend.models import Job, JobRow


@pytest.fixture(autouse=True)
def _default_timezone(monkeypatch):
    monkeypatch.delenv("APP_TIMEZONE", raising=False)


@pytest.fixture()
def env(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'r.db'}", connect_args={"check_same_thread": False}
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
    s = Session()
    s.add(Job(
        id="j1", status="done", total_rows=3, sent_count=1, failed_count=1,
        created_at=datetime(2026, 10, 16, 12, 0),
        finished_at=datetime(2026, 10, 16, 12, 0, 42),
        event_snapshot=json.dumps({"name": "Hack Night"}),
    ))
    s.add_all([
        JobRow(job_id="j1", row_index=0, name="Ada", email="ada@x.com", status="sent",
               sent_at=datetime(2026, 10, 16, 12, 0, 5), attempts=2),
        JobRow(job_id="j1", row_index=1, name="Bo", email="bo@x.com", status="failed",
               error_message="boom", attempts=4),
        JobRow(job_id="j1", row_index=2, name="Cy", email="ada@x.com", status="skipped",
               error_message="Duplicate of row 1"),
    ])
    for jid, snap in (("j4", [1, 2]), ("j5", {"name": 7})):
        s.add(Job(
            id=jid, status="done", total_rows=0, sent_count=0, failed_count=0,
            created_at=datetime(2026, 10, 16, 12, 0),
            event_snapshot=json.dumps(snap),
        ))
    for jid, nm in (("j2", "हैकथॉन"), ("j3", "!!!")):
        s.add(Job(
            id=jid, status="done", total_rows=0, sent_count=0, failed_count=0,
            created_at=datetime(2026, 10, 16, 12, 0),
            event_snapshot=json.dumps({"name": nm}),
        ))
    s.commit()
    s.close()
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_report_csv_downloads_with_a_dated_filename(env):
    res = env.get("/api/jobs/j1/report.csv")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    assert 'filename="hack_night_delivery_report_2026-10-16.csv"' in res.headers["content-disposition"]


def test_report_csv_has_one_row_per_participant_in_ist(env):
    text = env.get("/api/jobs/j1/report.csv").content.decode("utf-8")
    table = list(csv.reader(io.StringIO(text.lstrip("﻿"))))
    assert [r[3] for r in table[1:]] == ["Delivered", "Failed", "Skipped"]
    assert table[1][5] == "2026-10-16 17:30:05 IST"
    assert table[1][6] == "2"
    assert table[3][7] == "Duplicate of row 1"


@pytest.mark.parametrize("jid", ["j4", "j5"])
def test_report_survives_a_malformed_snapshot(env, jid):
    res = env.get(f"/api/jobs/{jid}/report.csv")
    assert res.status_code == 200
    assert 'filename="job_delivery_report_2026-10-16.csv"' in res.headers["content-disposition"]


def test_report_for_an_unknown_job_is_404(env):
    assert env.get("/api/jobs/nope/report.csv").status_code == 404


def test_get_job_includes_the_summary(env):
    summary = env.get("/api/jobs/j1").json()["summary"]
    assert summary["total"] == 3
    assert summary["delivered"] == 1
    assert summary["failed"] == 1
    assert summary["skipped"] == 1
    assert summary["retries"] == 1 + 3
    assert summary["duration_seconds"] == 42
    assert summary["delivered_pct"] == 50.0       # 1 of the 2 that were attempted


def test_the_zip_download_still_names_itself_from_the_event(env, tmp_path, monkeypatch):
    out = tmp_path / "output" / "j1"
    out.mkdir(parents=True)
    (out / "a.pdf").write_bytes(b"%PDF")
    monkeypatch.setattr("backend.routers.jobs.OUTPUT_DIR", tmp_path / "output")
    res = env.get("/api/jobs/j1/download")
    assert res.status_code == 200
    assert "hack_night.zip" in res.headers["content-disposition"]


def test_report_csv_survives_a_non_latin_event_name(env):
    res = env.get("/api/jobs/j2/report.csv")
    assert res.status_code == 200
    cd = res.headers["content-disposition"]
    cd.encode("latin-1")
    assert '_delivery_report_2026-10-16.csv"' in cd
    assert 'filename="' in cd and all(ord(ch) < 128 for ch in cd)
    assert "filename*=UTF-8''" in cd
    assert "%E0%A4%B9" in cd


def test_report_csv_symbol_only_name_falls_back_to_ascii(env):
    res = env.get("/api/jobs/j3/report.csv")
    assert res.status_code == 200
    assert 'filename="job_delivery_report_2026-10-16.csv"' in res.headers["content-disposition"]
