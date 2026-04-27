# Moteur de recherche sémantique coranique — Architecture

## Contexte

Application Next.js 15 (Node.js, TypeScript) de contemplation coranique.
Données : `data/quran/quran.json` — 6236 versets arabes indexés par `{surah, ayah, text}`.
Stack : Anthropic SDK (claude-sonnet-4-6), pas de base de données, filesystem uniquement.
Déploiement : Vercel (Node runtime).

## Solution retenue : BM25 + re-ranking Claude

### Pourquoi ce choix

- BM25 en local = pas d'appel réseau pour le recall, fonctionne offline après build
- Claude re-ranking = compréhension thématique et spirituelle profonde (distingue صبر على البلاء de صبر على الطاعة)
- Coût : ~$0.015/requête (Sonnet), ~$0.005 (Haiku) → $5-22/mois pour 50 req/jour
- RAM : ~5-8 Mo au runtime
- Complexité : 3/5

### Fallback

Si BM25 recall insuffisant : Claude seul avec structured output + vérification locale contre quran.json. Complexité 1/5, coût similaire.

---

## Plan d'implémentation

### Étape 1 — Normalisation arabe

Créer `lib/arabic-normalize.ts` :

- Suppression diacritiques (tashkeel) : regex `[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]`
- Normalisation hamza : أ إ آ ء → ا
- Normalisation taa marbuta : ة → ه
- Normalisation alef maqsura : ى → ي
- Usage : indexation et recherche BM25 uniquement, jamais pour l'affichage

### Étape 2 — Script de build de l'index BM25

Créer `scripts/build-bm25-index.ts` :

1. Lire `data/quran/quran.json`
2. Pour chaque verset : normaliser le texte, tokenizer par espaces
3. Calculer les statistiques corpus : document frequency par terme, avgdl
4. Sérialiser dans `data/quran/bm25-index.json` :
   ```json
   {
     "avgdl": 15.3,
     "N": 6236,
     "df": { "term1": 42, "term2": 7, ... },
     "docs": [
       { "surah": 1, "ayah": 1, "tokens": ["بسم", "الله", "الرحمن", "الرحيم"], "dl": 4 },
       ...
     ]
   }
   ```
5. Ajouter au `package.json` : `"prebuild": "tsx scripts/build-bm25-index.ts"`

### Étape 3 — Module BM25

Créer `lib/bm25.ts` :

- Charger l'index via `import` statique ou `fs.readFileSync` au démarrage (une seule fois)
- Fonction `searchBM25(query: string, topK: number = 50): Array<{surah, ayah, text, score}>`
- Paramètres BM25 : k1=1.5, b=0.75 (valeurs standard, ajuster si besoin)
- La requête est normalisée et tokenisée avec le même pipeline que l'indexation

### Étape 4 — Module de re-ranking Claude

Créer `lib/rerank.ts` :

- Fonction `rerankWithClaude(sourceVerse, candidates: Array<{surah, ayah, text}>, topK: number = 15)`
- Appel Anthropic SDK avec structured output (tool use ou JSON mode)
- Prompt :

```
أنت عالم متخصص في القرآن الكريم والتفسير الموضوعي.

الآية المرجعية:
سورة {surah} آية {ayah}: {text}

فيما يلي {n} آية مرشحة. رتّب أقرب 15 آية من حيث:
- الموضوع الروحي المشترك
- السياق القرآني المتشابه
- الدرس أو العبرة المشتركة

لا تُدرج آيات غير موجودة في القائمة أدناه.

أعد JSON فقط بالشكل التالي:
[{"surah": number, "ayah": number, "reason": "سبب القرابة الموضوعية في جملة واحدة"}]

الآيات المرشحة:
{candidates formatted as "سورة X آية Y: text"}
```

- Modèle : `claude-sonnet-4-6` (ou `claude-haiku-4-5-20251001` pour réduire le coût)
- Parse la réponse JSON, valider chaque {surah, ayah} contre la liste des candidats

### Étape 5 — API Route

Créer `app/api/search/route.ts` :

```typescript
// POST { query: string } ou { surah: number, ayah: number }
// 1. Si surah+ayah fournis, récupérer le texte depuis quran.json
// 2. BM25 search → top 50
// 3. Re-ranking Claude → top 15
// 4. Retourner les résultats avec texte complet + raison
```

- Méthode POST
- Validation des entrées
- Gestion d'erreur : si Claude échoue, retourner les résultats BM25 bruts (fallback gracieux)
- Cache optionnel : stocker les résultats dans un Map en mémoire (LRU, max 500 entrées)

### Étape 6 — Composant UI

Créer `components/SemanticSearch.tsx` :

- Textarea pour coller un verset ou un extrait
- Possibilité de sélectionner sourate + ayah depuis un dropdown
- Affichage des résultats : texte arabe complet (avec tashkeel), référence (sourate:ayah), raison thématique
- État de chargement pendant l'appel Claude (~2-4s)
- Direction RTL pour tout le texte arabe

---

## Structure des fichiers

```
lib/
  arabic-normalize.ts        # normalisation texte arabe
  bm25.ts                    # moteur BM25
  rerank.ts                  # re-ranking Claude
scripts/
  build-bm25-index.ts        # génération index au build
app/api/search/
  route.ts                   # endpoint API
components/
  SemanticSearch.tsx          # composant UI
data/quran/
  quran.json                 # source (existant)
  bm25-index.json            # index généré (gitignored)
```

## Dépendances

```bash
npm install @anthropic-ai/sdk
npm install -D tsx
```

## Commandes

```bash
# Générer l'index
npx tsx scripts/build-bm25-index.ts

# Build complet (prebuild génère l'index automatiquement)
npm run build
```

## Optimisations futures

1. **Stemming racinaire arabe** : si le recall BM25 est faible, ajouter un extracteur de racines trilitères pour améliorer le matching
2. **Cache des résultats** : sérialiser les résultats fréquents dans un fichier JSON local pour éviter les appels Claude répétés
3. **Mode Haiku** : switch automatique vers Haiku pour les recherches simples (versets courts, thèmes évidents)
4. **Élargir le top-K BM25** : passer de 50 à 100 candidats si les résultats manquent de diversité
