import uuid
from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime, ForeignKey, Text, Float
)
from sqlalchemy.orm import relationship
from .database import Base
from .timeutil import utc_naive_now


def _uuid():
    return str(uuid.uuid4())


class Event(Base):
    __tablename__ = "events"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    # Template image (stored in uploads/)
    template_path = Column(String, nullable=True)
    template_natural_width = Column(Integer, nullable=True)
    template_natural_height = Column(Integer, nullable=True)

    # Name placement
    text_position_x = Column(Integer, nullable=True)
    text_position_y = Column(Integer, nullable=True)

    # Text styling — no glass effect
    font_path = Column(String, nullable=True)   # None = system Arial
    font_size = Column(Integer, default=48, nullable=False)
    font_style = Column(String, default="normal", nullable=False)  # normal | bold | italic
    font_color = Column(String, default="#000000", nullable=False)  # CSS hex
    max_text_width = Column(Integer, default=1400, nullable=False)

    created_at = Column(DateTime, default=utc_naive_now, nullable=False)

    jobs = relationship("Job", back_populates="event")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, default=_uuid)
    event_id = Column(String, ForeignKey("events.id", ondelete="SET NULL"), nullable=True)
    # Full snapshot of event config at time of run — survives event edits/deletion
    event_snapshot = Column(Text, nullable=True)

    status = Column(String, default="pending", nullable=False)  # pending | running | done | failed
    total_rows = Column(Integer, default=0, nullable=False)
    sent_count = Column(Integer, default=0, nullable=False)
    failed_count = Column(Integer, default=0, nullable=False)
    invalid_count = Column(Integer, default=0, nullable=False)
    bounced_count = Column(Integer, default=0, nullable=False)
    dry_run = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=utc_naive_now, nullable=False)
    finished_at = Column(DateTime, nullable=True)

    event = relationship("Event", back_populates="jobs")
    rows = relationship("JobRow", back_populates="job", cascade="all, delete-orphan")


class JobRow(Base):
    __tablename__ = "job_rows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    row_index = Column(Integer, nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    # pending | sent | failed | skipped | invalid_domain | bounced
    status = Column(String, default="pending", nullable=False)
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime, nullable=True)       # UTC, when the message left
    attempts = Column(Integer, default=0, server_default="0", nullable=False)

    job = relationship("Job", back_populates="rows")
