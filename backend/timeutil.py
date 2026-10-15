"""Time handling: store naive UTC, present in the app timezone (IST by default)."""
import os
from datetime import datetime, timezone
from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import PlainSerializer

DEFAULT_TZ = "Asia/Kolkata"


def app_tz() -> ZoneInfo:
    """The display timezone. Read at call time; an invalid name falls back to IST."""
    try:
        return ZoneInfo(os.getenv("APP_TIMEZONE", DEFAULT_TZ))
    except (ZoneInfoNotFoundError, ValueError, OSError):
        return ZoneInfo(DEFAULT_TZ)


def utc_naive_now() -> datetime:
    """What we STORE: the current UTC time without tzinfo."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_app_tz(dt: datetime) -> datetime:
    """Convert to the app timezone. A naive datetime is treated as UTC."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(app_tz())


# For response schemas: ISO-8601 with the app offset, e.g. 2026-10-16T17:30:00+05:30
AppDatetime = Annotated[
    datetime, PlainSerializer(lambda d: to_app_tz(d).isoformat(), return_type=str)
]
