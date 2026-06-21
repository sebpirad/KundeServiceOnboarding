# PowerMatch · Onboarding

A focused, single-user onboarding wizard for new PowerMatch customer-service
team members. It walks a trainee through a **7-phase / 33-step** first week —
from first login to taking supervised calls — and lets them track progress and
capture personal notes along the way.

The interface is a guided, one-phase-at-a-time flow in PowerMatch's hi-vis
yellow (`#F8E965`) on charcoal. Everything is persisted server-side (SQLite),
so a trainee can stop and resume on the same instance at any time.

## Features

- **Guided 7-phase flow** with per-phase progress rings and an overall progress rail.
- **Resumable progress** — every checked step is saved to the backend.
- **Per-item notes** — attach one editable note to any checklist item, with
  created/edited timestamps, autosave, expand-to-edit and delete.
- **1:1 training workspace** (phase 4 "Forretningen i dybden") — save resource
  **links** and write multiple free-form **notes** that expand to near-A4 for
  focused writing.
- **"Mine noter"** — every note gathered and grouped by phase, printable / save-as-PDF.
- No login, no admin, no tracking. One trainee per instance.

## Quick start

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
python -m onboarding          # http://127.0.0.1:8000
```

Or with uvicorn directly:

```bash
uvicorn onboarding.app:app --reload --app-dir src
```

## Configuration

All settings use the `PM_` env prefix (or a `.env` file):

| Variable             | Default                      | Description                          |
| -------------------- | ---------------------------- | ------------------------------------ |
| `PM_DATABASE_URL`    | `sqlite:///./onboarding.db`  | SQLAlchemy database URL              |
| `PM_APP_NAME`        | `PowerMatch · Onboarding`    | Title shown in the UI                |
| `PM_MAX_FREE_NOTES`  | `12`                         | Max free notes per workspace         |
| `PM_MAX_LINKS`       | `20`                         | Max links per workspace              |
| `PM_HOST` / `PM_PORT`| `127.0.0.1` / `8000`         | Bind address for `python -m onboarding` |

## Tests

```bash
pytest
ruff check .
```

## Docker

```bash
docker compose -f docker/docker-compose.yml up --build
```

## Architecture

```
src/onboarding/
  content.py     # single source of truth — 7 phases, 33 items, tips
  config.py      # pydantic-settings (PM_ prefix)
  db.py          # engine + session
  models.py      # Check, ItemNote, FreeNote, Link
  schemas.py     # pydantic request/response models
  services.py    # business logic over the ORM
  app.py         # FastAPI app + JSON API
  templates/index.html
  static/css/style.css
  static/js/app.js   # wizard logic, both note features, confetti
tests/           # content + API tests
```

The frontend hydrates from a `#bootstrap` JSON blob (content + state + limits)
and syncs every change to the API:

| Method | Path                              | Purpose                |
| ------ | --------------------------------- | ---------------------- |
| GET    | `/api/state`                      | Full state for hydrate |
| POST   | `/api/check`                      | Set step completion    |
| PUT    | `/api/item-notes/{item_key}`      | Upsert per-item note   |
| DELETE | `/api/item-notes/{item_key}`      | Delete per-item note   |
| POST   | `/api/workspaces/{phase}/notes`   | Create free note       |
| PUT    | `/api/notes/{id}`                 | Update free note       |
| DELETE | `/api/notes/{id}`                 | Delete free note       |
| POST   | `/api/workspaces/{phase}/links`   | Add link               |
| DELETE | `/api/links/{id}`                 | Remove link            |

## License

MIT — see [LICENSE](LICENSE).
