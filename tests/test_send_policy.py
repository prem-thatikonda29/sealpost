import smtplib
import socket
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import send_policy
from backend.database import Base
from backend.models import Job, JobRow


def test_settings_defaults(monkeypatch):
    for k in ("SEND_INTERVAL_SECONDS", "SEND_DAILY_CAP",
              "SEND_MAX_RETRIES", "SEND_BACKOFF_BASE_SECONDS"):
        monkeypatch.delenv(k, raising=False)
    s = send_policy.load_settings()
    assert (s.interval, s.daily_cap, s.max_retries, s.backoff_base) == (1.0, 450, 3, 2.0)


def test_settings_read_env_at_call_time(monkeypatch):
    monkeypatch.setenv("SEND_DAILY_CAP", "10")
    assert send_policy.load_settings().daily_cap == 10


def test_settings_bad_value_falls_back_to_default(monkeypatch):
    monkeypatch.setenv("SEND_DAILY_CAP", "lots")
    assert send_policy.load_settings().daily_cap == 450


def test_daily_limit_detected():
    exc = smtplib.SMTPDataError(550, b"5.4.5 Daily user sending limit exceeded.")
    assert send_policy.is_daily_limit(exc)
    assert not send_policy.is_transient(exc)


def test_transient_errors():
    assert send_policy.is_transient(smtplib.SMTPServerDisconnected("gone"))
    assert send_policy.is_transient(smtplib.SMTPDataError(451, b"try later"))
    assert send_policy.is_transient(socket.timeout("slow"))
    assert send_policy.is_transient(ConnectionResetError())


def test_permanent_errors_are_not_transient():
    assert not send_policy.is_transient(smtplib.SMTPRecipientsRefused({"a@x.com": (550, b"no")}))
    assert not send_policy.is_transient(smtplib.SMTPDataError(550, b"rejected"))
    assert not send_policy.is_transient(ValueError("bad"))


def test_backoff_doubles_and_caps():
    assert send_policy.backoff_delay(0, 2.0) == 2.0
    assert send_policy.backoff_delay(1, 2.0) == 4.0
    assert send_policy.backoff_delay(2, 2.0) == 8.0
    assert send_policy.backoff_delay(10, 2.0) == 60.0


def test_throttle_spaces_sends():
    t = send_policy.Throttle(1.0)
    assert t.delay(100.0) == 0.0          # first send: no wait
    t.mark(100.0)
    assert t.delay(100.25) == 0.75
    assert t.delay(101.5) == 0.0


def test_sent_in_last_day_counts_sent_and_bounced_only(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'p.db'}")
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    now = datetime(2026, 10, 16, 12, 0, tzinfo=timezone.utc)
    db.add(Job(id="j", status="done", total_rows=4))
    rows = [
        ("sent", now - timedelta(hours=1)),     # counts
        ("bounced", now - timedelta(hours=23)), # counts
        ("sent", now - timedelta(hours=25)),    # too old
        ("failed", now - timedelta(hours=1)),   # never left the building
    ]
    for i, (status, at) in enumerate(rows):
        db.add(JobRow(job_id="j", row_index=i, name="n", email=f"{i}@x.com",
                      status=status, sent_at=at.replace(tzinfo=None)))
    db.commit()
    assert send_policy.sent_in_last_day(db, now) == 2


def _seed_sent(tmp_path, hours_ago):
    """Sent rows stored the way the app stores them: naive UTC. Returns (db, base_utc)."""
    engine = create_engine(f"sqlite:///{tmp_path / 'p.db'}")
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    base = datetime(2026, 10, 16, 12, 0, tzinfo=timezone.utc)
    db.add(Job(id="j", status="done", total_rows=len(hours_ago),
               created_at=base.replace(tzinfo=None)))
    for i, hours in enumerate(hours_ago):
        db.add(JobRow(job_id="j", row_index=i, name="n", email=f"{i}@x.com",
                      status="sent", sent_at=(base - timedelta(hours=hours)).replace(tzinfo=None)))
    db.commit()
    return db, base


def test_aware_non_utc_now_counts_same_as_utc(tmp_path):
    # 1h and 23h ago are inside the window; the 23h row falls between the naive
    # cutoffs that a bare replace(tzinfo=None) would produce for a +05:00 clock.
    db, base = _seed_sent(tmp_path, hours_ago=(1, 23, 25))
    plus5 = timezone(timedelta(hours=5))
    assert send_policy.sent_in_last_day(db, base) == 2
    assert send_policy.sent_in_last_day(db, base.astimezone(plus5)) == 2


def test_naive_now_is_treated_as_utc(tmp_path):
    db, base = _seed_sent(tmp_path, hours_ago=(1, 23, 25))
    assert send_policy.sent_in_last_day(db, base.replace(tzinfo=None)) == 2


def test_row_exactly_at_24h_boundary_is_counted(tmp_path):
    db, base = _seed_sent(tmp_path, hours_ago=(24,))
    assert send_policy.sent_in_last_day(db, base) == 1
    assert send_policy.sent_in_last_day(db, base.astimezone(timezone(timedelta(hours=5)))) == 1
