# Cert Sender

Browser-based certificate generation and email sending tool. Upload templates, position names visually, upload participant CSVs, and send certificates with real-time progress — no terminal required.

## Features

- **Visual name positioning** — Figma-style canvas editor: click on the template to set the exact center point, with live text overlay and marked max-text-width guides
- **Tier checklist with column mapping** — per-tier CSV upload on the Run page; names-only CSVs and split name columns are mapped for you
- **Email pre-validation** — DNS MX check before sending catches bad domains (typos like `@gmial.com`), plus a warning before re-sending to people who already have the certificate
- **Live per-row progress** — sent / failed / invalid domain statuses update in real time; after sending, bounce detection polls your Gmail inbox for NDRs
- **Re-send failures** — retry only the rows that missed out, with a message you can rewrite
- **Generate all and download** — a dry run that actually generates every certificate, downloaded as a zip
- **Job history** — per-row status, CSV export, delete a job or clear the history along with its certificates
- **Bundled font library** — pick from bundled fonts or upload your own

## Prerequisites

- Python 3.11+
- Node.js 20+

## Setup

### 1. Clone and configure

```bash
git clone https://github.com/prem-thatikonda29/Certificates-Sender.git
cd Certificates-Sender
cp .env.example .env
```

Edit `.env`:
```
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=your_16_char_app_password
```

> Gmail App Password: Google Account → Security → 2-Step Verification → App passwords

### 2. Backend

```bash
pip install -r backend/requirements.txt
```

### 3. Frontend

```bash
cd frontend && npm install && cd ..
```

## Running

```bash
bash start.sh
```

This starts:
- **Backend** at `http://localhost:8000` (FastAPI + SQLite)
- **Frontend** at `http://localhost:3000` (Next.js)

Or start separately:
```bash
# Terminal 1
uvicorn backend.main:app --reload

# Terminal 2
cd frontend && npm run dev
```

## First-time flow

1. Go to `http://localhost:3000`
2. **Events → New Event** — upload a template image, click on it to place the name, choose a font, write the email subject/body
3. **Run** — check the tiers you want to run, upload each tier's CSV, map columns, optionally validate emails, start the job
4. Watch live progress — sent / invalid / failed rows update in real time
5. After ~30s, bounce check runs automatically against your Gmail inbox
6. **History** — view any past job, re-send to the people who missed out, export CSV, or delete the job with its certificates

## Runtime directories

These are created automatically on first run and are gitignored:

| Path | Contents |
|---|---|
| `uploads/` | Uploaded template images and font files |
| `output/` | Generated certificate PDFs (per job) |
| `data.db` | SQLite database (events, jobs, rows) |

## API

The FastAPI backend exposes a full REST API. Swagger docs available at:
```
http://localhost:8000/docs
```

Useful for coding agents or scripted automation:

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
| `GET /api/fonts/{id}/file` | Download font file |
| `POST /api/preview` | Render sample certificate → PNG |
| `POST /api/jobs` | Start a job (multipart: config JSON + CSV file) |
| `POST /api/jobs/validate-emails` | Validate email domains before sending |
| `POST /api/jobs/check-duplicates` | Warn about people who already have the certificate |
| `GET /api/jobs` | List all past jobs |
| `GET /api/jobs/{id}` | Get one job |
| `GET /api/jobs/{id}/progress` | SSE stream of real-time row progress |
| `GET /api/jobs/{id}/download` | Download generated certificates (zip) |
| `DELETE /api/jobs/{id}` | Delete a job with its certificates |
| `DELETE /api/jobs` | Clear the job history |
