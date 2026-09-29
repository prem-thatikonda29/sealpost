"""
Certificate generation engine.

No glass/pill effect — text styling only (font, size, style, color).
All parameters are explicit kwargs; no config.py, no sys.argv.
"""
import os
import re
import tempfile
from typing import Optional, Tuple

import img2pdf
from PIL import Image, ImageDraw, ImageFont

from .paths import resolve

# Fallback system font path (macOS + common Linux locations)
_FALLBACK_FONTS = [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
]


def _resolve_fallback_font() -> str:
    for path in _FALLBACK_FONTS:
        if os.path.exists(path):
            return path
    raise FileNotFoundError(
        "No fallback font found. Please supply font_path explicitly."
    )


def sanitize_name(name: str) -> str:
    """Return a filesystem-safe version of a name."""
    name = name.lower().strip().replace(" ", "_")
    return re.sub(r"[^\w]", "", name)


def get_first_name(full_name: str) -> str:
    """Extract first meaningful name part for email salutation."""
    for part in full_name.split():
        if len(part) > 3 and "." not in part:
            return part
    parts = full_name.split()
    return parts[0] if parts else full_name


def validate_inputs(template_path: Optional[str], font_path: Optional[str]) -> None:
    """
    Check that a job could actually render, before it starts.

    job_runner catches per-row exceptions and marks the row failed, so a
    missing template or font does not crash a job — it marks *every* row failed
    while the job runs to completion, which reads as a mail problem rather than
    a missing file. Fail once, up front, with the reason.
    """
    if not template_path:
        raise ValueError("This event has no template. Upload one in the editor.")
    if not resolve(template_path).exists():
        raise ValueError(f"Template file is missing: {template_path}")
    if font_path:
        _load_font(font_path, "normal", 12)  # raises FileNotFoundError


def _parse_color(hex_color: str) -> Tuple[int, int, int]:
    """Convert CSS hex (#RRGGBB or #RGB) to an RGB tuple."""
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def _load_font(
    font_path: Optional[str],
    font_style: str,
    font_size: int,
) -> ImageFont.FreeTypeFont:
    """
    Load a TrueType font at the given size.
    If font_style is 'bold' or 'italic' and a matching variant exists next to
    the regular font, use it; otherwise fall back gracefully.
    """
    resolved = str(resolve(font_path)) if font_path else _resolve_fallback_font()

    if font_style in ("bold", "italic", "bold_italic"):
        base_dir = os.path.dirname(resolved)
        base_name = os.path.splitext(os.path.basename(resolved))[0]
        ext = os.path.splitext(resolved)[1]
        # Common naming conventions: Name-Bold.ttf / Name_Bold.ttf / NameBold.ttf
        suffixes = {
            "bold": ["-Bold", "_Bold", "Bold", "-bold", "_bold"],
            "italic": ["-Italic", "_Italic", "Italic", "-italic", "_italic"],
            "bold_italic": ["-BoldItalic", "_BoldItalic", "BoldItalic"],
        }
        for suffix in suffixes.get(font_style, []):
            candidate = os.path.join(base_dir, f"{base_name}{suffix}{ext}")
            if os.path.exists(candidate):
                resolved = candidate
                break
        # If no variant found, just use the regular weight silently.
        # Callers that need to know this call available_styles() first.

    # Pillow's own error for a missing file names a file descriptor, not the
    # path, which is unreadable in a job's failure log.
    if not os.path.exists(resolved):
        raise FileNotFoundError(
            f"Font file not found: {resolved}. Re-upload the font, or pick one "
            f"from the built-in library."
        )

    try:
        return ImageFont.truetype(resolved, font_size)
    except OSError as exc:
        raise FileNotFoundError(f"Cannot read font {resolved}: {exc}") from exc


def available_styles(font_path: Optional[str]) -> list[str]:
    """
    Which of normal / bold / italic this font can actually render.

    The sibling-probe in _load_font falls back to the regular weight silently,
    so "bold" on a single-file font produces a regular certificate. The UI uses
    this to only offer styles that resolve to a real face.
    """
    if not font_path:
        return ["normal"]

    resolved = str(resolve(font_path))
    base_dir = os.path.dirname(resolved)
    base_name = os.path.splitext(os.path.basename(resolved))[0]
    ext = os.path.splitext(resolved)[1]

    styles = ["normal"]
    for key, suffixes in (
        ("bold", ["-Bold", "_Bold", "Bold", "-bold", "_bold"]),
        ("italic", ["-Italic", "_Italic", "Italic", "-italic", "_italic"]),
    ):
        if any(os.path.exists(os.path.join(base_dir, f"{base_name}{s}{ext}")) for s in suffixes):
            styles.append(key)
    return styles


def _draw_name(
    img: Image.Image,
    name: str,
    position: Tuple[int, int],
    font: ImageFont.FreeTypeFont,
    font_color: str,
) -> None:
    """
    Draw `name` centred on `position`.

    anchor="mm" centres the run on its advance width and on the font's
    ascent/descent midline. The previous code centred the *ink* box
    (bbox[2]-bbox[0], bbox[3]-bbox[1]) but drew with the default "la" anchor,
    which aligns the ascender top — so ink landed low by bbox[1] / 2. That
    offset is font-dependent (measured ~11px for Inter at size 48, 0px for
    Press Start 2P), so no constant could correct it. "mm" is also what CSS
    `translate(-50%, -50%)` on a line box approximates, which is what the
    editor's canvas preview does.
    """
    ImageDraw.Draw(img).text(
        position, name, font=font, fill=_parse_color(font_color), anchor="mm"
    )


def fit_font(
    text: str,
    font_size: int,
    max_width: int,
    font_path: Optional[str] = None,
    font_style: str = "normal",
) -> ImageFont.FreeTypeFont:
    """
    Return the largest font that fits `text` within `max_width` pixels,
    shrinking by 2px steps down to size 10.
    """
    size = font_size
    while size >= 10:
        font = _load_font(font_path, font_style, size)
        bbox = font.getbbox(text)
        if (bbox[2] - bbox[0]) <= max_width:
            return font
        size -= 2
    return _load_font(font_path, font_style, 10)


def generate_certificate(
    name: str,
    template_path: str,
    text_position: Tuple[int, int],
    output_path: str,
    font_path: Optional[str] = None,
    font_size: int = 48,
    font_style: str = "normal",
    font_color: str = "#000000",
    max_text_width: int = 1400,
) -> str:
    """
    Generate a certificate PDF for `name` using `template_path`.

    Returns `output_path` on success.
    Raises on any error — caller handles exceptions.
    """
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    src = Image.open(resolve(template_path))
    # What the template already is decides what the composite becomes, and it
    # only matters because of size. A JPEG template has been through lossy
    # compression once, so re-encoding the composite as JPEG costs no quality
    # that exists — the "lossless" PNG was faithfully preserving old JPEG
    # artefacts, not pristine artwork. And img2pdf embeds a JPEG untouched,
    # where a PNG is deflated into the PDF. On a 2000x1414 certificate that is
    # 0.27MB against 0.50MB, and the attachment size is what the SMTP send
    # spends its time on. A PNG template keeps PNG, so nothing is *newly* lossy.
    source_format = (src.format or "").upper()

    img = src.convert("RGBA")

    font = fit_font(name, font_size, max_text_width, font_path, font_style)
    _draw_name(img, name, text_position, font, font_color)

    rgb = img.convert("RGB")

    # Write to a temp image, then let img2pdf wrap it.
    as_jpeg = source_format == "JPEG"
    with tempfile.NamedTemporaryFile(
        suffix=".jpg" if as_jpeg else ".png", delete=False
    ) as tmp:
        tmp_img = tmp.name

    try:
        if as_jpeg:
            # 4:4:4 — no chroma subsampling, so coloured logo edges and
            # signatures stay crisp. q95 is the top of Pillow's useful range.
            rgb.save(tmp_img, "JPEG", quality=95, subsampling=0, optimize=True)
        else:
            rgb.save(tmp_img, "PNG")
        with open(tmp_img, "rb") as img_f, open(output_path, "wb") as pdf_f:
            pdf_f.write(img2pdf.convert(img_f))
    finally:
        if os.path.exists(tmp_img):
            os.remove(tmp_img)

    return output_path


def generate_preview_png(
    name: str,
    template_path: str,
    text_position: Tuple[int, int],
    font_path: Optional[str] = None,
    font_size: int = 48,
    font_style: str = "normal",
    font_color: str = "#000000",
    max_text_width: int = 1400,
) -> str:
    """
    Same as generate_certificate but returns a temp PNG path (not a PDF).
    Caller is responsible for deleting the file after streaming it.
    """
    img = Image.open(resolve(template_path)).convert("RGBA")

    font = fit_font(name, font_size, max_text_width, font_path, font_style)
    _draw_name(img, name, text_position, font, font_color)

    rgb = img.convert("RGB")
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp_png = tmp.name
    rgb.save(tmp_png, "PNG")
    return tmp_png
