# Cert Sender — Web UI Rebuild Plan

## Overview

Replace the existing CLI-only cert-sender tool with a full-stack web application. The new system must:

- Let non-technical staff upload templates and CSVs, position names visually in a browser, and send certificates — no terminal required.
- Fix the core name-positioning problem by replacing the broken Tkinter `find_position.py` tool with a browser canvas-based visual editor that shows a live preview instantly.
- Be agent-friendly: a FastAPI backend exposes clean REST endpoints that a coding agent can call directly without scraping terminal output.
- Run locally with `uvicorn` (backend) and `npm run dev` (frontend); SQLite + local disk for storage.
- Auth and cloud deployment are explicitly out of scope for this phase.

The existing CLI scripts (`run.py`, `generate_certs.py`, `send_certs.py`, `find_position.py`, `generate_test_cert.py`, `clean_ideaframe_data.py`) are **deleted**. `config.py` is replaced by a database-backed Events system.

---

## On Email Bounce Detection

Gmail SMTP does **not** report delivery failures synchronously. The `send()` call succeeds as long as your Gmail account accepted the message — what happens after (bad address, full inbox, domain doesn't exist) is reported asynchronously via a **bounce / NDR email** sent back to the sender address.

The plan implements a two-layer approach:

1. **DNS MX pre-validation** — before sending, check each email's domain has valid MX records using `dnspython`. Catches ~60–70% of bad addresses (wrong domain, typos like `@gmial.com`). These rows are flagged `invalid_domain` and skipped (with a UI warning).
2. **Gmail IMAP bounce polling** — after all sends complete, wait 30 seconds then poll the sender's Gmail inbox via IMAP for NDR emails from `mailer-daemon@googlemail.com`. Match the original recipient address from the NDR body. Update matching `JobRow` records to `bounced`. The SSE stream stays open during this phase so the UI shows a live "Checking for bounces…" indicator.

---

## Architecture

```
cert-sender/
├── backend/
│   ├── main.py            # FastAPI app entry, router registration, CORS
│   ├── database.py        # SQLAlchemy engine, session, Base
│   ├── models.py          # ORM: Event, Job, JobRow
│   ├── schemas.py         # Pydantic request/response shapes
│   ├── cert_engine.py     # Certificate generation (Pillow + img2pdf)
│   ├── mailer.py          # SMTP send + IMAP bounce poll
│   ├── email_validator.py # DNS MX check + format validation
│   ├── job_runner.py      # Background task: validate → generate → send → poll bounces
│   └── routers/
│       ├── events.py      # CRUD saved events
│       ├── templates.py   # Template upload + serve
│       ├── preview.py     # Render sample cert → PNG
│       └── jobs.py        # Create job, SSE progress, history
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx               # Redirect to /events
│   │   ├── events/page.tsx        # Event list
│   │   ├── events/new/page.tsx    # New event editor
│   │   ├── events/[id]/page.tsx   # Edit event editor
│   │   ├── run/page.tsx           # Run a job
│   │   └── history/
│   │       ├── page.tsx           # Job list
│   │       └── [jobId]/page.tsx   # Job detail + row table
│   ├── components/
│   │   ├── ui/                    # shadcn/ui generated components
│   │   ├── PositionEditor.tsx     # Click-to-place name on template image
│   │   ├── CertPreview.tsx        # Live preview via /api/preview
│   │   ├── CsvUploader.tsx        # Upload + column mapping + email pre-validation
│   │   ├── JobProgress.tsx        # SSE progress bar + row log + bounce phase
│   │   └── EventForm.tsx          # Full event config form
│   └── lib/
│       ├── api.ts                 # Typed fetch wrappers for backend
│       └── utils.ts               # shadcn cn() utility
│
├── uploads/               # Template images (runtime)
├── output/                # Generated PDFs (runtime)
├── data.db                # SQLite (runtime)
├── .env                   # GMAIL_USER, GMAIL_APP_PASSWORD
├── .env.example
└── start.sh               # Launches backend + frontend in parallel
```

---

## Sub-Tasks

---

### Sub-Task 1 — Backend Scaffolding

**Status:** [ ] pending

**Intent:**
Set up the FastAPI project with SQLite, ORM models, and a running dev server. Foundation for all other sub-tasks.

**Expected Outcomes:**
- `uvicorn backend.main:app --reload` starts without errors
- `GET /health` returns `{"status": "ok"}`
- `Event`, `Job`, `JobRow` tables auto-created on first run

**Todo List:**
1. Create `backend/requirements.txt`:
   ```
   fastapi
   uvicorn[standard]
   sqlalchemy
   pillow
   img2pdf
   python-dotenv
   aiofiles
   sse-starlette
   dnspython
   ```
2. Create `backend/database.py`: SQLAlchemy engine pointing to `../data.db`, `SessionLocal` factory, `Base = declarative_base()`
3. Create `backend/models.py`:
   - `Event`: id (uuid pk), name, description, template_path, template_natural_width (int), template_natural_height (int), text_position_x (int), text_position_y (int), font_path (nullable str), font_size (int, default 48), font_style (str, default "normal"), font_color (str, default "#000000"), max_text_width (int), email_subject (str), email_body (str), created_at (datetime)
   - `Job`: id (uuid pk), event_id (nullable FK → Event), event_snapshot (JSON str), status (str: pending/running/done/failed), total_rows (int), sent_count (int), failed_count (int), dry_run (bool), created_at (datetime), finished_at (nullable datetime)
   - `JobRow`: id (int pk autoincrement), job_id (FK → Job), row_index (int), name (str), email (str), status (str: pending/sent/failed/skipped/invalid_domain/bounced), error_message (nullable str)
4. Create `backend/schemas.py`: Pydantic models for Event CRUD, Job create/response, JobRow response
5. Create `backend/main.py`: FastAPI app, CORSMiddleware (allow `http://localhost:3000`), `@app.on_event("startup")` creates all tables, stub routers registered, `GET /health`
6. Smoke-test: `uvicorn backend.main:app --reload` starts, `curl http://localhost:8000/health` returns 200

**Relevant Context:**
- Old `config.py` TIERS dict fields map directly to `Event` model columns
- Glass effect fields are intentionally absent — do not add them
- `font_color` stored as CSS hex string (e.g. `"#000000"`) for easy frontend color picker binding

---

### Sub-Task 2 — Core Certificate Engine

**Status:** [ ] pending

**Intent:**
Port certificate generation into a clean, importable module. Remove the glass effect entirely. Add DNS MX validation and Gmail IMAP bounce polling.

**Expected Outcomes:**
- `cert_engine.generate_certificate(...)` produces a PDF at `output_path`
- `email_validator.validate_mx(email)` returns True/False without blocking the event loop
- `mailer.poll_bounces(since_dt)` returns a list of bounced email addresses found in Gmail inbox

**Todo List:**
1. Create `backend/cert_engine.py`:
   - Port `sanitize_name(name) -> str`, `get_first_name(full_name) -> str`, `fit_font(text, font_size, max_width, font_path) -> ImageFont` from old `generate_certs.py`
   - Port `generate_certificate(name, template_path, text_position, font_settings, output_path)`:
     - `text_position`: `(int, int)` tuple
     - `font_settings`: dict with keys `font_path`, `font_size`, `font_style`, `font_color` (hex str), `max_text_width`
     - Parse `font_color` hex → RGB tuple for Pillow `ImageDraw.text(fill=...)`
     - Open template as RGBA, fit font, compute centered position, draw text, convert to RGB, save as temp PNG, convert to PDF via `img2pdf`, clean up PNG
     - **No glass effect code** — delete entirely, do not port
   - All parameters are explicit kwargs, no `tier` dict, no `sys.argv`
2. Create `backend/email_validator.py`:
   - `validate_format(email: str) -> bool`: regex `r'^[^@\s]+@[^@\s]+\.[^@\s]+$'`
   - `validate_mx(email: str) -> bool`: extract domain, `dns.resolver.resolve(domain, 'MX')`, return False on `NXDOMAIN` / `NoAnswer` / `Timeout`
   - Wrap `validate_mx` in `asyncio.get_event_loop().run_in_executor(None, ...)` so it doesn't block
3. Create `backend/mailer.py`:
   - Port `make_smtp_connection() -> smtplib.SMTP`: reads `GMAIL_USER`, `GMAIL_APP_PASSWORD` from env
   - Port `send_certificate(smtp, name, email, pdf_path, subject, body) -> None`: MIME multipart with PDF attachment, `{name}` substituted in body
   - Add `poll_bounces(since_dt: datetime) -> list[str]`:
     - `imaplib.IMAP4_SSL("imap.gmail.com", 993)`, login with same credentials
     - Search: `(FROM "mailer-daemon" SINCE <date>)` + `(SUBJECT "Delivery Status Notification" SINCE <date>)`
     - For each matching message, fetch body, extract email addresses with `re.findall(r'[\w.\-+]+@[\w.\-]+\.\w+', body)`
     - Return deduplicated list of found addresses
4. Create `backend/job_runner.py`:
   - In-memory store: `_queues: dict[str, asyncio.Queue] = {}`
   - `async def run_job(job_id, event_config, csv_rows, dry_run)`:
     - **Phase 1 — Pre-flight**: for each row, run `validate_format` + `validate_mx`; mark `invalid_domain` rows in DB, push `{"type": "row", ..., "status": "invalid_domain"}` to queue
     - **Phase 2 — Generate + Send**: for valid rows, generate cert PDF, send email (or skip if dry_run), update `JobRow` status in DB, push `{"type": "row", ...}` to queue
     - **Phase 3 — Bounce poll**: if not dry_run, push `{"type": "phase", "phase": "bounce_check"}` to queue, `await asyncio.sleep(30)`, call `mailer.poll_bounces(job_start_dt)`, update matching `JobRow` records to `bounced`, push updated rows to queue
     - Push `{"type": "done", "sent": N, "failed": M, "invalid": K, "bounced": B}` sentinel
     - Update `Job.status`, `Job.finished_at`, `Job.sent_count`, `Job.failed_count` in DB

**Relevant Context:**
- Old frosted-glass code: `ImageFilter.GaussianBlur`, RGBA compositing in `generate_certs.py` lines ~50–80 — delete entirely
- `img2pdf` usage: `with open(pdf_path, "wb") as f: f.write(img2pdf.convert(png_path))`
- Gmail App Password works for both SMTP (port 587) and IMAP SSL (port 993)

---

### Sub-Task 3 — Events & Templates API

**Status:** [ ] pending

**Intent:**
REST endpoints for managing saved event configurations and uploading certificate template images.

**Expected Outcomes:**
- Full CRUD on `/api/events`
- Template upload returns dimensions (needed by position editor)
- Template images served back at a stable URL

**Todo List:**
1. Create `backend/routers/templates.py`:
   - `POST /api/templates/upload`: save `UploadFile` to `uploads/{uuid}_{original_filename}`, open with Pillow to read `.size` → `(natural_width, natural_height)`, return `{template_id, url: "/api/templates/{template_id}", natural_width, natural_height}`
   - `GET /api/templates/{template_id}`: `FileResponse(uploads/{template_id}_*)`; glob the uploads dir to find the file by id prefix
2. Create `backend/routers/events.py`:
   - `GET /api/events` → list all, ordered by `created_at` desc
   - `POST /api/events` → create; body includes all Event fields; `save: bool = True` — if false, return the config dict without writing to DB (for one-off runs)
   - `GET /api/events/{id}` → single event or 404
   - `PUT /api/events/{id}` → update fields
   - `DELETE /api/events/{id}` → delete; also delete associated template file if no other event references it
3. Register routers in `main.py`
4. Test: create event, list, update font_size, delete

**Relevant Context:**
- `template_natural_width` / `template_natural_height` stored in `Event` model and returned in template upload response — frontend uses these for the Position Editor back-scaling formula

---

### Sub-Task 4 — Preview & Jobs API

**Status:** [ ] pending

**Intent:**
The live preview endpoint and the job execution + SSE progress stream.

**Expected Outcomes:**
- `POST /api/preview` returns a PNG within ~500ms
- `POST /api/jobs` starts a job and returns `{job_id}` immediately
- SSE stream delivers per-row updates in real time, stays open through bounce poll phase
- `GET /api/validate-emails` validates a list of addresses and returns per-address results

**Todo List:**
1. Create `backend/routers/preview.py`:
   - `POST /api/preview`: body = event config fields + `sample_name: str = "Sample Name"`
   - Call `cert_engine.generate_certificate()` writing to a `tempfile.NamedTemporaryFile` PNG
   - Return `StreamingResponse(open(tmp_path, "rb"), media_type="image/png")`
   - `background_tasks.add_task(os.unlink, tmp_path)` to clean up after response
2. Create `backend/routers/jobs.py`:
   - `GET /api/validate-emails`: body = `{emails: list[str]}`; run format + MX check for each; return `[{email, valid, reason}]`
   - `POST /api/jobs`: accept `multipart/form-data`:
     - `config` field: JSON string with `event_id` (or inline event config), `dry_run: bool`, `batch_size: int`
     - `csv_file`: uploaded CSV file
     - Parse CSV with Python's `csv.DictReader` using mapped `name_col` and `email_col`
     - Create `Job` record (status=pending), create `JobRow` records (status=pending) for each CSV row
     - Initialize `_queues[job_id] = asyncio.Queue()`
     - `background_tasks.add_task(job_runner.run_job, job_id, event_config, rows, dry_run)`
     - Return `{job_id}`
   - `GET /api/jobs/{job_id}/progress`: SSE using `sse_starlette.sse.EventSourceResponse`; read from `_queues[job_id]` until `done` sentinel; yield each item as `data: {json}`
   - `GET /api/jobs/{job_id}`: return Job + all JobRows
   - `GET /api/jobs`: list jobs newest-first
3. Register in `main.py`

**Relevant Context:**
- `sse-starlette` package: `from sse_starlette.sse import EventSourceResponse`
- Generator pattern for SSE: `async def event_gen(): while True: item = await queue.get(); yield {"data": json.dumps(item)}; if item["type"] == "done": break`
- `batch_size = 0` means no limit

---

### Sub-Task 5 — Frontend Scaffolding + Events UI

**Status:** [ ] pending

**Intent:**
Bootstrap the Next.js app with shadcn/ui, build the Events list and Event Editor, covering all configuration fields.

**Expected Outcomes:**
- `npm run dev` starts on port 3000
- `/events` page lists saved events, with New/Edit/Delete actions using shadcn `Card`, `Button`, `Badge`
- Event editor form covers: template upload (with thumbnail), font size, font style, font color, max text width, email subject, email body
- Form validation and submission work end-to-end
- Position field shows current `(x, y)` with an "Edit Position" button (wired in Sub-Task 6)

**Todo List:**
1. Scaffold: `npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir`
2. Init shadcn: `npx shadcn@latest init` (choose default style, slate base color, CSS variables)
3. Add shadcn components used across the app:
   ```
   npx shadcn@latest add button card badge input label textarea select separator toast progress table dialog
   ```
4. Install additional deps: `@tanstack/react-query`, `axios`, `react-hook-form`, `@hookform/resolvers`, `zod`, `papaparse`, `@types/papaparse`
5. Create `frontend/lib/api.ts`: typed `axios` wrappers for all endpoints
6. Create `frontend/lib/utils.ts`: `cn()` utility (shadcn standard)
7. Build `EventForm.tsx`:
   - shadcn `Card` wrapper with `CardHeader` / `CardContent`
   - Template section: `Input type="file"` + shadcn `Button` to trigger, thumbnail preview on upload (calls `POST /api/templates/upload`)
   - Font section: `Input` for font size, shadcn `Select` for font style (normal/bold/italic), `Input type="color"` for font color, `Input` for max text width
   - Email section: `Input` for subject, `Textarea` for body with helper text showing `{name}` placeholder
   - Position section: read-only display of `(x, y)` + shadcn `Button "Edit Position"` (opens dialog — wired in Sub-Task 6)
   - shadcn `toast` for save success/error feedback
8. Build `/events/page.tsx`: `GET /api/events`, render list as shadcn `Card` grid
9. Build `/events/new/page.tsx` and `/events/[id]/page.tsx`
10. Add top nav with shadcn `Separator`, links to Events / Run / History

**Relevant Context:**
- `NEXT_PUBLIC_API_URL=http://localhost:8000` in `frontend/.env.local`
- shadcn components are generated into `frontend/components/ui/` — do not hand-write them
- `@tanstack/react-query` wraps all API calls for loading/error states

---

### Sub-Task 6 — Visual Position Editor

**Status:** [ ] pending

**Intent:**
The browser-based replacement for `find_position.py`. User clicks the template image to set the name center point; a live preview updates instantly. This is the most important UX improvement in the entire rebuild.

**Expected Outcomes:**
- Template image displayed at max 900px width, proportionally scaled
- Crosshair cursor on hover over the image
- Single click sets center point; coordinates back-scaled to original image pixel space
- A red crosshair marker (CSS absolute positioning) shows the current point on the image
- `CertPreview` renders beside it, re-fetching from `POST /api/preview` within ~300ms of any change (debounced)
- Embedded inside a shadcn `Dialog` opened from the "Edit Position" button in `EventForm`
- On "Confirm", the `(x, y)` values flow back into the parent form state

**Todo List:**
1. Create `frontend/components/PositionEditor.tsx`:
   - Props: `templateUrl: string`, `naturalWidth: number`, `naturalHeight: number`, `value: {x: number, y: number}`, `onChange: (x: number, y: number) => void`
   - Render `<img>` with `ref` inside `position: relative` container, `max-width: 900px`, `width: 100%`
   - Overlay a full-size transparent `<div>` with `cursor: crosshair` and `onClick`:
     ```
     const rect = imgRef.current.getBoundingClientRect()
     const displayWidth = rect.width
     const displayHeight = rect.height
     const ox = Math.round((e.clientX - rect.left) / displayWidth * naturalWidth)
     const oy = Math.round((e.clientY - rect.top) / displayHeight * naturalHeight)
     onChange(ox, oy)
     ```
   - Red crosshair: absolute `<div>` with a CSS `+` shape, positioned at `(value.x / naturalWidth * 100)%` left and `(value.y / naturalHeight * 100)%` top via inline style
2. Create `frontend/components/CertPreview.tsx`:
   - Props: all event config fields + `sampleName: string`
   - `useEffect` with debounce (300ms): POST to `/api/preview`, create blob URL, set as `<img src>`
   - Show shadcn `Skeleton` while loading
   - Show shadcn `Badge` variant="destructive" if preview fails
3. Wire into `EventForm.tsx`:
   - shadcn `Dialog` triggered by "Edit Position" button
   - `DialogContent`: two-column layout — `PositionEditor` on left, `CertPreview` on right (synced to current form state)
   - `DialogFooter`: "Confirm" sets form fields `text_position_x` / `text_position_y`; "Cancel" discards

**Relevant Context:**
- Back-scaling formula: `original_x = click_x_in_display / display_width * natural_width`
- Natural dimensions come from `Event.template_natural_width` / `template_natural_height` (stored at upload time)
- The Dialog pattern from shadcn means the editor doesn't need its own route

---

### Sub-Task 7 — Run Page + Job Progress UI

**Status:** [ ] pending

**Intent:**
The main operational page where staff trigger send runs, see real-time per-row status, watch the bounce check phase, and get a final summary.

**Expected Outcomes:**
- `/run` page: pick saved event OR configure one-off (toggle)
- CSV upload → auto-detects `name`/`email` columns → editable column map → preview table showing rows with pre-validation badges
- "Invalid domain" rows flagged in yellow before job starts
- Dry run checkbox, batch size input
- "Start Job" button (shadcn `Button`)
- `JobProgress` shows: shadcn `Progress` bar, scrollable row log (name, email, status icon), bounce check phase indicator, final summary card
- Bounced rows appear in the log retroactively when bounce poll completes

**Todo List:**
1. Create `frontend/components/CsvUploader.tsx`:
   - `Input type="file" accept=".csv"` wrapped in shadcn `Card`
   - Parse with `papaparse.parse(file, {header: true})` client-side
   - Show detected headers; shadcn `Select` dropdowns to map `name column` and `email column` (auto-select if header name matches case-insensitively)
   - On column mapping confirmed: POST to `GET /api/validate-emails` with the email column values, overlay per-row `Badge` (green valid / yellow invalid_domain / red invalid_format)
   - Expose `{rows: {name, email}[], invalidCount}` to parent
2. Create `frontend/components/JobProgress.tsx`:
   - Props: `jobId: string`
   - On mount: `new EventSource('/api/jobs/{jobId}/progress')`
   - Handle message types:
     - `row` → update row in local state array; update progress bar `value={sent/total*100}`
     - `phase` with `phase: "bounce_check"` → show shadcn `Badge` "Checking for bounces…" spinner
     - `done` → close EventSource; render summary shadcn `Card` with counts
   - Row log: scrollable `div` with one row per `JobRow`; use shadcn `Badge` for status (green sent / red failed / yellow invalid_domain / amber bounced / gray skipped)
3. Build `/run/page.tsx`:
   - shadcn `Card` for event selection: `Select` populated from `GET /api/events` + "One-off config" toggle (renders condensed `EventForm` inline)
   - `CsvUploader` component
   - Options row: `Checkbox` for dry run, `Input type="number"` for batch size
   - `Button "Start Job"` — disabled if no event selected or no CSV loaded; onClick POSTs `multipart/form-data` to `/api/jobs`
   - On success: replace the form with `<JobProgress jobId={...} />`

**Relevant Context:**
- `papaparse` must be in frontend deps (added in Sub-Task 5)
- One-off config: pass inline event JSON in `config` field of job POST, no `event_id`
- `batch_size = 0` = no limit

---

### Sub-Task 8 — History Page

**Status:** [ ] pending

**Intent:**
Read-only view of all past jobs and per-row outcomes, including bounce status. Replaces `sent_log.csv`.

**Expected Outcomes:**
- `/history` page: job list in shadcn `Table` with event name, date, status badge, counts
- `/history/[jobId]`: per-row table with name, email, status badge, error message
- Bounced rows shown with amber badge
- "Export CSV" button downloads row data

**Todo List:**
1. Build `/history/page.tsx`:
   - Fetch `GET /api/jobs`
   - shadcn `Table` with columns: Event Name, Started, Status, Total, Sent, Failed, Bounced
   - Each row links to `/history/[jobId]`
2. Build `/history/[jobId]/page.tsx`:
   - Fetch `GET /api/jobs/{jobId}`
   - shadcn `Table` with columns: #, Name, Email, Status, Error
   - Status column: shadcn `Badge` with variant by status (default=sent, destructive=failed, secondary=skipped, outline=bounced, warning=invalid_domain)
   - "Export CSV" button: client-side generate CSV from row data, trigger download via `<a href={blobUrl} download>`
3. Add `/history` link to top nav

**Relevant Context:**
- `JobRow.status` enum: `sent`, `failed`, `skipped`, `invalid_domain`, `bounced`
- shadcn does not have a "warning" badge variant by default — add a custom `warning` variant in `components/ui/badge.tsx` (yellow/amber)

---

### Sub-Task 9 — Cleanup & Migration

**Status:** [ ] pending

**Intent:**
Remove all old CLI files, update docs, create a convenience start script.

**Expected Outcomes:**
- Old Python CLI files deleted
- All historical CSV data, output PDFs, and old state files removed from disk
- `.gitignore` updated so data files, uploads, outputs, and the DB never reach GitHub
- Repo is clean enough to `git clone` and use immediately with zero leftover data
- `README.md` explains how to start the app, set `.env`, and create a first event
- `start.sh` launches both services

**Todo List:**
1. Delete old CLI Python files: `run.py`, `generate_certs.py`, `send_certs.py`, `find_position.py`, `generate_test_cert.py`, `clean_ideaframe_data.py`, `config.py`
2. Delete historical data and output files (already done as pre-work — see note below):
   - `data/` directory (all CSVs from previous events)
   - `output/` directory (166 MB of generated PDFs)
   - `participants.csv` (root-level leftover)
   - `sent_log.csv`, `sent_log.csv.bak`, `progress.json` (old state files)
   - `Press_Start_2P.zip`, `files.zip` (leftover archives)
3. Replace `data/` and `output/` with runtime-created directories that are `.gitignore`d:
   - The new app creates `uploads/` and `output/` at startup via `os.makedirs(..., exist_ok=True)` in `backend/main.py`
   - Add a `.gitkeep` to neither — directories are created at runtime, not committed
4. Update `.gitignore` to cover all runtime-generated paths:
   ```
   # Runtime data — never commit
   uploads/
   output/
   data.db
   data/
   fonts/
   templates/
   sent_log.csv
   sent_log.csv.bak
   progress.json
   participants.csv
   # Env and secrets
   .env
   # Python
   __pycache__/
   *.pyc
   *.pyo
   .pytest_cache/
   # Node
   frontend/node_modules/
   frontend/.next/
   frontend/.env.local
   # OS
   .DS_Store
   *.zip
   ```
5. Update `README.md`:
   - Prerequisites: Python 3.11+, Node 20+
   - Setup: `pip install -r backend/requirements.txt`, copy `.env.example` → `.env`, fill credentials
   - Frontend setup: `cd frontend && npm install`
   - Start: `bash start.sh` or run separately
   - First-time flow: create event → upload template → set position → upload CSV → run job
   - Note that `uploads/`, `output/`, and `data.db` are created automatically on first run
6. Create `start.sh`:
   ```bash
   #!/bin/bash
   uvicorn backend.main:app --reload &
   cd frontend && npm run dev
   ```
7. Verify `.env.example` has `GMAIL_USER=` and `GMAIL_APP_PASSWORD=`
8. End-to-end smoke test on a clean directory: clone → setup → create event → upload template → position → upload CSV → dry-run → check history

**Relevant Context:**
- `output/` currently holds 166 MB of PDFs from previous runs — deleted in pre-work
- `data/` currently holds CSVs from previous events (winner.csv, ideaframe/, portfolio_hackathon.csv, etc.) — deleted in pre-work
- `fonts/` and `templates/` from previous events are also gitignored; font uploads and template uploads are handled through the new UI and stored in `uploads/`
- The new `uploads/` directory holds both uploaded templates and any font files — it is gitignored and runtime-created
- Historical event data is NOT migrated into the new SQLite DB; operators re-create events via the UI

---

## Pre-Work (Do Before Any Sub-Task)

These are immediate cleanup actions on the current repo — not part of the new code build but must happen first so the repo is clean before implementation begins.

**Actions:**
1. Delete `output/` directory (166 MB of PDFs)
2. Delete `data/` directory (all historical CSVs)
3. Delete `participants.csv`, `sent_log.csv`, `sent_log.csv.bak`, `progress.json`
4. Delete `Press_Start_2P.zip`, `files.zip`
5. Update `.gitignore` immediately (full content in Sub-Task 9)
6. `git add -A && git commit -m "chore: delete historical data, PDFs, and old state files"` to record the removal

**Note on templates/ and fonts/:** Leave these for now. Once the new upload UI is built (Sub-Task 3), re-upload the fonts you want to keep (GlacialIndifference, Inter) through the UI. Then delete `templates/` and `fonts/` from disk and commit.

---

## Out of Scope (This Phase)

- User authentication / login / roles
- Cloud deployment, Docker, hosted database
- Additional email providers (SendGrid, SES, etc.)
- In-browser certificate template designer
- Bulk import of old `config.py` tier configs into the new DB
