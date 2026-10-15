"""
Events CRUD — saved certificate event configurations.
"""
import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Event
from ..timeutil import utc_naive_now
from ..schemas import EventCreate, EventResponse, EventUpdate

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=List[EventResponse])
def list_events(db: Session = Depends(get_db)):
    return db.query(Event).order_by(Event.created_at.desc()).all()


@router.post("", response_model=EventResponse, status_code=201)
def create_event(body: EventCreate, db: Session = Depends(get_db)):
    if not body.save:
        # One-off: return a synthetic response without writing to DB
        # The caller can use this config dict directly in a job POST.
        # We give it a fake id so the schema validates.
        return EventResponse(
            id="one-off",
            created_at=utc_naive_now(),
            **body.model_dump(exclude={"save"}),
        )

    event = Event(**body.model_dump(exclude={"save"}))
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/{event_id}", response_model=EventResponse)
def get_event(event_id: str, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.put("/{event_id}", response_model=EventResponse)
def update_event(event_id: str, body: EventUpdate, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: str, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    db.delete(event)
    db.commit()
