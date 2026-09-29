"""
Font catalog, font file serving, and font upload.

Three id spaces meet here:
  - catalog ids are slugs (`inter`, `playfair-display`) from fonts_catalog
  - uploaded fonts are uuid4 strings, named `<uuid>_<original name>`

Both resolve through `GET /api/fonts/{font_id}/file` so the frontend has one
URL shape to build, and both are served with an explicit media_type: Starlette
falls back to `application/octet-stream` when `mimetypes` has no entry, and
`font/ttf` is not in Python's built-in table — it comes from the host's
`/etc/mime.types`, which a slim container won't have.
"""
from __future__ import annotations

import glob
import os
import uuid

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import ImageFont

from .. import fonts_catalog
from ..paths import FONTS_UPLOAD_DIR, TYPEFACES_DIR, resolve, to_stored

router = APIRouter(prefix="/api/fonts", tags=["fonts"])

ALLOWED_EXTENSIONS = {".ttf", ".otf"}
MAX_FONT_BYTES = 12 * 1024 * 1024

MEDIA_TYPES = {".ttf": "font/ttf", ".otf": "font/otf"}


@router.get("")
def list_fonts():
    """The curated catalog. Metadata only — the binaries are separate requests."""
    return [
        {
            "id": f.id,
            "label": f.label,
            "category": f.category,
            "path": f.path,
            "url": f"/api/fonts/{f.id}/file",
            "styles": f.styles,
            "google_family": f.google_family,
        }
        for f in fonts_catalog.all_fonts()
    ]


def _uploaded_font_path(font_id: str) -> str | None:
    matches = glob.glob(str(FONTS_UPLOAD_DIR / f"{font_id}_*"))
    return matches[0] if matches else None


@router.get("/{font_id}/file")
def serve_font(font_id: str):
    """Serve a catalog or uploaded font. `font_id` never becomes a path."""
    path: str | None = None

    entry = fonts_catalog.get(font_id)
    if entry:
        candidate = resolve(entry.path)
        # Belt and braces: a catalog entry is authored here, not by a request,
        # but the file must still be inside the typefaces directory.
        if TYPEFACES_DIR in candidate.parents and candidate.exists():
            path = str(candidate)
    else:
        path = _uploaded_font_path(font_id)

    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Font not found")

    ext = os.path.splitext(path)[1].lower()
    return FileResponse(
        path,
        media_type=MEDIA_TYPES.get(ext, "application/octet-stream"),
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@router.post("/upload")
async def upload_font(file: UploadFile = File(...)):
    """
    Store a user-supplied font.

    Validated by *loading* it with Pillow rather than by extension — the
    template endpoint's `Image.open()` is the right test for an image and the
    wrong one for a font, which is how the old upload path came to delete every
    font it was handed.
    """
    original = os.path.basename(file.filename or "font.ttf")
    ext = os.path.splitext(original)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported font type '{ext or original}'. Upload a .ttf or .otf file.",
        )

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=422, detail="The file is empty.")
    if len(contents) > MAX_FONT_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Font is larger than {MAX_FONT_BYTES // 1024 // 1024}MB.",
        )

    font_id = str(uuid.uuid4())
    FONTS_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # Write to a temp file first, validate, then move into place. Validating
    # after the final write would leave a bad file in the upload directory.
    tmp_path = FONTS_UPLOAD_DIR / f".{font_id}.tmp"
    tmp_path.write_bytes(contents)

    try:
        face = ImageFont.truetype(str(tmp_path), 12)
        family, style = face.getname()
    except Exception as exc:
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=422,
            detail=f"That file is not a readable font: {exc}",
        )

    final_path = FONTS_UPLOAD_DIR / f"{font_id}_{original}"
    os.replace(tmp_path, final_path)

    return {
        "font_id": font_id,
        "path": to_stored(final_path),
        "url": f"/api/fonts/{font_id}/file",
        "family": family,
        "style": style,
    }
