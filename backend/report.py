"""
The delivery report: what happened to every row of a job, as a summary and a CSV.

Pure functions over a job and its rows (any objects with the same attributes), so
they need no database to test.
"""
import csv
import io
from typing import Iterable, List

from .timeutil import to_app_tz

# What a row's stored status means to an organizer asking "did everyone get it?"
OUTCOME = {
    "sent": "Delivered",
    "generated": "Generated",
    "failed": "Failed",
    "bounced": "Bounced",
    "invalid_domain": "Invalid address",
    "skipped": "Skipped",
    "pending": "Not processed",
}

COLUMNS = ["Row", "Name", "Email", "Outcome", "Status", "Sent at", "Attempts", "Note"]

# A cell whose text (ignoring leading spaces and newlines) starts with one of these is
# read as a formula by Excel and Sheets; a cell starting with a raw tab or CR is
# guarded too. Names and addresses come from an uploaded file, so they are not trusted.
_FORMULA_STARTS = ("=", "+", "-", "@")
_CONTROL_STARTS = ("\t", "\r")


def _safe(value) -> str:
    text = "" if value is None else str(value)
    if text.startswith(_CONTROL_STARTS) or text.lstrip().startswith(_FORMULA_STARTS):
        return "'" + text
    return text


def summarize(job, rows: Iterable) -> dict:
    """Counts and timings for the summary card."""
    rows = list(rows)

    def count(status: str) -> int:
        return sum(1 for r in rows if r.status == status)

    skipped = count("skipped")
    delivered = count("sent")
    # Skipped rows were never meant to receive anything, so they are left out of
    # the denominator: "delivered 487 of 500" should not count the repeat rows.
    attempted = len(rows) - skipped
    duration = None
    if job.finished_at and job.created_at:
        duration = max(0, int((job.finished_at - job.created_at).total_seconds()))
    return {
        "total": len(rows),
        "delivered": delivered,
        "generated": count("generated"),
        "failed": count("failed"),
        "bounced": count("bounced"),
        "invalid": count("invalid_domain"),
        "skipped": skipped,
        "not_processed": count("pending"),
        "retries": sum(max((r.attempts or 0) - 1, 0) for r in rows),
        "duration_seconds": duration,
        "delivered_pct": (
            None
            if job.dry_run or attempted <= 0
            else round(100 * delivered / attempted, 1)
        ),
    }


def build_csv(rows: List) -> str:
    """The report as CSV text, with a BOM so Excel reads names as UTF-8."""
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(COLUMNS)
    for r in sorted(rows, key=lambda r: r.row_index):
        sent_at = (
            to_app_tz(r.sent_at).strftime("%Y-%m-%d %H:%M:%S %Z") if r.sent_at else ""
        )
        writer.writerow([
            r.row_index + 1,
            _safe(r.name),
            _safe(r.email),
            OUTCOME.get(r.status, r.status),
            r.status,
            sent_at,
            r.attempts or 0,
            _safe(r.error_message),
        ])
    return "﻿" + out.getvalue()
