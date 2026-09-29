"""
The pre-send duplicate check.

This is the thing that stands between a test run and emailing a list twice, so
the cases that matter are the ones where it must *not* stay quiet, and the ones
where staying quiet is correct because the send is legitimate.

Each test runs against its own throwaway SQLite file rather than the app's
`data.db`, so the suite never reads or writes real send history.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base, get_db
from backend.main import app
from backend.models import Event, Job, JobRow


@pytest.fixture()
def client(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    # Bypass the lifespan: it would create tables on the real data.db.
    with TestClient(app) as c:
        c.session_factory = TestingSession
        yield c
    app.dependency_overrides.clear()


def seed(client, *, event_id=None, emails=(), status="sent", dry_run=False):
    """Record a finished job that sent to `emails`."""
    db = client.session_factory()
    job = Job(id=f"job-{len(emails)}-{status}-{dry_run}", event_id=event_id,
              status="done", dry_run=dry_run, total_rows=len(emails))
    db.add(job)
    for i, email in enumerate(emails):
        db.add(JobRow(job_id=job.id, row_index=i, name=email.split("@")[0],
                      email=email, status=status))
    db.commit()
    # Read the id while the session is still open: commit expires the instance,
    # so touching it afterwards raises DetachedInstanceError.
    job_id = job.id
    db.close()
    return job_id


def check(client, emails, event_id=None):
    r = client.post("/api/jobs/check-duplicates",
                    json={"event_id": event_id, "emails": list(emails)})
    assert r.status_code == 200, r.text
    return r.json()


# ── What it must catch ────────────────────────────────────────────────────────


class TestCatchesRealDuplicates:
    def test_flags_an_address_that_already_received_this_certificate(self, client):
        db = client.session_factory()
        db.add(Event(id="ev-1", name="SIH"))
        db.commit()
        db.close()

        seed(client, event_id="ev-1", emails=["a@x.com", "b@x.com"])

        res = check(client, ["a@x.com", "b@x.com", "c@x.com"], event_id="ev-1")
        assert res["checked"] == 3
        assert res["already_sent"] == 2
        assert res["scoped_to_event"] is True

    def test_flags_when_the_job_has_no_event(self, client):
        # The case this was first built wrong for: every job recorded before
        # events existed has event_id NULL, and NULL never equals a supplied id,
        # so an event-scoped-only check silently reported zero duplicates.
        seed(client, event_id=None, emails=["a@x.com", "b@x.com"])

        res = check(client, ["a@x.com", "b@x.com"], event_id=None)
        assert res["already_sent"] == 2
        assert res["scoped_to_event"] is False

    def test_a_deleted_event_still_leaves_its_sends_visible(self, client):
        # The FK is ON DELETE SET NULL, so a job outlives its event. Checking by
        # event alone would lose this history the moment the event was removed.
        seed(client, event_id=None, emails=["a@x.com"])
        res = check(client, ["a@x.com"], event_id=None)
        assert res["already_sent"] == 1

    def test_matching_is_case_insensitive(self, client):
        seed(client, emails=["Someone@Example.COM"])
        assert check(client, ["someone@example.com"])["already_sent"] == 1

    def test_surrounding_whitespace_is_ignored(self, client):
        seed(client, emails=["a@x.com"])
        assert check(client, ["  a@x.com  "])["already_sent"] == 1

    def test_the_sample_names_the_people(self, client):
        seed(client, emails=["a@x.com", "b@x.com"])
        res = check(client, ["a@x.com", "b@x.com"])
        assert {s["email"] for s in res["sample"]} == {"a@x.com", "b@x.com"}


# ── What it must stay quiet about ─────────────────────────────────────────────


class TestDoesNotCryWolf:
    def test_a_send_to_a_different_event_is_not_a_duplicate(self, client):
        # Two different certificates to an overlapping list is normal. Warning
        # here would teach the user to click through the warning.
        db = client.session_factory()
        db.add_all([Event(id="ev-1", name="Winners"), Event(id="ev-2", name="Participants")])
        db.commit()
        db.close()

        seed(client, event_id="ev-1", emails=["a@x.com"])

        res = check(client, ["a@x.com"], event_id="ev-2")
        assert res["already_sent"] == 0

    def test_addresses_never_sent_to_are_not_duplicates(self, client):
        seed(client, emails=["a@x.com"])
        assert check(client, ["nobody@x.com"])["already_sent"] == 0

    def test_a_bounced_row_is_not_a_duplicate(self, client):
        # Nobody received it, so re-sending is the correct thing to do.
        seed(client, emails=["a@x.com"], status="bounced")
        assert check(client, ["a@x.com"])["already_sent"] == 0

    def test_a_failed_row_is_not_a_duplicate(self, client):
        seed(client, emails=["a@x.com"], status="failed")
        assert check(client, ["a@x.com"])["already_sent"] == 0

    def test_a_dry_run_is_not_a_duplicate(self, client):
        # A dry run sends nothing, so it cannot have delivered anything.
        seed(client, emails=["a@x.com"], status="sent", dry_run=True)
        assert check(client, ["a@x.com"])["already_sent"] == 0


# ── Counting ──────────────────────────────────────────────────────────────────


class TestCounting:
    def test_someone_in_two_past_jobs_is_counted_once(self, client):
        seed(client, emails=["a@x.com"])
        seed(client, emails=["a@x.com", "b@x.com"])
        res = check(client, ["a@x.com", "b@x.com"])
        assert res["already_sent"] == 2
        assert len(res["sample"]) == 2

    def test_an_empty_list_is_not_an_error(self, client):
        assert check(client, []) == {
            "checked": 0, "already_sent": 0, "scoped_to_event": False, "sample": [],
        }

    def test_duplicates_within_the_csv_do_not_inflate_the_count(self, client):
        seed(client, emails=["a@x.com"])
        assert check(client, ["a@x.com", "a@x.com"])["already_sent"] == 1
