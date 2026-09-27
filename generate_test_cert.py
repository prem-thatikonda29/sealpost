#!/usr/bin/env python3
"""Generate a single test certificate to verify name placement."""

import os
import re
import sys

import img2pdf
from PIL import Image, ImageDraw, ImageFont

# Import config
sys.path.insert(0, os.path.dirname(__file__))
from config import FONT_COLOR, FONT_PATH


def sanitize_name(name: str) -> str:
    name = name.lower().strip().replace(" ", "_")
    return re.sub(r"[^\w]", "", name)


def fit_font(text: str, font_size: int, max_width: int) -> ImageFont.FreeTypeFont:
    size = font_size
    while size >= 10:
        font = ImageFont.truetype(FONT_PATH, size)
        bbox = font.getbbox(text)
        if (bbox[2] - bbox[0]) <= max_width:
            return font
        size -= 2
    return ImageFont.truetype(FONT_PATH, 10)


def generate_certificate(name: str, output_path: str) -> None:
    # Use ideaframe tier settings
    template = "templates/ideaframe-certificate.jpg"
    text_position = (800, 393)
    font_size = 36
    max_text_width = 1740
    
    img = Image.open(template).convert("RGBA")
    
    font = fit_font(name, font_size, max_text_width)
    bbox = font.getbbox(name)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    
    cx, cy = text_position
    text_x = cx - text_w // 2
    text_y = cy - text_h // 2
    
    # Simple text overlay without glass effect, using black font
    ImageDraw.Draw(img).text((text_x, text_y), name, font=font, fill=(0, 0, 0))
    
    rgb = img.convert("RGB")
    tmp_png = output_path.replace(".pdf", "_tmp.png")
    rgb.save(tmp_png, "PNG")
    with open(tmp_png, "rb") as img_f, open(output_path, "wb") as pdf_f:
        pdf_f.write(img2pdf.convert(img_f))
    os.remove(tmp_png)


if __name__ == "__main__":
    # Use a test name
    test_name = "Test User"
    output_dir = "output/ideaframe_test"
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, f"{sanitize_name(test_name)}_test.pdf")
    
    print(f"Generating test certificate for: {test_name}")
    generate_certificate(test_name, output_path)
    print(f"Generated: {output_path}")
    print("\nPlease check the PDF to verify name placement.")
