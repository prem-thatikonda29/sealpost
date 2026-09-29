"""
Repo-relative path resolution.

Paths stored in the database (`template_path`, `font_path`) are repo-relative
strings like `uploads/<uuid>_cert.png` or `backend/typefaces/inter/Inter.ttf`.
They were only ever resolvable because `start.sh` runs uvicorn from the repo
root — running it from `backend/` broke every one of them, and `preview.py`'s
`os.path.exists()` check would fail while a `FileNotFoundError` surfaced
somewhere unrelated.

Resolving against a REPO_ROOT derived from `__file__` makes the stored strings
CWD-independent, which is what lets a catalog font_path and an uploaded
font_path be the same kind of value.
"""
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

UPLOADS_DIR = REPO_ROOT / "uploads"
FONTS_UPLOAD_DIR = UPLOADS_DIR / "fonts"
OUTPUT_DIR = REPO_ROOT / "output"
TYPEFACES_DIR = REPO_ROOT / "backend" / "typefaces"


def resolve(path: str | Path) -> Path:
    """Absolute path for a stored repo-relative path. Absolute paths pass through."""
    p = Path(path)
    return p if p.is_absolute() else REPO_ROOT / p


def to_stored(path: str | Path) -> str:
    """Inverse of resolve(): the repo-relative string to persist in the database."""
    p = Path(path).resolve()
    try:
        return str(p.relative_to(REPO_ROOT))
    except ValueError:
        return str(p)  # outside the repo — store as-is rather than lying about it
