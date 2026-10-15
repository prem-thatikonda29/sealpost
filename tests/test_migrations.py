from sqlalchemy import create_engine, inspect, text

from backend.migrations import ensure_columns


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


def test_is_idempotent(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'new.db'}")
    from backend.database import Base
    Base.metadata.create_all(engine)
    ensure_columns(engine)
    ensure_columns(engine)  # must not raise
