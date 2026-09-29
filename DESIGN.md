# Design

Visual system for `frontend/`. Derived from the committed brand in `landing/` — palette, type families, and geometry are inherited, not invented. Where a landing token fails WCAG AA in this denser context, the repair is recorded below.

## Theme

**Light only.** The landing page is light-only and the two surfaces must read as one product. The `.dark` token block and the `@custom-variant dark` selector have been removed from `frontend/app/globals.css`; there is no theme toggle in the app and no dark pass has been verified. If dark mode is ever wanted, it needs a real design pass over the warm ramp — not a mechanical inversion.

Physical scene, for the record: an organizer at a laptop, mid-event, in a bright room, checking whether 800 emails went out. Light surface, calm, high legibility.

**Color strategy: Restrained.** Tinted warm neutrals carry the surface; the four accents appear only as status indicators and small category marks, well under 10% of any screen.

## Color

Base ramps are inherited verbatim from `landing/app/globals.css`. Semantic app tokens map onto them.

### Brand palette (as authored in `landing/`)

| Token | Value | Role |
|---|---|---|
| `canvas` | `#F5F0EB` | page ground |
| `surface` | `#FDFBF9` | cards, panels, popovers |
| `surface-raised` | `#FAF7F4` | card hover |
| `border` | `#E5DED5` | 1px hairlines |
| `border-hover` | `#C9BFB3` | border on hover |
| `text` | `#2C2520` | primary ink |
| `text-muted` | `#8A7E74` | ⚠️ repaired → `#6E6258` |
| `text-faint` | `#B5AAA0` | ⚠️ collapsed into `text-muted` |
| `terra` / text | `#E8D5CC` / `#9C5A42` | ⚠️ text repaired → `#8A4A33` |
| `sage` / text | `#D9E2D4` / `#4A6340` | passes as authored |
| `amber` / text | `#F0E4CC` / `#8A6B2A` | ⚠️ text repaired → `#7A5C1E` |
| `rose` / text | `#EADADD` / `#8A4A5C` | passes as authored |

### Contrast repairs

Measured against `canvas` `#F5F0EB`. The landing's soft values are correct at landing type sizes (18px+, large/loose) and fail at app type sizes (11–14px, dense).

| Landing value | Measured | Repaired | Measured | Note |
|---|---|---|---|---|
| `text-muted` `#8A7E74` | 3.49 | `#6E6258` | **5.22** | same hue ramp, darker. Used for all secondary body text, metadata, and labels |
| `text-faint` `#B5AAA0` | 2.01 | *collapsed* | — | no value on this ramp clears 4.5:1 while still reading as "fainter than muted", so the third level was dropped. The label register distinguishes itself by family, case, and tracking instead — see below |
| terra text `#9C5A42` | 3.75 on tint | `#8A4A33` | **4.77** on tint | terra badges are small text |
| amber text `#8A6B2A` | 3.95 on tint | `#7A5C1E` | **4.94** on tint | amber badges are small text |

Sage `#4A6340` (5.01 on tint) and rose `#8A4A5C` (4.84 on tint) already pass and are unchanged. Hue is preserved throughout — every repaired value sits on the original ramp, so the palette still reads as the landing's.

### App semantic tokens

`frontend/app/globals.css` keeps shadcn's variable names so the `ui/` primitives keep working, with values remapped:

| Token | Value | Contrast | Maps to |
|---|---|---|---|
| `--background` | `#F5F0EB` | — | canvas |
| `--foreground` | `#2C2520` | 13.32 | text |
| `--card`, `--popover` | `#FDFBF9` | — | surface |
| `--card-foreground` | `#2C2520` | 14.61 | text on surface |
| `--muted` | `#EDE6DE` | 1.09 vs canvas | table headers, subtle bands |
| `--muted-foreground` | `#6E6258` | 5.22 canvas / 4.78 on `--muted` | repaired muted — the only secondary text token |
| `--border`, `--input` | `#E5DED5` | — | hairline |
| `--primary` | `#2C2520` | 13.32 vs its foreground | dark ink button, as the landing's CTA |
| `--primary-foreground` | `#F5F0EB` | — | canvas |
| `--secondary`, `--accent` | `#FAF7F4` | — | surface-raised |
| `--ring` | `#9C5A42` | 4.69 vs canvas | terra focus ring — visible, on-brand |
| `--destructive` | `#8A4A5C` | 5.77 vs canvas | rose text; tint `#EADADD` |

### Status vocabulary

One fixed mapping, used identically on every screen (dashboard, progress log, job detail, CSV validation). No page may improvise its own green.

| Semantic | Accent | Fill | Text |
|---|---|---|---|
| success / sent / done / valid | sage | `#D9E2D4` | `#4A6340` |
| in progress / running | amber | `#F0E4CC` | `#7A5C1E` |
| invalid / warning | amber | `#F0E4CC` | `#7A5C1E` |
| bounced | terra | `#E8D5CC` | `#8A4A33` |
| failed / error / destructive | rose | `#EADADD` | `#8A4A5C` |
| pending / skipped / dry run | neutral | `#EDE6DE` | `#6E6258` |

Selection: `::selection` uses terra fill with terra text, as the landing does.

## Typography

Three families, matching the landing exactly. Loaded via `next/font/google` in `frontend/app/layout.tsx`.

- **Newsreader** (`--font-serif`) — display voice. Page titles and the app wordmark **only**.
- **Geist** (`--font-sans`) — everything else: body, labels, buttons, card titles, table cells.
- **Geist Mono** (`--font-mono`) — the *label register* and all machine data: field labels, table column headers, email addresses, coordinates, hex colors, numeric counts.

### The serif boundary

This is the rule that keeps the app a tool. Newsreader may appear on:

- the wordmark in the top nav
- `<h1>` page titles (`Events`, `Run`, `History`, `New Event`)

Newsreader must **never** appear on: buttons, form labels, table headers, status badges, card titles, numeric data, or body copy. The landing's serif is a display voice; the product-register ban on display fonts in UI is not overridden by the match request.

### Roles

| Role | Family | Size | Weight | Tracking |
|---|---|---|---|---|
| Wordmark | serif | 15px | 400 | `-0.02em` |
| Page title (h1) | serif | 26px | 400 | `-0.02em` |
| Page subtitle | sans | 13px | 400 | — |
| Card title | sans | 14px | 600 | — |
| Body / table cell | sans | 13px | 400 | — |
| **Field label** | mono | 11px | 500 | `0.12em` uppercase |
| **Table column head** | mono | 11px | 500 | `0.12em` uppercase |
| Mono data (email, coords, hex) | mono | 12px | 400 | — |
| Nav item | sans | 13px | 500 | — |

Fixed rem scale, no `clamp()`. Product UI is viewed at consistent DPI and the density is deliberate. The landing's fluid `text-5xl md:text-6xl lg:text-7xl` hero has no analogue here.

Metrics kept from the landing: `text-wrap: balance` on headings, `text-wrap: pretty` on prose, line length capped ~68ch for prose (tables may run wider).

### The certificate typeface

The three families above dress the **app**. The certificate's name is set in a fourth face the user picks, and that is a separate axis — the serif boundary says nothing about it. Someone issuing an award may set it in Cormorant or Oswald without that leaking one glyph into the interface.

14 families ship in `backend/typefaces/` (6 serif, 6 sans, 2 display), committed as real `.ttf` binaries with their OFL license text. Nothing is fetched at runtime: a send job must not be able to fail because a font was unreachable. `backend/scripts/fetch_typefaces.py` is the one-time, developer-run tool that populates the directory; adding a family is an edit to its `FAMILIES` list.

Three rules hold this together:

- **One identifier.** `font_path` is a repo-root-relative path string, and it means the same thing for a vendored family, an uploaded file, and the PDF renderer. No format branching anywhere.
- **The file names are load-bearing.** `cert_engine._load_font` finds a bold or italic face by probing for a sibling named after the regular face's *stem* — so the regular face carries the bare family name (`Inter.ttf`) and variants hang off it (`Inter-Bold.ttf`). Naming it `Inter-Regular.ttf` makes every probe miss and silently renders bold as regular. The picker only offers styles the family actually has files for, so the Style buttons and the PDF cannot disagree.
- **The canvas mirrors the fit.** `fit_font` shrinks the name by 2px steps to a floor of 10 until it fits `max_text_width`. `lib/fonts.ts` reimplements that against an offscreen 2D context, measuring *ink* width (`actualBoundingBoxLeft + actualBoundingBoxRight`) the way Pillow's `getbbox` does — advance width differs by a few pixels that grow with size. Without this the canvas draws an un-fitted name that overflows while the PDF shrinks it.

The canvas is the browser's text engine and the PDF is Pillow's, so they can be close but never identical. The canvas is therefore presented as an approximation, and "Check exact output" mounts `CertPreview` for the server's own render.

## Geometry

- **Radius: 4px.** The landing's signature is a sharp corner. `--radius: 0.25rem`, and the primitives' `rounded-lg` / `rounded-xl` derive from it. Badges are 3px, not pills — the landing has no pill shapes.
- **Borders: 1px hairlines everywhere.** No shadows on cards; the landing uses border + surface contrast instead. Popovers and dialogs are the exception (they float, so they get `ring-1` plus a shadow).
- **The hairline grid device.** The landing's `grid gap-px bg-border border border-border` — cells separated by 1px lines rather than gutters — carries the events grid and stat rows. It is the single most recognizable structural element of the brand and is used deliberately, not everywhere.
- **Elevation**: two steps, mapped to Tailwind's standard `z` so no raw values appear in markup — `z-30` for the sticky nav, and `z-50` for everything that portals to the top layer (select popups, dialog overlay and content, toasts). Portaled content must clear the nav *and* any dialog beneath it, so it shares one step rather than nesting. Never `z-999`.

## Motion

Product cadence, 150–250ms. The landing's scroll-reveal choreography is **not** ported — page-load orchestration is a product-register ban, and the app loads into a task.

- Easing: `--ease-out-quart` = `cubic-bezier(0.16, 1, 0.3, 1)`, inherited from the landing, applied where motion is authored by hand — the tier disclosure and the progress bar. Hover color transitions keep the default ease at 150ms; the curve doesn't read at that length.
- Hover: 150ms on `background-color`, `border-color`, `color`.
- Press: `active:scale-[0.98]` on buttons, as the landing's CTAs.
- Disclosure: the tier config panel and CSV mapping reveal with a 200ms opacity + 4px rise. This is state, not decoration.
- Progress: the bar transitions width at 200ms; the live row log appends without animation so the eye can track new rows.
- **Nothing animates on mount.** No entrance animations, no stagger, no reveals. Content is present and visible on first paint.
- All of the above collapse under `@media (prefers-reduced-motion: reduce)`.

## Components

Every interactive component ships default / hover / focus-visible / active / disabled. Loading where it applies.

| Component | Treatment |
|---|---|
| Button, primary | `#2C2520` fill, canvas text, terra focus ring, 4px radius |
| Button, outline | hairline border, surface fill, `border-hover` + `surface-raised` on hover |
| Button, ghost | no border, `surface-raised` on hover |
| Button, destructive | rose text on rose tint |
| Input / Textarea / Select | hairline border, surface fill, terra focus ring |
| Checkbox | 4px radius, ink fill when checked |
| Badge | 3px radius, mono 10px uppercase, tinted fill per the status table |
| Card | surface fill, hairline border. Cards themselves are inert — hover belongs to whatever wraps them when they're clickable |
| Table | mono caps column heads on `--muted`, hairline row dividers, hover row band |
| Progress | 6px track on `--muted`, `sage-ink` fill — the brand tint is too pale to read as a filled bar |
| Dialog | surface, hairline border, 6px radius — the one floating surface allowed to sit rounder than the 4px base. Warm ink scrim at 25%, **no backdrop blur** |
| Toast | surface, hairline border, 13px title |

### Three components that exist to prevent drift

None is a shadcn primitive; each was added because the app had several duplicated implementations of the same decision.

| Component | Treatment |
|---|---|
| `PageHeader` | The *only* place a serif `<h1>` is constructed. Takes `title`, `subtitle`, `actions`. Every page uses it; no page hand-rolls its own title block |
| `StatusBadge` | The *only* place a status string becomes a color. Maps `done`/`running`/`pending`/`failed` and `sent`/`invalid_domain`/`bounced`/`skipped` to the status table above. A screen that hand-rolls its own green is a bug |
| `FontPicker` | The *only* place a font is chosen. Lists every family **rendered in its own face** — the only honest way to pick a typeface — grouped by category, with an upload affordance. Exposes the styles each family can actually render, so the sidebar's Style buttons disable themselves rather than offering a weight the PDF will silently downgrade |

## Layout

- App shell: sticky top nav, `max-w-5xl` content — matches the landing's `max-w-4xl` measure closely enough to feel like one product while giving tables room.
- Responsive behavior is structural: the events grid collapses to one column, the canvas editor's right sidebar becomes a stacked panel below the canvas, `grid-cols-4` stat rows become `grid-cols-2`.
- The canvas editor is the one genuinely two-dimensional surface: free-width canvas + fixed 256px property rail on `lg`, stacked below that.

### The canvas position picker

Two input paths, both first-class. The picker is the one control in the app that isn't a stock form element, so it carries its own interaction contract.

| Input | Behavior |
|---|---|
| Pointer | Click anywhere on the template to place the name there |
| Keyboard | Tab to the canvas, then arrow keys nudge by 1px; Shift+arrow by 10px; Enter or Space places at centre |

Clamped to the template bounds, so a nudge can't push the name off the image — and to `1..max-1` rather than `0..max`. `0` is this app's sentinel for *no position* (the column default is `0,0`, and every "has it been placed?" check tests `> 0`), so clamping to zero would make a nudge to the left edge silently un-place the name instead of sliding it against the border. Arrow keys are consumed while the canvas has focus, so the page doesn't scroll under it.

The overlay text is positioned by `translate(-50%, -50%)` on a `line-height: 1` box, which is what Pillow's `anchor="mm"` approximates. The server previously centred the *ink* box but drew with the default `"la"` (ascender-top) anchor, so the ink landed low by half its own bbox — a font-dependent offset (≈34px for Inter at 48px, 0px for Press Start 2P) that no constant could correct. Both renderers now centre on the advance width and the ascent/descent midline.

The element carries `role="application"`. That is deliberate and load-bearing: screen readers in browse mode capture arrow keys for virtual-cursor navigation, so without it the keyboard path would exist in the DOM and never reach the page. `aria-describedby` points at instructions read on focus, and an `aria-live` region announces each nudge as "x by y pixels" — the same feedback the visible coordinate readout gives a sighted user. Tab leaves the region, so it isn't a mode trap.

Motion: none. The name and the anchor marker track the keyboard exactly as they track the pointer, with no easing — direct manipulation shouldn't lag the input.

#### Check exact output

Beneath the canvas, a `<details>` disclosure mounts `CertPreview`, which POSTs to `/api/preview` and renders the true server-side PNG — same `fit_font` shrink, same Pillow shaping, same face. It is collapsed by default and mounted only once a template and a position exist, so opening it is never a dead end. The canvas above it updates per keystroke with no round-trip; this is the thing you open when the name is nearly right and you want to stop guessing.

## Known gaps

- **Deleting an event uses the browser's native `confirm()`.** It is the one unbranded surface left in the app — it ignores the palette, the type, and the radius, and it renders differently on every platform. Wiring `components/ui/dialog.tsx` into the events list is the fix; that component now has a working precedent to copy, since `FontPicker` is built on it.
- **`components/ui/toast.tsx` and `components/PositionEditor.tsx` are unreferenced.** `toast.tsx` carries the brand treatment and is ready for use. `PositionEditor` is superseded by the inline `CertCanvas` in `EventForm` — one of the two should go.
- **`tests/` does not run.** All five existing modules import the pre-rewrite CLI (`config`, `generate_certs`, `send_certs`, `run`), none of which exist, so `pytest` errors on collection and collects nothing. `tests/test_fonts.py` is the only current suite and must be run by path: `pytest tests/test_fonts.py`. The rest needs deleting or porting to `backend/`.
- **An uploaded font can only render its regular face.** The upload route stores one file under a fresh UUID prefix, so nothing can sit beside it for `_load_font`'s sibling probe to find. Uploading `Inter-Bold.ttf` therefore renders bold for *every* style, including normal. Supporting per-style uploads would mean a multi-file upload and a naming scheme that preserves the stem; until then the picker correctly reports one style.
