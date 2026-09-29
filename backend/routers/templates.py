"""
Template image upload and serving.
"""
import glob
import os
import uuid

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from PIL import Image

from ..paths import UPLOADS_DIR, to_stored
from ..schemas import TemplateUploadResponse

router = APIRouter(prefix="/api/templates", tags=["templates"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
MAX_TEMPLATE_BYTES = 25 * 1024 * 1024

MEDIA_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}


def _find_file(template_id: str) -> str | None:
    """Glob for any file whose name starts with `template_id`."""
    matches = glob.glob(str(UPLOADS_DIR / f"{template_id}_*"))
    return matches[0] if matches else None


@router.post("/upload", response_model=TemplateUploadResponse)
async def upload_template(file: UploadFile = File(...)):
    # The filename is client-controlled. `os.path.join` does not normalise, so
    # joining it raw let "uuid_../../etc/passwd" traverse; basename first.
    original = os.path.basename(file.filename or "template.jpg")
    ext = os.path.splitext(original)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        if ext in {".ttf", ".otf"}:
            raise HTTPException(
                status_code=422,
                detail="That's a font, not an image. Use the font picker in the event editor.",
            )
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported image type '{ext or original}'. Upload a PNG or JPEG.",
        )

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=422, detail="The file is empty.")
    if len(contents) > MAX_TEMPLATE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image is larger than {MAX_TEMPLATE_BYTES // 1024 // 1024}MB.",
        )

    template_id = str(uuid.uuid4())
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    # Validate before moving into place, so a rejected upload leaves nothing behind.
    tmp_path = UPLOADS_DIR / f".{template_id}.tmp"
    tmp_path.write_bytes(contents)

    try:
        with Image.open(tmp_path) as img:
            natural_width, natural_height = img.size
            img.verify()
    except Exception as exc:
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=f"Cannot read image: {exc}")

    final_path = UPLOADS_DIR / f"{template_id}_{original}"
    os.replace(tmp_path, final_path)

    return TemplateUploadResponse(
        template_id=template_id,
        path=to_stored(final_path),
        url=f"/api/templates/{template_id}",
        natural_width=natural_width,
        natural_height=natural_height,
    )


@router.get("/{template_id}")
def serve_template(template_id: str):
    path = _find_file(template_id)
    if not path:
        raise HTTPException(status_code=404, detail="Template not found")
    return FileResponse(path, media_type=MEDIA_TYPES.get(os.path.splitext(path)[1].lower()))
