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
    resolved = font_path or _resolve_fallback_font()

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
        # If no variant found, just use the regular weight silently

    return ImageFont.truetype(resolved, font_size)


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

    img = Image.open(template_path).convert("RGBA")

    font = fit_font(name, font_size, max_text_width, font_path, font_style)
    bbox = font.getbbox(name)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    cx, cy = text_position
    text_x = cx - text_w // 2
    text_y = cy - text_h // 2

    fill_color = _parse_color(font_color)
    ImageDraw.Draw(img).text((text_x, text_y), name, font=font, fill=fill_color)

    rgb = img.convert("RGB")

    # Write to a temp PNG then convert to PDF via img2pdf
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp_png = tmp.name

    try:
        rgb.save(tmp_png, "PNG")
        with open(tmp_png, "rb") as img_f, open(output_path, "wb") as pdf_f:
            pdf_f.write(img2pdf.convert(img_f))
    finally:
        if os.path.exists(tmp_png):
            os.remove(tmp_png)

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
    img = Image.open(template_path).convert("RGBA")

    font = fit_font(name, font_size, max_text_width, font_path, font_style)
    bbox = font.getbbox(name)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    cx, cy = text_position
    text_x = cx - text_w // 2
    text_y = cy - text_h // 2

    fill_color = _parse_color(font_color)
    ImageDraw.Draw(img).text((text_x, text_y), name, font=font, fill=fill_color)

    rgb = img.convert("RGB")
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp_png = tmp.name
    rgb.save(tmp_png, "PNG")
    return tmp_png
