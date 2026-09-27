from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


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
    created_at: datetime

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
    created_at: datetime
    finished_at: Optional[datetime]
    rows: List[JobRowResponse] = []

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
    created_at: datetime
    finished_at: Optional[datetime]

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Template upload response
# ---------------------------------------------------------------------------

class TemplateUploadResponse(BaseModel):
    template_id: str
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
