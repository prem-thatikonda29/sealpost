import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .routers import events, templates, preview, jobs


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup; also ensure runtime directories exist
    Base.metadata.create_all(bind=engine)
    os.makedirs("uploads", exist_ok=True)
    os.makedirs("output", exist_ok=True)
    yield


app = FastAPI(
    title="Cert Sender API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events.router)
app.include_router(templates.router)
app.include_router(preview.router)
app.include_router(jobs.router)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
