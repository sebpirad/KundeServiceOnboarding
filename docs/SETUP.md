# PowerMatch Onboarding — Delt synkronisering (Supabase)

Siden virker **uden** opsætning: den gemmer noter og spørgsmål lokalt i hver
browser. For at Maiken og Michelle kan dele noter og spørgsmål **på tværs af
enheder**, skal du tænde en gratis Supabase-backend. Det tager ~3 minutter.

---

## 1. Opret Supabase-projekt

1. Gå til <https://supabase.com> → **New project** (gratis tier rækker rigeligt).
2. Vælg et navn (fx `powermatch-onboarding`) og en region tæt på DK (Frankfurt).
3. Vent til projektet er klar (~1 min).

## 2. Opret tabellerne

Gå til **SQL Editor** → **New query**, indsæt hele blokken herunder, og tryk **Run**.

```sql
-- ===== Noter knyttet til et konkret trin =====
create table if not exists item_notes (
  item_key   text primary key,
  body       text,
  author     text,
  height     int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===== Frie noter pr. fase (workspace) =====
create table if not exists ws_notes (
  id         bigint generated always as identity primary key,
  phase_id   text not null,
  title      text,
  body       text,
  author     text,
  height     int,
  position   int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===== Links pr. fase (workspace) =====
create table if not exists ws_links (
  id         bigint generated always as identity primary key,
  phase_id   text not null,
  label      text,
  url        text,
  author     text,
  created_at timestamptz default now()
);

-- ===== Spørgsmål fra Maiken / svar fra Michelle =====
create table if not exists questions (
  id          bigint generated always as identity primary key,
  phase_id    text,
  item_key    text,
  item_title  text,
  question    text not null,
  asked_by    text,
  answer      text,
  answered_by text,
  status      text default 'open',     -- 'open' | 'answered'
  created_at  timestamptz default now(),
  answered_at timestamptz
);
```

## 3. Slå Row Level Security til + giv adgang

Onboarding-siden er internt værktøj uden login. Den bruger den offentlige
**anon**-nøgle og skal kunne læse + skrive i de fire tabeller. Kør:

```sql
-- Tænd RLS på alle fire tabeller
alter table item_notes enable row level security;
alter table ws_notes  enable row level security;
alter table ws_links  enable row level security;
alter table questions enable row level security;

-- Tillad anon (siden) at læse + skrive. Gentag pr. tabel.
create policy "anon all item_notes" on item_notes for all to anon using (true) with check (true);
create policy "anon all ws_notes"   on ws_notes  for all to anon using (true) with check (true);
create policy "anon all ws_links"   on ws_links  for all to anon using (true) with check (true);
create policy "anon all questions"  on questions for all to anon using (true) with check (true);
```

> **Sikkerhed:** anon-nøglen er offentlig og ligger i frontend — det er by design.
> Adgangen er begrænset til de fire onboarding-tabeller via RLS. Læg aldrig
> følsomme data i disse tabeller. Vil du have det helt lukket, kan du senere
> lægge siden bag et password eller skifte til kun-læse for anon + et lille
> edge-function-skrivelag. Til intern oplæring er ovenstående tilstrækkeligt.

## 4. Indsæt URL + nøgle

1. I Supabase: **Settings → API**.
2. Kopiér **Project URL** (fx `https://abcdxyz.supabase.co`).
3. Kopiér **anon public** nøglen (den lange `eyJ...`).
4. Åbn `docs/js/config.js` og udfyld:

```js
window.PM_CONFIG = {
  supabaseUrl: "https://abcdxyz.supabase.co",
  supabaseAnonKey: "eyJhbGciOi...din-anon-nøgle...",
  people: ["Maiken", "Michelle"],
  defaultPerson: "Maiken",
  syncIntervalMs: 12000,
};
```

## 5. Push og gå live

```bash
git add docs/js/config.js
git commit -m "Aktivér delt Supabase-synkronisering"
git push
```

GitHub Pages opdaterer siden inden for ~1 minut. Åbn siden, og den viser nu
**"Delt · synkroniseret"** i Spørgsmål-fanen i stedet for "Kun denne enhed".

---

## Hvordan det virker

- **`config.js`** er den eneste fil du rører. Tomme `YOUR_...`-værdier = lokal
  tilstand. Udfyldte værdier = delt tilstand.
- **`db.js`** registrerer tilstanden automatisk og taler med Supabase via REST.
  Alt skrives med `author` = den valgte person (Maiken/Michelle).
- Siden **poller** hver `syncIntervalMs` (12 sek.) efter nye spørgsmål/svar, så
  Michelle ser Maikens spørgsmål — og Maiken ser svarene — uden at genindlæse.
- **Afkrydsninger** (trin-status) holdes altid lokalt pr. enhed, så de to ikke
  overskriver hinandens fremgang.

## Fejlsøgning

- **Stadig "Kun denne enhed"?** `config.js` er ikke udfyldt, eller browseren har
  cachet den gamle. Hard-refresh (Ctrl/Cmd+Shift+R).
- **Intet bliver delt?** Tjek at de fire RLS-policies er oprettet (trin 3).
  Åbn browserens konsol (F12) og se efter 401/403 fra Supabase.
- **Forkert URL/nøgle?** Project URL skal ende på `.supabase.co` uden skråstreg
  til sidst; anon-nøglen starter med `eyJ`.
