"""
Deleting jobs.

Two things here are easy to get wrong and expensive to get wrong. A bulk delete
bypasses the ORM's cascade, so rows would be orphaned rather than removed. And
a job that is still running has its rows written in a loop that assumes they
exist — deleting one mid-flight does not just lose history, it corrupts the job.

Both are pinned below. `OUTPUT_DIR` is redirected per test so no real
certificate is ever deleted.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import job_runner
from backend.database import Base, get_db
from backend.main import app
from backend.models import Job, JobRow


@pytest.fixture()
def client(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'del.db'}",
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
    output = tmp_path / "output"
    monkeypatch.setattr("backend.routers.jobs.OUTPUT_DIR", output)

    with TestClient(app) as c:
        c.session_factory = Session
        c.output = output
        yield c
    app.dependency_overrides.clear()


def seed(client, job_id, status="done", rows=(), with_output=False):
    db = client.session_factory()
    db.add(Job(id=job_id, status=status, total_rows=len(rows)))
    for i, (name, email, row_status) in enumerate(rows):
        db.add(JobRow(job_id=job_id, row_index=i, name=name,
                      email=email, status=row_status))
    db.commit()
    db.close()

    if with_output:
        d = client.output / job_id
        d.mkdir(parents=True, exist_ok=True)
        (d / "ada_lovelace_0.pdf").write_bytes(b"%PDF-1.4 fake")
    return job_id


def counts(client):
    db = client.session_factory()
    result = (db.query(Job).count(), db.query(JobRow).count())
    db.close()
    return result


# ── Deleting one job ──────────────────────────────────────────────────────────


class TestDeleteJob:
    def test_removes_the_job_and_its_rows(self, client):
        seed(client, "j1", rows=[("Ada", "ada@x.com", "sent"),
                                 ("Grace", "grace@x.com", "failed")])
        assert counts(client) == (1, 2)

        assert client.delete("/api/jobs/j1").status_code == 204
        # The rows matter more than the job: a bulk delete would leave them
        # behind with no parent.
        assert counts(client) == (0, 0)

    def test_leaves_other_jobs_alone(self, client):
        seed(client, "j1", rows=[("Ada", "ada@x.com", "sent")])
        seed(client, "j2", rows=[("Grace", "grace@x.com", "sent")])

        client.delete("/api/jobs/j1")
        assert counts(client) == (1, 1)
        assert client.get("/api/jobs/j2").status_code == 200

    def test_removes_the_certificates_it_rendered(self, client):
        # Leaving the PDFs would orphan files nothing can reach — no screen
        # lists them and nothing can name one.
        seed(client, "j1", with_output=True)
        assert (client.output / "j1").is_dir()

        client.delete("/api/jobs/j1")
        assert not (client.output / "j1").exists()

    def test_a_missing_job_is_a_404(self, client):
        assert client.delete("/api/jobs/nope").status_code == 404

    def test_forgets_the_job_queue(self, client, monkeypatch):
        # _queues is a module-level dict; without this a long-lived process
        # holds a queue for every job it has ever run.
        monkeypatch.setitem(job_runner._queues, "j1", object())
        seed(client, "j1")
        client.delete("/api/jobs/j1")
        assert "j1" not in job_runner._queues


# ── A running job must not be deletable ───────────────────────────────────────


class TestRunningJobsAreProtected:
    def test_a_running_job_is_refused(self, client):
        # Its rows are being updated in a loop that assumes they exist.
        seed(client, "j1", status="running", rows=[("Ada", "ada@x.com", "pending")])
        assert client.delete("/api/jobs/j1").status_code == 409
        assert counts(client) == (1, 1)

    def test_a_pending_job_is_refused(self, client):
        seed(client, "j1", status="pending")
        assert client.delete("/api/jobs/j1").status_code == 409

    def test_the_refusal_says_why(self, client):
        seed(client, "j1", status="running")
        detail = client.delete("/api/jobs/j1").json()["detail"]
        assert "running" in detail.lower()

    def test_nothing_is_removed_from_disk(self, client):
        seed(client, "j1", status="running", with_output=True)
        client.delete("/api/jobs/j1")
        assert (client.output / "j1").is_dir()


# ── Clearing everything ───────────────────────────────────────────────────────


class TestClearHistory:
    def test_removes_every_job_and_row(self, client):
        seed(client, "j1", rows=[("Ada", "ada@x.com", "sent")])
        seed(client, "j2", rows=[("Grace", "grace@x.com", "failed"),
                                 ("Alan", "alan@x.com", "sent")])
        assert counts(client) == (2, 3)

        assert client.delete("/api/jobs").status_code == 204
        assert counts(client) == (0, 0)

    def test_removes_every_output_directory(self, client):
        seed(client, "j1", with_output=True)
        seed(client, "j2", with_output=True)
        client.delete("/api/jobs")
        assert not (client.output / "j1").exists()
        assert not (client.output / "j2").exists()

    def test_an_empty_history_is_not_an_error(self, client):
        assert client.delete("/api/jobs").status_code == 204

    def test_clearing_is_all_or_nothing(self, client):
        # If one job is running, deleting the rest would leave the user unsure
        # what survived. Refuse the whole thing instead.
        seed(client, "j1", rows=[("Ada", "ada@x.com", "sent")])
        seed(client, "j2", status="running")
        assert client.delete("/api/jobs").status_code == 409
        assert counts(client) == (2, 1)

    def test_the_refusal_counts_what_is_running(self, client):
        seed(client, "j1", status="running")
        seed(client, "j2", status="pending")
        detail = client.delete("/api/jobs").json()["detail"]
        assert "2 jobs" in detail

    def test_one_running_job_reads_as_singular(self, client):
        seed(client, "j1", status="running")
        detail = client.delete("/api/jobs").json()["detail"]
        assert "1 job is" in detail

    def test_forgets_every_queue(self, client, monkeypatch):
        monkeypatch.setitem(job_runner._queues, "j1", object())
        monkeypatch.setitem(job_runner._queues, "j2", object())
        seed(client, "j1")
        seed(client, "j2")
        client.delete("/api/jobs")
        assert "j1" not in job_runner._queues
        assert "j2" not in job_runner._queues
