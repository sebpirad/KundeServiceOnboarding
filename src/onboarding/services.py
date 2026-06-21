"""Business logic — thin layer over the ORM."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import content
from .config import settings
from .models import Check, FreeNote, ItemNote, Link


class NotFoundError(Exception):
    pass


class ValidationError(Exception):
    pass


class LimitError(Exception):
    pass


# ---------- checks ----------
def set_check(db: Session, item_key: str, checked: bool) -> None:
    if item_key not in content.all_item_keys():
        raise ValidationError(f"Ukendt punkt: {item_key}")
    row = db.get(Check, item_key)
    if row is None:
        row = Check(item_key=item_key, checked=checked)
        db.add(row)
    else:
        row.checked = checked
    db.commit()


def all_checks(db: Session) -> dict[str, bool]:
    rows = db.scalars(select(Check)).all()
    return {r.item_key: r.checked for r in rows if r.checked}


# ---------- per-item notes ----------
def upsert_item_note(db: Session, item_key: str, body: str, height: int = 0) -> ItemNote | None:
    if item_key not in content.all_item_keys():
        raise ValidationError(f"Ukendt punkt: {item_key}")
    row = db.get(ItemNote, item_key)
    if not body.strip():
        # Empty body deletes the note.
        if row is not None:
            db.delete(row)
            db.commit()
        return None
    if row is None:
        row = ItemNote(item_key=item_key, body=body, height=height)
        db.add(row)
    else:
        row.body = body
        if height:
            row.height = height
    db.commit()
    db.refresh(row)
    return row


def delete_item_note(db: Session, item_key: str) -> None:
    row = db.get(ItemNote, item_key)
    if row is None:
        raise NotFoundError(item_key)
    db.delete(row)
    db.commit()


def all_item_notes(db: Session) -> list[ItemNote]:
    return list(db.scalars(select(ItemNote)).all())


# ---------- free notes (workspace) ----------
def _check_phase(phase_id: str) -> None:
    if phase_id not in content.WORKSPACE_PHASES:
        raise ValidationError(f"Fase uden arbejdsområde: {phase_id}")


def create_free_note(
    db: Session, phase_id: str, title: str, body: str, height: int = 0
) -> FreeNote:
    _check_phase(phase_id)
    count = len(list(db.scalars(select(FreeNote).where(FreeNote.phase_id == phase_id))))
    if count >= settings.max_free_notes:
        raise LimitError(f"Maks {settings.max_free_notes} noter pr. arbejdsområde.")
    row = FreeNote(phase_id=phase_id, title=title, body=body, height=height, position=count)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_free_note(
    db: Session, note_id: int, title: str, body: str, height: int = 0
) -> FreeNote:
    row = db.get(FreeNote, note_id)
    if row is None:
        raise NotFoundError(str(note_id))
    row.title = title
    row.body = body
    if height:
        row.height = height
    db.commit()
    db.refresh(row)
    return row


def delete_free_note(db: Session, note_id: int) -> None:
    row = db.get(FreeNote, note_id)
    if row is None:
        raise NotFoundError(str(note_id))
    db.delete(row)
    db.commit()


def free_notes_for(db: Session, phase_id: str) -> list[FreeNote]:
    stmt = (
        select(FreeNote)
        .where(FreeNote.phase_id == phase_id)
        .order_by(FreeNote.position, FreeNote.id)
    )
    return list(db.scalars(stmt).all())


# ---------- links (workspace) ----------
def create_link(db: Session, phase_id: str, label: str, url: str) -> Link:
    _check_phase(phase_id)
    count = len(list(db.scalars(select(Link).where(Link.phase_id == phase_id))))
    if count >= settings.max_links:
        raise LimitError(f"Maks {settings.max_links} links pr. arbejdsområde.")
    row = Link(phase_id=phase_id, label=label or url, url=url)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def delete_link(db: Session, link_id: int) -> None:
    row = db.get(Link, link_id)
    if row is None:
        raise NotFoundError(str(link_id))
    db.delete(row)
    db.commit()


def links_for(db: Session, phase_id: str) -> list[Link]:
    stmt = select(Link).where(Link.phase_id == phase_id).order_by(Link.id)
    return list(db.scalars(stmt).all())


# ---------- aggregate state ----------
def full_state(db: Session) -> dict:
    """Everything the frontend needs to hydrate on load."""
    item_notes = {
        n.item_key: {
            "body": n.body,
            "height": n.height,
            "created_at": n.created_at.isoformat(),
            "updated_at": n.updated_at.isoformat(),
        }
        for n in all_item_notes(db)
    }
    workspaces: dict[str, dict] = {}
    for pid in content.WORKSPACE_PHASES:
        workspaces[pid] = {
            "notes": [
                {
                    "id": n.id,
                    "title": n.title,
                    "body": n.body,
                    "height": n.height,
                    "created_at": n.created_at.isoformat(),
                    "updated_at": n.updated_at.isoformat(),
                }
                for n in free_notes_for(db, pid)
            ],
            "links": [
                {"id": ln.id, "label": ln.label, "url": ln.url} for ln in links_for(db, pid)
            ],
        }
    return {
        "checks": all_checks(db),
        "item_notes": item_notes,
        "workspaces": workspaces,
    }
