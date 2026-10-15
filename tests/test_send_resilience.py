import asyncio
import io
import json
import smtplib
from types import SimpleNamespace

import pytest
from PIL import Image
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import email_validator, job_runner, mailer
from backend.database import Base, get_db
from backend.main import app
from backend.models import Job, JobRow


@pytest.fixture()
def env(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'r.db'}",
                           connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr(job_runner, "SessionLocal", Session)
    monkeypatch.setattr(job_runner, "OUTPUT_DIR", tmp_path / "output")
    monkeypatch.setattr("backend.routers.jobs.OUTPUT_DIR", tmp_path / "output")

    template = tmp_path / "cert.jpg"
    Image.new("RGB", (400, 280), "white").save(template, "JPEG")

    state = {"sent": [], "connections": 0, "script": []}  # script: exceptions to raise, in order

    def make_conn():
        state["connections"] += 1
        return object()

    def fake_send(**kw):
        if state["script"]:
            exc = state["script"].pop(0)
            if exc is not None:
                raise exc
        state["sent"].append(kw["email"])

    monkeypatch.setattr(mailer, "make_smtp_connection", make_conn)
    monkeypatch.setattr(mailer, "send_certificate", fake_send)
    monkeypatch.setattr(mailer, "poll_bounces", lambda since: [])
    monkeypatch.setattr(email_validator, "validate_mx", lambda email: (True, "ok"))

    sleeps = []

    async def fake_sleep(seconds):
        sleeps.append(seconds)

    monkeypatch.setattr(asyncio, "sleep", fake_sleep)
    monkeypatch.setenv("SEND_INTERVAL_SECONDS", "0")
    monkeypatch.setenv("SEND_BACKOFF_BASE_SECONDS", "2")

    with TestClient(app) as c:
        c.Session, c.template, c.state, c.sleeps = Session, str(template), state, sleeps
        yield c
    app.dependency_overrides.clear()


def run(env, people, dry_run=False):
    db = env.Session()
    db.add(Job(id="j", status="pending", dry_run=dry_run, total_rows=len(people)))
    for i, (n, e) in enumerate(people):
        db.add(JobRow(job_id="j", row_index=i, name=n, email=e, status="pending"))
    db.commit()
    db.close()
    config = {"template_path": env.template, "text_position_x": 200,
              "text_position_y": 140, "font_size": 48, "max_text_width": 350,
              "email_subject": "s", "email_body": "Hi {name}"}
    rows = [{"name": n, "email": e} for n, e in people]
    asyncio.run(job_runner.run_job("j", config, rows, dry_run))
    db = env.Session()
    out = {r.email: r for r in db.query(JobRow).all()}
    job = db.query(Job).first()
    db.expunge_all()
    db.close()
    return job, out


PEOPLE = [("Ada", "a@x.com"), ("Bo", "b@x.com"), ("Cy", "c@x.com")]


def test_transient_error_is_retried_then_sent(env):
    env.state["script"] = [smtplib.SMTPServerDisconnected("dropped")]
    job, rows = run(env, PEOPLE[:1])
    assert rows["a@x.com"].status == "sent"
    assert rows["a@x.com"].attempts == 2
    assert rows["a@x.com"].sent_at is not None
    assert 2.0 in env.sleeps                       # first backoff
    assert env.state["connections"] == 2           # reconnected after the drop


def test_gives_up_after_max_retries(env, monkeypatch):
    monkeypatch.setenv("SEND_MAX_RETRIES", "2")
    env.state["script"] = [smtplib.SMTPDataError(451, b"later")] * 5
    job, rows = run(env, PEOPLE[:1])
    assert rows["a@x.com"].status == "failed"
    assert rows["a@x.com"].attempts == 3           # first try + 2 retries
    assert job.failed_count == 1


def test_permanent_error_is_not_retried(env):
    env.state["script"] = [smtplib.SMTPDataError(550, b"rejected")]
    job, rows = run(env, PEOPLE[:1])
    assert rows["a@x.com"].status == "failed"
    assert rows["a@x.com"].attempts == 1


def test_daily_limit_stops_the_run_and_marks_the_rest(env):
    env.state["script"] = [None, smtplib.SMTPDataError(550, b"5.4.5 Daily user sending limit exceeded")]
    job, rows = run(env, PEOPLE)
    assert rows["a@x.com"].status == "sent"
    assert rows["b@x.com"].status == "failed"
    assert rows["b@x.com"].error_message == "Daily send limit reached. Re-send tomorrow."
    assert rows["c@x.com"].status == "failed"
    assert rows["c@x.com"].error_message == "Daily send limit reached. Re-send tomorrow."
    assert job.failed_count == 2
    assert env.state["sent"] == ["a@x.com"]        # c was never attempted
    assert job.status == "done"


def test_configured_cap_stops_before_sending(env, monkeypatch):
    monkeypatch.setenv("SEND_DAILY_CAP", "2")
    job, rows = run(env, PEOPLE)
    assert env.state["sent"] == ["a@x.com", "b@x.com"]
    assert rows["c@x.com"].status == "failed"
    assert "Daily send limit" in rows["c@x.com"].error_message


def test_throttle_waits_between_sends(env, monkeypatch):
    monkeypatch.setenv("SEND_INTERVAL_SECONDS", "5")
    # Freeze only job_runner's clock; patching time.monotonic globally would also freeze asyncio's.
    monkeypatch.setattr(job_runner, "time", SimpleNamespace(monotonic=lambda: 1000.0))
    run(env, PEOPLE[:2])
    assert 5.0 in env.sleeps


def test_dry_run_ignores_throttle_and_cap_and_sends_nothing(env, monkeypatch):
    monkeypatch.setenv("SEND_INTERVAL_SECONDS", "5")
    monkeypatch.setenv("SEND_DAILY_CAP", "0")
    job, rows = run(env, PEOPLE, dry_run=True)
    assert env.sleeps == []                        # no throttle sleep
    assert env.state["sent"] == []                 # send never called
    assert env.state["connections"] == 0           # no SMTP connection opened
    for r in rows.values():
        assert r.status == "generated"
        assert r.attempts == 0


def test_permanent_rejection_does_not_consume_cap(env, monkeypatch):
    monkeypatch.setenv("SEND_DAILY_CAP", "2")
    env.state["script"] = [smtplib.SMTPDataError(550, b"rejected")]
    job, rows = run(env, PEOPLE)
    assert rows["a@x.com"].status == "failed"
    assert rows["a@x.com"].error_message != "Daily send limit reached. Re-send tomorrow."
    assert rows["b@x.com"].status == "sent"
    assert rows["c@x.com"].status == "sent"
    assert env.state["sent"] == ["b@x.com", "c@x.com"]


def test_dropped_connection_is_closed_before_reconnect(env, monkeypatch):
    closed, conns = [], []

    class Conn:
        def close(self):
            closed.append(self)

    def make_conn():
        c = Conn()
        conns.append(c)
        return c

    monkeypatch.setattr(mailer, "make_smtp_connection", make_conn)
    env.state["script"] = [smtplib.SMTPServerDisconnected("dropped")]
    job, rows = run(env, PEOPLE[:1])
    assert closed == [conns[0]]                    # the dropped session was closed
    assert len(conns) == 2                         # then replaced
    assert rows["a@x.com"].status == "sent"


def post_job(env, csv_text, dry_run=False):
    cfg = {"event_config": {"name": "E", "template_path": env.template,
                            "text_position_x": 200, "text_position_y": 140,
                            "font_size": 48, "max_text_width": 350},
           "dry_run": dry_run}
    return env.post("/api/jobs",
                    data={"config": json.dumps(cfg)},
                    files={"csv_file": ("p.csv", io.BytesIO(csv_text.encode()), "text/csv")})


def test_repeated_email_is_sent_once(env):
    res = post_job(env, "name,email\nAda,a@x.com\nAda L,A@X.com\nBo,b@x.com\n")
    assert res.status_code == 201
    assert res.json()["duplicates_skipped"] == 1
    db = env.Session()
    by_index = {r.row_index: r for r in db.query(JobRow).all()}
    assert by_index[1].status == "skipped"
    assert by_index[1].error_message == "Duplicate of row 1"
    db.close()


def _run_with_skipped_duplicate(env):
    db = env.Session()
    db.add(Job(id="j", status="pending", dry_run=False, total_rows=2))
    db.add(JobRow(job_id="j", row_index=0, name="Ada", email="a@x.com", status="pending"))
    db.add(JobRow(job_id="j", row_index=1, name="Ada", email="a@x.com",
                  status="skipped", error_message="Duplicate of row 1"))
    db.commit()
    db.close()
    config = {"template_path": env.template, "text_position_x": 200,
              "text_position_y": 140, "font_size": 48, "max_text_width": 350}
    rows = [{"name": "Ada", "email": "a@x.com"},
            {"name": "Ada", "email": "a@x.com", "duplicate_of": 0}]
    asyncio.run(job_runner.run_job("j", config, rows, False))


def test_runner_never_sends_to_a_skipped_row(env):
    _run_with_skipped_duplicate(env)
    assert env.state["sent"] == ["a@x.com"]


def test_skipped_duplicate_does_not_touch_counters(env):
    _run_with_skipped_duplicate(env)
    db = env.Session()
    job = db.query(Job).first()
    skipped = db.query(JobRow).filter(JobRow.row_index == 1).one()
    assert skipped.status == "skipped"
    assert (job.sent_count, job.failed_count, job.invalid_count) == (1, 0, 0)
    assert job.total_rows == 2
    db.close()


def test_total_rows_counts_every_csv_row_including_skipped(env):
    res = post_job(env, "name,email\nAda,a@x.com\nAda L,a@x.com\n")
    db = env.Session()
    job = db.query(Job).filter(Job.id == res.json()["job_id"]).one()
    # TestClient runs the background task, so the first row really sent.
    assert job.total_rows == 2
    assert (job.sent_count, job.failed_count, job.invalid_count) == (1, 0, 0)
    assert env.state["sent"] == ["a@x.com"]
    db.close()


def test_dry_run_keeps_duplicates(env):
    res = post_job(env, "name,email\nAda,a@x.com\nAda L,a@x.com\n", dry_run=True)
    assert res.json()["duplicates_skipped"] == 0
