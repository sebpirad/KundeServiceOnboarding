"""Onboarding content — the single source of truth.

The 7-phase customer-service onboarding journey. Each item gets a stable,
deterministic key (``<phase_id>:<index>``) so progress and notes can be
persisted against it regardless of render order.
"""

from __future__ import annotations

from typing import Any

# Phases. ``icon`` is either a filename under static/icons or the literal
# "audio" (rendered as an inline waveform glyph by the frontend).
PHASES: list[dict[str, Any]] = [
    {
        "id": "phase-1",
        "num": 1,
        "kicker": "Dag 1 · Søndag",
        "title": "Kom i gang",
        "icon": "settings.svg",
        "purpose": (
            "Få alle adgange på plads og mød menneskene bag PowerMatch. "
            "Når det her er klaret, kan du arbejde uhindret."
        ),
        "items": [
            {"type": "task", "title": "Opret din PowerMatch e-mailkonto",
             "desc": "Din primære indgang til alt internt."},
            {"type": "task", "title": "Få adgang til Adversus",
             "desc": "Vores opkaldsplatform — du bruger den hver dag."},
            {"type": "task", "title": "Login til app.powermatch.dk",
             "desc": "Kerneplatformen: kandidater, virksomheder, kontrakter."},
            {"type": "task", "title": "Adgang til interne systemer & CRM",
             "desc": "Så du kan følge sager fra start til slut."},
            {"type": "task", "title": "Kalender + delte mapper/drev",
             "desc": "Del og find dokumenter med resten af holdet."},
            {"type": "task", "title": "Adgang til løn-ark + sygdomsark",
             "desc": "Under 8 ugers ansættelse — til afstemning senere på ugen."},
            {"type": "task", "title": "Intro-møde med Sebastian (SP) + LS",
             "desc": "Forretningsmodel, vision og hvor vi er på vej hen."},
        ],
    },
    {
        "id": "phase-2",
        "num": 2,
        "kicker": "Dag 1–2 · Man–Tir",
        "title": "Lær platformen at kende",
        "nav_title": "Lær platformen",
        "icon": "dashboard.svg",
        "purpose": (
            "Korte videogennemgange af de værktøjer du skal mestre. "
            "Se dem i ro — du kan altid spole tilbage."
        ),
        "items": [
            {"type": "video", "title": "Introduktion til app.powermatch",
             "desc": "Det store overblik over platformen.",
             "url": "https://www.loom.com/share/3c37e86da0e7403294c02db902165025"},
            {"type": "video", "title": "Opfølgning på kontrakter",
             "desc": "Sådan holder du styr på igangværende aftaler.",
             "url": "https://www.loom.com/share/1b7f694981d34afdbad67db23a39c520"},
            {"type": "video", "title": "Tidsregistrering",
             "desc": "Hvordan timer registreres og godkendes.",
             "url": "https://www.loom.com/share/b62533734eb7472098ac99af389f2a50"},
            {"type": "video", "title": "Powerlink — lead til sælgere + screenere",
             "desc": "Sådan flyder leads gennem systemet.",
             "url": "https://www.loom.com/share/abe23ef6eb2a41f9b3fc0de239866fed"},
            {"type": "video", "title": "Love calls",
             "desc": "Se FØRST efter din live-oplæring i Adversus.",
             "time": "Efter live-oplæring",
             "url": "https://www.loom.com/share/c338d509c3954252bbbf6aa57109343f"},
        ],
    },
    {
        "id": "phase-3",
        "num": 3,
        "kicker": "Dag 1–2 · Man–Tir",
        "title": "Forstå branchen",
        "icon": "building.svg",
        "purpose": (
            "Selvstudie der giver dig fagligt fundament. "
            "Det gør dine samtaler skarpere fra dag ét."
        ),
        "items": [
            {"type": "doc", "title": "Introduktion til byggebranchen",
             "desc": "Hvem arbejder vi for, og hvordan tænker de?",
             "url": "https://docs.google.com/document/d/12CZ_A-5I8LSFiVBGZrBXGYVeXx83yKbpFjoPs8Sb4gk/edit"},
            {"type": "doc", "title": "Hvad er en overenskomst?",
             "desc": "Grundbegreberne forklaret enkelt.",
             "url": "https://docs.google.com/document/d/1A9CyqTjpMHsk0BbMTrOB4CWe-Tj2RaeaJnSeHojq94k/edit"},
            {"type": "doc", "title": "Overenskomster & fagforeninger",
             "desc": "Dybdegående gennemgang.",
             "url": "https://docs.google.com/document/d/1dpM7TJpRrdLwZnm1FVs47Qq_YQverAwQpQBBQhxHKww/edit"},
            {"type": "doc", "title": "Teamet og opgaverne",
             "desc": "Hvem gør hvad — og hvem du går til med hvad.",
             "url": "https://docs.google.com/document/d/1xSncDjCUACxRjH0xx4rMUrzY0l35nXW0ZmjeosUTM7w/edit"},
        ],
    },
    {
        "id": "phase-4",
        "num": 4,
        "kicker": "1-1 oplæring",
        "title": "Forretningen i dybden",
        "icon": "briefcase.svg",
        "purpose": (
            "Live gennemgang med din oplærer. Stil spørgsmål, tag noter — "
            "det her er kernen i jobbet."
        ),
        # The 1:1 workspace (links + free-form notes) is enabled for this phase.
        "workspace": True,
        "items": [
            {"type": "task", "title": "Forretningsmodellen",
             "desc": "Try & hire, handelsbetingelser, kandidatens og virksomhedens vilkår."},
            {"type": "task", "title": "Virksomhederne",
             "desc": "Hvem er de, hvordan får vi dem ind, processen A–Z, og fastholdelse."},
            {"type": "task", "title": "Ansøgerne",
             "desc": "Hvem er de, hvordan får vi dem ind, og hvordan vi holder dem engagerede."},
            {"type": "task", "title": "Kandidaterne",
             "desc": "Hele rejsen A–Z, og hvorfor de vælger PowerMatch."},
            {"type": "task", "title": "Adversus — introduktion & emnebehandling",
             "desc": "Sådan arbejder du struktureret i opkaldsplatformen."},
            {"type": "task", "title": "Love calls-kampagne i Adversus",
             "desc": "Den praktiske opsætning og afvikling."},
            {"type": "task", "title": "Intern kommunikation",
             "desc": "Hvor og hvordan vi taler sammen i hverdagen."},
            {"type": "task", "title": "Opsigelser i app.powermatch",
             "desc": "Den korrekte proces, trin for trin."},
            {"type": "task", "title": "Lønperiode — løn-ark + sygdomsark",
             "desc": "Gennemgang onsdag/torsdag."},
        ],
    },
    {
        "id": "phase-5",
        "num": 5,
        "kicker": "Kulturforståelse",
        "title": "Lyt og lær",
        "icon": "audio",
        "purpose": (
            "Den hurtigste vej til at lyde som en del af holdet: "
            "hør, hvordan vi rent faktisk taler med folk."
        ),
        "items": [
            {"type": "audio", "title": "Lyt til 20–30 rigtige opkald",
             "desc": ("Optagelser fra oplæringsmappen. Læg mærke til tone, "
                      "struktur og indvendingshåndtering."),
             "time": "Lydoptagelser",
             "url": "https://drive.google.com/drive/u/0/folders/1H6bEVL1PUDeveK_7xYr3tePLCT8V-nhC"},
        ],
    },
    {
        "id": "phase-6",
        "num": 6,
        "kicker": "Reference",
        "title": "Procesguides",
        "nav_title": "Reference & guides",
        "icon": "report.svg",
        "purpose": (
            "Dine opslagsværker. Læs dem nu — og hav dem ved hånden, "
            "når en konkret situation opstår."
        ),
        "items": [
            {"type": "pdf", "title": "Virksomhedsopkald — proces",
             "desc": "Hvordan vi forventer dialogen, særligt med virksomheder.",
             "url": "https://drive.google.com/file/d/1paUGosVs_gyZRa8caSxHequsJgkeyXCR/view"},
            {"type": "pdf", "title": "Opsigelser — proces",
             "desc": "Den fulde proces visuelt forklaret.",
             "url": "https://drive.google.com/file/d/1hyT-McCkoQJpR1H9VvbWR-zbQ24OtzdO/view"},
            {"type": "pdf", "title": "Arbejdstøj — overblik",
             "desc": "Hvordan det fungerer, budget og katalog.",
             "url": "https://drive.google.com/file/d/1y9PxSOdywq_DKizgbqxP3ll3PKtvm4p2/view"},
            {"type": "pdf", "title": "Løn & udbetaling — CS-guide",
             "desc": "Hvordan løn fungerer, og hvem der kan hjælpe dig.",
             "url": "https://drive.google.com/file/d/1VEZVSXS3C6vL_PKeNaeeUzckLRl_VdS5/view"},
        ],
    },
    {
        "id": "phase-7",
        "num": 7,
        "kicker": "Dag 3–5 · Ons–Fre",
        "title": "Ud i praksis",
        "icon": "interviews.svg",
        "purpose": (
            "Nu kobler vi teori og virkelighed. Du følger Michelle og tager "
            "gradvist dine egne opkald med supervision."
        ),
        "items": [
            {"type": "live", "title": "Onsdag: Shadowing af Michelle",
             "desc": "Se hvordan en erfaren kollega arbejder + afstem løn-ark sammen."},
            {"type": "live", "title": "Torsdag: Shadowing + dine første indgående opkald",
             "desc": "Du tager opkald med supervision tæt på."},
            {"type": "live", "title": "Fredag: Indgående opkald med supervision",
             "desc": "Mulig afprøvning af opfølgning på kontrakter på egen hånd."},
        ],
    },
]

# Aside tips per phase (instructional, static — distinct from personal notes).
TIPS: dict[str, dict[str, str]] = {
    "phase-1": {"label": "Din intro",
                "text": "Sebastian (SP) + LS gennemgår forretning, vision og vejen frem."},
    "phase-2": {"label": "Husk rækkefølgen",
                "text": "Gem \u201cLove calls\u201d til efter din live-oplæring i Adversus."},
    "phase-3": {"label": "Selvstudie",
                "text": "Tag det i dit tempo — fundamentet her gør dine samtaler skarpere."},
    "phase-4": {"label": "1-1 med din oplærer",
                "text": "Stil spørgsmål og tag noter. Det her er kernen i jobbet."},
    "phase-5": {"label": "Lyt efter",
                "text": "Tone, struktur og hvordan vi håndterer indvendinger."},
    "phase-6": {"label": "Opslagsværk",
                "text": "Læs dem nu — og vend tilbage, når en konkret situation opstår."},
    "phase-7": {"label": "Din makker",
                "text": "Du følger Michelle og tager gradvist egne opkald med supervision."},
}


def build_phases() -> list[dict[str, Any]]:
    """Return phases with a stable ``key`` injected on every item.

    Key format: ``<phase_id>:<index>`` (e.g. ``phase-4:2``).
    """
    out: list[dict[str, Any]] = []
    for phase in PHASES:
        p = dict(phase)
        items = []
        for idx, item in enumerate(phase["items"]):
            it = dict(item)
            it["key"] = f"{phase['id']}:{idx}"
            items.append(it)
        p["items"] = items
        p["tip"] = TIPS.get(phase["id"])
        out.append(p)
    return out


def all_item_keys() -> set[str]:
    """Every valid item key — used to validate writes."""
    return {f"{p['id']}:{i}" for p in PHASES for i in range(len(p["items"]))}


def total_items() -> int:
    return sum(len(p["items"]) for p in PHASES)


# Phase IDs that expose the 1:1 workspace (links + free notes).
WORKSPACE_PHASES: set[str] = {p["id"] for p in PHASES if p.get("workspace")}
