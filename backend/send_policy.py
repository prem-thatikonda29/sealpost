"""
Decisions about *how* to send, kept apart from the sending itself so they can
be tested without an SMTP server.

Gmail allows roughly 500 messages a day on a personal account, and the limit is
a rolling 24 hours. SEND_DAILY_CAP defaults below that so a run stops on our
terms instead of in the middle of a 550.
"""
import os
import smtplib
import socket
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from .models import JobRow


@dataclass(frozen=True)
class SendSettings:
    interval: float
    daily_cap: int
    max_retries: int
    backoff_base: float


def _env(name: str, default, cast):
    try:
        return cast(os.environ[name])
    except (KeyError, ValueError):
        return default


def load_settings() -> SendSettings:
    return SendSettings(
        interval=_env("SEND_INTERVAL_SECONDS", 1.0, float),
        daily_cap=_env("SEND_DAILY_CAP", 450, int),
        max_retries=_env("SEND_MAX_RETRIES", 3, int),
        backoff_base=_env("SEND_BACKOFF_BASE_SECONDS", 2.0, float),
    )


def _smtp_text(exc: Exception) -> str:
    err = getattr(exc, "smtp_error", b"")
    if isinstance(err, bytes):
        err = err.decode("utf-8", errors="ignore")
    return f"{err} {exc}".lower()


def is_daily_limit(exc: Exception) -> bool:
    """Gmail's 'Daily user sending limit exceeded' (550 5.4.5). Retrying is pointless."""
    if not isinstance(exc, smtplib.SMTPResponseException):
        return False
    text = _smtp_text(exc)
    return "5.4.5" in text or "daily user sending" in text


def is_transient(exc: Exception) -> bool:
    """Worth retrying: the connection dropped, timed out, or the server said 4xx."""
    if is_daily_limit(exc):
        return False
    if isinstance(exc, (smtplib.SMTPServerDisconnected, socket.timeout, ConnectionError)):
        return True
    if isinstance(exc, smtplib.SMTPResponseException):
        return 400 <= exc.smtp_code < 500
    return False


def backoff_delay(attempt: int, base: float) -> float:
    return min(60.0, base * (2 ** attempt))


class Throttle:
    """Minimum spacing between sends. Time is passed in, so tests need no clock."""

    def __init__(self, interval: float):
        self.interval = interval
        self._last = None

    def delay(self, now: float) -> float:
        if self._last is None:
            return 0.0
        return max(0.0, self._last + self.interval - now)

    def mark(self, now: float) -> None:
        self._last = now


def sent_in_last_day(db: Session, now: datetime) -> int:
    """Messages that actually left in the last 24h, across every job."""
    cutoff = (now - timedelta(hours=24)).replace(tzinfo=None)
    return (
        db.query(JobRow)
        .filter(JobRow.status.in_(("sent", "bounced")), JobRow.sent_at >= cutoff)
        .count()
    )
