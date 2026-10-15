from sqlalchemy import create_engine, inspect, text

from backend.database import Base
from backend.migrations import ensure_columns

OLD_JOB_ROWS = (
    "CREATE TABLE job_rows (id INTEGER PRIMARY KEY, job_id TEXT, "
    "row_index INTEGER, name TEXT, email TEXT, status TEXT, error_message TEXT)"
)


def test_adds_missing_columns_to_an_old_database(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with engine.begin() as c:
        c.execute(text(
            "CREATE TABLE job_rows (id INTEGER PRIMARY KEY, job_id TEXT, "
            "row_index INTEGER, name TEXT, email TEXT, status TEXT, error_message TEXT)"
        ))
        c.execute(text("INSERT INTO job_rows (job_id,row_index,name,email,status) "
                       "VALUES ('j',0,'A','a@x.com','sent')"))
    ensure_columns(engine)
    cols = {c["name"] for c in inspect(engine).get_columns("job_rows")}
    assert {"sent_at", "attempts"} <= cols
    with engine.connect() as c:
        assert c.execute(text("SELECT attempts FROM job_rows")).scalar() == 0


def test_is_idempotent_and_keeps_existing_rows(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with engine.begin() as c:
        c.execute(text(OLD_JOB_ROWS))
        c.execute(text("INSERT INTO job_rows (job_id,row_index,name,email,status) "
                       "VALUES ('j',0,'A','a@x.com','sent')"))
    ensure_columns(engine)
    ensure_columns(engine)  # second run must not raise or duplicate anything
    with engine.connect() as c:
        assert c.execute(text("SELECT attempts FROM job_rows")).all() == [(0,)]


def test_fresh_schema_defaults_attempts_to_zero(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'new.db'}")
    Base.metadata.create_all(engine)
    with engine.begin() as c:
        c.execute(text("INSERT INTO job_rows (job_id,row_index,name,email,status) "
                       "VALUES ('j',0,'A','a@x.com','sent')"))
    with engine.connect() as c:
        assert c.execute(text("SELECT attempts FROM job_rows")).scalar() == 0
