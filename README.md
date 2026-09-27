# Cert Sender

Browser-based certificate generation and email sending tool. Upload templates, position names visually, upload participant CSVs, and send certificates with real-time progress — no terminal required.

## Features

- **Visual name positioning** — click on the template in-browser to set the exact center point; see a live preview instantly
- **Email pre-validation** — DNS MX check before sending catches bad domains (typos like `@gmial.com`) before a single email goes out
- **Bounce detection** — after sending, polls your Gmail inbox for NDR bounce emails and updates row statuses automatically
- **Job history** — every run is recorded with per-row status (sent / failed / invalid domain / bounced), exportable as CSV
- **Saved events** — reusable certificate configurations per event/tier

## Prerequisites

- Python 3.11+
- Node.js 20+

## Setup

### 1. Clone and configure

```bash
git clone <repo-url>
cd cert-sender
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
2. **Events → New Event** — fill in name, upload template image, set text position (click on template), set font options, write email subject/body
3. **Run** — select the event, upload participants CSV, optionally validate emails, start job
4. Watch live progress — sent / invalid / failed rows update in real time
5. After ~30s, bounce check runs automatically against your Gmail inbox
6. **History** — view any past job, see per-row status, export CSV

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
| `PUT /api/events/{id}` | Update event |
| `POST /api/templates/upload` | Upload a template image |
| `POST /api/preview` | Render sample certificate → PNG |
| `POST /api/jobs` | Start a job (multipart: config JSON + CSV file) |
| `GET /api/jobs/{id}/progress` | SSE stream of real-time row progress |
| `GET /api/jobs` | List all past jobs |
| `POST /api/jobs/validate-emails` | Validate email domains before sending |
