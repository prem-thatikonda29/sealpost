# Setup Guide: README + Landing Page Refresh

**Date:** 2026-09-30
**Status:** Approved

## Problem

The application moved from a Python CLI (`run.py`, `config.py`, `data/*.csv`) to a web app (FastAPI backend + Next.js frontend, started with `start.sh`, configured via `.env`). Recent commits extended it further (canvas editor, tier checklist, column mapping, re-send, generate-all-and-download, font library, job deletion).

Two surfaces still describe the dead CLI:

- **Landing page** (`landing/`): Hero eyebrow says "CLI Tool"; Quickstart shows `pip install -r requirements.txt` (no such file), `EMAIL`/`PASSWORD` env vars (wrong names), and `python run.py winner` (doesn't exist); HowItWorks walks through `data/` + `templates/` dirs and `python run.py`; Configuration documents `config.py`.
- **Root README**: Setup section is roughly correct but the Features list and API endpoint table lag recent commits.

## Goal

One canonical setup guide — the current web-app flow — shown on both surfaces.

```
git clone https://github.com/prem-thatikonda29/Certificates-Sender.git && cd Certificates-Sender
cp .env.example .env            # GMAIL_USER, GMAIL_APP_PASSWORD
pip install -r backend/requirements.txt
cd frontend && npm install && cd ..
bash start.sh                   # backend :8000, frontend :3000
# open http://localhost:3000
```

## Decisions

1. **Source of truth:** the current web-app flow above, written fresh, verified against `.env.example`, `backend/requirements.txt`, and `start.sh`.
2. **Scope — landing:** all four CLI-era sections (Hero, HowItWorks, Quickstart, Configuration), plus factual fixes in Features.
3. **Scope — README:** Setup/Running/First-time flow, Features list, API table.
4. **Sync strategy:** hand-synced mirror. Both are hand-written; no shared source file or build step.

## Approach

**In-place content refresh (Approach A).** Every landing section keeps its ID, sidebar/mobile-nav entry, layout, components, and styling. Only content changes. No new design decisions on the landing — `PRODUCT.md` designates it the source of visual identity, so structural edits are riskier than content swaps. Rejected: consolidating Quickstart + Configuration into one "Setup" section (changes anchor IDs, removes a section the committed brand design has).

---

## Part 1 — Root README.md

### Features (rewrite, 8 bullets)

- Visual name placement — Figma-style canvas editor with live text overlay and marked max-text-width guides
- Tier checklist — per-tier CSV upload on the Run page, with column mapping; names-only CSVs and split name columns supported
- Email pre-validation — DNS MX check plus a duplicate warning before a single email goes out
- Live per-row progress — sent / failed / invalid domain statuses update in real time; bounce detection polls Gmail for NDRs
- Re-send — retry only the rows that missed out, with a message you can rewrite; warn before re-sending to people who already have it
- Generate all and download — dry run that actually generates, downloaded as a zip
- Job history — per-row status, CSV export, delete a job or clear the history
- Bundled font library — pick from bundled fonts or upload your own

### Prerequisites / Setup

Unchanged in shape, verified accurate: Python 3.11+, Node 20+, `cp .env.example .env`, `pip install -r backend/requirements.txt`, `cd frontend && npm install`. One fix: the clone block currently reads `git clone <repo-url>` / `cd cert-sender` — use the real URL (`Certificates-Sender.git`) and `cd Certificates-Sender` to match it, so the guide is copy-pasteable. This clone line is the mirrored line in the landing Quickstart.

### Running / First-time flow

Refresh to the actual UI path:

1. `bash start.sh` → backend `http://localhost:8000`, frontend `http://localhost:3000`
2. **Events → New Event** — upload template image, click to place the name, choose font, write email subject/body
3. **Run** — check tiers, upload per-tier CSVs, map columns, optionally validate emails, start
4. Watch live progress — per-row status updates in real time; bounce check follows
5. **History** — per-row status, re-send failures, export CSV, delete job or clear history

### API table

Bring to parity with `backend/routers/`:

| Endpoint | Description |
|---|---|
| `GET /api/events` | List all saved events |
| `POST /api/events` | Create event |
| `GET /api/events/{id}` | Get one event |
| `PUT /api/events/{id}` | Update event |
| `DELETE /api/events/{id}` | Delete event |
| `POST /api/templates/upload` | Upload a template image |
| `GET /api/templates/{id}` | Get template |
| `GET /api/fonts` | List bundled fonts |
| `POST /api/fonts/upload` | Upload a font |
| `GET /api/fonts/{id}/file` | Font file |
| `POST /api/preview` | Render sample certificate → PNG |
| `POST /api/jobs` | Start a job (multipart: config JSON + CSV) |
| `POST /api/jobs/validate-emails` | Validate email domains before sending |
| `POST /api/jobs/check-duplicates` | Warn about people who already have the certificate |
| `GET /api/jobs` | List all past jobs |
| `GET /api/jobs/{id}` | Get one job |
| `GET /api/jobs/{id}/progress` | SSE stream of real-time row progress |
| `GET /api/jobs/{id}/download` | Download generated certificates (zip) |
| `DELETE /api/jobs/{id}` | Delete a job |
| `DELETE /api/jobs` | Clear history |

---

## Part 2 — Landing page

Same section IDs (`#hero`, `#features`, `#how-it-works`, `#quickstart`, `#configuration`), same Sidebar/MobileNav/Footer entries, same layout and components. Content only.

### Hero.tsx

- Eyebrow: `CLI Tool` → `Web app`
- Subhead: "Built-in resume tracking and batch control." → "Place names visually, upload a CSV, and watch every send land — or fail — in real time."
- CTA anchors and GitHub link unchanged.

### HowItWorks.tsx

Three steps become the browser flow:

1. **Create an event** — upload a template, click to place the name, pick a font, write the email
2. **Upload & map your CSV** — per-tier CSVs, column mapping; names-only CSVs work
3. **Send and watch** — live per-row status, bounce detection, re-send the failures

The `python run.py winner` terminal block is replaced by a failure-diagnostic block in the same card style, labelled `history · when a row doesn't go through`. It teaches the three failure statuses before the reader ever hits one: `invalid` (caught before the send, nothing went out), `failed` (SMTP refused, retry from History), `bounced` (NDR arrived, re-send after fixing), closed by `573 sent · 15 need attention · re-send targets just those 15`. It carries real information rather than a decorative send log. No `$` prompt, no fake window chrome — **not terminal cosplay**; `PRODUCT.md` explicitly bans dressing the tool up as a CLI.

### Quickstart.tsx — the new setup guide

Mirrors the README:

- **Install** — `git clone https://github.com/prem-thatikonda29/Certificates-Sender.git`, `cd Certificates-Sender`, `pip install -r backend/requirements.txt`, `cd frontend && npm install`
- **Configuration** — `.env` with `GMAIL_USER=...` and `GMAIL_APP_PASSWORD=...` (keep the existing inline-code treatment of `.env`)
- **Run** — `bash start.sh`, then open `http://localhost:3000`; note backend `:8000`

The `python run.py …` usage block is replaced by the start output / next-step instruction.

### Configuration.tsx

`config.py` + `data/*.csv` table becomes "where things are configured now":

| Where | What |
|---|---|
| `.env` | Gmail credentials (`GMAIL_USER`, `GMAIL_APP_PASSWORD`) |
| Event | Template, name position, font, email subject/body |
| Tier | CSV, column mapping, per-tier email overrides |

Same table + code-block components. The `config.py` example block becomes a `.env` block.

### Features.tsx — factual fixes only

- **Resume Support** ("Interrupt and restart anytime") → **Re-send Failures** — "Retry only the rows that missed out, with a message you can rewrite"
- **Dry Run Mode** → **Generate & Download** — "Produce every certificate and download the zip without sending an email"
- Unchanged: Batch Generation, Email Delivery, Custom Templates, Rate Control (all still true — `dry_run` and `batch_size` exist in `backend/job_runner.py`)

---

## Verification

1. `npm run build` and `npm run lint` in `landing/`
2. README commands match `.env.example`, `backend/requirements.txt`, `start.sh`
3. Every API row in the README matches a real route in `backend/routers/`
4. No landing anchor IDs, sidebar entries, or component structure changed (diff shows content-only)

## Out of scope

- `frontend/README.md` and `landing/README.md` (stock create-next-app boilerplate)
- Landing visual/design changes
- Backend or frontend application code
