#!/bin/bash
# Starts the backend (FastAPI) and frontend (Next.js) in parallel.
# Press Ctrl+C to stop both.

trap "kill 0" SIGINT SIGTERM EXIT

echo "▶ Starting backend on http://localhost:8000"
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000 &

echo "▶ Starting frontend on http://localhost:3000"
cd frontend && npm run dev
