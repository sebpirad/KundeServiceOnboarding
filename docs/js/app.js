/* ============================================================
   PowerMatch — Onboarding wizard (static / GitHub Pages build)
   Data via window.PM_DB (Supabase delt backend ELLER localStorage).
     • Personlig fremdrift (afkrydsninger) = lokal pr. enhed
     • Noter, links, spørgsmål = delt (når Supabase er sat op)
   Features: per-trin noter, fase-4 arbejdsområde, persona
   (Maiken/Michelle) med forfatter-badges, og "Spørgsmål fra
   Maiken" — et delt Q&A som oplæreren besvarer.
   ============================================================ */
(() => {
  "use strict";

  const CONTENT = window.PM_CONTENT || { phases: [], limits: {} };
  const PHASES = CONTENT.phases;
  const LIMITS = CONTENT.limits || { max_free_notes: 12, max_links: 20 };
  const DB = window.PM_DB;

  /* ---------- in-memory mirrors (fyldes i bootstrap) ---------- */
  const checks = new Set();
  const itemNotes = new Map();       // key -> {item_key, body, author, height, created_at, updated_at}
  const workspaces = {};             // phase_id -> {notes:[], links:[]}
  let questions = [];                // [{id, phase_id, item_key, item_title, question, asked_by, answer, answered_by, status, created_at, answered_at}]

  const TOTAL = PHASES.reduce((n, p) => n + p.items.length, 0);

  /* ---------- helpers ---------- */
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
  function rel(iso) {
    if (!iso) return "";
    const d = new Date(iso), s = (Date.now() - d.getTime()) / 1000;
    if (isNaN(d)) return "";
    if (s < 60) return "lige nu";
    if (s < 3600) return `for ${Math.floor(s / 60)} min siden`;
    if (s < 86400) return `for ${Math.floor(s / 3600)} t siden`;
    if (s < 172800) return "i går";
    return fmt(iso);
  }
  const api = (m, u, b) => DB.api(m, u, b);

  /* ---------- persona ---------- */
  const persona = {
    get: () => DB.persona.get(),
    set: (n) => DB.persona.set(n),
    list: () => DB.persona.list(),
  };
  const initial = (name) => (name || "?").trim().charAt(0).toUpperCase();
  // deterministisk farve-slot pr. person (0/1) → CSS styrer farverne
  const personaSlot = (name) => {
    const list = persona.list();
    const i = list.indexOf(name);
    return i < 0 ? 0 : i % 4;
  };
  function authorBadge(name, prefix = "") {
    const n = name || "—";
    return `<span class="abadge" data-slot="${personaSlot(n)}"><span class="ab-av">${esc(initial(n))}</span>${prefix ? esc(prefix) + " " : ""}${esc(n)}</span>`;
  }

  /* ---------- inline SVG glyphs ---------- */
  const G = {
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    video: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
    audio: '<path d="M3 10v4M7 6v12M11 3v18M15 7v10M19 10v4"/>',
    task: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    live: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    note: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    expand: '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
    collapse: '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    chat: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    reply: '<polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
    send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  };
  const svg = (name, attrs = "") =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${attrs}>${G[name] || ""}</svg>`;

  const TAG = { video: "Video", audio: "Lyd", doc: "Dokument", pdf: "PDF", live: "Live" };
  const OPEN_LABEL = { video: "Se video", audio: "Åbn mappe", doc: "Åbn dokument", pdf: "Åbn PDF", live: "Åbn" };
  const TYPE_ICON = { task: "task", video: "video", audio: "audio", doc: "doc", pdf: "pdf", live: "live" };
  const phaseIcon = (p) => (p.icon === "audio" ? "audio" : (p.icon || "").replace(".svg", "") || "task");

  /* ---------- navigation model ---------- */
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
    startSub: $("#startSub"),
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
    // persona
    persona: $("#persona"),
    personaPill: $("#personaPill"),
    personaAv: $("#personaAv"),
    personaName: $("#personaName"),
    personaMenu: $("#personaMenu"),
    // questions
    questionsLink: $("#questionsLink"),
    qBadge: $("#qBadge"),
    qMode: $("#qMode"),
    qSub: $("#qSub"),
    qAskInput: $("#qAskInput"),
    qAskPhase: $("#qAskPhase"),
    qAskBtn: $("#qAskBtn"),
    qAskHint: $("#qAskHint"),
    qFilters: $("#qFilters"),
    qcOpen: $("#qcOpen"),
    qcAns: $("#qcAns"),
    qcAll: $("#qcAll"),
    questionsBody: $("#questionsBody"),
  };

  /* ---------- derived ---------- */
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
  const openQCount = () => questions.filter((q) => q.status !== "answered").length;
  const phaseLabel = (pid) => {
    const p = PHASES.find((x) => x.id === pid);
    return p ? `Fase ${p.num}` : (pid ? pid : "Generelt");
  };

  /* ============================================================
     RAIL
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
    refreshQBadge();
  }
  function refreshQBadge() {
    const open = openQCount();
    dom.qBadge.textContent = open;
    dom.qBadge.classList.toggle("show", open > 0);
    dom.questionsLink.classList.toggle("has", questions.length > 0);
  }

  /* ============================================================
     PHASE SCREEN
     ============================================================ */
  function buildPhaseScreen(p, idx) {
    const sec = el("section", "screen");
    sec.id = "screen-" + p.id;
    if (phaseDone(p)) sec.classList.add("is-done");

    const canvas = el("div", "canvas");
    const head = el("div", "ph-head");
    head.innerHTML = `
      <div class="ph-tile">${svg(phaseIcon(p))}</div>
      <div class="meta">
        <div class="ph-kick"><span class="b">Fase ${p.num}</span><span class="sep"></span>${esc(p.kicker)}</div>
        <h1>${esc(p.title)}</h1>
      </div>
      <div class="ph-count">${svg("check", 'class="ck"')}<span class="n">0 / ${p.items.length}</span></div>`;
    canvas.appendChild(head);
    canvas.appendChild(el("p", "ph-purpose", esc(p.purpose)));

    const grid = el("div", "ph-grid");
    const main = el("div", "ph-main");
    const list = el("div", "list");
    p.items.forEach((it) => list.appendChild(buildRow(p, it)));
    main.appendChild(list);
    if (p.workspace) main.appendChild(buildWorkspace(p));
    grid.appendChild(main);
    grid.appendChild(buildAside(p));
    canvas.appendChild(grid);
    sec.appendChild(canvas);
    return sec;
  }

  function buildAside(p) {
    const aside = el("div", "ph-aside");

    const progCard = el("div", "aside-card");
    progCard.innerHTML = `
      <div class="ac-lbl">Denne fase</div>
      <div class="prog-row">
        <div class="ring2"><div class="ring2-in"><b class="rp-done">0</b><span>/${p.items.length}</span></div></div>
        <div class="prog-txt"><b class="rp-pct">0%</b><span>trin gennemført</span></div>
      </div>`;
    aside.appendChild(progCard);

    // --- Ask-a-question card (tied to this phase) ---
    const ask = el("div", "aside-card ask-card");
    ask.innerHTML = `
      <div class="ak-head">${svg("chat")}<b>Spørgsmål til Fase ${p.num}</b></div>
      <div class="ak-sub">Sidder du fast? Skriv det her — din oplærer svarer.</div>
      <textarea class="ak-input" placeholder="Hvad vil du spørge om?"></textarea>
      <div class="ak-row">
        <button class="btn btn-dark ak-send" type="button">${svg("send")}Send spørgsmål</button>
        <button class="ak-all" type="button">Se alle <span class="ak-open">0</span></button>
      </div>
      <div class="ak-flash"></div>`;
    const akInput = $(".ak-input", ask);
    const akSend = $(".ak-send", ask);
    const akAll = $(".ak-all", ask);
    const akFlash = $(".ak-flash", ask);
    const akOpen = $(".ak-open", ask);
    const updAk = () => { const c = questions.filter((q) => q.phase_id === p.id && q.status !== "answered").length; akOpen.textContent = c; akOpen.classList.toggle("zero", c === 0); };
    updAk();
    ask._updAk = updAk;
    const submitAsk = async () => {
      const text = akInput.value.trim();
      if (!text) { akInput.focus(); return; }
      akSend.disabled = true;
      try {
        const q = await api("POST", "/api/questions", { phase_id: p.id, question: text, asked_by: persona.get() });
        if (q) { questions.push(q); }
        akInput.value = "";
        akFlash.textContent = "Sendt ✓ — din oplærer kan nu se det.";
        akFlash.classList.add("show");
        setTimeout(() => akFlash.classList.remove("show"), 2600);
        refreshQBadge(); updateAllAskCards(); if (current === "questions") renderQuestions();
      } catch (e) { alert(e.message || "Kunne ikke sende spørgsmålet."); }
      akSend.disabled = false;
    };
    akSend.addEventListener("click", submitAsk);
    akInput.addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submitAsk(); });
    akAll.addEventListener("click", () => { qFilter = "open"; qAskPhasePref = p.id; goTo("questions"); });
    aside.appendChild(ask);

    if (p.tip) {
      const tip = el("div", "aside-card tip");
      tip.innerHTML = `
        <div class="tip-ic">${svg("clock")}</div>
        <div class="tt"><b>${esc(p.tip.label)}</b><span>${esc(p.tip.text)}</span></div>`;
      aside.appendChild(tip);
    }

    const next = ORDER[ORDER.indexOf(p.id) + 1];
    if (next) {
      const nextP = PHASES.find((x) => x.id === next);
      const nu = el("div", "aside-card next-up");
      const label = next === "done" ? "Afslut" : "Næste fase";
      const ttl = next === "done" ? "Du er klar!" : esc(nextP.nav_title || nextP.title);
      nu.innerHTML = `
        <div class="nu-lbl">Bagefter</div>
        <div class="nu-row">
          <div class="nu-tile">${svg(next === "done" ? "check" : phaseIcon(nextP))}</div>
          <div class="nu-meta"><b>${label}</b><span>${ttl}</span></div>
          <div class="nu-arrow">${svg("external")}</div>
        </div>`;
      nu.addEventListener("click", () => goTo(next));
      aside.appendChild(nu);
    }
    return aside;
  }

  function updateAllAskCards() {
    document.querySelectorAll(".ask-card").forEach((c) => { if (c._updAk) c._updAk(); });
  }

  /* ---------- task/resource row + note zone ---------- */
  function buildRow(p, it) {
    const wrap = el("div", "row-wrap");
    wrap.dataset.key = it.key;
    if (checks.has(it.key)) wrap.classList.add("done");

    const row = el("div", "row");
    const hasNote = itemNotes.has(it.key);

    const sideBits = [];
    if (TAG[it.type]) sideBits.push(`<span class="tag ${it.type}">${TAG[it.type]}</span>`);
    if (it.time) sideBits.push(`<span class="tag time">${svg("clock")}${esc(it.time)}</span>`);
    if (it.url) {
      sideBits.push(`<a class="open" href="${esc(it.url)}" target="_blank" rel="noopener">${OPEN_LABEL[it.type] || "Åbn"}${svg("external")}</a>`);
    }
    sideBits.push(`<button class="note-btn${hasNote ? " has" : ""}" type="button">${svg("note")}<span class="lbl">${hasNote ? "Note" : "Tilføj note"}</span><span class="dot"></span></button>`);

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

    const cb = $("input", row);
    cb.addEventListener("change", () => toggleCheck(p, it.key, cb.checked, wrap));

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
    if (hasNote) { buildItemNoteCard(zone, it, noteBtn); built = true; }
    return wrap;
  }

  /* ---------- per-item note editor (redesigned, author-aware) ---------- */
  function buildItemNoteCard(zone, it, noteBtn) {
    const data = itemNotes.get(it.key);
    const card = el("div", "note-card");
    card.innerHTML = `
      <div class="nc-head">
        <span class="nc-author"></span>
        <div class="nc-meta"></div>
        <span class="nc-status">${svg("save")}Gemt</span>
      </div>
      <textarea placeholder="Skriv din note til “${esc(it.title)}” …"></textarea>
      <div class="nc-foot">
        <span class="nc-hint">Gemmes automatisk · synlig for ${esc(persona.list().join(" & "))}</span>
        <div class="nc-actions">
          <button class="nc-btn expand" type="button">${svg("expand")}<span>Større</span></button>
          <button class="nc-btn danger del" type="button">${svg("trash")}Slet</button>
        </div>
      </div>`;
    const ta = $("textarea", card);
    const meta = $(".nc-meta", card);
    const authorEl = $(".nc-author", card);
    const status = $(".nc-status", card);
    const expandBtn = $(".expand", card);
    const delBtn = $(".del", card);

    if (data) { ta.value = data.body; if (data.height) ta.style.height = data.height + "px"; }
    renderNoteMeta(authorEl, meta, data);

    let timer = null, flash = null;
    const showSaved = () => { status.classList.add("show"); clearTimeout(flash); flash = setTimeout(() => status.classList.remove("show"), 1400); };

    const save = async () => {
      const body = ta.value;
      const height = Math.round(ta.getBoundingClientRect().height) || 0;
      try {
        const row = await api("PUT", `/api/item-notes/${encodeURIComponent(it.key)}`, { body, height, author: persona.get() });
        if (row) { itemNotes.set(it.key, row); renderNoteMeta(authorEl, meta, row); markNoteBtn(noteBtn, true); }
        else { itemNotes.delete(it.key); renderNoteMeta(authorEl, meta, null); markNoteBtn(noteBtn, false); }
        refreshIndicators();
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
      try { if (had) await api("DELETE", `/api/item-notes/${encodeURIComponent(it.key)}`); } catch (e) {}
      itemNotes.delete(it.key);
      renderNoteMeta(authorEl, meta, null);
      markNoteBtn(noteBtn, false);
      refreshIndicators();
      const z = card.closest(".note-zone");
      if (z) { z.classList.remove("open"); noteBtn.classList.remove("active"); }
    });

    zone.appendChild(card);
  }

  function renderNoteMeta(authorEl, meta, data) {
    if (!data) { authorEl.innerHTML = ""; meta.innerHTML = `<span>Ny note</span>`; return; }
    authorEl.innerHTML = data.author ? authorBadge(data.author) : "";
    const created = fmt(data.created_at), updated = fmt(data.updated_at);
    meta.innerHTML = (updated && updated !== created) ? `Redigeret ${updated}` : `Oprettet ${created}`;
  }
  function markNoteBtn(btn, has) {
    btn.classList.toggle("has", has);
    const lbl = $(".lbl", btn);
    if (lbl) lbl.textContent = has ? "Note" : "Tilføj note";
  }

  function refreshIndicators() {
    PHASES.forEach((p) => {
      const step = dom.steps.querySelector(`.step[data-view="${p.id}"]`);
      if (step) step.classList.toggle("has-notes", phaseHasNotes(p));
    });
    refreshRailProgress();
  }

  /* ============================================================
     PHASE-4 WORKSPACE
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

    ws.links.forEach((ln) => linksWrap.appendChild(buildLinkChip(p, ln, ws, linksWrap, renderLinkCount)));
    renderLinkCount();

    const addLink = async () => {
      const url = urlIn.value.trim();
      if (!url) { urlIn.focus(); return; }
      try {
        const ln = await api("POST", `/api/workspaces/${p.id}/links`, { label: labelIn.value.trim(), url, author: persona.get() });
        ws.links.push(ln);
        linksWrap.appendChild(buildLinkChip(p, ln, ws, linksWrap, renderLinkCount));
        labelIn.value = ""; urlIn.value = "";
        renderLinkCount();
      } catch (e) { alert(e.message || "Kunne ikke tilføje link."); }
    };
    addLinkBtn.addEventListener("click", addLink);
    urlIn.addEventListener("keydown", (e) => { if (e.key === "Enter") addLink(); });

    const addTile = el("div", "fnote-add");
    addTile.innerHTML = `<div class="plus">${svg("plus")}<span>Ny note</span></div>`;
    const renderAddTile = () => { addTile.style.display = ws.notes.length >= LIMITS.max_free_notes ? "none" : "grid"; };
    addTile.addEventListener("click", async () => {
      try {
        const n = await api("POST", `/api/workspaces/${p.id}/notes`, { title: "", body: "", height: 0, position: ws.notes.length, author: persona.get() });
        ws.notes.push(n);
        fnotes.insertBefore(buildFreeNote(p, n, ws, fnotes, renderNoteCount, renderAddTile), addTile);
        renderNoteCount(); renderAddTile(); refreshIndicators();
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
        <div class="lc-url">${esc(host)}${ln.author ? " · " + esc(ln.author) : ""}</div>
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
        <span class="fn-author"></span>
        <button class="fn-toggle" type="button" title="Større / mindre">${svg("expand")}</button>
        <button class="fn-del" type="button" title="Slet note">${svg("trash")}</button>
      </div>
      <textarea placeholder="Skriv din note …">${esc(n.body)}</textarea>
      <div class="fn-foot">
        <span class="fn-meta"></span>
        <span class="fn-status">${svg("save")}Gemt</span>
      </div>`;
    const titleIn = $(".fn-title", card);
    const ta = $("textarea", card);
    const meta = $(".fn-meta", card);
    const authorEl = $(".fn-author", card);
    const status = $(".fn-status", card);
    const toggle = $(".fn-toggle", card);
    const delBtn = $(".fn-del", card);
    if (n.height) ta.style.height = n.height + "px";

    const setMeta = (d) => {
      authorEl.innerHTML = d.author ? authorBadge(d.author) : "";
      const c = fmt(d.created_at), u = fmt(d.updated_at);
      meta.textContent = (u && u !== c) ? `Redigeret ${u}` : `Oprettet ${c}`;
    };
    setMeta(n);

    let timer = null, flash = null;
    const showSaved = () => { status.classList.add("show"); clearTimeout(flash); flash = setTimeout(() => status.classList.remove("show"), 1300); };
    const save = async () => {
      const height = Math.round(ta.getBoundingClientRect().height) || 0;
      try {
        const row = await api("PUT", `/api/notes/${n.id}`, { title: titleIn.value, body: ta.value, height, author: persona.get() });
        if (row) { Object.assign(n, row); setMeta(row); showSaved(); }
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
     SPØRGSMÅL FRA MAIKEN  (delt Q&A)
     ============================================================ */
  let qFilter = "open";
  let qAskPhasePref = "";

  function buildQuestionAskOptions() {
    const sel = dom.qAskPhase;
    if (!sel) return;
    sel.innerHTML = `<option value="">Generelt</option>` +
      PHASES.map((p) => `<option value="${p.id}">Fase ${p.num} · ${esc(p.nav_title || p.title)}</option>`).join("");
    if (qAskPhasePref) sel.value = qAskPhasePref;
  }

  function renderQMode() {
    const shared = DB.mode === "supabase";
    dom.qMode.innerHTML = shared
      ? `<span class="mode-dot ok"></span> Delt · synkroniseret`
      : `<span class="mode-dot warn"></span> Kun denne enhed`;
    dom.qMode.title = shared
      ? "Spørgsmål og svar deles mellem alle enheder."
      : "Supabase er ikke sat op endnu — spørgsmål gemmes kun lokalt i denne browser.";
  }

  function renderQuestions() {
    renderQMode();
    buildQuestionAskOptions();
    const body = dom.questionsBody;
    const open = questions.filter((q) => q.status !== "answered").length;
    const ans = questions.length - open;
    dom.qcOpen.textContent = open;
    dom.qcAns.textContent = ans;
    dom.qcAll.textContent = questions.length;
    dom.qSub.textContent = DB.mode === "supabase"
      ? "Stil spørgsmål mens du gennemgår platformen — din oplærer ser dem på sin egen enhed og svarer her."
      : "Stil spørgsmål mens du gennemgår platformen. (Slå deling til i config.js for at dele med din oplærer.)";

    // active filter button
    dom.qFilters.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.f === qFilter));

    const list = questions
      .filter((q) => qFilter === "all" ? true : qFilter === "open" ? q.status !== "answered" : q.status === "answered")
      .slice()
      .sort((a, b) => {
        // ubesvarede øverst, derefter nyeste
        const ao = a.status !== "answered", bo = b.status !== "answered";
        if (ao !== bo) return ao ? -1 : 1;
        return new Date(b.created_at) - new Date(a.created_at);
      });

    body.innerHTML = "";
    if (!list.length) {
      body.appendChild(el("div", "q-empty", `
        <div class="qe-ic">${svg("help")}</div>
        <b>${qFilter === "answered" ? "Ingen besvarede spørgsmål endnu" : qFilter === "open" ? "Ingen ubesvarede spørgsmål" : "Ingen spørgsmål endnu"}</b>
        <span>Brug feltet ovenfor — eller knappen ude ved hver fase — til at stille det første.</span>`));
      return;
    }

    // group by phase
    const groups = new Map();
    list.forEach((q) => {
      const k = q.phase_id || "_general";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(q);
    });
    const order = [...PHASES.map((p) => p.id), "_general"];
    order.forEach((gid) => {
      if (!groups.has(gid)) return;
      const arr = groups.get(gid);
      const p = PHASES.find((x) => x.id === gid);
      const grp = el("div", "q-group");
      grp.innerHTML = `<div class="qg-head"><span class="pill">${p ? "Fase " + p.num : "Generelt"}</span><b>${p ? esc(p.title) : "Ikke knyttet til en fase"}</b><span class="qg-n">${arr.length}</span></div>`;
      arr.forEach((q) => grp.appendChild(buildQuestionCard(q)));
      body.appendChild(grp);
    });
  }

  function buildQuestionCard(q) {
    const answered = q.status === "answered";
    const card = el("div", "q-card" + (answered ? " answered" : " open"));
    card.dataset.id = q.id;
    card.innerHTML = `
      <div class="qc-q">
        <div class="qc-meta">${authorBadge(q.asked_by)}<span class="qc-time">spurgte ${rel(q.created_at)}</span>${q.status === "answered" ? '<span class="qc-tag done">Besvaret</span>' : '<span class="qc-tag wait">Afventer svar</span>'}</div>
        <div class="qc-text">${esc(q.question)}</div>
        <button class="qc-del" type="button" title="Slet spørgsmål">${svg("trash")}</button>
      </div>
      <div class="qc-answer-zone"></div>`;
    const zone = $(".qc-answer-zone", card);

    if (answered) {
      const ans = el("div", "qc-answer");
      ans.innerHTML = `
        <div class="qa-ic">${svg("reply")}</div>
        <div class="qa-body">
          <div class="qc-meta">${authorBadge(q.answered_by, "")}<span class="qc-time">svarede ${rel(q.answered_at)}</span></div>
          <div class="qa-text">${esc(q.answer)}</div>
          <button class="qa-edit" type="button">Rediger svar</button>
        </div>`;
      $(".qa-edit", ans).addEventListener("click", () => openAnswerComposer(zone, q, true));
      zone.appendChild(ans);
    } else {
      openAnswerComposer(zone, q, false);
    }

    $(".qc-del", card).addEventListener("click", async () => {
      if (!confirm("Slet dette spørgsmål?")) return;
      try { await api("DELETE", `/api/questions/${q.id}`); } catch (e) {}
      questions = questions.filter((x) => String(x.id) !== String(q.id));
      refreshQBadge(); updateAllAskCards(); renderQuestions();
    });
    return card;
  }

  function openAnswerComposer(zone, q, isEdit) {
    zone.innerHTML = "";
    const comp = el("div", "qc-compose");
    comp.innerHTML = `
      <div class="qcc-lbl">${svg("reply")} Svar som ${authorBadge(persona.get())}</div>
      <textarea placeholder="Skriv svaret til ${esc(q.asked_by)} …">${isEdit ? esc(q.answer || "") : ""}</textarea>
      <div class="qcc-row">
        <button class="btn btn-primary qcc-save" type="button">${svg("check")}Gem svar</button>
        ${isEdit ? '<button class="qcc-cancel" type="button">Annullér</button>' : ''}
      </div>`;
    const ta = $("textarea", comp);
    const saveBtn = $(".qcc-save", comp);
    saveBtn.addEventListener("click", async () => {
      const answer = ta.value.trim();
      if (!answer) { ta.focus(); return; }
      saveBtn.disabled = true;
      try {
        const row = await api("PUT", `/api/questions/${q.id}`, { answer, answered_by: persona.get() });
        if (row) {
          const i = questions.findIndex((x) => String(x.id) === String(q.id));
          if (i >= 0) questions[i] = row;
        }
        refreshQBadge(); updateAllAskCards(); renderQuestions();
      } catch (e) { alert(e.message || "Kunne ikke gemme svaret."); saveBtn.disabled = false; }
    });
    const cancel = $(".qcc-cancel", comp);
    if (cancel) cancel.addEventListener("click", () => renderQuestions());
    zone.appendChild(comp);
  }

  function wireQuestionsUI() {
    dom.questionsLink.addEventListener("click", () => goTo("questions"));
    dom.qFilters.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => { qFilter = b.dataset.f; renderQuestions(); }));
    const submit = async () => {
      const text = dom.qAskInput.value.trim();
      if (!text) { dom.qAskInput.focus(); return; }
      dom.qAskBtn.disabled = true;
      try {
        const phase_id = dom.qAskPhase.value || null;
        const q = await api("POST", "/api/questions", { phase_id, question: text, asked_by: persona.get() });
        if (q) questions.push(q);
        dom.qAskInput.value = "";
        dom.qAskHint.textContent = "Sendt ✓";
        dom.qAskHint.classList.add("show");
        setTimeout(() => dom.qAskHint.classList.remove("show"), 2000);
        qFilter = "open";
        refreshQBadge(); updateAllAskCards(); renderQuestions();
      } catch (e) { alert(e.message || "Kunne ikke sende spørgsmålet."); }
      dom.qAskBtn.disabled = false;
    };
    dom.qAskBtn.addEventListener("click", submit);
    dom.qAskInput.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  }

  /* ============================================================
     PERSONA switcher
     ============================================================ */
  function renderPersona() {
    const name = persona.get();
    dom.personaName.textContent = name;
    dom.personaAv.textContent = initial(name);
    dom.personaPill.dataset.slot = personaSlot(name);
    dom.personaMenu.innerHTML = persona.list().map((n) =>
      `<button class="pa-item${n === name ? " on" : ""}" data-name="${esc(n)}" type="button">
         <span class="pa-av" data-slot="${personaSlot(n)}">${esc(initial(n))}</span>${esc(n)}${n === name ? svg("check", 'class="pa-ck"') : ""}
       </button>`).join("");
    dom.personaMenu.querySelectorAll(".pa-item").forEach((b) =>
      b.addEventListener("click", () => {
        persona.set(b.dataset.name);
        closePersonaMenu();
        renderPersona();
        // re-paint note hint authorship + question composer labels live
        if (current === "questions") renderQuestions();
      }));
  }
  function openPersonaMenu() { dom.personaMenu.hidden = false; dom.persona.classList.add("open"); }
  function closePersonaMenu() { dom.personaMenu.hidden = true; dom.persona.classList.remove("open"); }
  function wirePersona() {
    dom.personaPill.addEventListener("click", (e) => {
      e.stopPropagation();
      if (dom.personaMenu.hidden) openPersonaMenu(); else closePersonaMenu();
    });
    document.addEventListener("click", (e) => { if (!dom.persona.contains(e.target)) closePersonaMenu(); });
    renderPersona();
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
    else if (view === "questions") sec = $("#screen-questions");
    else sec = $("#screen-" + view);
    if (sec) sec.classList.add("show");
    dom.workScroll.scrollTop = 0;
  }
  function goTo(view) {
    current = view;
    showView(view);
    const p = PHASES.find((x) => x.id === view);
    if (p) updatePhaseScreen(p);
    if (view === "done") renderDone();
    if (view === "notes") renderNotes();
    if (view === "questions") renderQuestions();
    renderSteps();
    updateFooter();
  }
  function updateFooter() {
    const isPhase = PHASES.some((p) => p.id === current);
    dom.foot.classList.toggle("show", isPhase);
    if (!isPhase) return;
    const i = PHASES.findIndex((p) => p.id === current);
    dom.footN.textContent = `Fase ${i + 1} af ${PHASES.length}`;
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

  dom.prevBtn.addEventListener("click", () => { const i = ORDER.indexOf(current); if (i > 0) goTo(ORDER[i - 1]); });
  dom.nextBtn.addEventListener("click", () => { const i = ORDER.indexOf(current); if (i < ORDER.length - 1) goTo(ORDER[i + 1]); });
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
      p.items.forEach((it) => {
        const d = itemNotes.get(it.key);
        if (d && d.body.trim()) entries.push({ title: it.title, body: d.body, author: d.author, created: d.created_at, updated: d.updated_at });
      });
      const ws = workspaces[p.id];
      if (ws && ws.notes) ws.notes.forEach((n) => {
        if ((n.body || "").trim() || (n.title || "").trim()) entries.push({ title: n.title || "Note (1:1)", body: n.body, author: n.author, created: n.created_at, updated: n.updated_at });
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
          <div class="ni-top"><span class="ni-title">${esc(e.title)}</span><span class="ni-time">${e.author ? authorBadge(e.author) + " · " : ""}${time}</span></div>
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
     CONFETTI
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
     SYNC (polling) — holder spørgsmål/svar friske på tværs af enheder
     ============================================================ */
  function questionsSignature(arr) {
    return arr.map((q) => `${q.id}:${q.status}:${q.answered_at || ""}:${(q.answer || "").length}:${(q.question || "").length}`).join("|");
  }
  async function syncTick() {
    if (DB.mode !== "supabase") return;
    try {
      const data = await DB.refresh();
      // questions (live surface)
      const before = questionsSignature(questions);
      questions = data.questions || [];
      const after = questionsSignature(questions);
      refreshQBadge(); updateAllAskCards();
      // re-render Q-screen only if changed AND user isn't typing an answer
      if (current === "questions" && before !== after) {
        const ae = document.activeElement;
        const typing = ae && dom.questionsBody.contains(ae) && (ae.tagName === "TEXTAREA" || ae.tagName === "INPUT");
        if (!typing) renderQuestions();
      }
      // notes/links mirrors (counts only — don't clobber open editors)
      const im = data.item_notes || {};
      itemNotes.clear();
      for (const [k, v] of Object.entries(im)) itemNotes.set(k, v);
      for (const pid of Object.keys(workspaces)) delete workspaces[pid];
      for (const [pid, w] of Object.entries(data.workspaces || {})) workspaces[pid] = { notes: (w.notes || []).map((n) => ({ ...n })), links: (w.links || []).map((l) => ({ ...l })) };
      refreshIndicators();
    } catch (e) { /* netværk — prøv igen næste tick */ }
  }

  /* ============================================================
     INIT
     ============================================================ */
  async function hydrate() {
    // checks: altid lokalt
    Object.keys(DB.checksObject()).forEach((k) => checks.add(k));
    // delt state
    let data = { item_notes: {}, workspaces: {}, questions: [] };
    try { data = await DB.bootstrap(); }
    catch (e) { console.error("bootstrap failed — kører videre med tom delt state", e); }
    for (const [k, v] of Object.entries(data.item_notes || {})) itemNotes.set(k, v);
    for (const [pid, w] of Object.entries(data.workspaces || {})) {
      workspaces[pid] = { notes: (w.notes || []).map((n) => ({ ...n })), links: (w.links || []).map((l) => ({ ...l })) };
    }
    questions = data.questions || [];
  }

  async function init() {
    await hydrate();

    // welcome stats
    const totalEl = $("#wcTotal"); if (totalEl) totalEl.textContent = TOTAL;
    const vidEl = $("#wcVideos");
    if (vidEl) {
      const v = CONTENT.video_count != null ? CONTENT.video_count
        : PHASES.reduce((n, p) => n + p.items.filter((it) => it.type === "video").length, 0);
      vidEl.textContent = v + " videoer";
    }
    if (dom.startSub) dom.startSub.textContent = DB.mode === "supabase"
      ? "Noter & spørgsmål deles automatisk med din oplærer."
      : "Intet er låst — du styrer tempoet.";

    wirePersona();
    wireQuestionsUI();

    PHASES.forEach((p) => dom.phaseMount.appendChild(buildPhaseScreen(p)));
    PHASES.forEach((p) => updatePhaseScreen(p));
    renderSteps();
    refreshRailProgress();
    if (checkedCount() > 0 && checkedCount() < TOTAL) dom.startLabel.textContent = "Fortsæt onboarding";
    showView("welcome");
    updateFooter();

    // start polling hvis delt
    if (DB.mode === "supabase") {
      const ms = (window.PM_CONFIG && window.PM_CONFIG.syncIntervalMs) || 12000;
      setInterval(syncTick, ms);
    }
  }

  init();
})();
