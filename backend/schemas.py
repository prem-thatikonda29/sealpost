import json
from typing import Optional, List
from .timeutil import AppDatetime
from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Event schemas
# ---------------------------------------------------------------------------

class EventBase(BaseModel):
    name: str
    description: Optional[str] = None
    template_path: Optional[str] = None
    template_natural_width: Optional[int] = None
    template_natural_height: Optional[int] = None
    text_position_x: Optional[int] = None
    text_position_y: Optional[int] = None
    font_path: Optional[str] = None
    font_size: int = 48
    font_style: str = "normal"
    font_color: str = "#000000"
    max_text_width: int = 1400


class EventCreate(EventBase):
    save: bool = True  # if False, return config dict without writing to DB


class EventUpdate(EventBase):
    name: Optional[str] = None  # all fields optional on update


class EventResponse(EventBase):
    id: str
    created_at: AppDatetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Job Row schemas
# ---------------------------------------------------------------------------

class JobRowResponse(BaseModel):
    id: int
    job_id: str
    row_index: int
    name: str
    email: str
    status: str
    error_message: Optional[str] = None
    sent_at: Optional[AppDatetime] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Job schemas
# ---------------------------------------------------------------------------

class JobCreate(BaseModel):
    event_id: Optional[str] = None          # use saved event
    event_config: Optional[EventBase] = None  # inline one-off config
    dry_run: bool = False
    batch_size: int = 0                      # 0 = no limit
    name_col: str = "name"
    email_col: str = "email"
    # Email content is always supplied at run time
    email_subject: str = "Your Certificate"
    email_body: str = "Hi {name},\n\nPlease find your certificate attached.\n\nBest regards"


class JobSummary(BaseModel):
    """Counts and timings for the delivery report card."""
    total: int
    delivered: int
    generated: int
    failed: int
    bounced: int
    invalid: int
    skipped: int
    not_processed: int
    retries: int
    duration_seconds: Optional[int] = None
    delivered_pct: Optional[float] = None


class JobResponse(BaseModel):
    id: str
    event_id: Optional[str]
    status: str
    total_rows: int
    sent_count: int
    failed_count: int
    invalid_count: int
    bounced_count: int
    dry_run: bool
    created_at: AppDatetime
    finished_at: Optional[AppDatetime]
    rows: List[JobRowResponse] = []
    # Whether there is a zip to offer. Computed from disk, not stored.
    certificates_available: bool = False
    # The config this job ran with, frozen at creation. Exposed so a retry can
    # rebuild it without needing the event to still exist — and so the original
    # message can prefill the retry's subject and body.
    event_snapshot: Optional[dict] = None
    # Filled in by get_job from the rows; not a column.
    summary: Optional[JobSummary] = None

    @field_validator("event_snapshot", mode="before")
    @classmethod
    def _parse_snapshot(cls, v):
        # Stored as a JSON string in a Text column.
        if isinstance(v, str):
            try:
                return json.loads(v)
            except ValueError:
                return None
        return v

    class Config:
        from_attributes = True


class JobListItem(BaseModel):
    id: str
    event_id: Optional[str]
    event_name: Optional[str] = None  # denormalised from snapshot
    status: str
    total_rows: int
    sent_count: int
    failed_count: int
    invalid_count: int
    bounced_count: int
    dry_run: bool
    created_at: AppDatetime
    finished_at: Optional[AppDatetime]

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Template upload response
# ---------------------------------------------------------------------------

class TemplateUploadResponse(BaseModel):
    template_id: str
    path: str          # repo-relative, e.g. uploads/<uuid>_cert.png — store this
    url: str
    natural_width: int
    natural_height: int


# ---------------------------------------------------------------------------
# Email validation
# ---------------------------------------------------------------------------

class EmailValidationResult(BaseModel):
    email: str
    valid: bool
    reason: str


# ---------------------------------------------------------------------------
# Duplicate recipient check
# ---------------------------------------------------------------------------

class DuplicateCheckRequest(BaseModel):
    # None for a job with no saved event. That is not hypothetical: the FK is
    # ON DELETE SET NULL, and every job recorded before events existed carries
    # no event_id. Those still need checking — there is just nothing to scope to.
    event_id: Optional[str] = None
    emails: List[str]


class DuplicateRecipient(BaseModel):
    email: str
    name: str
    sent_at: Optional[AppDatetime] = None


class DuplicateCheckResult(BaseModel):
    checked: int              # distinct addresses looked up
    already_sent: int         # how many of those already had this certificate
    # Whether the check was confined to one event. When it was not, the result
    # can only say "sent something before", and the wording must not claim more.
    scoped_to_event: bool
    sample: List[DuplicateRecipient]   # a few, so the warning can name names


# ---------------------------------------------------------------------------
# Preview request
# ---------------------------------------------------------------------------

class PreviewRequest(BaseModel):
    template_path: str
    text_position_x: int
    text_position_y: int
    font_path: Optional[str] = None
    font_size: int = 48
    font_style: str = "normal"
    font_color: str = "#000000"
    max_text_width: int = 1400
    sample_name: str = "Sample Name"


# ---------------------------------------------------------------------------
# Upload cleaning
# ---------------------------------------------------------------------------

class CleanRow(BaseModel):
    name: str = Field("", max_length=2000)
    email: str = Field("", max_length=2000)


class CleanRequest(BaseModel):
    rows: List[CleanRow] = Field(max_length=10000)
    # A generate-only run needs no addresses.
    require_email: bool = True
