/* ============================================================
   PowerMatch — Onboarding · KONFIGURATION
   ------------------------------------------------------------
   Dette er den ENESTE fil du (Sebastian) skal røre for at
   tænde delt synkronisering mellem Maiken og Michelle.

   Uden Supabase-nøgler kører siden videre i "lokal" tilstand
   (gemmer i browseren) — så alt virker fra dag 1. Når du
   indsætter URL + nøgle herunder, bliver noter og spørgsmål
   delt på tværs af alle enheder med det samme.

   Sådan får du de to værdier (ca. 3 min — se SETUP.md):
     1. Opret gratis projekt på https://supabase.com
     2. Settings → API → kopiér "Project URL" og "anon public" key
     3. Indsæt dem nedenfor, gem, og push til GitHub.
   ============================================================ */
window.PM_CONFIG = {
  // ---- Supabase (delt backend) ----
  // Lad dem stå som "YOUR_..." for at køre lokalt uden deling.
  supabaseUrl: "YOUR_SUPABASE_URL",         // fx https://abcdxyz.supabase.co
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY", // den lange "anon public" nøgle

  // ---- Personer der bruger platformen ----
  // Den første er standard-valget når man åbner siden.
  people: ["Maiken", "Michelle"],
  defaultPerson: "Maiken",

  // ---- Hvor ofte hentes nye spørgsmål/svar (ms) ----
  syncIntervalMs: 12000,
};
