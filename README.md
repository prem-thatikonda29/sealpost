# Sealpost

Browser-based certificate generation and email sending tool. Upload templates, position names visually, upload participant CSVs, and send certificates with real-time progress. No terminal required.

## Features

- **Visual name positioning**: a canvas editor where you click the template to set the exact center point, with live text overlay and max-text-width guides marked on the canvas
- **Tier checklist with column mapping**: upload a CSV per tier on the Run page, and map its columns; names-only CSVs and split name columns work too
- **Email pre-validation**: a DNS MX check catches bad domains (typos like `@gmial.com`) before anything goes out, and you get a warning before re-sending to anyone who already has the certificate
- **Live per-row progress**: every row shows sent, failed, or invalid domain as it happens; after the send, bounce detection polls your Gmail inbox for NDRs
- **Re-send failures**: retry only the rows that missed out, with a message you can rewrite
- **Generate all and download**: a dry run that generates every certificate, packaged up as a zip
- **Job history**: per-row status and CSV export, plus delete a job or clear the history
- **Delivery report**: a summary of who got their certificate and a downloadable CSV (outcome, send time in IST, attempts, and why a row failed) for every job (jobs from before the report was added show an attempt count of 0 and no send time)
- **IST by default**: all times are shown in Indian Standard Time; to change it, set both `APP_TIMEZONE` (API) and `NEXT_PUBLIC_APP_TIMEZONE` (web UI) to the same IANA zone
- **Bundled font library**: pick from the bundled fonts or upload your own
- **Send limits**: sends are throttled, transient SMTP errors are retried with backoff, and a run stops at your daily cap; people it didn't reach show as failed and can be re-sent tomorrow from History
- **Duplicate protection**: an address that appears twice in one upload is only emailed once

## Prerequisites

- Python 3.11+
- Node.js 20+

## Setup

### 1. Clone and configure

```bash
git clone https://github.com/prem-thatikonda29/sealpost.git
cd sealpost
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
2. **Events → New Event**: upload a template image, click on it to place the name, choose a font, write the email subject/body
3. **Run**: check the tiers you want, upload each tier's CSV, map the columns, optionally validate emails, start the job
4. Watch live progress: sent, invalid, and failed rows update in real time
5. After ~30s, the bounce check runs automatically against your Gmail inbox
6. **History**: open any past job, re-send to the people who missed out, export CSV, or delete the job with its certificates

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
| `GET /api/jobs/{id}/report.csv` | Download the delivery report (CSV) |
| `DELETE /api/jobs/{id}` | Delete a job with its certificates |
| `DELETE /api/jobs` | Clear the job history |
