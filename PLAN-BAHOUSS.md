# Plan d'intégration — Versets-ressources (Bahouss) dans Tadabbur

## Décisions validées

- **BM25 retiré** — la recherche lexicale est faite par l'app Bahouss (mobile)
- Les versets Bahouss sont des **versets-ressources** (تفسير القرآن بالقرآن), pas des versets à contempler
- Ils sont traités dans le prompt comme un tafsir additionnel — Claude pioche ce qui éclaire, il n'est pas obligé d'utiliser tout
- L'utilisateur coche les versets pertinents — Claude utilise **uniquement** les versets cochés
- Le pipe est Google Keep : copier sur mobile → coller sur PC dans l'app
- Deux moments : avant le tadabbur (enrichissement initial) ou après (rafraîchissement)

## Fichiers à supprimer

```
src/lib/bm25.ts              ← plus nécessaire
src/lib/rerank.ts             ← plus nécessaire
src/app/api/search/route.ts   ← plus nécessaire
data/quran/bm25-index.json    ← si généré
```

Retirer aussi dans `scripts/` tout script `build-bm25-index` s'il existe.

Nettoyer les imports de bm25/rerank dans les autres fichiers.

---

## Étape 1 — Parser Bahouss

Créer `src/lib/bahouss-parser.ts`

### Format d'entrée (texte brut copié depuis l'app)

```
1)
- النتيجة: مُنَافِقِ
- الآية: (وَإِذَا قِيلَ لَهُمْ تَعَالَوْا إِلَىٰ مَا أَنزَلَ ٱللَّهُ وَإِلَى ٱلرَّسُولِ رَأَيْتَ ٱلْمُنَٰفِقِينَ يَصُدُّونَ عَنكَ صُدُودًا) [النساء:61]

2)
- النتيجة: مُنَافِقِ
- الآية: (فَمَا لَكُمْ فِي ٱلْمُنَٰفِقِينَ فِئَتَيْنِ ...) [النساء:88]
```

### Format de sortie

```typescript
interface BahoussVerse {
  index: number           // numéro dans les résultats Bahouss (1, 2, 3...)
  surah: number           // numéro de sourate
  surahName: string       // nom de la sourate en arabe (النساء)
  ayah: number            // numéro de l'ayah
  text: string            // texte complet du verset (sans parenthèses)
  morphResult: string     // النتيجة — forme morphologique trouvée (مُنَافِقِينَ)
}
```

### Logique du parser

```typescript
export function parseBahoussText(raw: string): BahoussVerse[] {
  // 1. Découper par blocs numérotés : regex /^\d+\)/m
  // 2. Pour chaque bloc :
  //    a. Extraire النتيجة(s) : regex /النتيجة|النتائج:\s*(.+)/
  //    b. Extraire le texte de l'آية : regex /الآية:\s*\((.+?)\)\s*\[(.+?):(\d+)\]/
  //    c. Gérer le cas النتائج (pluriel) : plusieurs formes séparées par " - "
  //    d. Mapper surahName → surah number via lookup table ou quran.json
  // 3. Retourner le tableau trié par index
}
```

### Sample 2 — Recherche « صراط » (45 versets)

```
عدد الآيات 45:

1)
- النتيجة: صِّرَاطَ
- الآية: (ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ) [الفاتحة:6]

2)
- النتيجة: صِرَاطَ
- الآية: (صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّالِّينَ) [الفاتحة:7]

13)
- النتيجة: صِرَاطِ
- الآية: (وَأَنَّ هَٰذَا صِرَٰطِي مُسْتَقِيمًا فَٱتَّبِعُوهُ وَلَا تَتَّبِعُوا ٱلسُّبُلَ فَتَفَرَّقَ بِكُمْ عَن سَبِيلِهِ ذَٰلِكُمْ وَصَّىٰكُم بِهِ لَعَلَّكُمْ تَتَّقُونَ) [الأنعام:153]

25)
- النتيجة: صِّرَاطِ
- الآية: (قُلْ كُلٌّ مُّتَرَبِّصٌ فَتَرَبَّصُوا فَسَتَعْلَمُونَ مَنْ أَصْحَٰبُ ٱلصِّرَٰطِ ٱلسَّوِيِّ وَمَنِ ٱهْتَدَىٰ) [طه:135]

35)
- النتيجة: صِرَاطِ
- الآية: (مِن دُونِ ٱللَّهِ فَٱهْدُوهُمْ إِلَىٰ صِرَٰطِ ٱلْجَحِيمِ) [الصافات:23]

37)
- النتيجة: صِّرَاطِ
- الآية: (إِذْ دَخَلُوا عَلَىٰ دَاوُدَ فَفَزِعَ مِنْهُمْ قَالُوا لَا تَخَفْ خَصْمَانِ بَغَىٰ بَعْضُنَا عَلَىٰ بَعْضٍ فَٱحْكُم بَيْنَنَا بِٱلْحَقِّ وَلَا تُشْطِطْ وَٱهْدِنَا إِلَىٰ سَوَاءِ ٱلصِّرَٰطِ) [ص:22]
```

(Extraits représentatifs — le sample complet contient 45 versets)

### Variantes de format observées entre les deux samples

| Aspect | Sample 1 (منافقين) | Sample 2 (صراط) |
|---|---|---|
| النتيجة singulier | ✅ | ✅ |
| النتائج pluriel (" - " séparateur) | ✅ (items 9, 10, 19-22) | ❌ absent |
| Versets très longs (>200 chars) | ✅ (item 4, 9) | ✅ (item 4, 13, 37) |
| Noms de sourates courts (1-2 lettres) | ❌ | ✅ (ص, طه, يس) |
| Forme morphologique avec shadda | ❌ | ✅ (صِّرَاطَ vs صِرَاطَ) |
| En-tête `عدد الآيات N:` | ✅ | ✅ |

### Robustesse du parser

Le format Bahouss est stable entre les deux samples. Variantes à gérer :
- `النتيجة` (singulier) ou `النتائج` (pluriel avec plusieurs formes séparées par " - ")
- Le texte du verset peut contenir des retours à la ligne
- Les parenthèses arabes `﴿﴾` peuvent remplacer `()`
- Certains versets très longs (>200 caractères) — le parser ne doit pas tronquer
- L'en-tête `عدد الآيات N:` doit être ignoré (pas un bloc de verset)
- La forme morphologique peut avoir des diacritiques variés (shadda, kasra, fatha, tanwin)

Le parser doit être tolérant : extraire ce qu'il peut, ignorer ce qu'il ne peut pas parser, et retourner un tableau partiel plutôt que de crasher.

### Lookup sourate nom → numéro

Créer `src/lib/surah-map.ts` — un simple objet :
```typescript
export const SURAH_NAME_TO_NUMBER: Record<string, number> = {
  "الفاتحة": 1,
  "البقرة": 2,
  "آل عمران": 3,
  // ... toutes les 114 sourates
  "ص": 38,        // ← ATTENTION : nom d'une seule lettre
  "ق": 50,        // ← idem
  "طه": 20,       // ← nom court de 2 lettres
  "يس": 36,       // ← idem
  "الناس": 114,
}
```

**Cas limites pour le mapping :**
- Sourates à nom d'une seule lettre : ص (38), ق (50)
- Sourates à nom court : طه (20), يس (36)
- Sourates avec « آل » : آل عمران (3)
- Variantes d'orthographe possibles : الصافات vs صافات (toujours inclure la forme avec ال)

Utiliser ce mapping plutôt que de chercher dans quran.json (plus rapide, pas de I/O).

---

## Étape 2 — Composant UI

Créer `src/components/BahoussInput.tsx`

### Deux états

**État 1 — Zone de collage (textarea)**
- Placeholder arabe : « ألصق هنا نتائج البحث من باحوث... »
- Bouton « تحليل » (parser)
- Positionnement : dans le formulaire `VerseInput.tsx`, après la sélection des tafsirs
- Visuellement traité comme les pills de tafsir — même famille d'UI, pas un élément étranger

**État 2 — Liste de versets parsés (après clic تحليل)**
- Chaque verset affiché comme une ligne avec :
  - Checkbox (cochée par défaut)
  - Référence : `[السورة:الآية]` en badge
  - Texte du verset (tronqué à ~80 caractères avec "..." si trop long, expandable au clic)
  - La forme morphologique (النتيجة) en petit tag discret
- Bouton « تحديد الكل / إلغاء الكل » (select all / deselect all)
- Bouton « مسح » pour revenir à l'état 1 (vider et recoller)
- Compteur : « ١٢ / ٢٥ آية محددة »

### Style

Respecter le design system existant dans `globals.css` :
- Tokens or/crème
- Direction RTL
- Police Amiri pour le texte coranique
- Même traitement visuel que la zone de sélection des tafsirs

### Props

```typescript
interface BahoussInputProps {
  onVersesSelected: (verses: BahoussVerse[]) => void  // uniquement les cochés
}
```

Le composant appelle `onVersesSelected` à chaque changement de sélection (coche/décoche).

---

## Étape 3 — Intégration dans VerseInput.tsx

### Ajout dans le formulaire

Ajouter `BahoussInput` après les pills de tafsir, avec un séparateur visuel et un label :

```
آيات مرجعية (تفسير القرآن بالقرآن)
```

Sous-label discret :
```
ألصق نتائج البحث من تطبيق باحوث لإثراء التدبر
```

### Propagation des données

`VerseInput.tsx` transmet les versets sélectionnés au parent `page.tsx` via le callback `onSubmit`.

Modifier le type `SubmitData` dans `useTadabbur.ts` :

```typescript
interface SubmitData {
  surah: number
  from: number
  to: number
  depth: Depth
  tafsirs: TafsirName[]
  freeText?: string
  crossReferences?: BahoussVerse[]  // ← NOUVEAU
}
```

---

## Étape 4 — Modification de l'API tadabbur

Fichier : `src/app/api/tadabbur/route.ts`

### Body de la requête

Ajouter le champ optionnel `crossReferences` au body attendu.

### Construction du message utilisateur

Si `crossReferences` est présent et non vide, ajouter une section XML dans le message envoyé à Claude :

```xml
<quranic_cross_references>
هذه آيات من القرآن الكريم تتعلق بنفس المفهوم الذي تعالجه الآيات المتدبَّرة.
اختر منها ما يُنير التدبر ويُغني البيان العام أو الهدى المنهاجي.
لا تُقحم آية لمجرد وجودها — استخدمها فقط إن أضافت بصيرة حقيقية.

١. سورة النساء آية ٦١: وَإِذَا قِيلَ لَهُمْ تَعَالَوْا إِلَىٰ مَا أَنزَلَ ٱللَّهُ...
٢. سورة النساء آية ٨٨: فَمَا لَكُمْ فِي ٱلْمُنَٰفِقِينَ فِئَتَيْنِ...
...
</quranic_cross_references>
```

Cette section est placée APRÈS les `<tafsir_context>` dans le message, car elle a le même statut : matériau de référence, pas consigne.

### Pas de modification du system prompt

Le system prompt contient déjà les directives de fidélité et d'usage des sources. Les `<quranic_cross_references>` seront traitées naturellement par ces règles existantes.

---

## Étape 5 — Mode rafraîchissement (après tadabbur)

### Scénario

Le tadabbur est déjà affiché (streaming terminé). L'utilisateur colle des versets Bahouss et clique « إثراء التدبر » (enrichir le tadabbur).

### Implémentation

Deux options, par ordre de simplicité :

**Option A — Relance complète (recommandée pour v1)**
- Le bouton relance le tadabbur avec les mêmes paramètres (sourate, plage, profondeur, tafsirs) + les crossReferences ajoutés
- Le résultat remplace l'ancien
- Simple, pas de nouveau endpoint, pas de logique de diff

**Option B — Complément (v2 future)**
- Envoyer le tadabbur déjà produit + les versets-ressources dans un nouveau prompt
- Claude produit un complément (pas une réécriture)
- Plus complexe : nécessite de stocker le résultat précédent, nouveau prompt template, gestion de l'affichage (avant + après)

→ **Commencer par l'option A.** L'option B peut venir plus tard si le besoin se confirme.

### UI pour le mode rafraîchissement

Quand le tadabbur est affiché (état `done` dans `useTadabbur`) :
- Le composant `BahoussInput` reste visible/accessible (pas masqué après submit)
- Si l'utilisateur colle des versets et clique « إثراء التدبر », relancer avec les mêmes params + crossReferences
- Indicateur visuel que c'est un rafraîchissement : « جارٍ إثراء التدبر بالآيات المرجعية... »

---

## Étape 6 — Mise à jour SUIVI.md

### Retirer de la section "Tâches en suspens"
- `SemanticSearch.tsx` → remplacé par `BahoussInput.tsx`

### Retirer de la section "Priorité moyenne"
- Item 1 "SemanticSearch.tsx" → remplacé

### Ajouter en section "Réalisé" (après implémentation)
```
### Phase 9 — Versets-ressources Bahouss (date)
- [ ] `src/lib/bahouss-parser.ts` — parser texte brut Bahouss → versets structurés
- [ ] `src/lib/surah-map.ts` — mapping nom sourate arabe → numéro
- [ ] `src/components/BahoussInput.tsx` — zone collage + liste checkboxes
- [ ] `VerseInput.tsx` — intégration BahoussInput après pills tafsir
- [ ] `useTadabbur.ts` — type SubmitData étendu avec crossReferences
- [ ] `route.ts` (tadabbur) — section <quranic_cross_references> dans le prompt
- [ ] Suppression BM25 : `bm25.ts`, `rerank.ts`, `search/route.ts`
- [ ] Mode rafraîchissement post-tadabbur (option A — relance complète)
```

---

## Ordre d'implémentation pour Claude Code

```
1. Supprimer bm25.ts, rerank.ts, search/route.ts et nettoyer les imports
2. Créer src/lib/surah-map.ts
3. Créer src/lib/bahouss-parser.ts + tests unitaires (parser les 2 samples : 25 versets منافقين + 45 versets صراط)
4. Créer src/components/BahoussInput.tsx
5. Modifier SubmitData dans useTadabbur.ts (ajouter crossReferences)
6. Modifier VerseInput.tsx (intégrer BahoussInput)
7. Modifier route.ts (ajouter <quranic_cross_references> au prompt)
8. Modifier page.tsx (propager crossReferences dans le submit + mode rafraîchissement)
9. Mettre à jour SUIVI.md
```

---

## Prompt Claude Code pour lancer

```
Lis SUIVI.md pour comprendre l'état du projet.
Lis ce fichier (PLAN-BAHOUSS.md) pour le plan d'implémentation.
Commence par l'étape 1 : supprime bm25.ts, rerank.ts, search/route.ts et nettoie les imports cassés.
Puis enchaîne les étapes 2-9 dans l'ordre.
```

---

## Annexe — Données de test pour le parser

### Test 1 — Sample « منافقين » (25 versets, النتائج pluriel)

Coller ce texte brut dans le parser et vérifier la sortie :

```
عدد الآيات 25:

1)
- النتيجة: مُنَافِقِ
- الآية: (وَإِذَا قِيلَ لَهُمْ تَعَالَوْا إِلَىٰ مَا أَنزَلَ ٱللَّهُ وَإِلَى ٱلرَّسُولِ رَأَيْتَ ٱلْمُنَٰفِقِينَ يَصُدُّونَ عَنكَ صُدُودًا) [النساء:61]

2)
- النتيجة: مُنَافِقِ
- الآية: (فَمَا لَكُمْ فِي ٱلْمُنَٰفِقِينَ فِئَتَيْنِ وَٱللَّهُ أَرْكَسَهُم بِمَا كَسَبُوا أَتُرِيدُونَ أَن تَهْدُوا مَنْ أَضَلَّ ٱللَّهُ وَمَن يُضْلِلِ ٱللَّهُ فَلَن تَجِدَ لَهُ سَبِيلًا) [النساء:88]

3)
- النتيجة: مُنَافِقِ
- الآية: (بَشِّرِ ٱلْمُنَٰفِقِينَ بِأَنَّ لَهُمْ عَذَابًا أَلِيمًا) [النساء:138]

9)
- النتائج: مُنَافِقُ - مُنَافِقَ - مُنَافِقِ
- الآية: (ٱلْمُنَٰفِقُونَ وَٱلْمُنَٰفِقَٰتُ بَعْضُهُم مِّن بَعْضٍ يَأْمُرُونَ بِٱلْمُنكَرِ وَيَنْهَوْنَ عَنِ ٱلْمَعْرُوفِ وَيَقْبِضُونَ أَيْدِيَهُمْ نَسُوا ٱللَّهَ فَنَسِيَهُمْ إِنَّ ٱلْمُنَٰفِقِينَ هُمُ ٱلْفَٰسِقُونَ) [التوبة:67]

22)
- النتائج: مُنَافِقُ - مُنَافِقِ
- الآية: (إِذَا جَاءَكَ ٱلْمُنَٰفِقُونَ قَالُوا نَشْهَدُ إِنَّكَ لَرَسُولُ ٱللَّهِ وَٱللَّهُ يَعْلَمُ إِنَّكَ لَرَسُولُهُ وَٱللَّهُ يَشْهَدُ إِنَّ ٱلْمُنَٰفِقِينَ لَكَٰذِبُونَ) [المنافقون:1]
```

**Assertions :**
- Total parsé : 25 versets
- Item 9 : `morphResult` = `مُنَافِقُ - مُنَافِقَ - مُنَافِقِ` (3 formes, النتائج pluriel)
- Item 22 : surahName = `المنافقون`, surah = 63
- Tous les items : `surah > 0` et `ayah > 0`

### Test 2 — Sample « صراط » (45 versets, noms de sourate courts)

```
عدد الآيات 45:

1)
- النتيجة: صِّرَاطَ
- الآية: (ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ) [الفاتحة:6]

4)
- النتيجة: صِرَاطٍ
- الآية: (كَانَ ٱلنَّاسُ أُمَّةً وَٰحِدَةً فَبَعَثَ ٱللَّهُ ٱلنَّبِيِّنَ مُبَشِّرِينَ وَمُنذِرِينَ وَأَنزَلَ مَعَهُمُ ٱلْكِتَٰبَ بِٱلْحَقِّ لِيَحْكُمَ بَيْنَ ٱلنَّاسِ فِيمَا ٱخْتَلَفُوا فِيهِ وَمَا ٱخْتَلَفَ فِيهِ إِلَّا ٱلَّذِينَ أُوتُوهُ مِن بَعْدِ مَا جَاءَتْهُمُ ٱلْبَيِّنَٰتُ بَغْيًا بَيْنَهُمْ فَهَدَى ٱللَّهُ ٱلَّذِينَ ءَامَنُوا لِمَا ٱخْتَلَفُوا فِيهِ مِنَ ٱلْحَقِّ بِإِذْنِهِ وَٱللَّهُ يَهْدِي مَن يَشَاءُ إِلَىٰ صِرَٰطٍ مُّسْتَقِيمٍ) [البقرة:213]

25)
- النتيجة: صِّرَاطِ
- الآية: (قُلْ كُلٌّ مُّتَرَبِّصٌ فَتَرَبَّصُوا فَسَتَعْلَمُونَ مَنْ أَصْحَٰبُ ٱلصِّرَٰطِ ٱلسَّوِيِّ وَمَنِ ٱهْتَدَىٰ) [طه:135]

37)
- النتيجة: صِّرَاطِ
- الآية: (إِذْ دَخَلُوا عَلَىٰ دَاوُدَ فَفَزِعَ مِنْهُمْ قَالُوا لَا تَخَفْ خَصْمَانِ بَغَىٰ بَعْضُنَا عَلَىٰ بَعْضٍ فَٱحْكُم بَيْنَنَا بِٱلْحَقِّ وَلَا تُشْطِطْ وَٱهْدِنَا إِلَىٰ سَوَاءِ ٱلصِّرَٰطِ) [ص:22]

45)
- النتيجة: صِرَاطٍ
- الآية: (أَفَمَن يَمْشِي مُكِبًّا عَلَىٰ وَجْهِهِ أَهْدَىٰ أَمَّن يَمْشِي سَوِيًّا عَلَىٰ صِرَٰطٍ مُّسْتَقِيمٍ) [الملك:22]
```

**Assertions :**
- Total parsé : 45 versets
- Item 25 : surahName = `طه`, surah = 20 (nom court 2 lettres)
- Item 37 : surahName = `ص`, surah = 38 (nom 1 seule lettre arabe)
- Item 4 : `text.length > 200` (verset long, intégralement conservé)
- Item 1 : morphResult avec shadda initiale (`صِّرَاطَ`)
- Aucun item : `surah === 0` ou `ayah === 0`
