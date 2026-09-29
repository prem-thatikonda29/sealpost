"""
Preview endpoint — renders a sample certificate and streams back a PNG.
"""
import os
import tempfile

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse

from ..cert_engine import generate_preview_png
from ..paths import resolve
from ..schemas import PreviewRequest

router = APIRouter(prefix="/api/preview", tags=["preview"])


@router.post("")
async def preview_certificate(body: PreviewRequest, background_tasks: BackgroundTasks):
    if not body.template_path:
        raise HTTPException(status_code=422, detail="template_path is required")

    if not resolve(body.template_path).exists():
        raise HTTPException(status_code=404, detail="Template file not found")

    try:
        tmp_png = generate_preview_png(
            name=body.sample_name,
            template_path=body.template_path,
            text_position=(body.text_position_x, body.text_position_y),
            font_path=body.font_path,
            font_size=body.font_size,
            font_style=body.font_style,
            font_color=body.font_color,
            max_text_width=body.max_text_width,
        )
    except FileNotFoundError as exc:
        # A missing template or font is the caller's input being wrong, not a
        # server fault — 422 keeps it out of the error logs and the frontend
        # shows `detail` either way.
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    # Clean up the temp file after the response is sent
    background_tasks.add_task(os.unlink, tmp_png)

    return StreamingResponse(
        open(tmp_png, "rb"),
        media_type="image/png",
        headers={"Cache-Control": "no-store"},
    )
