"""
Template image upload and serving.
"""
import glob
import os
import uuid

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from PIL import Image

from ..schemas import TemplateUploadResponse

router = APIRouter(prefix="/api/templates", tags=["templates"])

UPLOADS_DIR = "uploads"


def _find_file(template_id: str) -> str | None:
    """Glob for any file whose name starts with `template_id`."""
    matches = glob.glob(os.path.join(UPLOADS_DIR, f"{template_id}_*"))
    return matches[0] if matches else None


@router.post("/upload", response_model=TemplateUploadResponse)
async def upload_template(file: UploadFile = File(...)):
    os.makedirs(UPLOADS_DIR, exist_ok=True)

    ext = os.path.splitext(file.filename or "template.jpg")[1] or ".jpg"
    template_id = str(uuid.uuid4())
    save_name = f"{template_id}_{file.filename}"
    save_path = os.path.join(UPLOADS_DIR, save_name)

    contents = await file.read()
    with open(save_path, "wb") as f:
        f.write(contents)

    # Read natural dimensions via Pillow
    try:
        with Image.open(save_path) as img:
            natural_width, natural_height = img.size
    except Exception as exc:
        os.remove(save_path)
        raise HTTPException(status_code=422, detail=f"Cannot read image: {exc}")

    return TemplateUploadResponse(
        template_id=template_id,
        url=f"/api/templates/{template_id}",
        natural_width=natural_width,
        natural_height=natural_height,
    )


@router.get("/{template_id}")
def serve_template(template_id: str):
    path = _find_file(template_id)
    if not path:
        raise HTTPException(status_code=404, detail="Template not found")
    return FileResponse(path)
