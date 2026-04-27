# Suivi du projet — Tadabbur تدبّر

Outil de contemplation coranique basé sur la méthodologie de Farid Al-Ansari.
**Stack :** Next.js 15 · TypeScript · Tailwind v4 · Anthropic SDK (claude-sonnet-4-6)

---

## ⏭️ Prochaine session — Par où commencer

### En attente de validation utilisateur
- Tester en app sourate Yunus versets 1-2 avec Muharrar (fix الآيتان appliqué en fin de session)
- Tester autres sourates pour confirmer stabilité globale extraction

### Tâches en suspens
1. ~~**Rate limiting** — `/api/tadabbur` sans protection quota Anthropic~~ ✅ (2026-04-27)
2. **CSS orphelins** — classes `.sugg`, `.sugg-row` présentes dans globals.css mais UI suggestions supprimée
3. **Speech** — fonctionnalité audio (postponée par l'utilisateur)

---

## ✅ Réalisé

### Phase 1 — Socle technique
- [x] Projet Next.js 15 + TypeScript + Tailwind v4
- [x] Anthropic SDK avec prompt caching (system prompt mis en cache)
- [x] API SSE streaming (`/api/tadabbur`) — max 32k tokens, 120s
- [x] Hook `useTadabbur` — gestion état streaming/done/error
- [x] System prompt complet (méthodologie Farid Al-Ansari encodée)

### Phase 2 — Refonte UI
- [x] Nouveau design system (`globals.css`) — tokens or/crème, RTL natif
- [x] Google Fonts : Amiri, Noto Naskh Arabic, Source Serif 4, Cormorant Garamond
- [x] Layout grid : sidebar (280px) + zone principale
- [x] Sidebar : logo, bouton "nouveau", historique localStorage (20 items)
- [x] Topbar : menu mobile, fil d'Ariane, thème, panel réglages
- [x] Écran accueil : hero + formulaire (onglets sourate / texte libre)
- [x] Sélecteur 114 sourates, plage versets, profondeur موجز/متوسّط/مُفصَّل
- [x] Mode sombre + toggle, panel réglages (police, densité)

### Phase 3 — Texte coranique réel (2026-04-26)
- [x] `scripts/build-quran-data.ts` → `data/quran/quran.json` (6236 versets)
- [x] `src/lib/quran-loader.ts` — `getVerses(surah, from, to)` + cache mémoire
- [x] `route.ts` — résolution placeholders `[الآية N]`, event SSE `{ type: "verses" }`
- [x] `useTadabbur.ts` — `resolvedVerses: string[] | null`
- [x] `page.tsx` — carte verset utilise `resolvedVerses` en priorité

### Phase 4 — Extraction tafsir Shamela v4 (2026-04-26)
- [x] `scripts/extract-tafsir.py` — extraction via JPype1 + Lucene JVM
  - Tabari (7798) : 4667 pages, 114/114 sourates ✅
  - Ibn Kathir (1503) : 2450 pages, 114/114 sourates ✅
  - Ibn Achour (9776) : 114/114 sourates ✅
  - Fakhri Razi (23635) : 114/114 sourates ✅

### Phase 5 — Intégration tafsir dans l'app (2026-04-26)
- [x] `VerseInput.tsx` — pills multi-sélect (Tabari, Ibn Kathir, Ibn Achour, Fakhri Razi, Muharrar)
- [x] `route.ts` — passe `tafsirs` sélectionnés au loader, event SSE `{ type: "context" }`

### Phase 6 — التفسير المحرر (Dorar) ✅ (2026-04-26)
- [x] HTTrack mirror `dorar.net/tafseer/` → `C:\Mes Sites Web\dorar\`
- [x] `scripts/extract-muharrar.py` → `data/tafsir/muharrar/` — 114/114 sourates ✅

### Phase 7 — Extracteurs par-tafsir + qualité (2026-04-27)
- [x] Réécriture complète `src/lib/tafsir-loader.ts` :
  - **`extractWithAyaSpan()`** — tabari / ibn-kathir : index absolu ayah via `quran.json`, balises `<span id="aya-N">`
  - **`extractSpanTitle()`** — fakhri-razi / ibn-achour : 3 passes (marqueur strict `[N]` → span `آية N]` → patterns loose)
  - **`extractMuharrar()`** — muharrar : headers `=== ... الآيتان/الآيات/الآية (START-END) ===`
    - Fix dual form : regex `الآي(?:ة|تان|ات)` + `stripTashkeel()` avant exec
  - `normalizeLines()` : normalisation `\r\n` / `\r` → `\n` (fichiers ibn-achour mixed endings)
  - `TASHKEEL_RE` : ranges Unicode explicites (fix bug strip lettres arabes de base)
  - `getAyahOffsets()` : cache lazy index cumulatif 1→6236 pour tabari/ibn-kathir
  - `truncateAtSentence()` : coupure propre à frontière de phrase/ligne
  - Limites : `MAX_CHARS_PER_TAFSIR = 15000`, `MAX_TOTAL_PER_TAFSIR = 30000`
- [x] **Sélection modèle par profondeur** (`route.ts`) :
  - `brief` → `claude-haiku-4-5-20251001`
  - `medium` / `detailed` → `claude-sonnet-4-6`
- [x] Validé en app : Ibn Achour ✅ · Fakhri Razi ✅ · Muharrar fix appliqué (Yunus 1-2)

### Phase 9 — Versets-ressources Bahouss (2026-04-27)
- [x] `src/lib/surah-map.ts` — mapping nom sourate arabe → numéro (114 sourates)
- [x] `src/lib/bahouss-parser.ts` — parser texte brut Bahouss → BahoussVerse[]
- [x] `src/components/BahoussInput.tsx` — zone collage + liste checkboxes RTL
- [x] `VerseInput.tsx` — intégration BahoussInput après pills tafsir
- [x] `useTadabbur.ts` — SubmitData étendu avec crossReferences?: BahoussVerse[]
- [x] `route.ts` — section `<quranic_cross_references>` dans le prompt si crossReferences présents
- [x] Suppression BM25 : `bm25.ts`, `rerank.ts`, `search/route.ts`, `bm25-index.json`, `build-bm25-index.ts`
- [x] Mode rafraîchissement post-tadabbur (option A — relance complète avec BahoussInput dans écran résultat)

### Phase 8 — Revue de code + correctifs sécurité (2026-04-27)

#### System prompt
- [x] Ajout `<priority_directive>` : directive arabe d'exactitude absolue — "الأولوية للدقة المطلقة. إذا لم تكن متأكداً، قل لا أعرف."

#### CLAUDE.md
- [x] Intégration guidelines Karpathy (forrestchang/andrej-karpathy-skills) :
  - Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution

#### Correctifs appliqués suite revue de code
- [x] **AbortController** (`useTadabbur.ts`) — annule le stream en cours si nouvelle requête ou démontage composant
- [x] **localStorage try-catch** (`page.tsx`) — données corrompues effacées proprement au lieu de crasher
- [x] **Validation longueur query** (`search/route.ts`) — rejet si > 1000 chars (protection ReDoS/RAM)
- [x] **File size guard** (`tafsir-loader.ts`) — skip fichiers tafsir > 50MB avant `readFileSync`
- [x] **Cache TTL** (`rerank.ts`) — expiration 1h des entrées (évite croissance mémoire indéfinie)
- [x] **XSS analysé non-critique** (`StreamingText.tsx`) — `formatBody` échappe `&<>` avant inlineFmt → safe

#### Rate limiting (2026-04-27)
- [x] `src/lib/rate-limiter.ts` — sliding window in-memory, 10 req/h par IP (configurable via `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS`)
- [x] `src/middleware.ts` — Next.js middleware filtrant POST `/api/tadabbur`, retour 429 avec `Retry-After` + `X-RateLimit-Remaining`

#### Cache des réponses Anthropic (2026-04-27)
- [x] `src/lib/tadabbur-cache.ts` — cache in-memory clé = hash(surah+verses+depth+tafsirs+crossRefs), TTL 24h
- [x] `route.ts` — vérification cache avant appel API, replay SSE si HIT, stockage après message_stop si MISS
- [x] Header `X-Cache: HIT/MISS` dans la réponse SSE

#### Non traité (hors scope ou complexe)
- ~~Rate limiting APIs~~ ✅ implémenté
- Validation serveur plage versets — client-side `max={maxVerse}` non-suffisant

---

## 🔴 Priorité haute

_(rien de bloquant — extraction tafsir stable)_

---

## 🟡 Priorité moyenne — Fonctionnel

### 1. Navigation sections par scroll
IntersectionObserver sur les 4 sections — onglet actif suit le scroll.

### 3. Restauration depuis l'historique
Clic item historique → restaurer sourate/plage/profondeur dans formulaire + bouton "Régénérer".

### 4. Bouton Partager
`navigator.share({ title, text })` avec fallback clipboard.

---

## 🟢 Priorité basse — Polish

### 5. CSS orphelins `.sugg`, `.sugg-row`
Classes dans `globals.css` mais UI suggestions supprimée — à nettoyer.

### 6. Sidebar overlay mobile
```css
.sidebar-overlay { position:fixed; inset:0; background:rgba(0,0,0,.3); z-index:49; }
```

### 7. Skeleton loading — avant premier token
### 8. `aria-live="polite"` sur zone streaming
### 9. Export PDF / impression (`@media print`)
### 10. Raccourcis clavier (`⌘N`, `⌘D`, `Escape`)
### 11. Speech (postponé)

---

## 📁 Architecture fichiers clés

```
tadabbur/
├── src/
│   ├── app/
│   │   ├── page.tsx              ← Layout principal, historique
│   │   ├── globals.css           ← Design system complet
│   │   └── api/
│   │       └── tadabbur/route.ts ← API SSE, Claude, tafsir context + cross-refs, modèle par profondeur
│   ├── components/
│   │   ├── VerseInput.tsx        ← Formulaire + sélection tafsirs (pills) + BahoussInput
│   │   ├── BahoussInput.tsx      ← Zone collage Bahouss + liste checkboxes
│   │   ├── StreamingText.tsx     ← Sections pliables avec nav
│   │   └── ThemeToggle.tsx
│   ├── hooks/
│   │   └── useTadabbur.ts        ← Hook SSE, types SubmitData/Depth/TafsirName
│   └── lib/
│       ├── tafsir-loader.ts      ← 5 extracteurs par-tafsir, limites 15k/30k
│       ├── quran-loader.ts       ← getVerses(surah, from, to)
│       ├── bahouss-parser.ts     ← Parser texte Bahouss → BahoussVerse[]
│       └── surah-map.ts          ← Mapping nom sourate arabe → numéro
├── data/
│   ├── quran/quran.json          ← 6236 versets arabes
│   └── tafsir/
│       ├── tabari/               ✅ 114 fichiers (Lucene Shamela) — extractWithAyaSpan
│       ├── ibn-kathir/           ✅ 114 fichiers — extractWithAyaSpan
│       ├── ibn-achour/           ✅ 114 fichiers — extractSpanTitle
│       ├── fakhri-razi/          ✅ 114 fichiers — extractSpanTitle
│       ├── muharrar/             ✅ 114 fichiers (HTTrack dorar.net) — extractMuharrar
│       └── fi-zilal/             ❌ non disponible (hors Shamela)
├── scripts/
│   ├── build-quran-data.ts
│   ├── extract-tafsir.py         ← Extraction Shamela v4 (JPype1 + Lucene)
│   ├── extract-muharrar.py       ← Extraction dorar.net HTTrack mirror
│   └── debug-titles.py
├── system/system-prompt.md       ← Méthodologie Farid Al-Ansari
├── SUIVI.md                      ← Ce fichier
└── .env.local                    ← ANTHROPIC_API_KEY
```

---

## 🔧 Chemins importants

| Ressource | Chemin |
|---|---|
| Shamela v4 | `C:\shamela4\` |
| Mirror dorar.net | `C:\Mes Sites Web\dorar\dorar.net\tafseer\` |
| Source Quran JSON | `C:\Mes Projets\Usine\Quran\Quran-Json\data\json\verses\` |

---

## 🚀 Pour lancer

```bash
cd "C:\Mes Projets\tadabbur"
npm run dev   # → http://localhost:3000
```
