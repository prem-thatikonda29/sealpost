#!/usr/bin/env python3
"""
Builds the Sealpost wordmark, the mark + wordmark lockups, and the social
(Open Graph) image. Letters are converted to outlines from the Sentient font so
the SVGs need no font at all.

Sentient is not committed (it comes from fontshare.com). Download its two
variable TTFs and point this script at them:

    python3 landing/scripts/build-lockups.py --fonts /path/to/sentient

The folder needs Sentient-Variable.ttf and Sentient-VariableItalic.ttf.
The two scripts are independent; run either one on its own.
Needs `rsvg-convert` (brew install librsvg) and fontTools for the PNG and outlines.
"""
import argparse
import importlib.util
import shutil
import subprocess
import tempfile
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
BRAND = ROOT / "landing" / "public" / "brand"

TERRA, TERRA_TINT, INK, CANVAS, MUTED = "#9C5A42", "#E8D5CC", "#2C2520", "#F5F0EB", "#6E6258"

# build-brand.py has a dash in its name, so load it by path to share the mark.
_spec = importlib.util.spec_from_file_location("build_brand", HERE / "build-brand.py")
brand = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(brand)


def num(v: float) -> str:
    return f"{v:.2f}".rstrip("0").rstrip(".")


class Face:
    """One Sentient instance at a fixed weight, able to set text as outlines."""

    def __init__(self, path: Path, wght: int):
        self.font = instantiateVariableFont(TTFont(path), {"wght": wght})
        self.glyphs = self.font.getGlyphSet()
        self.cmap = self.font.getBestCmap()
        self.upm = self.font["head"].unitsPerEm

    def set(self, text: str, size: float, x: float = 0, y: float = 0, tracking: float = 0.0):
        """Return (svg path d, ink bounds, advance) for text with its baseline at y."""
        scale = size / self.upm
        pen = SVGPathPen(self.glyphs, ntos=num)
        bounds = BoundsPen(self.glyphs)
        cursor = 0.0
        for ch in text:
            name = self.cmap[ord(ch)]
            glyph = self.glyphs[name]
            t = (scale, 0, 0, -scale, x + cursor * scale, y)
            glyph.draw(TransformPen(pen, t))
            glyph.draw(TransformPen(bounds, t))
            cursor += glyph.width + tracking * self.upm
        cursor -= tracking * self.upm
        return pen.getCommands(), bounds.bounds, cursor * scale

    def cap_height(self, size: float) -> float:
        b = BoundsPen(self.glyphs)
        self.glyphs[self.cmap[ord("S")]].draw(b)
        return b.bounds[3] * size / self.upm


def wordmark(face: Face, size: float, x: float, y: float, fill: str):
    d, b, adv = face.set("Sealpost", size, x, y, tracking=-0.012)
    return f'<path d="{d}" fill="{fill}"/>', b, adv


def lockup(face: Face, theme: str):
    """Mark + wordmark, baseline at y=0. Returns (inner svg, bounds)."""
    size = 100
    fill = {"light": INK, "dark": CANVAS, "mono-ink": INK, "mono-cream": CANVAS}[theme]
    cap = face.cap_height(size)
    d = cap * 1.45                     # mark diameter
    gap = d * 0.34
    cy = -cap / 2                      # mark centred on the capital height
    scale = d / 120
    mx, my = 0, cy - d / 2
    if theme == "light":
        mark = brand.mark_group(TERRA, CANVAS)
    elif theme == "dark":
        mark = brand.mark_group(TERRA_TINT, INK)
    else:
        mark = brand.mono_group(fill, f"cut-{theme}")
    wm, b, adv = wordmark(face, size, d + gap, 0, fill)
    inner = (
        f'<g transform="translate({num(mx)} {num(my)}) scale({num(scale)})">{mark}</g>\n  {wm}'
    )
    left, top = 0, min(my, b[1])
    right, bottom = b[2], max(my + d, b[3])
    return inner, (left, top, right, bottom)


def svg_doc(inner: str, bounds, label="Sealpost", pad=2):
    l, t, r, btm = bounds
    w, h = r - l + 2 * pad, btm - t + 2 * pad
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{num(l - pad)} {num(t - pad)} {num(w)} {num(h)}" '
        f'role="img" aria-label="{label}">\n  {inner}\n</svg>\n'
    )


def build_og(roman: Face, medium: Face, italic: Face, out_png: Path) -> None:
    W, H, LEFT = 1200, 630, 72
    parts = [f'<rect width="{W}" height="{H}" fill="{CANVAS}"/>']

    # Lockup, top left.
    inner, (l, t, r, b) = lockup(roman, "light")
    k = 44 / (b - t)
    parts.append(f'<g transform="translate({LEFT} {num(64 - t * k)}) scale({num(k)})">{inner}</g>')

    # Headline.
    size = 78
    lines = [("Send hackathon", roman, INK), ("certificates", roman, INK)]
    y = 220
    for text, face, fill in lines:
        d, _, adv = face.set(text, size, LEFT, y, tracking=-0.02)
        assert adv < 590, f"headline line too wide: {adv}"
        parts.append(f'<path d="{d}" fill="{fill}"/>')
        y += 84
    d, _, adv = italic.set("in minutes", size, LEFT, y, tracking=-0.02)
    parts.append(f'<path d="{d}" fill="{TERRA}"/>')
    ux = LEFT + 2
    parts.append(
        f'<path d="M{ux} {y + 16} C {ux + 70} {y + 7}, {ux + 150} {y + 25}, {ux + 228} {y + 12} '
        f'S {ux + 310} {y + 14}, {ux + adv - 6} {y + 9}" fill="none" stroke="{TERRA}" '
        f'stroke-width="4" stroke-linecap="round"/>'
    )

    # Supporting line.
    for i, text in enumerate(["Place names. Upload a list.", "Watch every send land."]):
        d, _, _ = roman.set(text, 28, LEFT, 476 + i * 38)
        parts.append(f'<path d="{d}" fill="{MUTED}"/>')

    # Call to action: the site's dark "Get started" button, the address beside it.
    bx, by, bh, pad_x, label_size = LEFT, 540, 56, 26, 24
    base = by + bh / 2 + medium.cap_height(label_size) / 2
    d, _, label_w = medium.set("Get started", label_size, bx + pad_x, base)
    ax = bx + pad_x + label_w + 14  # arrow, drawn as strokes
    ay = by + bh / 2
    bw = ax + 18 + pad_x - bx
    parts.append(f'<rect x="{bx}" y="{by}" width="{num(bw)}" height="{bh}" rx="4" fill="{INK}"/>')
    parts.append(f'<path d="{d}" fill="{CANVAS}"/>')
    parts.append(
        f'<path d="M{num(ax)} {num(ay)} H{num(ax + 18)} M{num(ax + 11)} {num(ay - 7)} '
        f'L{num(ax + 18)} {num(ay)} L{num(ax + 11)} {num(ay + 7)}" fill="none" stroke="{CANVAS}" '
        f'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
    )
    url_size = 22
    d, _, url_w = medium.set(
        "sealpost.vercel.app", url_size, bx + bw + 24, by + bh / 2 + medium.cap_height(url_size) / 2, tracking=0.01
    )
    assert bx + bw + 24 + url_w < 610, "call to action runs into the certificate"
    parts.append(f'<path d="{d}" fill="{TERRA}"/>')

    # Certificate card, tilted, with the flat terracotta offset the site uses.
    cx0, cy0, cw = 690, 168, 440
    ch = cw * 814 / 1156
    cx, cy = cx0 + cw / 2, cy0 + ch / 2
    parts.append(
        f'<g transform="rotate(-3 {num(cx)} {num(cy)})">'
        f'<rect x="{cx0 + 12}" y="{cy0 + 12}" width="{cw}" height="{num(ch)}" fill="{TERRA_TINT}"/>'
        f'<rect x="{cx0}" y="{cy0}" width="{cw}" height="{num(ch)}" fill="#fff" stroke="#E5DED5" stroke-width="1.5"/>'
        f'<image x="{cx0}" y="{cy0}" width="{cw}" height="{num(ch)}" href="og-certificate.jpg" preserveAspectRatio="xMidYMid slice"/>'
        f'<rect x="{cx0}" y="{cy0}" width="{cw}" height="{num(ch)}" fill="none" stroke="#E5DED5" stroke-width="1.5"/>'
        f"</g>"
    )
    # The seal, stamped over the card's lower left corner.
    s, sx, sy = 124, 628, 372
    parts.append(
        f'<g transform="translate({sx} {sy})"><circle cx="{s / 2}" cy="{s / 2}" r="{s / 2 + 7}" fill="{CANVAS}"/>'
        f'<g transform="scale({num(s / 120)})">{brand.mark_group(TERRA, CANVAS)}</g></g>'
    )

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">\n  '
        + "\n  ".join(parts)
        + "\n</svg>\n"
    )
    with tempfile.TemporaryDirectory() as tmp:
        shutil.copy(HERE / "assets" / "og-certificate.jpg", tmp)
        src = Path(tmp) / "og.svg"
        src.write_text(svg)
        subprocess.run(["rsvg-convert", "-o", str(out_png), str(src)], check=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fonts", required=True, type=Path, help="folder with the two Sentient variable TTFs")
    args = ap.parse_args()
    roman_path = args.fonts / "Sentient-Variable.ttf"
    italic_path = args.fonts / "Sentient-VariableItalic.ttf"

    regular = Face(roman_path, 400)
    logo = Face(roman_path, 500)  # the weight the logo is drawn in
    BRAND.mkdir(parents=True, exist_ok=True)

    for theme, fill in (("light", INK), ("dark", CANVAS)):
        inner, b, _ = wordmark(logo, 100, 0, 0, fill)
        (BRAND / f"wordmark-{theme}.svg").write_text(svg_doc(inner, b))

    for theme in ("light", "dark", "mono-ink", "mono-cream"):
        inner, b = lockup(logo, theme)
        (BRAND / f"lockup-{theme}.svg").write_text(svg_doc(inner, b))

    build_og(regular, logo, Face(italic_path, 400), BRAND / "og-image.png")
    print("wrote wordmarks, lockups and og-image.png")


if __name__ == "__main__":
    main()
