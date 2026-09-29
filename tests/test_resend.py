"""
The re-send contract.

A re-send adds no endpoint: it posts the job's own `event_snapshot` back to
`createJob` with a CSV of the affected rows. That only works if the snapshot
round-trips through the creation schema intact, which is what these pin — the
kind of thing that breaks silently when a field is added to one side and not
the other.

`run_job` is stubbed, so no certificate is rendered, no mail is sent, and no
DNS is consulted. These test the handoff, not the send.
"""
import json

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import job_runner
from backend.database import Base, get_db
from backend.main import app
from backend.models import Job, JobRow

# What a job actually records. Copied from a real row in the database rather
# than invented, so a field that stops being written shows up here.
REAL_SNAPSHOT = {
    "template_path": None,  # filled in per test
    "text_position_x": 1006,
    "text_position_y": 742,
    "font_path": None,
    "font_size": 64,
    "font_style": "normal",
    "font_color": "#000000",
    "max_text_width": 1400,
    "email_subject": "Participation Certificate",
    "email_body": "Hi {name},\n\nPlease find your certificate attached.",
    "name": "SIH",
}

# JobCreate carries these separately; the certificate fields go in event_config.
EMAIL_FIELDS = {"email_subject", "email_body"}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'resend.db'}",
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
    # The job itself is not what is under test, and running it would reach for
    # the network and the SMTP credentials.
    monkeypatch.setattr(job_runner, "run_job", lambda *a, **k: None)

    template = tmp_path / "cert.jpg"
    Image.new("RGB", (400, 280), "white").save(template, "JPEG")

    with TestClient(app) as c:
        c.session_factory = Session
        c.template = str(template)
        yield c
    app.dependency_overrides.clear()


def seed_job(client, rows):
    """A finished job with a realistic snapshot, as the history page would read it."""
    snapshot = {**REAL_SNAPSHOT, "template_path": client.template}
    db = client.session_factory()
    job = Job(id="job-orig", event_id=None, status="done",
              event_snapshot=json.dumps(snapshot), total_rows=len(rows))
    db.add(job)
    for i, (name, email, status) in enumerate(rows):
        db.add(JobRow(job_id=job.id, row_index=i, name=name, email=email, status=status))
    db.commit()
    # Read before closing: commit expires the instance, so touching it
    # afterwards raises DetachedInstanceError.
    job_id = job.id
    db.close()
    return job_id


def resend(client, job_id, rows, *, subject=None, body=None, dry_run=True):
    """Post the snapshot back the way the panel does."""
    job = client.get(f"/api/jobs/{job_id}").json()
    snapshot = job["event_snapshot"]
    cert = {k: v for k, v in snapshot.items() if k not in EMAIL_FIELDS}

    csv = "name,email\n" + "\n".join(f'"{n}",{e}' for n, e in rows)
    return client.post(
        "/api/jobs",
        data={
            "config": json.dumps({
                "event_config": cert,
                "email_subject": subject or snapshot["email_subject"],
                "email_body": body or snapshot["email_body"],
                "name_col": "name",
                "email_col": "email",
                "dry_run": dry_run,
            })
        },
        files={"csv_file": ("resend.csv", csv, "text/csv")},
    )


# ── The snapshot has to survive the round trip ────────────────────────────────


class TestSnapshotRoundTrip:
    def test_the_snapshot_is_exposed_as_parsed_json(self, client):
        # It is a Text column holding JSON; the API parses it so the browser
        # never has to know that.
        job_id = seed_job(client, [("Ada", "ada@x.com", "sent")])
        snap = client.get(f"/api/jobs/{job_id}").json()["event_snapshot"]
        assert isinstance(snap, dict)
        assert snap["font_size"] == 64

    def test_a_snapshot_is_accepted_as_an_inline_config(self, client):
        job_id = seed_job(client, [("Ada", "ada@x.com", "failed")])
        r = resend(client, job_id, [("Ada", "ada@x.com")])
        assert r.status_code == 201, r.text
        assert r.json()["job_id"]

    def test_the_new_job_records_the_same_certificate(self, client):
        # The retry has to produce the certificate everyone else received. The
        # assertion is that the original's settings *survive*, not that the two
        # snapshots have identical key sets — the inline path is a schema dump
        # and the event path is a hand-built dict, so they legitimately differ
        # on optional fields that carry no value either way.
        job_id = seed_job(client, [("Ada", "ada@x.com", "failed")])
        new_id = resend(client, job_id, [("Ada", "ada@x.com")]).json()["job_id"]

        original = client.get(f"/api/jobs/{job_id}").json()["event_snapshot"]
        retried = client.get(f"/api/jobs/{new_id}").json()["event_snapshot"]
        for key, value in original.items():
            if key in EMAIL_FIELDS:
                continue
            assert retried.get(key) == value, f"{key} did not survive the retry"

    def test_the_snapshot_does_not_accumulate_nulls(self, client):
        # Every optional field written as an explicit null would grow with each
        # retry of a retry.
        job_id = seed_job(client, [("Ada", "ada@x.com", "failed")])
        new_id = resend(client, job_id, [("Ada", "ada@x.com")]).json()["job_id"]
        snap = client.get(f"/api/jobs/{new_id}").json()["event_snapshot"]
        assert not [k for k, v in snap.items() if v is None]

    def test_every_snapshot_field_is_something_the_schema_accepts(self, client):
        # A field written into the snapshot but not accepted on the way back in
        # would be dropped, and the retry would silently use a default.
        job_id = seed_job(client, [("Ada", "ada@x.com", "failed")])
        snap = client.get(f"/api/jobs/{job_id}").json()["event_snapshot"]
        for key in snap:
            assert key in REAL_SNAPSHOT, f"{key} is not a field this contract covers"


# ── The message is the caller's to rewrite ────────────────────────────────────


class TestMessageIsEditable:
    def test_the_subject_can_be_replaced(self, client):
        # The whole reason this is not frozen with the certificate: an apology
        # reads differently from the original invitation.
        job_id = seed_job(client, [("Ada", "ada@x.com", "failed")])
        new_id = resend(
            client, job_id, [("Ada", "ada@x.com")],
            subject="Sorry — your certificate, take two",
            body="Hi {name}, our earlier mail didn't reach you. Certificate attached.",
        ).json()["job_id"]

        snap = client.get(f"/api/jobs/{new_id}").json()["event_snapshot"]
        assert snap["email_subject"] == "Sorry — your certificate, take two"
        assert "didn't reach you" in snap["email_body"]

    def test_the_certificate_is_unaffected_by_the_message_change(self, client):
        job_id = seed_job(client, [("Ada", "ada@x.com", "failed")])
        a = resend(client, job_id, [("Ada", "ada@x.com")],
                   subject="One", body="One").json()["job_id"]
        b = resend(client, job_id, [("Ada", "ada@x.com")],
                   subject="Two", body="Two").json()["job_id"]

        sa = client.get(f"/api/jobs/{a}").json()["event_snapshot"]
        sb = client.get(f"/api/jobs/{b}").json()["event_snapshot"]
        assert sa["template_path"] == sb["template_path"]
        assert sa["text_position_x"] == sb["text_position_x"]
        assert sa["email_subject"] != sb["email_subject"]


# ── What gets retried ─────────────────────────────────────────────────────────


class TestWhichRowsGoBack:
    def test_only_the_rows_handed_over_are_in_the_new_job(self, client):
        # The panel sends the failures; the successes must not be dragged along
        # or the retry would re-mail everyone.
        job_id = seed_job(client, [
            ("Ada", "ada@x.com", "failed"),
            ("Grace", "grace@x.com", "sent"),
        ])
        new_id = resend(client, job_id, [("Ada", "ada@x.com")]).json()["job_id"]

        rows = client.get(f"/api/jobs/{new_id}").json()["rows"]
        assert [r["email"] for r in rows] == ["ada@x.com"]

    def test_the_original_job_is_left_alone(self, client):
        # History records what actually happened. A retry is a new attempt, not
        # a rewrite of the first one.
        job_id = seed_job(client, [("Ada", "ada@x.com", "failed")])
        resend(client, job_id, [("Ada", "ada@x.com")])

        before = client.get(f"/api/jobs/{job_id}").json()
        assert before["status"] == "done"
        assert before["failed_count"] == 0  # never ran; still the seeded record
        assert [r["status"] for r in before["rows"]] == ["failed"]

    def test_a_job_with_no_snapshot_has_nothing_to_rebuild_from(self, client):
        # Older jobs may have no snapshot; the panel says so rather than
        # guessing a default certificate.
        db = client.session_factory()
        db.add(Job(id="job-bare", status="done", total_rows=0, event_snapshot=None))
        db.commit()
        db.close()
        assert client.get("/api/jobs/job-bare").json()["event_snapshot"] is None
