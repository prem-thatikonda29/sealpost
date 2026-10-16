import csv
import io
from datetime import datetime
from types import SimpleNamespace as NS

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


def test_csv_neutralises_spreadsheet_formulas():
    table = parse(build_csv([row(0, "sent", name="=HYPERLINK(\"http://x\")",
                                 error_message="+1")]))
    assert table[1][1].startswith("'=")
    assert table[1][7] == "'+1"
