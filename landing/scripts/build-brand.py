#!/usr/bin/env python3
"""
Builds the Sealpost mark (concept A: a seal with a check) in every form the
site and app need. The SVG geometry lives here, once, so the variants cannot
drift apart. Run from the repo root:

    python3 landing/scripts/build-brand.py

Needs `rsvg-convert` (brew install librsvg) for the PNGs and the .ico.
Outputs to landing/public/brand/, landing/app/ and frontend/.
"""
import shutil
import struct
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BRAND = ROOT / "landing" / "public" / "brand"

TERRA = "#9C5A42"
TERRA_TINT = "#E8D5CC"
INK = "#2C2520"
CANVAS = "#F5F0EB"


def mark_group(disc: str, detail: str) -> str:
    """The mark's shapes on a 120 box: disc, fine inner ring, check."""
    return f"""<circle cx="60" cy="60" r="60" fill="{disc}"/>
  <circle cx="60" cy="60" r="49" fill="none" stroke="{detail}" stroke-width="1.4" stroke-opacity="0.5"/>
  <path d="M46.5 61 L56.3 71 L74.7 49" fill="none" stroke="{detail}" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/>"""


def mono_group(color: str, mask_id: str = "cut") -> str:
    """One colour: the ring and check are cut out of the disc."""
    return f"""<defs>
    <mask id="{mask_id}">
      <rect width="120" height="120" fill="#fff"/>
      <circle cx="60" cy="60" r="49" fill="none" stroke="#000" stroke-width="1.4" stroke-opacity="0.5"/>
      <path d="M46.5 61 L56.3 71 L74.7 49" fill="none" stroke="#000" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/>
    </mask>
  </defs>
  <circle cx="60" cy="60" r="60" fill="{color}" mask="url(#{mask_id})"/>"""


def mark(disc: str, detail: str) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="Sealpost">
  {mark_group(disc, detail)}
</svg>
"""


def mark_mono(color: str) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="Sealpost">
  {mono_group(color)}
</svg>
"""


# At 16 to 32px the fine ring turns to mud, so the favicon drops it and
# thickens the check.
FAVICON = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Sealpost">
  <circle cx="16" cy="16" r="16" fill="{TERRA}"/>
  <path d="M9.4 16.8 L14 21.4 L22.6 11" fill="none" stroke="{CANVAS}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
"""

# Full-bleed square for the OS to mask: the mark sits at 60% so rounded and
# circular masks never clip it.
APP_ICON = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Sealpost">
  <rect width="512" height="512" fill="{CANVAS}"/>
  <g transform="translate(106 106) scale(2.5)">
    <circle cx="60" cy="60" r="60" fill="{TERRA}"/>
    <circle cx="60" cy="60" r="49" fill="none" stroke="{CANVAS}" stroke-width="1.4" stroke-opacity="0.5"/>
    <path d="M46.5 61 L56.3 71 L74.7 49" fill="none" stroke="{CANVAS}" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>
"""


def png(svg: Path, out: Path, size: int) -> None:
    subprocess.run(
        ["rsvg-convert", "-w", str(size), "-h", str(size), "-o", str(out), str(svg)],
        check=True,
    )


def ico(pngs: list[Path], out: Path) -> None:
    """Pack PNG frames into an .ico (PNG-in-ICO is valid and universally read)."""
    frames = [(int.from_bytes(p.read_bytes()[16:20], "big"), p.read_bytes()) for p in pngs]
    header = struct.pack("<HHH", 0, 1, len(frames))
    offset = 6 + 16 * len(frames)
    entries, blobs = b"", b""
    for size, data in frames:
        w = 0 if size >= 256 else size
        entries += struct.pack("<BBBBHHII", w, w, 0, 0, 1, 32, len(data), offset)
        blobs += data
        offset += len(data)
    out.write_bytes(header + entries + blobs)


def main() -> None:
    BRAND.mkdir(parents=True, exist_ok=True)
    files = {
        "mark-light.svg": mark(TERRA, CANVAS),        # for light backgrounds
        "mark-dark.svg": mark(TERRA_TINT, INK),       # for dark backgrounds
        "mark-mono-ink.svg": mark_mono(INK),
        "mark-mono-cream.svg": mark_mono(CANVAS),
        "favicon.svg": FAVICON,
        "app-icon.svg": APP_ICON,
    }
    for name, svg in files.items():
        (BRAND / name).write_text(svg)

    png(BRAND / "app-icon.svg", BRAND / "apple-touch-icon.png", 180)
    png(BRAND / "app-icon.svg", BRAND / "icon-192.png", 192)
    png(BRAND / "app-icon.svg", BRAND / "icon-512.png", 512)

    with tempfile.TemporaryDirectory() as tmp:
        frames = []
        for size in (16, 32, 48):
            p = Path(tmp) / f"f{size}.png"
            png(BRAND / "favicon.svg", p, size)
            frames.append(p)
        ico(frames, BRAND / "favicon.ico")

    # Next picks these up by filename: app/icon.svg, app/favicon.ico, app/apple-icon.png.
    for app_dir in (ROOT / "landing" / "app", ROOT / "frontend" / "app"):
        shutil.copy(BRAND / "favicon.svg", app_dir / "icon.svg")
        shutil.copy(BRAND / "favicon.ico", app_dir / "favicon.ico")
        shutil.copy(BRAND / "apple-touch-icon.png", app_dir / "apple-icon.png")

    print("wrote", ", ".join(sorted(p.name for p in BRAND.iterdir())))


if __name__ == "__main__":
    main()
