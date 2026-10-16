import csv
import io
from datetime import datetime
from types import SimpleNamespace as NS

import pytest

from backend.report import COLUMNS, build_csv, summarize


def row(i, status, **kw):
    base = dict(row_index=i, name=f"P{i}", email=f"p{i}@x.com", status=status,
                error_message=None, sent_at=None, attempts=0)
    base.update(kw)
    return NS(**base)


def job(**kw):
    base = dict(dry_run=False, created_at=datetime(2026, 10, 16, 12, 0),
                finished_at=datetime(2026, 10, 16, 12, 9, 12))
    base.update(kw)
    return NS(**base)


def parse(text):
    assert text.startswith("﻿")
    return list(csv.reader(io.StringIO(text[1:])))


def test_summary_counts_every_outcome():
    rows = [row(0, "sent", attempts=1), row(1, "sent", attempts=3),
            row(2, "failed", attempts=4), row(3, "bounced"),
            row(4, "invalid_domain"), row(5, "skipped"), row(6, "pending")]
    s = summarize(job(), rows)
    assert (s["total"], s["delivered"], s["failed"], s["bounced"]) == (7, 2, 1, 1)
    assert (s["invalid"], s["skipped"], s["not_processed"]) == (1, 1, 1)
    assert s["retries"] == 2 + 3          # attempts beyond the first, per row
    assert s["duration_seconds"] == 9 * 60 + 12


def test_percentage_ignores_skipped_rows():
    rows = [row(0, "sent"), row(1, "sent"), row(2, "failed"), row(3, "skipped")]
    assert summarize(job(), rows)["delivered_pct"] == 66.7


def test_no_percentage_for_a_generate_only_job():
    s = summarize(job(dry_run=True), [row(0, "generated")])
    assert s["delivered_pct"] is None
    assert s["generated"] == 1


def test_no_percentage_when_nothing_was_attempted():
    assert summarize(job(), [row(0, "skipped")])["delivered_pct"] is None


def test_unfinished_job_has_no_duration():
    assert summarize(job(finished_at=None), [])["duration_seconds"] is None


def test_csv_has_header_outcome_and_ist_sent_time():
    rows = [row(0, "sent", sent_at=datetime(2026, 10, 16, 12, 0), attempts=2),
            row(1, "failed", error_message="Daily send limit reached. Re-send tomorrow.")]
    table = parse(build_csv(rows))
    assert table[0] == COLUMNS
    assert table[1] == ["1", "P0", "p0@x.com", "Delivered", "sent",
                        "2026-10-16 17:30:00 IST", "2", ""]
    assert table[2][3] == "Failed"
    assert table[2][7] == "Daily send limit reached. Re-send tomorrow."


def test_csv_is_ordered_by_row_and_quotes_commas():
    rows = [row(1, "sent", name='Lovelace, "Ada"'), row(0, "sent")]
    table = parse(build_csv(rows))
    assert [r[0] for r in table[1:]] == ["1", "2"]
    assert table[2][1] == 'Lovelace, "Ada"'


@pytest.mark.parametrize("value", [
    "=HYPERLINK(\"http://x\")", "+1", "-1", "@SUM(A1)", "\t=1", "\r=1",
    " =1", "\n=1", "  @SUM(A1)", "\n=cmd", " \t+1",
])
def test_csv_neutralises_spreadsheet_formulas(value):
    table = parse(build_csv([row(0, "sent", name=value, error_message=value)]))
    assert table[1][1] == "'" + value
    assert table[1][7] == "'" + value


def test_csv_leaves_ordinary_values_alone():
    table = parse(build_csv([row(0, "sent", name="Ada", email="a-b")]))
    assert table[1][1] == "Ada"
    assert table[1][2] == "a-b"


def test_pending_rows_stay_in_the_percentage_denominator():
    rows = [row(0, "sent"), row(1, "pending")]
    assert summarize(job(), rows)["delivered_pct"] == 50.0


def test_sent_at_uses_the_configured_zone(monkeypatch):
    monkeypatch.setenv("APP_TIMEZONE", "UTC")
    rows = [row(0, "sent", sent_at=datetime(2026, 10, 16, 12, 0, 5))]
    assert parse(build_csv(rows))[1][5] == "2026-10-16 12:00:05 UTC"


def test_unknown_status_is_shown_unchanged():
    table = parse(build_csv([row(0, "weird")]))
    assert table[1][3] == "weird"
    assert table[1][4] == "weird"


def test_missing_attempts_are_written_as_zero():
    table = parse(build_csv([row(0, "sent", attempts=None)]))
    assert table[1][6] == "0"
