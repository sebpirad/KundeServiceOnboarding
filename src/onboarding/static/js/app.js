/* ============================================================
   PowerMatch — Onboarding wizard (frontend)
   Server-persisted progress + two note features:
     1) per-item personal notes (every phase)
     2) phase-4 "1:1 oplæring" workspace: links + free notes
   State is hydrated from the #bootstrap JSON and synced to the
   FastAPI backend. No localStorage.
   ============================================================ */
(() => {
  "use strict";

  /* ---------- bootstrap ---------- */
  const boot = JSON.parse(document.getElementById("bootstrap").textContent);
  const PHASES = boot.phases;
  const LIMITS = boot.limits || { max_free_notes: 12, max_links: 20 };

  // Mutable client mirror of server state.
  const checks = new Set(Object.keys(boot.state.checks || {}));
  const itemNotes = new Map(); // key -> {body,height,created_at,updated_at}
  for (const [k, v] of Object.entries(boot.state.item_notes || {})) itemNotes.set(k, v);
  const workspaces = boot.state.workspaces || {}; // phase_id -> {notes:[], links:[]}

  const TOTAL = PHASES.reduce((n, p) => n + p.items.length, 0);

  /* ---------- tiny helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  function fmt(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const t = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${t}`;
  }

  async function api(method, url, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    if (!res.ok) {
      let detail = res.statusText;
      try { detail = (await res.json()).detail || detail; } catch (_) {}
      const err = new Error(detail);
      err.status = res.status;
      throw err;
    }
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  }

  /* ---------- inline SVG glyphs (Lucide-style) ---------- */
  const G = {
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    report: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>',
    interviews: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    audio: '<path d="M3 10v4M7 6v12M11 3v18M15 7v10M19 10v4"/>',
    task: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    video: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    live: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    note: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    expand: '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
    collapse: '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  };
  const svg = (name, attrs = "") =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${attrs}>${G[name] || ""}</svg>`;

  const TAG = { video: "Video", audio: "Lyd", doc: "Dokument", pdf: "PDF", live: "Live" };
  const OPEN_LABEL = { video: "Se video", audio: "Åbn mappe", doc: "Åbn dokument", pdf: "Åbn PDF", live: "Åbn" };
  const TYPE_ICON = { task: "task", video: "video", audio: "audio", doc: "doc", pdf: "pdf", live: "live" };

  /* ---------- navigation model ---------- */
  // Ordered linear views; "notes" is a side view reached via rail / done.
  const ORDER = ["welcome", ...PHASES.map((p) => p.id), "done"];
  let current = "welcome";

  const dom = {
    workScroll: $("#workScroll"),
    phaseMount: $("#phaseMount"),
    steps: $("#steps"),
    railPct: $("#railPct"),
    railBar: $("#railBar"),
    railMeta: $("#railMeta"),
    railProg: $("#railProg"),
    foot: $("#foot"),
    footN: $("#footN"),
    footDots: $("#footDots"),
    prevBtn: $("#prevBtn"),
    nextBtn: $("#nextBtn"),
    nextLabel: $("#nextLabel"),
    startBtn: $("#startBtn"),
    startLabel: $("#startLabel"),
    notesLink: $("#myNotesLink"),
    notesBadge: $("#notesBadge"),
    notesBody: $("#notesBody"),
    backFromNotes: $("#backFromNotesBtn"),
    doneNotesBtn: $("#doneNotesBtn"),
    printNotes: $("#printNotesBtn"),
    reviewBtn: $("#reviewBtn"),
    recapSteps: $("#recapSteps"),
    recapNotes: $("#recapNotes"),
    brand: $("#brand"),
  };

  /* ---------- derived state ---------- */
  const checkedCount = () => checks.size;
  const phaseItemKeys = (p) => p.items.map((it) => it.key);
  const phaseDone = (p) => phaseItemKeys(p).every((k) => checks.has(k));
  const phaseHasNotes = (p) => phaseItemKeys(p).some((k) => itemNotes.has(k)) ||
    (workspaces[p.id] && workspaces[p.id].notes.length > 0);
  const noteCount = () => {
    let n = itemNotes.size;
    for (const w of Object.values(workspaces)) n += (w.notes ? w.notes.length : 0);
    return n;
  };

  /* ============================================================
     RENDER: rail steps
     ============================================================ */
  function renderSteps() {
    dom.steps.innerHTML = "";
    PHASES.forEach((p) => {
      const done = phaseDone(p);
      const step = el("div", "step");
      step.dataset.view = p.id;
      if (p.id === current) step.classList.add("active");
      if (done) step.classList.add("done");
      if (phaseHasNotes(p)) step.classList.add("has-notes");
      step.innerHTML = `
        <div class="ind">
          <div class="badge"><span class="n">${p.num}</span>${svg("check", 'class="ck"')}</div>
          <div class="line"></div>
        </div>
        <div class="txt">
          <div class="st-ttl">${esc(p.nav_title || p.title)}</div>
          <div class="st-sub">${esc(p.kicker)}</div>
        </div>
        <span class="note-dot" title="Du har noter her"></span>`;
      step.addEventListener("click", () => goTo(p.id));
      dom.steps.appendChild(step);
    });
  }

  function refreshRailProgress() {
    const pct = TOTAL ? Math.round((checkedCount() / TOTAL) * 100) : 0;
    dom.railPct.textContent = pct;
    dom.railBar.style.width = pct + "%";
    dom.railMeta.textContent = `${checkedCount()} af ${TOTAL} trin`;
    dom.railProg.classList.toggle("complete", pct === 100);
    dom.notesBadge.textContent = noteCount();
    dom.notesLink.classList.toggle("has", noteCount() > 0);
  }

  /* ============================================================
     RENDER: a single phase screen
     ============================================================ */
  function buildPhaseScreen(p, idx) {
    const sec = el("section", "screen");
    sec.id = "screen-" + p.id;
    const done = phaseDone(p);
    if (done) sec.classList.add("is-done");

    const canvas = el("div", "canvas");

    // header
    const head = el("div", "ph-head");
    head.innerHTML = `
      <div class="ph-tile">${svg(p.icon === "audio" ? "audio" : (p.icon || "").replace(".svg", "") || "task")}</div>
      <div class="meta">
        <div class="ph-kick"><span class="b">Fase ${p.num}</span><span class="sep"></span>${esc(p.kicker)}</div>
        <h1>${esc(p.title)}</h1>
      </div>
      <div class="ph-count">${svg("check", 'class="ck"')}<span class="n">0 / ${p.items.length}</span></div>`;
    canvas.appendChild(head);

    canvas.appendChild(el("p", "ph-purpose", esc(p.purpose)));

    // grid: main (task list) + aside
    const grid = el("div", "ph-grid");
    const main = el("div", "ph-main");
    const list = el("div", "list");
    p.items.forEach((it) => list.appendChild(buildRow(p, it)));
    main.appendChild(list);

    // phase-4 workspace
    if (p.workspace) main.appendChild(buildWorkspace(p));

    grid.appendChild(main);
    grid.appendChild(buildAside(p, idx));
    canvas.appendChild(grid);
    sec.appendChild(canvas);
    return sec;
  }

  function buildAside(p, idx) {
    const aside = el("div", "ph-aside");

    // progress ring card
    const progCard = el("div", "aside-card");
    progCard.innerHTML = `
      <div class="ac-lbl">Denne fase</div>
      <div class="prog-row">
        <div class="ring2"><div class="ring2-in"><b class="rp-done">0</b><span>/${p.items.length}</span></div></div>
        <div class="prog-txt"><b class="rp-pct">0%</b><span>trin gennemført</span></div>
      </div>`;
    aside.appendChild(progCard);

    // tip
    if (p.tip) {
      const tip = el("div", "aside-card tip");
      tip.innerHTML = `
        <div class="tip-ic">${svg("clock")}</div>
        <div class="tt"><b>${esc(p.tip.label)}</b><span>${esc(p.tip.text)}</span></div>`;
      aside.appendChild(tip);
    }

    // next-up
    const next = ORDER[ORDER.indexOf(p.id) + 1];
    if (next) {
      const nextP = PHASES.find((x) => x.id === next);
      const nu = el("div", "aside-card next-up");
      const label = next === "done" ? "Afslut" : "Næste fase";
      const ttl = next === "done" ? "Du er klar!" : esc(nextP.nav_title || nextP.title);
      nu.innerHTML = `
        <div class="nu-lbl">Bagefter</div>
        <div class="nu-row">
          <div class="nu-tile">${svg(next === "done" ? "check" : (nextP.icon === "audio" ? "audio" : (nextP.icon || "").replace(".svg", "") || "task"))}</div>
          <div class="nu-meta"><b>${label}</b><span>${ttl}</span></div>
          <div class="nu-arrow">${svg("external")}</div>
        </div>`;
      nu.addEventListener("click", () => goTo(next));
      aside.appendChild(nu);
    }
    return aside;
  }

  /* ---------- one task/resource row + its note zone ---------- */
  function buildRow(p, it) {
    const wrap = el("div", "row-wrap");
    wrap.dataset.key = it.key;
    if (checks.has(it.key)) wrap.classList.add("done");

    const row = el("div", "row");
    const hasNote = itemNotes.has(it.key);

    // side controls
    const sideBits = [];
    if (TAG[it.type]) sideBits.push(`<span class="tag ${it.type}">${TAG[it.type]}</span>`);
    if (it.time) sideBits.push(`<span class="tag time">${svg("clock")}${esc(it.time)}</span>`);
    if (it.url) {
      sideBits.push(
        `<a class="open" href="${esc(it.url)}" target="_blank" rel="noopener">${OPEN_LABEL[it.type] || "Åbn"}${svg("external")}</a>`
      );
    }
    sideBits.push(
      `<button class="note-btn${hasNote ? " has" : ""}" type="button">${svg("note")}<span class="lbl">${hasNote ? "Note" : "Tilføj note"}</span><span class="dot"></span></button>`
    );

    row.innerHTML = `
      <label class="check">
        <input type="checkbox" ${checks.has(it.key) ? "checked" : ""}>
        <span class="box">${svg("check")}</span>
      </label>
      <div class="r-tile">${svg(TYPE_ICON[it.type] || "task")}</div>
      <div class="r-body">
        <div class="r-title">${esc(it.title)}</div>
        ${it.desc ? `<div class="r-desc">${esc(it.desc)}</div>` : ""}
      </div>
      <div class="r-side">${sideBits.join("")}</div>`;
    wrap.appendChild(row);

    // checkbox
    const cb = $("input", row);
    cb.addEventListener("change", () => toggleCheck(p, it.key, cb.checked, wrap));

    // note zone (lazily built once, toggled open/closed)
    const noteBtn = $(".note-btn", row);
    const zone = el("div", "note-zone");
    wrap.appendChild(zone);
    let built = false;
    noteBtn.addEventListener("click", () => {
      if (!built) { buildItemNoteCard(zone, it, noteBtn); built = true; }
      const open = zone.classList.toggle("open");
      noteBtn.classList.toggle("active", open);
      if (open) { const ta = $("textarea", zone); if (ta) ta.focus(); }
    });
    // auto-open if a note already exists
    if (hasNote) {
      buildItemNoteCard(zone, it, noteBtn);
      built = true;
    }
    return wrap;
  }

  /* ---------- per-item note editor card ---------- */
  function buildItemNoteCard(zone, it, noteBtn) {
    const data = itemNotes.get(it.key);
    const card = el("div", "note-card");
    card.innerHTML = `
      <div class="nc-head">
        ${svg("note", 'class="nc-ic"')}
        <div class="nc-meta"></div>
        <span class="nc-status">Gemt</span>
      </div>
      <textarea placeholder="Skriv din note til “${esc(it.title)}” …"></textarea>
      <div class="nc-foot">
        <span class="nc-hint">${svg("save")} Gemmes automatisk</span>
        <div class="nc-actions">
          <button class="nc-btn expand" type="button">${svg("expand")}<span>Større</span></button>
          <button class="nc-btn danger del" type="button">${svg("trash")}Slet</button>
        </div>
      </div>`;
    const ta = $("textarea", card);
    const meta = $(".nc-meta", card);
    const status = $(".nc-status", card);
    const expandBtn = $(".expand", card);
    const delBtn = $(".del", card);

    if (data) { ta.value = data.body; if (data.height) ta.style.height = data.height + "px"; }
    renderMeta(meta, data);

    let timer = null;
    let flash = null;
    const showSaved = () => {
      status.classList.add("show");
      clearTimeout(flash);
      flash = setTimeout(() => status.classList.remove("show"), 1400);
    };

    const save = async () => {
      const body = ta.value;
      const height = Math.round(ta.getBoundingClientRect().height) || 0;
      try {
        const row = await api("PUT", `/api/item-notes/${encodeURIComponent(it.key)}`, { body, height });
        if (row) {
          itemNotes.set(it.key, row);
          renderMeta(meta, row);
          markNoteBtn(noteBtn, true);
        } else {
          itemNotes.delete(it.key);
          renderMeta(meta, null);
          markNoteBtn(noteBtn, false);
        }
        refreshIndicators(it.key);
        showSaved();
      } catch (e) { console.error("note save failed", e); }
    };

    ta.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(save, 550); });
    ta.addEventListener("blur", () => { clearTimeout(timer); save(); });

    expandBtn.addEventListener("click", () => {
      const lg = card.classList.toggle("lg");
      expandBtn.innerHTML = lg ? `${svg("collapse")}<span>Mindre</span>` : `${svg("expand")}<span>Større</span>`;
      if (lg) ta.focus();
    });

    delBtn.addEventListener("click", async () => {
      const had = itemNotes.has(it.key);
      ta.value = "";
      try {
        if (had) await api("DELETE", `/api/item-notes/${encodeURIComponent(it.key)}`);
      } catch (e) { /* already gone */ }
      itemNotes.delete(it.key);
      renderMeta(meta, null);
      markNoteBtn(noteBtn, false);
      refreshIndicators(it.key);
      // close the zone
      const z = card.closest(".note-zone");
      if (z) { z.classList.remove("open"); noteBtn.classList.remove("active"); }
    });

    zone.appendChild(card);
  }

  function renderMeta(meta, data) {
    if (!data) { meta.innerHTML = `<span>Ny note</span>`; return; }
    const created = fmt(data.created_at);
    const updated = fmt(data.updated_at);
    let html = `<b>Oprettet</b> ${created}`;
    if (updated && updated !== created) html += ` · <b>Redigeret</b> ${updated}`;
    meta.innerHTML = html;
  }

  function markNoteBtn(btn, has) {
    btn.classList.toggle("has", has);
    const lbl = $(".lbl", btn);
    if (lbl) lbl.textContent = has ? "Note" : "Tilføj note";
  }

  /* ---------- refresh note indicators (rail dot + badge) ---------- */
  function refreshIndicators() {
    PHASES.forEach((p) => {
      const step = dom.steps.querySelector(`.step[data-view="${p.id}"]`);
      if (step) step.classList.toggle("has-notes", phaseHasNotes(p));
    });
    refreshRailProgress();
  }

  /* ============================================================
     RENDER: phase-4 workspace (links + free notes)
     ============================================================ */
  function buildWorkspace(p) {
    const ws = workspaces[p.id] || (workspaces[p.id] = { notes: [], links: [] });
    const box = el("div", "ws");
    box.innerHTML = `
      <div class="ws-head">
        <div class="ws-ic">${svg("briefcase")}</div>
        <div class="ws-tt">
          <b>1:1 oplæring — dit arbejdsområde</b>
          <span>Gem links fra din oplærer og skriv dine egne noter undervejs.</span>
        </div>
      </div>
      <div class="ws-body">
        <div class="ws-sec-lbl">Links <span class="n links-n">0</span></div>
        <div class="links"></div>
        <div class="link-add">
          <input class="label" type="text" placeholder="Titel (valgfri)">
          <input class="url" type="url" placeholder="https://…">
          <button class="btn btn-ghost add-link" type="button">${svg("plus")}Tilføj link</button>
        </div>
        <div class="ws-divider"></div>
        <div class="ws-sec-lbl">Noter <span class="n notes-n">0</span></div>
        <div class="fnotes"></div>
      </div>`;

    const linksWrap = $(".links", box);
    const linksN = $(".links-n", box);
    const labelIn = $(".label", box);
    const urlIn = $(".url", box);
    const addLinkBtn = $(".add-link", box);
    const fnotes = $(".fnotes", box);
    const notesN = $(".notes-n", box);

    const renderLinkCount = () => { linksN.textContent = ws.links.length; addLinkBtn.disabled = ws.links.length >= LIMITS.max_links; };
    const renderNoteCount = () => { notesN.textContent = ws.notes.length; };

    // existing links
    ws.links.forEach((ln) => linksWrap.appendChild(buildLinkChip(p, ln, ws, linksWrap, renderLinkCount)));
    renderLinkCount();

    const addLink = async () => {
      const url = urlIn.value.trim();
      if (!url) { urlIn.focus(); return; }
      try {
        const ln = await api("POST", `/api/workspaces/${p.id}/links`, { label: labelIn.value.trim(), url });
        ws.links.push(ln);
        linksWrap.appendChild(buildLinkChip(p, ln, ws, linksWrap, renderLinkCount));
        labelIn.value = ""; urlIn.value = "";
        renderLinkCount();
      } catch (e) { alert(e.message || "Kunne ikke tilføje link."); }
    };
    addLinkBtn.addEventListener("click", addLink);
    urlIn.addEventListener("keydown", (e) => { if (e.key === "Enter") addLink(); });

    // existing notes
    const addTile = el("div", "fnote-add");
    addTile.innerHTML = `<div class="plus">${svg("plus")}<span>Ny note</span></div>`;
    const renderAddTile = () => { addTile.style.display = ws.notes.length >= LIMITS.max_free_notes ? "none" : "grid"; };
    addTile.addEventListener("click", async () => {
      try {
        const n = await api("POST", `/api/workspaces/${p.id}/notes`, { title: "", body: "", height: 0 });
        ws.notes.push(n);
        fnotes.insertBefore(buildFreeNote(p, n, ws, fnotes, renderNoteCount, renderAddTile), addTile);
        renderNoteCount(); renderAddTile();
        refreshIndicators();
        const card = fnotes.querySelector(`.fnote[data-id="${n.id}"]`);
        if (card) $("textarea", card).focus();
      } catch (e) { alert(e.message || "Kunne ikke oprette note."); }
    });

    ws.notes.forEach((n) => fnotes.appendChild(buildFreeNote(p, n, ws, fnotes, renderNoteCount, renderAddTile)));
    fnotes.appendChild(addTile);
    renderNoteCount(); renderAddTile();

    return box;
  }

  function buildLinkChip(p, ln, ws, wrap, recount) {
    const chip = el("div", "link-chip");
    chip.dataset.id = ln.id;
    let host = ln.url;
    try { host = new URL(ln.url).hostname.replace(/^www\./, ""); } catch (_) {}
    chip.innerHTML = `
      <div class="lc-ic">${svg("link")}</div>
      <a class="lc-body" href="${esc(ln.url)}" target="_blank" rel="noopener">
        <div class="lc-label">${esc(ln.label || ln.url)}</div>
        <div class="lc-url">${esc(host)}</div>
      </a>
      <button class="lc-del" type="button" title="Fjern link">${svg("trash")}</button>`;
    $(".lc-del", chip).addEventListener("click", async () => {
      try { await api("DELETE", `/api/links/${ln.id}`); } catch (e) {}
      ws.links = ws.links.filter((x) => x.id !== ln.id);
      chip.remove(); recount();
    });
    return chip;
  }

  function buildFreeNote(p, n, ws, wrap, recount, renderAddTile) {
    const card = el("div", "fnote");
    card.dataset.id = n.id;
    card.innerHTML = `
      <div class="fn-head">
        <input class="fn-title" type="text" placeholder="Titel" value="${esc(n.title)}">
        <button class="fn-toggle" type="button" title="Større / mindre">${svg("expand")}</button>
        <button class="fn-del" type="button" title="Slet note">${svg("trash")}</button>
      </div>
      <textarea placeholder="Skriv din note …">${esc(n.body)}</textarea>
      <div class="fn-foot">
        <span class="fn-meta"></span>
        <span class="fn-status">Gemt</span>
      </div>`;
    const titleIn = $(".fn-title", card);
    const ta = $("textarea", card);
    const meta = $(".fn-meta", card);
    const status = $(".fn-status", card);
    const toggle = $(".fn-toggle", card);
    const delBtn = $(".fn-del", card);
    if (n.height) ta.style.height = n.height + "px";

    const setMeta = (d) => {
      const c = fmt(d.created_at), u = fmt(d.updated_at);
      meta.textContent = (u && u !== c) ? `Redigeret ${u}` : `Oprettet ${c}`;
    };
    setMeta(n);

    let timer = null, flash = null;
    const showSaved = () => { status.classList.add("show"); clearTimeout(flash); flash = setTimeout(() => status.classList.remove("show"), 1300); };
    const save = async () => {
      const height = Math.round(ta.getBoundingClientRect().height) || 0;
      try {
        const row = await api("PUT", `/api/notes/${n.id}`, { title: titleIn.value, body: ta.value, height });
        Object.assign(n, row);
        setMeta(row); showSaved();
      } catch (e) { console.error("free note save failed", e); }
    };
    const debounced = () => { clearTimeout(timer); timer = setTimeout(save, 550); };
    ta.addEventListener("input", debounced);
    titleIn.addEventListener("input", debounced);
    ta.addEventListener("blur", () => { clearTimeout(timer); save(); });
    titleIn.addEventListener("blur", () => { clearTimeout(timer); save(); });

    toggle.addEventListener("click", () => {
      const ex = card.classList.toggle("expanded");
      toggle.innerHTML = ex ? svg("collapse") : svg("expand");
      if (ex) ta.focus();
    });
    delBtn.addEventListener("click", async () => {
      try { await api("DELETE", `/api/notes/${n.id}`); } catch (e) {}
      ws.notes = ws.notes.filter((x) => x.id !== n.id);
      card.remove(); recount(); renderAddTile(); refreshIndicators();
    });
    return card;
  }

  /* ============================================================
     CHECK toggle
     ============================================================ */
  function toggleCheck(p, key, checked, wrap) {
    if (checked) checks.add(key); else checks.delete(key);
    wrap.classList.toggle("done", checked);
    updatePhaseScreen(p);
    renderSteps();
    refreshRailProgress();
    updateFooter();
    api("POST", "/api/check", { item_key: key, checked }).catch((e) => console.error("check failed", e));
    if (checks.size === TOTAL) maybeCelebrate();
  }

  function updatePhaseScreen(p) {
    const sec = $("#screen-" + p.id);
    if (!sec) return;
    const total = p.items.length;
    const done = phaseItemKeys(p).filter((k) => checks.has(k)).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    sec.classList.toggle("is-done", done === total);
    const countN = $(".ph-count .n", sec); if (countN) countN.textContent = `${done} / ${total}`;
    const ring = $(".ring2", sec); if (ring) { ring.style.setProperty("--p", pct); ring.classList.toggle("done", done === total); }
    const rd = $(".rp-done", sec); if (rd) rd.textContent = done;
    const rp = $(".rp-pct", sec); if (rp) rp.textContent = pct + "%";
  }

  /* ============================================================
     NAVIGATION
     ============================================================ */
  function showView(view) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("show"));
    let sec;
    if (view === "welcome") sec = $("#screen-welcome");
    else if (view === "done") sec = $("#screen-done");
    else if (view === "notes") sec = $("#screen-notes");
    else sec = $("#screen-" + view);
    if (sec) sec.classList.add("show");
    dom.workScroll.scrollTop = 0;
  }

  function goTo(view) {
    current = view;
    showView(view);

    // sync per-phase live numbers when entering a phase
    const p = PHASES.find((x) => x.id === view);
    if (p) updatePhaseScreen(p);
    if (view === "done") renderDone();
    if (view === "notes") renderNotes();

    renderSteps();
    updateFooter();
  }

  function updateFooter() {
    const isPhase = PHASES.some((p) => p.id === current);
    dom.foot.classList.toggle("show", isPhase);
    if (!isPhase) return;
    const i = PHASES.findIndex((p) => p.id === current);
    dom.footN.textContent = `Fase ${i + 1} af ${PHASES.length}`;
    // dots
    dom.footDots.innerHTML = "";
    PHASES.forEach((p, j) => {
      const d = el("i");
      if (phaseDone(p)) d.classList.add("done");
      if (j === i) d.classList.add("on");
      dom.footDots.appendChild(d);
    });
    dom.prevBtn.disabled = false;
    const last = i === PHASES.length - 1;
    dom.nextLabel.textContent = last ? "Afslut onboarding" : "Fortsæt";
    dom.nextBtn.classList.toggle("ready", last && phaseDone(PHASES[i]));
  }

  dom.prevBtn.addEventListener("click", () => {
    const i = ORDER.indexOf(current);
    if (i > 0) goTo(ORDER[i - 1]);
  });
  dom.nextBtn.addEventListener("click", () => {
    const i = ORDER.indexOf(current);
    if (i < ORDER.length - 1) goTo(ORDER[i + 1]);
  });
  dom.startBtn.addEventListener("click", () => goTo(PHASES[0].id));
  dom.brand.addEventListener("click", () => goTo("welcome"));
  dom.notesLink.addEventListener("click", () => goTo("notes"));
  dom.backFromNotes.addEventListener("click", () => goTo(PHASES[0].id));
  dom.doneNotesBtn.addEventListener("click", () => goTo("notes"));
  dom.reviewBtn.addEventListener("click", () => goTo("welcome"));
  dom.printNotes.addEventListener("click", () => window.print());

  /* ============================================================
     DONE + NOTES screens
     ============================================================ */
  function renderDone() {
    dom.recapSteps.textContent = checkedCount();
    dom.recapNotes.textContent = noteCount();
  }

  function renderNotes() {
    const body = dom.notesBody;
    body.innerHTML = "";
    let any = false;

    PHASES.forEach((p) => {
      const entries = [];
      // per-item notes
      p.items.forEach((it) => {
        const d = itemNotes.get(it.key);
        if (d && d.body.trim()) entries.push({ title: it.title, body: d.body, created: d.created_at, updated: d.updated_at });
      });
      // workspace free notes
      const ws = workspaces[p.id];
      if (ws && ws.notes) ws.notes.forEach((n) => {
        if (n.body.trim() || n.title.trim()) entries.push({ title: n.title || "Note (1:1)", body: n.body, created: n.created_at, updated: n.updated_at });
      });
      if (!entries.length) return;
      any = true;

      const group = el("div", "notes-group");
      group.innerHTML = `<div class="ng-head"><span class="pill">Fase ${p.num}</span><b>${esc(p.title)}</b></div>`;
      entries.forEach((e) => {
        const c = fmt(e.created), u = fmt(e.updated);
        const time = (u && u !== c) ? `Redigeret ${u}` : `Oprettet ${c}`;
        const item = el("div", "note-item");
        item.innerHTML = `
          <div class="ni-top"><span class="ni-title">${esc(e.title)}</span><span class="ni-time">${time}</span></div>
          <div class="ni-body">${esc(e.body)}</div>`;
        group.appendChild(item);
      });
      body.appendChild(group);
    });

    if (!any) {
      body.innerHTML = `
        <div class="notes-empty">
          <div class="ne-ic">${svg("note")}</div>
          <b>Ingen noter endnu</b>
          <span>Tryk “Tilføj note” ved et punkt for at samle dine tanker her.</span>
        </div>`;
    }
  }

  /* ============================================================
     CONFETTI (completion celebration)
     ============================================================ */
  let celebrated = false;
  function maybeCelebrate() {
    if (celebrated) return;
    celebrated = true;
    fireConfetti();
    setTimeout(() => goTo("done"), 650);
  }
  function fireConfetti() {
    const canvas = $("#confetti");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width = window.innerWidth;
    const H = canvas.height = window.innerHeight;
    canvas.style.display = "block";
    const colors = ["#F8E965", "#E6D84E", "#12B76A", "#FBF2A1", "#0B1119"];
    const N = 160;
    const parts = Array.from({ length: N }, () => ({
      x: Math.random() * W, y: -20 - Math.random() * H * 0.4,
      r: 4 + Math.random() * 6, c: colors[(Math.random() * colors.length) | 0],
      vx: -2 + Math.random() * 4, vy: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI, vr: -0.2 + Math.random() * 0.4,
    }));
    let frame = 0;
    (function loop() {
      ctx.clearRect(0, 0, W, H);
      parts.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6); ctx.restore();
      });
      frame++;
      if (frame < 220) requestAnimationFrame(loop);
      else { canvas.style.display = "none"; ctx.clearRect(0, 0, W, H); }
    })();
  }

  /* ============================================================
     INIT
     ============================================================ */
  function init() {
    // build phase screens
    PHASES.forEach((p, idx) => dom.phaseMount.appendChild(buildPhaseScreen(p, idx)));
    PHASES.forEach((p) => updatePhaseScreen(p));
    renderSteps();
    refreshRailProgress();
    // welcome start sublabel reflects resume state
    if (checkedCount() > 0 && checkedCount() < TOTAL) {
      dom.startLabel.textContent = "Fortsæt onboarding";
    }
    showView("welcome");
    updateFooter();
  }

  init();
})();
