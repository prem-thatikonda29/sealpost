#!/usr/bin/env python3
"""
Populate backend/typefaces/ with the curated font library.

One-time, developer-run. The downloaded files are committed, so the app itself
never touches the network — a bulk send job can't fail because a font couldn't
be fetched.

Run from the repo root:

    python3 backend/scripts/fetch_typefaces.py

Re-run after editing FAMILIES to add a family. Existing files are skipped unless
--force is passed.

How it gets static TTFs: the Google Fonts CSS API picks a format from the
User-Agent. Browsers get woff2, which Pillow cannot read. Python's default
urllib User-Agent gets `format('truetype')` with direct .ttf URLs — verify that
holds before trusting a silent change:

    curl -s 'https://fonts.googleapis.com/css2?family=Inter:wght@400' \
      -H 'User-Agent: Python-urllib/3.12' | grep format

Files land under the names cert_engine._load_font expects for style lookup
(`Inter-Bold.ttf` beside bare `Inter.ttf`), so bold and italic resolve to real
files rather than being silently downgraded to the regular weight. Each family
also gets its OFL.txt, because the binaries are redistributed in this repo and
both the OFL and Apache-2.0 require the license to travel with the font.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import quote_plus

# ── The curated library ───────────────────────────────────────────────────────
# Faces are (italic, weight) pairs, in the order the CSS2 API requires: ital
# first, and tuples sorted ascending. A family with no italic axis omits them.

SERIF = "Serif"
SANS = "Sans"
DISPLAY = "Display"

FAMILIES: list[dict] = [
    # Formal serifs — the default voice of a certificate.
    {"id": "playfair-display", "label": "Playfair Display", "category": SERIF,
     "gf": "Playfair Display", "faces": [(0, 400), (0, 700), (1, 400)]},
    {"id": "merriweather", "label": "Merriweather", "category": SERIF,
     "gf": "Merriweather", "faces": [(0, 400), (0, 700), (1, 400)]},
    {"id": "lora", "label": "Lora", "category": SERIF,
     "gf": "Lora", "faces": [(0, 400), (0, 700), (1, 400)]},
    {"id": "eb-garamond", "label": "EB Garamond", "category": SERIF,
     "gf": "EB Garamond", "faces": [(0, 400), (0, 700), (1, 400)]},
    {"id": "libre-baskerville", "label": "Libre Baskerville", "category": SERIF,
     "gf": "Libre Baskerville", "faces": [(0, 400), (0, 700), (1, 400)]},
    {"id": "cormorant-garamond", "label": "Cormorant Garamond", "category": SERIF,
     "gf": "Cormorant Garamond", "faces": [(0, 400), (0, 700), (1, 400)]},

    # Clean sans — modern, informal, and event-branded certificates.
    {"id": "inter", "label": "Inter", "category": SANS,
     "gf": "Inter", "faces": [(0, 400), (0, 700), (1, 400)]},
    {"id": "roboto", "label": "Roboto", "category": SANS,
     "gf": "Roboto", "faces": [(0, 400), (0, 700), (1, 400)]},
    {"id": "lato", "label": "Lato", "category": SANS,
     "gf": "Lato", "faces": [(0, 400), (0, 700), (1, 400)]},
    {"id": "montserrat", "label": "Montserrat", "category": SANS,
     "gf": "Montserrat", "faces": [(0, 400), (0, 700), (1, 400)]},
    {"id": "open-sans", "label": "Open Sans", "category": SANS,
     "gf": "Open Sans", "faces": [(0, 400), (0, 700), (1, 400)]},
    {"id": "source-sans-3", "label": "Source Sans 3", "category": SANS,
     "gf": "Source Sans 3", "faces": [(0, 400), (0, 700), (1, 400)]},

    # Display — a name set in these reads as a title, not a label.
    {"id": "oswald", "label": "Oswald", "category": DISPLAY,
     "gf": "Oswald", "faces": [(0, 400), (0, 700)]},  # no italic published
    {"id": "josefin-sans", "label": "Josefin Sans", "category": DISPLAY,
     "gf": "Josefin Sans", "faces": [(0, 400), (0, 700), (1, 400)]},
]

TYPE_DIR = Path(__file__).resolve().parent.parent / "typefaces"
MANIFEST = TYPE_DIR / "manifest.json"
CSS_API = "https://fonts.googleapis.com/css2"
UA = "Python-urllib/3.12"  # the UA that yields truetype rather than woff2

# Licenses live in the google/fonts repo, in a directory named for the license
# rather than the family, so the family slug is what varies. Every family here
# is OFL; the apache fallback is for families added later.
LICENSE_BASE = "https://raw.githubusercontent.com/google/fonts/main"
LICENSE_PATHS = (
    ("ofl", "OFL.txt", "OFL-1.1"),
    ("apache", "LICENSE.txt", "Apache-2.0"),
)


def css_url(family: dict) -> str:
    """Build a CSS2 URL for the family's faces, or a plain one when there's no italic axis."""
    faces = family["faces"]
    has_italic = any(i for i, _ in faces)
    # The tuple shape differs per axis list: with ital you send "ital,wght@0,400",
    # without it you send "wght@400". Sending the ital tuple to a family that has
    # no italic axis is a 400 from the API, not a fallback.
    if has_italic:
        spec = ";".join(f"{i},{w}" for i, w in faces)
        axes = "ital,wght"
    else:
        spec = ";".join(str(w) for _, w in faces)
        axes = "wght"
    # Family names contain spaces ("EB Garamond"); they must be encoded or
    # http.client rejects the request path outright.
    name = quote_plus(family["gf"])
    return f"{CSS_API}?family={name}:{axes}@{spec}"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def parse_css(css: str) -> list[tuple[int, int, str]]:
    """Pull (italic, weight, ttf_url) out of the @font-face blocks."""
    out = []
    for block in re.findall(r"@font-face\s*\{(.*?)\}", css, re.S):
        style = re.search(r"font-style:\s*(\w+)", block)
        weight = re.search(r"font-weight:\s*(\d+)", block)
        url = re.search(r"url\((https://[^)]+\.ttf)\)", block)
        if not (style and weight and url):
            continue
        out.append((1 if style.group(1) == "italic" else 0, int(weight.group(1)), url.group(1)))
    return out


def face_filename(family_label: str, italic: int, weight: int) -> str:
    """Inter.ttf / Inter-Bold.ttf / Inter-Italic.ttf / Inter-BoldItalic.ttf.

    These names are load-bearing. cert_engine._load_font takes the regular
    file's *stem* ("Inter") and probes for `{stem}-Bold{ext}` and
    `{stem}-Italic{ext}` beside it. Naming the regular face
    "Inter-Regular.ttf" would make every probe miss and bold would silently
    render as regular — so the regular face carries the bare family name and
    the variants hang off it.
    """
    slug = family_label.replace(" ", "")
    if weight == 400 and not italic:
        return f"{slug}.ttf"
    stem = {400: "", 700: "Bold"}.get(weight, str(weight))
    return f"{slug}-{stem}{'Italic' if italic else ''}.ttf"


def fetch_license(family: dict, dest_dir: Path, force: bool) -> str | None:
    """Save the family's license beside its faces; return its SPDX id.

    Not a nicety: these binaries are redistributed inside this repo, and both
    the OFL and Apache-2.0 require the license text to ship with the font. A
    family whose license can't be fetched is reported as a failure alongside the
    ones whose faces didn't download.
    """
    slug = family["id"].replace("-", "")
    for directory, filename, spdx in LICENSE_PATHS:
        dest = dest_dir / filename
        if dest.exists() and not force:
            return spdx
        try:
            body = fetch(f"{LICENSE_BASE}/{directory}/{slug}/{filename}")
        except (urllib.error.URLError, OSError):
            continue
        if body:
            dest.write_bytes(body)
            return spdx
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--force", action="store_true", help="re-download files that already exist")
    args = ap.parse_args()

    TYPE_DIR.mkdir(parents=True, exist_ok=True)
    manifest = []
    failures = []

    for family in FAMILIES:
        slug = family["id"]
        out_dir = TYPE_DIR / slug
        out_dir.mkdir(parents=True, exist_ok=True)

        print(f"\n{family['label']}  ({family['category']})")
        try:
            faces = parse_css(fetch(css_url(family)).decode("utf-8"))
        except (urllib.error.URLError, OSError) as exc:
            print(f"  ! could not fetch CSS: {exc}")
            failures.append(family["label"])
            continue

        if not faces:
            print("  ! no truetype faces in the CSS response — the API may have changed format")
            failures.append(family["label"])
            continue

        written: dict[tuple[int, int], str] = {}
        for italic, weight, url in faces:
            name = face_filename(family["label"], italic, weight)
            dest = out_dir / name
            written[(italic, weight)] = name

            if dest.exists() and not args.force:
                print(f"  = {name} (exists, {dest.stat().st_size // 1024}KB)")
                continue
            try:
                dest.write_bytes(fetch(url))
            except (urllib.error.URLError, OSError) as exc:
                print(f"  ! {name}: {exc}")
                failures.append(f"{family['label']} {name}")
                continue
            print(f"  + {name} ({dest.stat().st_size // 1024}KB)")

        # The regular face is what an event's font_path points at; the others are
        # found by suffix. A family is only usable if the regular face landed.
        regular = written.get((0, 400))
        if not regular or not (out_dir / regular).exists():
            print("  ! no regular face — family skipped")
            failures.append(family["label"])
            continue

        license_id = fetch_license(family, out_dir, args.force)
        if license_id:
            print(f"  + {license_id} license")
        else:
            print("  ! could not fetch the license text")
            failures.append(f"{family['label']} license")

        manifest.append({
            "id": slug,
            "label": family["label"],
            "category": family["category"],
            "google_family": family["gf"],
            "path": f"backend/typefaces/{slug}/{regular}",
            "has_bold": (0, 700) in written and (out_dir / written[(0, 700)]).exists(),
            "has_italic": (1, 400) in written and (out_dir / written[(1, 400)]).exists(),
            "license": license_id,
        })

    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")

    total = sum(f.stat().st_size for f in TYPE_DIR.rglob("*.ttf"))
    print(f"\n{len(manifest)} families · {total / 1_048_576:.1f}MB · {MANIFEST.relative_to(TYPE_DIR.parent.parent)}")
    if failures:
        print(f"failed: {', '.join(failures)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
