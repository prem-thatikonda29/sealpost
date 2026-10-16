"""Upload cleaning: look a participant list over before it is generated or sent."""
from fastapi import APIRouter

from .. import data_cleaning
from ..schemas import CleanRequest

router = APIRouter(prefix="/api/cleaning", tags=["cleaning"])


@router.post("/analyze")
def analyze(body: CleanRequest):
    """
    Check every row and report what is wrong or was tidied.

    Nothing is stored. Rows come back with `clean_name` / `clean_email` (the safe
    tidy-ups already applied) and a list of issues per row.
    """
    return data_cleaning.analyze_rows(
        [r.model_dump() for r in body.rows], require_email=body.require_email
    )
