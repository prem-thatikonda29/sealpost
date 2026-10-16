"""
Jobs API — create jobs, stream progress via SSE, query history.
Also hosts the /api/validate-emails endpoint.
"""
import asyncio
import csv
import io
import json
import os
import re
import shutil
import tempfile
import zipfile
from datetime import datetime
from typing import List, Optional
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse, Response
from sqlalchemy import func
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse
from starlette.background import BackgroundTask

from ..database import get_db
from ..models import Job, JobRow, Event
from ..paths import OUTPUT_DIR
from ..schemas import (
    DuplicateCheckRequest,
    DuplicateCheckResult,
    DuplicateRecipient,
    JobCreate,
    JobResponse,
    JobSummary,
    JobListItem,
    JobRowResponse,
    EmailValidationResult,
)
from .. import cert_engine
from ..cert_engine import validate_inputs
from .. import job_runner, report
from ..timeutil import to_app_tz
from ..email_validator import validate_format, validate_mx

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


# ---------------------------------------------------------------------------
# Email validation helper (used before jobs and on-demand from the frontend)
# ---------------------------------------------------------------------------

@router.post("/validate-emails", response_model=List[EmailValidationResult])
async def validate_emails(body: dict):
    """
    Validate a list of email addresses (format + DNS MX).
    Body: {"emails": ["a@b.com", ...]}
    """
    emails = body.get("emails", [])
    loop = asyncio.get_event_loop()
    results = []
    for email in emails:
        valid, reason = await loop.run_in_executor(None, validate_mx, email)
        results.append(EmailValidationResult(email=email, valid=valid, reason=reason))
    return results


# ---------------------------------------------------------------------------
# Duplicate recipient check
# ---------------------------------------------------------------------------

@router.post("/check-duplicates", response_model=DuplicateCheckResult)
def check_duplicates(body: DuplicateCheckRequest, db: Session = Depends(get_db)):
    """
    Which of these addresses have already been sent a certificate for this event?

    A job is the only thing in this app that emails anyone, and until now
    nothing ever looked at the jobs that had already run — so sending the same
    CSV twice was silent, and the second send was indistinguishable from the
    first until it had happened. This does not block: re-sending is legitimate
    when someone lost the mail or a correction went out. It makes the re-send
    deliberate instead of accidental.

    Only `sent` counts as delivered — a bounced or failed row never reached
    anyone, so those are not duplicates. Dry runs are excluded because they send
    nothing.

    Scoped to the event when there is one: the same list receiving two
    *different* certificates is normal, and warning about it would train the
    user to click through. When there is no event to scope by — a one-off job,
    or one whose event was deleted — the only answerable question is whether
    these addresses have been sent a certificate at all, so that is the one
    asked, and `scoped_to_event` says so rather than letting the caller imply
    more than the check knows.
    """
    emails = {e.strip().lower() for e in body.emails if e.strip()}
    if not emails:
        return DuplicateCheckResult(
            checked=0, already_sent=0, scoped_to_event=bool(body.event_id), sample=[]
        )

    filters = [
        Job.dry_run.is_(False),
        JobRow.status == "sent",
        func.lower(JobRow.email).in_(emails),
    ]
    if body.event_id:
        filters.append(Job.event_id == body.event_id)

    rows = (
        db.query(JobRow.email, JobRow.name, Job.finished_at)
        .join(Job, Job.id == JobRow.job_id)
        .filter(*filters)
        .all()
    )

    # Someone in two past jobs has two rows; keep the most recent, so the
    # warning can say when they last got one.
    rows.sort(key=lambda r: r[2] or datetime.min, reverse=True)
    seen: dict[str, DuplicateRecipient] = {}
    for email, name, finished_at in rows:
        seen.setdefault(
            email.lower(),
            DuplicateRecipient(email=email, name=name, sent_at=finished_at),
        )

    return DuplicateCheckResult(
        checked=len(emails),
        already_sent=len(seen),
        scoped_to_event=bool(body.event_id),
        sample=list(seen.values())[:8],
    )


# ---------------------------------------------------------------------------
# Create job
# ---------------------------------------------------------------------------

@router.post("", status_code=201)
async def create_job(
    background_tasks: BackgroundTasks,
    config: str = Form(...),        # JSON string: JobCreate fields
    csv_file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Start a certificate send job.
    - `config`: JSON-encoded JobCreate (event_id or inline event_config, dry_run, batch_size, name_col, email_col)
    - `csv_file`: CSV with participant data
    """
    try:
        cfg = JobCreate(**json.loads(config))
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid config: {exc}")

    # Resolve event config
    event_config: dict | None = None
    event_name = "One-off"

    if cfg.event_id:
        event = db.query(Event).filter(Event.id == cfg.event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        event_config = {
            "template_path": event.template_path,
            "text_position_x": event.text_position_x,
            "text_position_y": event.text_position_y,
            "font_path": event.font_path,
            "font_size": event.font_size,
            "font_style": event.font_style,
            "font_color": event.font_color,
            "max_text_width": event.max_text_width,
        }
        event_name = event.name
    elif cfg.event_config:
        # exclude_none keeps this close to the shape the event_id path stores.
        # Without it every optional field is written as an explicit null.
        event_config = cfg.event_config.model_dump(exclude_none=True)
        event_name = event_config.get("name", "One-off")
    else:
        raise HTTPException(status_code=422, detail="Either event_id or event_config must be provided")

    # Email is run-time, never part of the event, so it is stamped onto the
    # config on *both* paths — job_runner reads the subject and body from here,
    # and the snapshot records them. Setting it only on the event_id path meant
    # an inline config silently sent the default subject and body, which is how
    # a re-send's rewritten message would have vanished.
    event_config["email_subject"] = cfg.email_subject
    event_config["email_body"] = cfg.email_body
    event_config["sealpost_footer"] = cfg.sealpost_footer

    # A missing template or font would mark every row failed while the job ran
    # to completion. Reject the request instead.
    try:
        validate_inputs(event_config.get("template_path"), event_config.get("font_path"))
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Parse CSV
    raw = await csv_file.read()
    try:
        text = raw.decode("utf-8-sig")  # handle BOM
        reader = csv.DictReader(io.StringIO(text))
        all_rows = list(reader)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Cannot parse CSV: {exc}")

    # Map columns
    # A name can be split across columns ("First Name", "Last Name"), in which
    # case name_col carries both, comma-separated. They are joined with a space,
    # because that is what the two of them mean together and a certificate
    # carries one name — reading only the first column would silently halve
    # every name on it. An address is never split.
    name_cols = [c.strip().lower() for c in (cfg.name_col or "").split(",") if c.strip()]
    email_col = cfg.email_col
    csv_rows = []
    for row in all_rows:
        # Case-insensitive column lookup
        row_lower = {k.lower(): v for k, v in row.items()}
        name = " ".join(row_lower.get(c, "").strip() for c in name_cols).strip()
        email = row_lower.get(email_col.lower(), "").strip()
        if name or email:
            csv_rows.append({"name": name, "email": email})

    if not csv_rows:
        raise HTTPException(status_code=422, detail="CSV contains no usable rows")

    # A generate-only run needs no addresses, so a names-only CSV is fine there.
    # Sending does need them, and without this guard every row would come back
    # "invalid_domain" — which reads as a problem with the data rather than a
    # missing column.
    if not cfg.dry_run and not any(row.get("email") for row in csv_rows):
        raise HTTPException(
            status_code=422,
            detail=(
                "This CSV has no email addresses, so there is nobody to send to. "
                "Switch on Generate all and download to produce the certificates "
                "without sending them."
            ),
        )

    # One address, one certificate per send. A name appearing twice with the
    # same address is nearly always a paste error, and sending twice looks
    # careless. Generate-only runs keep every row: nothing is emailed there.
    first_seen: dict[str, int] = {}
    duplicates_skipped = 0
    if not cfg.dry_run:
        for idx, row in enumerate(csv_rows):
            key = row["email"].lower()
            if not key:
                continue
            if key in first_seen:
                row["duplicate_of"] = first_seen[key]
                duplicates_skipped += 1
            else:
                first_seen[key] = idx

    # Create Job record
    job = Job(
        event_id=cfg.event_id,
        event_snapshot=json.dumps({**event_config, "name": event_name}),
        status="pending",
        total_rows=len(csv_rows),
        sent_count=0,
        failed_count=0,
        invalid_count=0,
        bounced_count=0,
        dry_run=cfg.dry_run,
    )
    db.add(job)
    db.flush()  # get job.id before committing

    # Create JobRow records
    for idx, row in enumerate(csv_rows):
        dup = row.get("duplicate_of")
        db.add(JobRow(
            job_id=job.id,
            row_index=idx,
            name=row["name"],
            email=row["email"],
            status="skipped" if dup is not None else "pending",
            error_message=f"Duplicate of row {dup + 1}" if dup is not None else None,
        ))

    db.commit()
    db.refresh(job)

    # Launch background task
    background_tasks.add_task(
        job_runner.run_job,
        job.id,
        event_config,
        csv_rows,
        cfg.dry_run,
        cfg.batch_size,
    )

    return {"job_id": job.id, "duplicates_skipped": duplicates_skipped}


# ---------------------------------------------------------------------------
# SSE progress stream
# ---------------------------------------------------------------------------

@router.get("/{job_id}/progress")
async def job_progress(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator():
        # Wait briefly for the queue to be initialised by the background task
        for _ in range(20):
            q = job_runner.get_queue(job_id)
            if q is not None:
                break
            await asyncio.sleep(0.1)

        q = job_runner.get_queue(job_id)
        if q is None:
            # Job already completed; return current state from DB
            final_job = db.query(Job).filter(Job.id == job_id).first()
            if final_job:
                yield {
                    "data": json.dumps({
                        "type": "done",
                        "sent": final_job.sent_count,
                        "failed": final_job.failed_count,
                        "invalid": final_job.invalid_count,
                        "bounced": final_job.bounced_count,
                    })
                }
            return

        while True:
            try:
                event = await asyncio.wait_for(q.get(), timeout=30.0)
            except asyncio.TimeoutError:
                yield {"data": json.dumps({"type": "heartbeat"})}
                continue

            yield {"data": json.dumps(event)}

            if event.get("type") == "done":
                break

    return EventSourceResponse(event_generator())


# ---------------------------------------------------------------------------
# Downloading the certificates a job produced
# ---------------------------------------------------------------------------

def _snapshot_name(job) -> str:
    """The event name, which is not a column: it is recorded in the snapshot."""
    if job.event_snapshot:
        try:
            snapshot = json.loads(job.event_snapshot)
        except ValueError:
            return ""
        if isinstance(snapshot, dict):
            name = snapshot.get("name")
            if isinstance(name, str) and name:
                return name
    return ""


@router.get("/{job_id}/report.csv")
def delivery_report(job_id: str, db: Session = Depends(get_db)):
    """
    Who was sent what, who bounced, who failed: one row per participant.

    Times are in the app timezone (IST by default). The BOM lets Excel read
    names that are not ASCII.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    rows = db.query(JobRow).filter(JobRow.job_id == job_id).all()
    stamp = to_app_tz(job.created_at).strftime("%Y-%m-%d")
    base = cert_engine.sanitize_name(_snapshot_name(job)) or "job"
    full_name = f"{base}_delivery_report_{stamp}.csv"
    ascii_base = re.sub(r"[^A-Za-z0-9_]", "", base) or "job"
    ascii_name = f"{ascii_base}_delivery_report_{stamp}.csv"
    return Response(
        report.build_csv(rows).encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{ascii_name}"; '
                f"filename*=UTF-8''{quote(full_name)}"
            )
        },
    )


@router.get("/{job_id}/download")
def download_certificates(job_id: str, db: Session = Depends(get_db)):
    """
    Every certificate this job rendered, as one zip.

    Works for any job — a generate-only run is the usual reason, but a sent run
    has the same files on disk and the same claim to them.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    directory = OUTPUT_DIR / job_id
    files = sorted(p for p in directory.iterdir() if p.is_file()) if directory.is_dir() else []
    if not files:
        raise HTTPException(
            status_code=404,
            detail="This job has no certificates on disk. They are removed if the job is deleted.",
        )

    name = _snapshot_name(job) or "certificates"

    # Stored, not deflated: the PDFs are mostly JPEG, which is already
    # compressed, so deflating spends CPU to save almost nothing.
    tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    tmp.close()
    with zipfile.ZipFile(tmp.name, "w", zipfile.ZIP_STORED) as archive:
        for path in files:
            archive.write(path, arcname=path.name)

    return FileResponse(
        tmp.name,
        media_type="application/zip",
        filename=f"{cert_engine.sanitize_name(name) or 'certificates'}.zip",
        # Streaming it off disk rather than building 600MB in memory, then
        # removing it once the response has been sent.
        background=BackgroundTask(os.unlink, tmp.name),
    )


# ---------------------------------------------------------------------------
# Deleting jobs
# ---------------------------------------------------------------------------

# A job in either of these states is still being written to by the runner, and
# its rows are being updated in a loop that assumes they exist. Deleting one
# mid-flight does not just lose history, it corrupts the job that is running.
ACTIVE_STATUSES = ("pending", "running")


def _refuse_if_active(jobs) -> None:
    active = [j for j in jobs if j.status in ACTIVE_STATUSES]
    if active:
        raise HTTPException(
            status_code=409,
            detail=(
                f"{len(active)} job is still running. Deleting it now would "
                f"interrupt the send partway through — wait for it to finish."
                if len(active) == 1
                else f"{len(active)} jobs are still running. Deleting them now "
                f"would interrupt the sends partway through — wait for them to finish."
            ),
        )


def _has_certificates(job_id: str) -> bool:
    """Whether this job left anything on disk to download."""
    directory = OUTPUT_DIR / job_id
    return directory.is_dir() and any(directory.iterdir())


def _discard_output(job_id: str) -> None:
    """Delete the certificates this job rendered.

    Removing the record but leaving the PDFs behind would orphan files nothing
    can reach — no screen lists them and nothing can name one. They are the
    job's output, so they go with it.
    """
    shutil.rmtree(OUTPUT_DIR / job_id, ignore_errors=True)


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: str, db: Session = Depends(get_db)):
    """Remove one job: its rows, its rendered certificates, and its queue."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    _refuse_if_active([job])

    # Job.rows is cascade="all, delete-orphan", so the rows go with it.
    db.delete(job)
    db.commit()

    job_runner.forget(job_id)
    _discard_output(job_id)


@router.delete("", status_code=204)
def clear_jobs(db: Session = Depends(get_db)):
    """Remove every job. All or nothing: if anything is still running, nothing is deleted."""
    jobs = db.query(Job).all()
    _refuse_if_active(jobs)

    job_ids = [j.id for j in jobs]

    # Deleted explicitly rather than by iterating db.delete(), because a bulk
    # delete bypasses the ORM's cascade and would leave every row orphaned.
    db.query(JobRow).delete()
    db.query(Job).delete()
    db.commit()

    for job_id in job_ids:
        job_runner.forget(job_id)
        _discard_output(job_id)


# ---------------------------------------------------------------------------
# Job history
# ---------------------------------------------------------------------------

@router.get("", response_model=List[JobListItem])
def list_jobs(db: Session = Depends(get_db)):
    jobs = db.query(Job).order_by(Job.created_at.desc()).all()
    result = []
    for job in jobs:
        snapshot = {}
        if job.event_snapshot:
            try:
                snapshot = json.loads(job.event_snapshot)
            except Exception:
                pass
        result.append(JobListItem(
            id=job.id,
            event_id=job.event_id,
            event_name=snapshot.get("name"),
            status=job.status,
            total_rows=job.total_rows,
            sent_count=job.sent_count,
            failed_count=job.failed_count,
            invalid_count=job.invalid_count,
            bounced_count=job.bounced_count,
            dry_run=job.dry_run,
            created_at=job.created_at,
            finished_at=job.finished_at,
        ))
    return result


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Whether a download is worth offering, so the button is not a link to a
    # 404 for a job that rendered nothing.
    response = JobResponse.model_validate(job)
    response.certificates_available = _has_certificates(job_id)
    response.summary = JobSummary(**report.summarize(job, job.rows))
    return response
