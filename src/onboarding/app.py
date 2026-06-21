"""FastAPI application — PowerMatch onboarding wizard.

Single-user, instance-local. Serves the wizard UI and a small JSON API that
persists progress, per-item notes and the 1:1 workspace (links + free notes).
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from starlette.requests import Request

from . import content, services
from .config import settings
from .db import get_session, init_db
from .schemas import (
    CheckIn,
    FreeNoteIn,
    FreeNoteOut,
    ItemNoteIn,
    ItemNoteOut,
    LinkIn,
    LinkOut,
)

BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

    app.mount(
        "/static",
        StaticFiles(directory=str(BASE_DIR / "static")),
        name="static",
    )

    # ---------- pages ----------
    @app.get("/", response_class=HTMLResponse)
    def index(request: Request, db: Session = Depends(get_session)) -> HTMLResponse:
        return templates.TemplateResponse(
            request,
            "index.html",
            {
                "phases": content.build_phases(),
                "total": content.total_items(),
                "state": services.full_state(db),
                "app_name": settings.app_name,
                "limits": {
                    "max_free_notes": settings.max_free_notes,
                    "max_links": settings.max_links,
                },
            },
        )

    @app.get("/healthz")
    def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/state")
    def get_state(db: Session = Depends(get_session)) -> dict:
        return services.full_state(db)

    # ---------- checks ----------
    @app.post("/api/check")
    def post_check(payload: CheckIn, db: Session = Depends(get_session)) -> dict[str, bool]:
        try:
            services.set_check(db, payload.item_key, payload.checked)
        except services.ValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {"ok": True}

    # ---------- per-item notes ----------
    @app.put("/api/item-notes/{item_key}", response_model=ItemNoteOut | None)
    def put_item_note(
        item_key: str, payload: ItemNoteIn, db: Session = Depends(get_session)
    ) -> ItemNoteOut | None:
        try:
            row = services.upsert_item_note(db, item_key, payload.body, payload.height)
        except services.ValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return ItemNoteOut.model_validate(row) if row else None

    @app.delete("/api/item-notes/{item_key}")
    def del_item_note(item_key: str, db: Session = Depends(get_session)) -> dict[str, bool]:
        try:
            services.delete_item_note(db, item_key)
        except services.NotFoundError as exc:
            raise HTTPException(status_code=404, detail="Note ikke fundet") from exc
        return {"ok": True}

    # ---------- free notes ----------
    @app.post("/api/workspaces/{phase_id}/notes", response_model=FreeNoteOut)
    def create_free_note(
        phase_id: str, payload: FreeNoteIn, db: Session = Depends(get_session)
    ) -> FreeNoteOut:
        try:
            row = services.create_free_note(
                db, phase_id, payload.title, payload.body, payload.height
            )
        except services.ValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except services.LimitError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        return FreeNoteOut.model_validate(row)

    @app.put("/api/notes/{note_id}", response_model=FreeNoteOut)
    def update_free_note(
        note_id: int, payload: FreeNoteIn, db: Session = Depends(get_session)
    ) -> FreeNoteOut:
        try:
            row = services.update_free_note(
                db, note_id, payload.title, payload.body, payload.height
            )
        except services.NotFoundError as exc:
            raise HTTPException(status_code=404, detail="Note ikke fundet") from exc
        return FreeNoteOut.model_validate(row)

    @app.delete("/api/notes/{note_id}")
    def delete_free_note(note_id: int, db: Session = Depends(get_session)) -> dict[str, bool]:
        try:
            services.delete_free_note(db, note_id)
        except services.NotFoundError as exc:
            raise HTTPException(status_code=404, detail="Note ikke fundet") from exc
        return {"ok": True}

    # ---------- links ----------
    @app.post("/api/workspaces/{phase_id}/links", response_model=LinkOut)
    def create_link(
        phase_id: str, payload: LinkIn, db: Session = Depends(get_session)
    ) -> LinkOut:
        try:
            row = services.create_link(db, phase_id, payload.label, payload.url)
        except services.ValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except services.LimitError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        return LinkOut.model_validate(row)

    @app.delete("/api/links/{link_id}")
    def delete_link(link_id: int, db: Session = Depends(get_session)) -> dict[str, bool]:
        try:
            services.delete_link(db, link_id)
        except services.NotFoundError as exc:
            raise HTTPException(status_code=404, detail="Link ikke fundet") from exc
        return {"ok": True}

    @app.exception_handler(404)
    def _not_found(request: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": "Ikke fundet"})

    return app


app = create_app()
