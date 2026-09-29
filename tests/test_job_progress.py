"""
What the progress stream actually emits, and in what order.

The point of these is that the UI's whole job during a send is to show that
something is happening. A per-row send is ~60ms of rendering and then seconds
of SMTP, so if the stream only reports a row when it is finished, the user
watches a blank list through the slowest part. These tests pin the emissions
without sending any mail: the mailer is stubbed out, so nothing leaves the
machine.
"""
import asyncio

import pytest
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import email_validator, job_runner, mailer
from backend.database import Base
from backend.models import Job, JobRow


@pytest.fixture()
def env(tmp_path, monkeypatch):
    """A throwaway database, a real template, and no way to send email."""
    engine = create_engine(
        f"sqlite:///{tmp_path / 'job.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    monkeypatch.setattr(job_runner, "SessionLocal", Session)

    template = tmp_path / "cert.jpg"
    Image.new("RGB", (800, 560), "white").save(template, "JPEG")

    # Nothing may leave the machine from a test run.
    monkeypatch.setattr(mailer, "make_smtp_connection", lambda: object())
    monkeypatch.setattr(mailer, "send_certificate", lambda **kw: None)
    monkeypatch.setattr(mailer, "poll_bounces", lambda since: [])
    # Skip DNS: a real lookup would make the suite depend on the network.
    monkeypatch.setattr(email_validator, "validate_mx", lambda email: (True, "ok"))
    # Phase 3 sleeps 30s to let NDRs arrive. Nothing to wait for here.
    async def no_sleep(_seconds):
        return None
    monkeypatch.setattr(asyncio, "sleep", no_sleep)

    # Keep rendered certificates out of the repo's output/ directory.
    monkeypatch.setattr(job_runner, "OUTPUT_DIR", tmp_path / "output")
    return {"Session": Session, "template": str(template), "tmp": tmp_path}


def run_job(env, names_emails, *, dry_run=False):
    """Run a job to completion and return every event it streamed."""
    Session = env["Session"]
    db = Session()
    job = Job(id="job-test", status="pending", dry_run=dry_run, total_rows=len(names_emails))
    db.add(job)
    for i, (name, email) in enumerate(names_emails):
        db.add(JobRow(job_id="job-test", row_index=i, name=name, email=email, status="pending"))
    db.commit()
    db.close()

    config = {
        "template_path": env["template"],
        "text_position_x": 400,
        "text_position_y": 280,
        "font_size": 48,
        "font_style": "normal",
        "font_color": "#000000",
        "max_text_width": 700,
        "email_subject": "Your certificate",
        "email_body": "Hi {name}",
    }
    rows = [{"name": n, "email": e} for n, e in names_emails]
    asyncio.run(job_runner.run_job("job-test", config, rows, dry_run))

    queue = job_runner.get_queue("job-test")
    events = []
    while not queue.empty():
        events.append(queue.get_nowait())
    return events


def row_events(events, index=None):
    return [
        e for e in events
        if e["type"] == "row" and (index is None or e["index"] == index)
    ]


# ── Per-row states ────────────────────────────────────────────────────────────


class TestRowStates:
    def test_a_row_reports_itself_before_the_work_starts(self, env):
        events = run_job(env, [("Ada Lovelace", "ada@example.com")])
        assert [e["status"] for e in row_events(events, 0)] == [
            "generating", "sending", "sent",
        ]

    def test_generating_comes_before_sending_comes_before_sent(self, env):
        # Order is the whole feature: the row has to appear while it is still
        # being worked on, not after.
        events = run_job(env, [("Ada Lovelace", "ada@example.com")])
        statuses = [e["status"] for e in row_events(events, 0)]
        assert statuses.index("generating") < statuses.index("sending")
        assert statuses.index("sending") < statuses.index("sent")

    def test_a_row_carries_its_name_and_email_from_the_first_event(self, env):
        # Otherwise the row is blank until it finishes, which is the bug.
        events = run_job(env, [("Ada Lovelace", "ada@example.com")])
        first = row_events(events, 0)[0]
        assert first["name"] == "Ada Lovelace"
        assert first["email"] == "ada@example.com"

    def test_every_row_is_reported(self, env):
        events = run_job(env, [
            ("Ada Lovelace", "ada@example.com"),
            ("Grace Hopper", "grace@example.com"),
        ])
        assert {e["index"] for e in row_events(events)} == {0, 1}

    def test_the_transient_states_are_never_written_to_the_row(self, env):
        # The DB records outcomes. A row interrupted mid-render would otherwise
        # sit at "generating" forever.
        run_job(env, [("Ada Lovelace", "ada@example.com")])
        db = env["Session"]()
        stored = {r.status for r in db.query(JobRow).all()}
        db.close()
        assert stored == {"sent"}

    def test_a_dry_run_streams_no_generating_or_sending(self, env):
        # Nothing is rendered and nothing is sent, so claiming otherwise would
        # be the UI inventing work that is not happening.
        events = run_job(env, [("Ada Lovelace", "ada@example.com")], dry_run=True)
        statuses = [e["status"] for e in row_events(events, 0)]
        assert "generating" not in statuses
        assert "sending" not in statuses
        assert statuses == ["skipped"]


# ── Phases ────────────────────────────────────────────────────────────────────


class TestPhases:
    def test_phases_arrive_in_the_order_they_happen(self, env):
        events = run_job(env, [("Ada Lovelace", "ada@example.com")])
        phases = [e["phase"] for e in events if e["type"] == "phase"]
        assert phases == ["validating", "sending", "bounce_check"]

    def test_validation_is_announced_before_the_first_row(self, env):
        # The MX check runs over the whole list first, so on a large list this
        # is the longest stretch with no per-row activity to show.
        events = run_job(env, [
            ("Ada Lovelace", "ada@example.com"),
            ("Grace Hopper", "grace@example.com"),
        ])
        validating_at = next(
            i for i, e in enumerate(events)
            if e["type"] == "phase" and e["phase"] == "validating"
        )
        first_row_at = next(i for i, e in enumerate(events) if e["type"] == "row")
        assert validating_at < first_row_at

    def test_the_job_ends_with_done(self, env):
        events = run_job(env, [("Ada Lovelace", "ada@example.com")])
        assert events[-1]["type"] == "done"
        assert events[-1]["sent"] == 1


# ── The certificate itself ────────────────────────────────────────────────────


class TestAttachmentSize:
    def test_a_jpeg_template_produces_a_jpeg_in_the_pdf(self, env):
        # img2pdf embeds a JPEG untouched and has to deflate a PNG, and the
        # attachment size is what the SMTP send spends its time on.
        from backend.cert_engine import generate_certificate

        out = env["tmp"] / "cert.pdf"
        generate_certificate("Ada Lovelace", env["template"], (400, 280), str(out))
        assert b"DCTDecode" in out.read_bytes()

    def test_a_png_template_stays_lossless(self, env):
        # Nothing should be *newly* lossy for a source that never was.
        from backend.cert_engine import generate_certificate

        png = env["tmp"] / "cert.png"
        Image.new("RGB", (800, 560), "white").save(png)
        out = env["tmp"] / "from_png.pdf"
        generate_certificate("Ada Lovelace", str(png), (400, 280), str(out))
        raw = out.read_bytes()
        assert b"FlateDecode" in raw
        assert b"DCTDecode" not in raw
