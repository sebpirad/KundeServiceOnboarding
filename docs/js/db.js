/* ============================================================
   PowerMatch — Onboarding · DATALAG (PM_DB)
   ------------------------------------------------------------
   Ét fælles, async interface som app.js taler med. Bag det
   ligger ENTEN:
     • Supabase (delt backend — alle enheder ser det samme), eller
     • localStorage (kun denne browser — bruges hvis Supabase
       ikke er konfigureret, så siden aldrig går i stykker).

   Personlig fremdrift (afkrydsninger) gemmes ALTID lokalt —
   den er privat pr. enhed. Noter, links og spørgsmål deles.

   Routes (samme signatur som tidligere backend):
     POST   /api/check
     PUT    /api/item-notes/{key}      DELETE /api/item-notes/{key}
     POST   /api/workspaces/{phase}/notes
     POST   /api/workspaces/{phase}/links
     PUT    /api/notes/{id}            DELETE /api/notes/{id}
     DELETE /api/links/{id}
     POST   /api/questions             PUT /api/questions/{id}   DELETE /api/questions/{id}
   ============================================================ */
window.PM_DB = (() => {
  "use strict";

  const CFG = window.PM_CONFIG || {};
  const LIMITS = (window.PM_CONTENT && window.PM_CONTENT.limits) || { max_free_notes: 12, max_links: 20 };

  const isPlaceholder = (v) => !v || /^YOUR_/.test(String(v));
  const SUPA = !isPlaceholder(CFG.supabaseUrl) && !isPlaceholder(CFG.supabaseAnonKey);
  const MODE = SUPA ? "supabase" : "local";
  const base = SUPA ? String(CFG.supabaseUrl).replace(/\/$/, "") + "/rest/v1" : null;

  const nowISO = () => new Date().toISOString();

  /* ---------- persona (altid lokal — hvem "er" denne enhed) ---------- */
  const PERSONA_KEY = "pm_persona";
  const people = Array.isArray(CFG.people) && CFG.people.length ? CFG.people : ["Maiken", "Michelle"];
  const defaultPerson = CFG.defaultPerson && people.includes(CFG.defaultPerson) ? CFG.defaultPerson : people[0];
  const persona = {
    list: () => people.slice(),
    get() {
      try { const v = localStorage.getItem(PERSONA_KEY); if (v && people.includes(v)) return v; } catch (_) {}
      return defaultPerson;
    },
    set(name) {
      if (!people.includes(name)) return;
      try { localStorage.setItem(PERSONA_KEY, name); } catch (_) {}
    },
  };

  /* ============================================================
     LOCAL backend (localStorage) — fuld paritet med Supabase
     ============================================================ */
  const LS_KEY = "pm_onboarding_v1";
  function loadLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        s.checks = s.checks || {};
        s.item_notes = s.item_notes || {};
        s.workspaces = s.workspaces || {};
        s.questions = s.questions || [];
        s.seq = s.seq || 1;
        return s;
      }
    } catch (_) {}
    return { checks: {}, item_notes: {}, workspaces: {}, questions: [], seq: 1 };
  }
  const local = loadLocal();
  let saveTimer = null;
  function saveLocal() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveLocalNow, 60);
  }
  function saveLocalNow() {
    clearTimeout(saveTimer);
    try { localStorage.setItem(LS_KEY, JSON.stringify(local)); }
    catch (e) { console.error("persist failed", e); }
  }
  window.addEventListener("beforeunload", saveLocalNow);
  document.addEventListener("visibilitychange", () => { if (document.hidden) saveLocalNow(); });
  const nextId = () => local.seq++;
  function wsOf(phase) {
    if (!local.workspaces[phase]) local.workspaces[phase] = { notes: [], links: [] };
    const w = local.workspaces[phase];
    w.notes = w.notes || []; w.links = w.links || [];
    return w;
  }

  /* ---------- checks: ALTID lokal (personlig fremdrift) ---------- */
  function setCheck(item_key, checked) {
    if (checked) local.checks[item_key] = true; else delete local.checks[item_key];
    saveLocal();
  }
  const checksObject = () => ({ ...local.checks });

  /* ============================================================
     SUPABASE REST helper
     ============================================================ */
  async function sb(method, path, { query = "", body = null, prefer = null } = {}) {
    const headers = {
      "apikey": CFG.supabaseAnonKey,
      "Authorization": "Bearer " + CFG.supabaseAnonKey,
      "Content-Type": "application/json",
    };
    if (prefer) headers["Prefer"] = prefer;
    const res = await fetch(`${base}/${path}${query}`, {
      method, headers, body: body == null ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Supabase ${method} ${path} → ${res.status} ${txt}`);
    }
    if (res.status === 204) return null;
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  }
  const one = (rows) => (Array.isArray(rows) ? rows[0] : rows) || null;

  /* ============================================================
     BOOTSTRAP — hent al delt state ved opstart
     returnerer { item_notes:{key:row}, workspaces:{phase:{notes,links}}, questions:[] }
     ============================================================ */
  async function pullShared() {
    if (MODE === "local") {
      const item_notes = {};
      for (const [k, v] of Object.entries(local.item_notes)) item_notes[k] = { ...v };
      const workspaces = {};
      for (const [pid, w] of Object.entries(local.workspaces)) {
        workspaces[pid] = {
          notes: (w.notes || []).map((n) => ({ ...n })),
          links: (w.links || []).map((l) => ({ ...l })),
        };
      }
      const questions = (local.questions || []).map((q) => ({ ...q }));
      return { item_notes, workspaces, questions };
    }
    // Supabase: fire requests i parallel
    const [notes, wsNotes, wsLinks, qs] = await Promise.all([
      sb("GET", "item_notes", { query: "?select=*" }),
      sb("GET", "ws_notes", { query: "?select=*&order=position.asc,id.asc" }),
      sb("GET", "ws_links", { query: "?select=*&order=id.asc" }),
      sb("GET", "questions", { query: "?select=*&order=created_at.asc" }),
    ]);
    const item_notes = {};
    (notes || []).forEach((r) => { item_notes[r.item_key] = r; });
    const workspaces = {};
    const ensure = (pid) => (workspaces[pid] || (workspaces[pid] = { notes: [], links: [] }));
    (wsNotes || []).forEach((n) => ensure(n.phase_id).notes.push(n));
    (wsLinks || []).forEach((l) => ensure(l.phase_id).links.push(l));
    return { item_notes, workspaces, questions: qs || [] };
  }

  /* ============================================================
     API dispatcher
     ============================================================ */
  async function api(method, url, body = {}) {
    const path = url.replace(/^\/api\//, "");
    const parts = path.split("/");
    const seg0 = parts[0];

    /* ---- checks (altid lokal) ---- */
    if (method === "POST" && seg0 === "check") {
      setCheck(body.item_key, body.checked);
      return null;
    }

    /* ---- item-notes/{key} ---- */
    if (seg0 === "item-notes") {
      const key = decodeURIComponent(parts.slice(1).join("/"));
      if (method === "DELETE") {
        if (MODE === "local") { delete local.item_notes[key]; saveLocal(); return null; }
        await sb("DELETE", "item_notes", { query: `?item_key=eq.${encodeURIComponent(key)}` });
        return null;
      }
      if (method === "PUT") {
        const text = body.body || "";
        if (!text.trim()) { // tom = slet
          if (MODE === "local") { delete local.item_notes[key]; saveLocal(); return null; }
          await sb("DELETE", "item_notes", { query: `?item_key=eq.${encodeURIComponent(key)}` });
          return null;
        }
        if (MODE === "local") {
          const existing = local.item_notes[key];
          const row = {
            item_key: key, body: text, author: body.author || persona.get(),
            height: body.height | 0,
            created_at: existing ? existing.created_at : nowISO(), updated_at: nowISO(),
          };
          local.item_notes[key] = row; saveLocal();
          return { ...row };
        }
        // Supabase upsert på item_key
        const row = {
          item_key: key, body: text, author: body.author || persona.get(),
          height: body.height | 0, updated_at: nowISO(),
        };
        const out = await sb("POST", "item_notes", {
          query: "?on_conflict=item_key",
          body: row,
          prefer: "resolution=merge-duplicates,return=representation",
        });
        return one(out);
      }
    }

    /* ---- workspaces/{phase}/notes | links ---- */
    if (seg0 === "workspaces") {
      const phase = parts[1], sub = parts[2];
      if (sub === "notes" && method === "POST") {
        if (MODE === "local") {
          const w = wsOf(phase);
          if (w.notes.length >= LIMITS.max_free_notes) throw new Error("Du har nået grænsen for noter i dette område.");
          const n = {
            id: nextId(), phase_id: phase, title: body.title || "", body: body.body || "",
            author: body.author || persona.get(), height: body.height | 0,
            position: w.notes.length, created_at: nowISO(), updated_at: nowISO(),
          };
          w.notes.push(n); saveLocal(); return { ...n };
        }
        const out = await sb("POST", "ws_notes", {
          body: {
            phase_id: phase, title: body.title || "", body: body.body || "",
            author: body.author || persona.get(), height: body.height | 0, position: body.position | 0,
          },
          prefer: "return=representation",
        });
        return one(out);
      }
      if (sub === "links" && method === "POST") {
        const u = (body.url || "").trim();
        if (!(u.startsWith("http://") || u.startsWith("https://"))) throw new Error("URL skal starte med http:// eller https://");
        if (MODE === "local") {
          const w = wsOf(phase);
          if (w.links.length >= LIMITS.max_links) throw new Error("Du har nået grænsen for links i dette område.");
          const ln = { id: nextId(), phase_id: phase, label: body.label || "", url: u, author: body.author || persona.get(), created_at: nowISO() };
          w.links.push(ln); saveLocal(); return { ...ln };
        }
        const out = await sb("POST", "ws_links", {
          body: { phase_id: phase, label: body.label || "", url: u, author: body.author || persona.get() },
          prefer: "return=representation",
        });
        return one(out);
      }
    }

    /* ---- notes/{id}  (ws free notes) ---- */
    if (seg0 === "notes") {
      const id = MODE === "local" ? parseInt(parts[1], 10) : parts[1];
      if (MODE === "local") {
        for (const w of Object.values(local.workspaces)) {
          const i = (w.notes || []).findIndex((n) => n.id === id);
          if (i >= 0) {
            if (method === "DELETE") { w.notes.splice(i, 1); saveLocal(); return null; }
            if (method === "PUT") {
              const n = w.notes[i];
              if (body.title != null) n.title = body.title;
              if (body.body != null) n.body = body.body;
              if (body.author) n.author = body.author;
              n.height = body.height | 0; n.updated_at = nowISO();
              saveLocal(); return { ...n };
            }
          }
        }
        return null;
      }
      if (method === "DELETE") { await sb("DELETE", "ws_notes", { query: `?id=eq.${id}` }); return null; }
      if (method === "PUT") {
        const patch = { updated_at: nowISO() };
        if (body.title != null) patch.title = body.title;
        if (body.body != null) patch.body = body.body;
        if (body.author) patch.author = body.author;
        patch.height = body.height | 0;
        const out = await sb("PATCH", "ws_notes", { query: `?id=eq.${id}`, body: patch, prefer: "return=representation" });
        return one(out);
      }
    }

    /* ---- links/{id} ---- */
    if (seg0 === "links" && method === "DELETE") {
      const id = MODE === "local" ? parseInt(parts[1], 10) : parts[1];
      if (MODE === "local") {
        for (const w of Object.values(local.workspaces)) {
          const i = (w.links || []).findIndex((l) => l.id === id);
          if (i >= 0) { w.links.splice(i, 1); saveLocal(); return null; }
        }
        return null;
      }
      await sb("DELETE", "ws_links", { query: `?id=eq.${id}` });
      return null;
    }

    /* ---- questions ---- */
    if (seg0 === "questions") {
      // POST /api/questions  (ny)
      if (method === "POST" && parts.length === 1) {
        if (MODE === "local") {
          const q = {
            id: nextId(), phase_id: body.phase_id || null, item_key: body.item_key || null,
            item_title: body.item_title || null, question: body.question || "",
            asked_by: body.asked_by || persona.get(), answer: null, answered_by: null,
            status: "open", created_at: nowISO(), answered_at: null,
          };
          local.questions.push(q); saveLocal(); return { ...q };
        }
        const out = await sb("POST", "questions", {
          body: {
            phase_id: body.phase_id || null, item_key: body.item_key || null,
            item_title: body.item_title || null, question: body.question || "",
            asked_by: body.asked_by || persona.get(), status: "open",
          },
          prefer: "return=representation",
        });
        return one(out);
      }
      // {id}
      const id = MODE === "local" ? parseInt(parts[1], 10) : parts[1];
      if (method === "DELETE") {
        if (MODE === "local") {
          local.questions = local.questions.filter((q) => q.id !== id); saveLocal(); return null;
        }
        await sb("DELETE", "questions", { query: `?id=eq.${id}` });
        return null;
      }
      if (method === "PUT") {
        if (MODE === "local") {
          const q = local.questions.find((x) => x.id === id);
          if (!q) return null;
          if (body.answer != null) {
            q.answer = body.answer;
            q.answered_by = body.answered_by || persona.get();
            q.status = body.answer.trim() ? "answered" : "open";
            q.answered_at = body.answer.trim() ? nowISO() : null;
          }
          if (body.question != null) q.question = body.question;
          saveLocal(); return { ...q };
        }
        const patch = {};
        if (body.answer != null) {
          patch.answer = body.answer;
          patch.answered_by = body.answered_by || persona.get();
          patch.status = body.answer.trim() ? "answered" : "open";
          patch.answered_at = body.answer.trim() ? nowISO() : null;
        }
        if (body.question != null) patch.question = body.question;
        const out = await sb("PATCH", "questions", { query: `?id=eq.${id}`, body: patch, prefer: "return=representation" });
        return one(out);
      }
    }

    return null;
  }

  return {
    mode: MODE,
    persona,
    checksObject,
    bootstrap: pullShared,
    refresh: pullShared,
    api,
    limits: LIMITS,
  };
})();
