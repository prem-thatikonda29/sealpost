import csv
import os
import re
import sys

import img2pdf
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from config import FONT_COLOR, FONT_PATH, PILL_COLOR, PILL_PADDING_X, PILL_PADDING_Y, TIERS


def sanitize_name(name: str) -> str:
    name = name.lower().strip().replace(" ", "_")
    return re.sub(r"[^\w]", "", name)


def get_first_name(full_name: str) -> str:
    """Extract first name (>3 chars, no periods) for salutation."""
    for part in full_name.split():
        if len(part) > 3 and "." not in part:
            return part
    return full_name.split()[0] if full_name.split() else full_name


def fit_font(text: str, font_size: int, max_width: int, font_path: str = None) -> ImageFont.FreeTypeFont:
    path = font_path or FONT_PATH
    size = font_size
    while size >= 10:
        font = ImageFont.truetype(path, size)
        bbox = font.getbbox(text)
        if (bbox[2] - bbox[0]) <= max_width:
            return font
        size -= 2
    return ImageFont.truetype(path, 10)


def generate_certificate(name: str, output_path: str, tier: dict) -> None:
    img = Image.open(tier["template"]).convert("RGBA")

    font_path = tier.get("font_path")
    font = fit_font(name, tier["font_size"], tier["max_text_width"], font_path)
    bbox = font.getbbox(name)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    cx, cy = tier["text_position"]
    text_x = cx - text_w // 2
    text_y = cy - text_h // 2

    apply_glass = tier.get("apply_glass_effect", True)

    if apply_glass:
        pill_x0 = text_x - PILL_PADDING_X
        pill_y0 = text_y - PILL_PADDING_Y
        pill_x1 = text_x + text_w + PILL_PADDING_X
        pill_y1 = text_y + text_h + PILL_PADDING_Y
        radius = (pill_y1 - pill_y0) // 2

        # Pill shape mask
        pill_mask = Image.new("L", img.size, 0)
        ImageDraw.Draw(pill_mask).rounded_rectangle(
            [pill_x0, pill_y0, pill_x1, pill_y1], radius=radius, fill=255
        )

        # Layer 1: frosted blur
        blurred = img.filter(ImageFilter.GaussianBlur(radius=28))
        img.paste(blurred, mask=pill_mask)

        # Layer 2: dark semi-transparent fill
        dark_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(dark_layer).rounded_rectangle(
            [pill_x0, pill_y0, pill_x1, pill_y1], radius=radius, fill=PILL_COLOR
        )
        img = Image.alpha_composite(img, dark_layer)

        # Layer 3: subtle white border
        border_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(border_layer).rounded_rectangle(
            [pill_x0, pill_y0, pill_x1, pill_y1],
            radius=radius,
            outline=(255, 255, 255, 55),
            width=2,
        )
        img = Image.alpha_composite(img, border_layer)

        # Layer 4: top-edge highlight strip
        highlight_h = max(6, (pill_y1 - pill_y0) // 6)
        highlight_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(highlight_layer).rounded_rectangle(
            [pill_x0, pill_y0, pill_x1, pill_y0 + highlight_h * 2],
            radius=radius,
            fill=(255, 255, 255, 35),
        )
        img = Image.alpha_composite(
            img,
            Image.composite(highlight_layer, Image.new("RGBA", img.size, (0, 0, 0, 0)), pill_mask),
        )

    ImageDraw.Draw(img).text((text_x, text_y), name, font=font, fill=FONT_COLOR)

    rgb = img.convert("RGB")
    tmp_png = output_path.replace(".pdf", "_tmp.png")
    rgb.save(tmp_png, "PNG")
    with open(tmp_png, "rb") as img_f, open(output_path, "wb") as pdf_f:
        pdf_f.write(img2pdf.convert(img_f))
    os.remove(tmp_png)


def run_tier(tier_name: str, tier: dict) -> None:
    if not os.path.exists(tier["template"]):
        print(f"[{tier_name.upper()}] SKIP — template not found: {tier['template']}")
        return

    os.makedirs(tier["output_dir"], exist_ok=True)

    with open(tier["csv"], newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))

    ok = skip = 0
    for i, row in enumerate(rows, 1):
        name = row.get("name", row.get("Name", "")).strip()
        email = row.get("email", row.get("Email id", row.get("Email", ""))).strip()
        if not name or not email:
            print(f"[{tier_name.upper()}] SKIP row {i}: missing name or email")
            skip += 1
            continue
        out = os.path.join(tier["output_dir"], f"{sanitize_name(name)}_{tier['cert_suffix']}.pdf")
        generate_certificate(name, out, tier)
        print(f"[{tier_name.upper()}] OK   {name} → {out}")
        ok += 1

    print(f"[{tier_name.upper()}] Done: {ok} generated, {skip} skipped.\n")


def main() -> None:
    selected = sys.argv[1] if len(sys.argv) > 1 else None
    if selected and selected not in TIERS:
        raise SystemExit(f"Unknown tier '{selected}'. Choose from: {', '.join(TIERS)}")

    for name, tier in TIERS.items():
        if selected and name != selected:
            continue
        run_tier(name, tier)


if __name__ == "__main__":
    main()
