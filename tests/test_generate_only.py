"""
"Generate all and download" — a run that renders everything and sends nothing.

This replaces what "dry run" claimed to do and never did: `job_runner` wrapped
the render *and* the send in `if not dry_run`, so the checkbox's own label was
false and the run only checked addresses.

The mailer is recorded rather than stubbed silently, because "sends nothing" is
the claim most worth checking.
"""
import asyncio
import json

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
    engine = create_engine(
        f"sqlite:///{tmp_path / 'gen.db'}",
        connect_args={"check_same_thread": False},
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
    monkeypatch.setattr(job_runner, "SessionLocal", Session)

    output = tmp_path / "output"
    monkeypatch.setattr(job_runner, "OUTPUT_DIR", output)
    monkeypatch.setattr("backend.routers.jobs.OUTPUT_DIR", output)

    template = tmp_path / "cert.jpg"
    Image.new("RGB", (400, 280), "white").save(template, "JPEG")

    sent = []
    monkeypatch.setattr(mailer, "make_smtp_connection", lambda: object())
    monkeypatch.setattr(mailer, "send_certificate", lambda **kw: sent.append(kw))
    monkeypatch.setattr(mailer, "poll_bounces", lambda since: [])
    monkeypatch.setattr(email_validator, "validate_mx", lambda email: (True, "ok"))

    async def no_sleep(_seconds):
        return None

    monkeypatch.setattr(asyncio, "sleep", no_sleep)

    with TestClient(app) as c:
        c.session_factory = Session
        c.output = output
        c.template = str(template)
        c.sent = sent
        yield c
    app.dependency_overrides.clear()


def run(env, people, *, dry_run):
    Session = env.session_factory
    db = Session()
    job = Job(id="job-1", status="pending", dry_run=dry_run, total_rows=len(people))
    db.add(job)
    for i, (name, email) in enumerate(people):
        db.add(JobRow(job_id="job-1", row_index=i, name=name,
                      email=email, status="pending"))
    db.commit()
    db.close()

    config = {
        "template_path": env.template,
        "text_position_x": 200,
        "text_position_y": 140,
        "font_size": 48,
        "max_text_width": 350,
        "email_subject": "Your certificate",
        "email_body": "Hi {name}",
    }
    rows = [{"name": n, "email": e} for n, e in people]
    asyncio.run(job_runner.run_job("job-1", config, rows, dry_run))

    queue = job_runner.get_queue("job-1")
    events = []
    while not queue.empty():
        events.append(queue.get_nowait())
    return events


PEOPLE = [("Ada Lovelace", "ada@x.com"), ("Grace Hopper", "grace@x.com")]


# ── It renders ────────────────────────────────────────────────────────────────


class TestItRenders:
    def test_every_certificate_lands_on_disk(self, env):
        run(env, PEOPLE, dry_run=True)
        files = sorted(p.name for p in (env.output / "job-1").iterdir())
        assert len(files) == 2
        assert all(f.endswith(".pdf") for f in files)

    def test_the_pdfs_are_real(self, env):
        run(env, PEOPLE, dry_run=True)
        first = next((env.output / "job-1").iterdir())
        assert first.read_bytes().startswith(b"%PDF")

    def test_rows_report_as_generated(self, env):
        run(env, PEOPLE, dry_run=True)
        db = env.session_factory()
        statuses = sorted(r.status for r in db.query(JobRow).all())
        db.close()
        # Not "skipped" — something happened. Not "sent" — nothing was sent.
        assert statuses == ["generated", "generated"]

    def test_the_phase_is_generating_not_sending(self, env):
        events = run(env, PEOPLE, dry_run=True)
        phases = [e["phase"] for e in events if e["type"] == "phase"]
        assert "generating" in phases
        assert "sending" not in phases

    def test_a_row_is_never_reported_as_sending(self, env):
        events = run(env, PEOPLE, dry_run=True)
        statuses = {e["status"] for e in events if e["type"] == "row"}
        assert statuses == {"generating", "generated"}


# ── It sends nothing ──────────────────────────────────────────────────────────


class TestItSendsNothing:
    def test_no_mail_is_sent(self, env):
        run(env, PEOPLE, dry_run=True)
        assert env.sent == []

    def test_no_smtp_connection_is_opened(self, env, monkeypatch):
        # Opening one would be a login to the user's mailbox for no reason.
        opened = []
        monkeypatch.setattr(mailer, "make_smtp_connection",
                            lambda: opened.append(1) or object())
        run(env, PEOPLE, dry_run=True)
        assert opened == []

    def test_nothing_is_counted_as_sent(self, env):
        run(env, PEOPLE, dry_run=True)
        db = env.session_factory()
        job = db.query(Job).filter(Job.id == "job-1").first()
        # total_rows is the number generated; sent_count would be a lie.
        assert job.sent_count == 0
        assert job.total_rows == 2
        db.close()

    def test_the_bounce_check_is_skipped(self, env):
        events = run(env, PEOPLE, dry_run=True)
        phases = [e["phase"] for e in events if e["type"] == "phase"]
        assert "bounce_check" not in phases


# ── A real send is unaffected ─────────────────────────────────────────────────


class TestRealSendsStillSend:
    def test_a_normal_run_sends_every_row(self, env):
        run(env, PEOPLE, dry_run=False)
        assert len(env.sent) == 2

    def test_a_normal_run_reports_sent(self, env):
        events = run(env, PEOPLE, dry_run=False)
        statuses = {e["status"] for e in events if e["type"] == "row"}
        assert "sent" in statuses
        assert "generated" not in statuses

    def test_a_normal_run_counts_them_as_sent(self, env):
        run(env, PEOPLE, dry_run=False)
        db = env.session_factory()
        job = db.query(Job).filter(Job.id == "job-1").first()
        assert job.sent_count == 2
        db.close()


# ── Downloading the result ────────────────────────────────────────────────────


class TestDownload:
    def test_a_generated_run_downloads_as_a_zip(self, env):
        run(env, PEOPLE, dry_run=True)
        r = env.get("/api/jobs/job-1/download")
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/zip"

    def test_the_zip_holds_every_certificate(self, env):
        import io
        import zipfile

        run(env, PEOPLE, dry_run=True)
        r = env.get("/api/jobs/job-1/download")
        names = zipfile.ZipFile(io.BytesIO(r.content)).namelist()
        assert len(names) == 2
        assert all(n.endswith(".pdf") for n in names)

    def test_the_download_is_named_after_the_job(self, env):
        db = env.session_factory()
        db.add(Job(id="job-2", status="done", total_rows=0,
                   event_snapshot=json.dumps({"name": "Summer Hacks 2026"})))
        (env.output / "job-2").mkdir(parents=True)
        (env.output / "job-2" / "a.pdf").write_bytes(b"%PDF-1.4")
        db.commit()
        db.close()

        r = env.get("/api/jobs/job-2/download")
        assert 'filename="summer_hacks_2026.zip"' in r.headers["content-disposition"]

    def test_a_job_with_nothing_on_disk_is_a_404(self, env):
        run(env, PEOPLE, dry_run=True)
        assert env.get("/api/jobs/nope/download").status_code == 404

    def test_availability_is_reported_on_the_job(self, env):
        run(env, PEOPLE, dry_run=True)
        assert env.get("/api/jobs/job-1").json()["certificates_available"] is True

    def test_availability_is_false_when_there_is_nothing(self, env):
        db = env.session_factory()
        db.add(Job(id="job-3", status="done", total_rows=0))
        db.commit()
        db.close()
        assert env.get("/api/jobs/job-3").json()["certificates_available"] is False
