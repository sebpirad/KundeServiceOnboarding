"""End-to-end API behaviour."""

from __future__ import annotations

from fastapi.testclient import TestClient

from onboarding import content

A_KEY = "phase-1:0"


def test_healthz(client: TestClient) -> None:
    assert client.get("/healthz").json() == {"status": "ok"}


def test_index_renders(client: TestClient) -> None:
    r = client.get("/")
    assert r.status_code == 200
    assert "bootstrap" in r.text
    assert "power" in r.text.lower()


def test_initial_state_empty(client: TestClient) -> None:
    s = client.get("/api/state").json()
    assert s["checks"] == {}
    assert s["item_notes"] == {}
    assert "phase-4" in s["workspaces"]


def test_check_roundtrip(client: TestClient) -> None:
    assert client.post("/api/check", json={"item_key": A_KEY, "checked": True}).status_code == 200
    assert client.get("/api/state").json()["checks"].get(A_KEY) is True
    client.post("/api/check", json={"item_key": A_KEY, "checked": False})
    assert A_KEY not in client.get("/api/state").json()["checks"]


def test_check_rejects_unknown_key(client: TestClient) -> None:
    r = client.post("/api/check", json={"item_key": "nope:99", "checked": True})
    assert r.status_code == 400


def test_item_note_create_update_delete(client: TestClient) -> None:
    r = client.put(f"/api/item-notes/{A_KEY}", json={"body": "Husk adgang", "height": 120})
    assert r.status_code == 200
    data = r.json()
    assert data["body"] == "Husk adgang"
    created = data["created_at"]

    r2 = client.put(f"/api/item-notes/{A_KEY}", json={"body": "Opdateret", "height": 120})
    assert r2.json()["created_at"] == created  # creation time preserved

    # empty body deletes
    r3 = client.put(f"/api/item-notes/{A_KEY}", json={"body": "", "height": 0})
    assert r3.json() is None
    assert A_KEY not in client.get("/api/state").json()["item_notes"]


def test_item_note_unknown_key(client: TestClient) -> None:
    r = client.put("/api/item-notes/bad:1", json={"body": "x"})
    assert r.status_code == 400


def test_free_notes_workspace(client: TestClient) -> None:
    r = client.post("/api/workspaces/phase-4/notes", json={"title": "Model", "body": "try & hire"})
    assert r.status_code == 200
    nid = r.json()["id"]

    upd = client.put(f"/api/notes/{nid}", json={"title": "Model", "body": "udvidet"})
    assert upd.json()["body"] == "udvidet"

    assert client.delete(f"/api/notes/{nid}").status_code == 200
    assert client.get("/api/state").json()["workspaces"]["phase-4"]["notes"] == []


def test_free_note_rejects_non_workspace_phase(client: TestClient) -> None:
    r = client.post("/api/workspaces/phase-1/notes", json={"title": "x", "body": "y"})
    assert r.status_code == 400


def test_free_note_limit(client: TestClient) -> None:
    from onboarding.config import settings

    for _ in range(settings.max_free_notes):
        assert client.post("/api/workspaces/phase-4/notes", json={"body": "n"}).status_code == 200
    over = client.post("/api/workspaces/phase-4/notes", json={"body": "over"})
    assert over.status_code == 409


def test_links_workspace(client: TestClient) -> None:
    r = client.post("/api/workspaces/phase-4/links", json={"label": "Doc", "url": "https://x.dk"})
    assert r.status_code == 200
    lid = r.json()["id"]
    assert client.delete(f"/api/links/{lid}").status_code == 200


def test_link_requires_http(client: TestClient) -> None:
    r = client.post("/api/workspaces/phase-4/links", json={"label": "x", "url": "ftp://x"})
    assert r.status_code == 422


def test_link_limit(client: TestClient) -> None:
    from onboarding.config import settings

    for i in range(settings.max_links):
        assert client.post(
            "/api/workspaces/phase-4/links", json={"url": f"https://x{i}.dk"}
        ).status_code == 200
    over = client.post("/api/workspaces/phase-4/links", json={"url": "https://over.dk"})
    assert over.status_code == 409


def test_state_reflects_full_progress(client: TestClient) -> None:
    for p in content.PHASES:
        for i in range(len(p["items"])):
            client.post("/api/check", json={"item_key": f"{p['id']}:{i}", "checked": True})
    checks = client.get("/api/state").json()["checks"]
    assert len(checks) == content.total_items()
