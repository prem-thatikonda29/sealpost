"""
Background job runner.

Three-phase pipeline per job:
  Phase 1 — Pre-flight: DNS MX validation for every row
  Phase 2 — Generate + Send: certificate generation and email delivery
  Phase 3 — Bounce poll: IMAP check for NDR emails (skipped on dry_run)
"""
import asyncio
import json
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import Job, JobRow
from .paths import OUTPUT_DIR
from .timeutil import utc_naive_now
from . import cert_engine, email_validator, mailer, send_policy

# job_id → asyncio.Queue of SSE event dicts
_queues: Dict[str, asyncio.Queue] = {}


def get_queue(job_id: str) -> Optional[asyncio.Queue]:
    return _queues.get(job_id)


def forget(job_id: str) -> None:
    """Drop a job's event queue once the job is gone.

    _queues is a module-level dict, so without this a long-lived process holds
    a queue for every job it has ever run. An SSE consumer already reading the
    old object simply stops receiving, which is correct for a deleted job.
    """
    _queues.pop(job_id, None)


def _db_job(db: Session, job_id: str) -> Optional[Job]:
    return db.query(Job).filter(Job.id == job_id).first()


def _push(job_id: str, event: dict) -> None:
    """Put an event onto the job's SSE queue (fire-and-forget, sync-safe)."""
    q = _queues.get(job_id)
    if q:
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            pass


async def _send_with_retry(loop, smtp_holder, db_row, settings, throttle, **send_kwargs):
    """Send one message. Returns normally on success; raises the final error otherwise.

    Transient errors back off and retry on a fresh connection, because a dropped
    session stays dropped. A daily-limit error is raised straight away.
    """
    attempt = 0
    while True:
        wait = throttle.delay(time.monotonic())
        if wait > 0:
            await asyncio.sleep(wait)
        db_row.attempts = (db_row.attempts or 0) + 1
        try:
            await loop.run_in_executor(
                None, lambda: mailer.send_certificate(smtp=smtp_holder[0], **send_kwargs)
            )
            throttle.mark(time.monotonic())
            return
        except Exception as exc:
            throttle.mark(time.monotonic())
            if not send_policy.is_transient(exc) or attempt >= settings.max_retries:
                raise
            await asyncio.sleep(send_policy.backoff_delay(attempt, settings.backoff_base))
            attempt += 1
            try:
                smtp_holder[0].close()
            except Exception:
                pass  # best-effort: the session is already dead, and a stub may not have close()
            try:
                smtp_holder[0] = await loop.run_in_executor(None, mailer.make_smtp_connection)
            except Exception:
                pass  # the next attempt fails and is counted like any other


async def run_job(
    job_id: str,
    event_config: Dict[str, Any],
    csv_rows: List[Dict[str, str]],
    dry_run: bool,
    batch_size: int = 0,
) -> None:
    """
    Main entry point. Called as a FastAPI BackgroundTask.
    Updates Job + JobRow records in DB and pushes SSE events to the queue.
    """
    _queues[job_id] = asyncio.Queue(maxsize=2000)
    job_start = datetime.now(timezone.utc)

    db = SessionLocal()
    try:
        job = _db_job(db, job_id)
        if not job:
            return
        job.status = "running"
        db.commit()

        rows_to_process = csv_rows
        if batch_size and batch_size > 0:
            rows_to_process = csv_rows[:batch_size]

        total = len(rows_to_process)
        job.total_rows = total
        db.commit()

        # ------------------------------------------------------------------
        # Phase 1 — Pre-flight DNS MX validation
        # ------------------------------------------------------------------
        loop = asyncio.get_event_loop()

        if dry_run:
            # Generate-only, so there is nothing an address could be wrong for.
            # Skipping this is not merely saving the lookups: valid_indices is
            # what phase 2 iterates, so a row whose domain did not resolve would
            # be dropped from *generation* too — and "generate all" would
            # quietly hand back fewer certificates than there are names.
            valid_indices = list(range(len(rows_to_process)))
        else:
            # Every row is checked before the first email goes out, so on a
            # large list this is a long stretch with nothing else to show.
            # Announce it rather than leaving the UI on "Processing" with an
            # empty list.
            _push(job_id, {"type": "phase", "phase": "validating"})

            valid_indices = []
            for row_idx, row in enumerate(rows_to_process):
                db_row = db.query(JobRow).filter(
                    JobRow.job_id == job_id, JobRow.row_index == row_idx
                ).first()
                if not db_row:
                    continue

                email = row.get("email", "").strip()
                valid, reason = await loop.run_in_executor(
                    None, email_validator.validate_mx, email
                )

                if not valid:
                    db_row.status = "invalid_domain"
                    db_row.error_message = reason
                    db.commit()
                    job.invalid_count = (job.invalid_count or 0) + 1
                    db.commit()
                    _push(job_id, {
                        "type": "row",
                        "index": row_idx,
                        "name": row.get("name", ""),
                        "email": email,
                        "status": "invalid_domain",
                        "error": reason,
                    })
                else:
                    valid_indices.append(row_idx)

        # ------------------------------------------------------------------
        # Phase 2 — Generate + Send
        # ------------------------------------------------------------------
        smtp_conn = None
        smtp_holder = [None]
        if not dry_run:
            try:
                smtp_conn = await loop.run_in_executor(
                    None, mailer.make_smtp_connection
                )
            except Exception as exc:
                job.status = "failed"
                job.finished_at = utc_naive_now()
                db.commit()
                _push(job_id, {"type": "error", "message": str(exc)})
                _push(job_id, {"type": "done", "sent": 0, "failed": 0,
                               "invalid": job.invalid_count, "bounced": 0})
                return
            smtp_holder[0] = smtp_conn

        # Resolved against the repo root, not the process's working directory.
        # As a bare "output/" this wrote wherever uvicorn happened to have been
        # started from, which is the same trap paths.py exists to close for
        # uploads and fonts.
        output_dir = str(OUTPUT_DIR / job_id)
        os.makedirs(output_dir, exist_ok=True)

        _push(job_id, {"type": "phase", "phase": "generating" if dry_run else "sending"})

        template_path = event_config.get("template_path", "")
        text_position = (
            event_config.get("text_position_x", 0),
            event_config.get("text_position_y", 0),
        )

        settings = send_policy.load_settings()
        throttle = send_policy.Throttle(settings.interval)
        cap_left = None
        if not dry_run:
            cap_left = settings.daily_cap - send_policy.sent_in_last_day(
                db, datetime.now(timezone.utc)
            )
        cap_hit = False
        LIMIT_MSG = "Daily send limit reached. Re-send tomorrow."

        for row_idx in valid_indices:
            row = rows_to_process[row_idx]
            name = row.get("name", "").strip()
            email = row.get("email", "").strip()

            db_row = db.query(JobRow).filter(
                JobRow.job_id == job_id, JobRow.row_index == row_idx
            ).first()

            safe_name = cert_engine.sanitize_name(name)
            pdf_path = os.path.join(output_dir, f"{safe_name}_{row_idx}.pdf")

            # Transient states, streamed but never written to the row. The
            # database records outcomes; a row interrupted mid-render would
            # otherwise sit at "generating" forever, and every "is this row
            # done?" check would have to learn two values that mean "not yet".
            # Rendering is ~60ms and the send is seconds, so without these the
            # whole wait is one blank space where the recipient should be.
            row_event = {
                "type": "row",
                "index": row_idx,
                "name": name,
                "email": email,
            }

            if not dry_run and (cap_hit or cap_left <= 0):
                db_row.status = "failed"
                db_row.error_message = LIMIT_MSG
                job.failed_count = (job.failed_count or 0) + 1
                db.commit()
                _push(job_id, {"type": "row", "index": row_idx, "name": name,
                               "email": email, "status": "failed", "error": LIMIT_MSG})
                continue

            try:
                # A dry run renders and stops. Originally it did neither, which
                # made the label ("generate the certificates but send nothing")
                # false — and left no way to check how a *real* list of names
                # comes out, since the editor only ever previews one sample.
                _push(job_id, {**row_event, "status": "generating"})
                await loop.run_in_executor(
                    None,
                    lambda n=name, p=pdf_path: cert_engine.generate_certificate(
                        name=n,
                        template_path=template_path,
                        text_position=text_position,
                        output_path=p,
                        font_path=event_config.get("font_path"),
                        font_size=event_config.get("font_size", 48),
                        font_style=event_config.get("font_style", "normal"),
                        font_color=event_config.get("font_color", "#000000"),
                        max_text_width=event_config.get("max_text_width", 1400),
                    ),
                )

                if not dry_run:
                    _push(job_id, {**row_event, "status": "sending"})
                    await _send_with_retry(
                        loop, smtp_holder, db_row, settings, throttle,
                        name=name, email=email, pdf_path=pdf_path,
                        subject=event_config.get("email_subject", "Your Certificate"),
                        body=event_config.get("email_body", "Hi {name}, please find your certificate attached."),
                    )
                    cap_left -= 1
                    db_row.sent_at = utc_naive_now()

                if dry_run:
                    # Nothing was sent, so nothing counts as sent. total_rows is
                    # the number generated, and the zip is what the run is for.
                    db_row.status = "generated"
                else:
                    db_row.status = "sent"
                    job.sent_count = (job.sent_count or 0) + 1
                db.commit()
                _push(job_id, {**row_event, "status": db_row.status})

            except Exception as exc:
                if send_policy.is_daily_limit(exc):
                    cap_hit = True
                    exc = RuntimeError(LIMIT_MSG)
                db_row.status = "failed"
                db_row.error_message = str(exc)
                db.commit()
                job.failed_count = (job.failed_count or 0) + 1
                db.commit()
                _push(job_id, {
                    "type": "row",
                    "index": row_idx,
                    "name": name,
                    "email": email,
                    "status": "failed",
                    "error": str(exc),
                })

        if smtp_holder[0]:
            try:
                smtp_holder[0].quit()
            except Exception:
                pass

        # ------------------------------------------------------------------
        # Phase 3 — Bounce poll (real sends only, best-effort)
        # ------------------------------------------------------------------
        if not dry_run and job.sent_count > 0:
            _push(job_id, {"type": "phase", "phase": "bounce_check"})
            await asyncio.sleep(30)

            bounced_addrs = await loop.run_in_executor(
                None, mailer.poll_bounces, job_start
            )

            for addr in bounced_addrs:
                db_row = db.query(JobRow).filter(
                    JobRow.job_id == job_id,
                    JobRow.email == addr,
                ).first()
                if db_row and db_row.status == "sent":
                    db_row.status = "bounced"
                    db_row.error_message = "Bounce detected via IMAP"
                    db.commit()
                    job.bounced_count = (job.bounced_count or 0) + 1
                    job.sent_count = max(0, (job.sent_count or 1) - 1)
                    db.commit()
                    _push(job_id, {
                        "type": "row",
                        "index": db_row.row_index,
                        "name": db_row.name,
                        "email": addr,
                        "status": "bounced",
                    })

        job.status = "done"
        job.finished_at = utc_naive_now()
        db.commit()

        _push(job_id, {
            "type": "done",
            "sent": job.sent_count,
            "failed": job.failed_count,
            "invalid": job.invalid_count,
            "bounced": job.bounced_count,
        })

    except Exception as exc:
        db.rollback()
        try:
            job = _db_job(db, job_id)
            if job:
                job.status = "failed"
                job.finished_at = utc_naive_now()
                db.commit()
        except Exception:
            pass
        _push(job_id, {"type": "error", "message": str(exc)})
        _push(job_id, {"type": "done", "sent": 0, "failed": 0,
                       "invalid": 0, "bounced": 0})
    finally:
        db.close()
        # Leave queue in _queues briefly so SSE consumer can drain it;
        # FastAPI's EventSourceResponse will close the connection cleanly.
