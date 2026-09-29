"""
Jobs API — create jobs, stream progress via SSE, query history.
Also hosts the /api/validate-emails endpoint.
"""
import asyncio
import csv
import io
import json
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from ..database import get_db
from ..models import Job, JobRow, Event
from ..schemas import (
    DuplicateCheckRequest,
    DuplicateCheckResult,
    DuplicateRecipient,
    JobCreate,
    JobResponse,
    JobListItem,
    JobRowResponse,
    EmailValidationResult,
)
from ..cert_engine import validate_inputs
from .. import job_runner
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
            # Email always comes from the run-time config, not the event
            "email_subject": cfg.email_subject,
            "email_body": cfg.email_body,
        }
        event_name = event.name
    elif cfg.event_config:
        event_config = cfg.event_config.model_dump()
        event_name = event_config.get("name", "One-off")
    else:
        raise HTTPException(status_code=422, detail="Either event_id or event_config must be provided")

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
    name_col = cfg.name_col
    email_col = cfg.email_col
    csv_rows = []
    for row in all_rows:
        # Case-insensitive column lookup
        row_lower = {k.lower(): v for k, v in row.items()}
        name = row_lower.get(name_col.lower(), "").strip()
        email = row_lower.get(email_col.lower(), "").strip()
        if name or email:
            csv_rows.append({"name": name, "email": email})

    if not csv_rows:
        raise HTTPException(status_code=422, detail="CSV contains no usable rows")

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
        db.add(JobRow(
            job_id=job.id,
            row_index=idx,
            name=row["name"],
            email=row["email"],
            status="pending",
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

    return {"job_id": job.id}


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
    return job
