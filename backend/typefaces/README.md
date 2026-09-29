# Bundled typefaces

The font library the app ships with. Committed binaries — nothing here is
fetched at runtime, so a send job can never fail because a font was unreachable.

Each directory holds one family's static faces plus its license:

```
inter/
  Inter.ttf            ← the regular face; font_path points at this
  Inter-Bold.ttf
  Inter-Italic.ttf
  OFL.txt
```

## The file names are load-bearing

`cert_engine._load_font` takes the `font_path`'s **stem** and probes for
`{stem}-Bold{ext}` and `{stem}-Italic{ext}` beside it. So the regular face
carries the bare family name and the variants hang off it.

Naming the regular face `Inter-Regular.ttf` would make every probe miss, and
bold would silently render as the regular weight — which is the exact bug this
library exists to fix. `manifest.json` records what actually landed, and
`fonts_catalog.py` re-checks it against the files on disk, so a family with a
missing variant loses that option in the UI rather than failing at render time.

## Adding a family

Edit `FAMILIES` in `../scripts/fetch_typefaces.py` and run it from the repo
root:

```bash
python3 backend/scripts/fetch_typefaces.py           # skips files already present
python3 backend/scripts/fetch_typefaces.py --force   # re-downloads everything
```

It downloads the static TTFs, saves each family's license, and rewrites
`manifest.json`. Commit the result.

## Provenance

All families come from [google/fonts](https://github.com/google/fonts) and are
licensed under the SIL Open Font License 1.1, which permits redistribution. The
license text sits beside each family's faces; `manifest.json` records the SPDX
id per family. Source family names are in the manifest's `google_family` field.
