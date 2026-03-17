from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.auth import require_dashboard_token
from app.routers import analyze, meetings, search, telegram


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="MeetMind AI – Meeting Intelligence API",
    )

    # Allow local frontend (Vite dev server) to call the API.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # for local dev; tighten in production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    dependency = Depends(require_dashboard_token)

    app.include_router(analyze.router, dependencies=[dependency])
    app.include_router(meetings.router, dependencies=[dependency])
    app.include_router(search.router, dependencies=[dependency])
    app.include_router(telegram.router, dependencies=[dependency])

    return app


app = create_app()

