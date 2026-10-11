import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .paths import FONTS_UPLOAD_DIR, OUTPUT_DIR, UPLOADS_DIR
from .routers import events, templates, preview, jobs, fonts

# The dev frontend is the default. Add origins (a LAN IP for phone testing, a
# deployed domain) without editing code, since a font served to an origin that
# isn't listed fails as an opaque DOMException with no status.
_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup; also ensure runtime directories exist
    Base.metadata.create_all(bind=engine)
    for directory in (UPLOADS_DIR, FONTS_UPLOAD_DIR, OUTPUT_DIR):
        os.makedirs(directory, exist_ok=True)
    yield


app = FastAPI(
    title="Sealpost API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events.router)
app.include_router(templates.router)
app.include_router(preview.router)
app.include_router(jobs.router)
app.include_router(fonts.router)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
