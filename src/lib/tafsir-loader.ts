import fs from "fs";
import path from "path";

export type TafsirName =
  | "tabari"
  | "ibn-kathir"
  | "fakhri-razi"
  | "ibn-achour"
  | "fi-zilal";

export interface TafsirEntry {
  name: TafsirName;
  label: string;
  labelAr: string;
  content: string;
}

const TAFSIR_LABELS: Record<TafsirName, { ar: string; fr: string }> = {
  tabari: { ar: "تفسير الطبري", fr: "Tafsir Al-Tabari" },
  "ibn-kathir": { ar: "تفسير ابن كثير", fr: "Tafsir Ibn Kathir" },
  "fakhri-razi": { ar: "تفسير الفخر الرازي", fr: "Tafsir Fakhr Al-Razi" },
  "ibn-achour": {
    ar: "التحرير والتنوير — ابن عاشور",
    fr: "Al-Tahrir wal-Tanwir — Ibn Achour",
  },
  "fi-zilal": { ar: "في ظلال القرآن — سيد قطب", fr: "Fi Zilal Al-Quran — Sayyid Qutb" },
};

const TAFSIR_DIR = path.join(process.cwd(), "data", "tafsir");

export function getTafsirForVerses(
  surahNumber: number,
  verseNumbers: number[]
): TafsirEntry[] {
  const results: TafsirEntry[] = [];
  const tafsirNames = Object.keys(TAFSIR_LABELS) as TafsirName[];

  for (const tafsirName of tafsirNames) {
    const surahFile = path.join(
      TAFSIR_DIR,
      tafsirName,
      `${String(surahNumber).padStart(3, "0")}.txt`
    );

    if (!fs.existsSync(surahFile)) continue;

    const content = fs.readFileSync(surahFile, "utf-8");
    const extracted = extractVerses(content, verseNumbers);

    if (extracted) {
      results.push({
        name: tafsirName,
        label: TAFSIR_LABELS[tafsirName].fr,
        labelAr: TAFSIR_LABELS[tafsirName].ar,
        content: extracted,
      });
    }
  }

  return results;
}

function extractVerses(content: string, verseNumbers: number[]): string | null {
  const lines = content.split("\n");
  const chunks: string[] = [];

  for (const verseNum of verseNumbers) {
    // Look for verse markers like [1], (1), آية 1, verse 1, etc.
    const patterns = [
      new RegExp(`\\[\\s*${verseNum}\\s*\\]`),
      new RegExp(`\\(\\s*${verseNum}\\s*\\)`),
      new RegExp(`آية\\s+${verseNum}`),
      new RegExp(`الآية\\s+${verseNum}`),
      new RegExp(`^${verseNum}[\\s\\-\\.]`),
    ];

    let startLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (patterns.some((p) => p.test(lines[i]))) {
        startLine = i;
        break;
      }
    }

    if (startLine === -1) continue;

    // Collect content until next verse marker or 30 lines
    const chunk: string[] = [];
    for (let i = startLine; i < Math.min(startLine + 30, lines.length); i++) {
      const line = lines[i];
      const isNextVerse =
        i > startLine &&
        patterns.some((_, idx) => {
          const nextNum = verseNum + 1;
          return new RegExp(
            `\\[\\s*${nextNum}\\s*\\]|\\(\\s*${nextNum}\\s*\\)|آية\\s+${nextNum}`
          ).test(line);
        });
      if (isNextVerse) break;
      chunk.push(line);
    }

    if (chunk.length > 0) chunks.push(chunk.join("\n"));
  }

  return chunks.length > 0 ? chunks.join("\n\n---\n\n") : null;
}

export function listAvailableTafsirs(): TafsirName[] {
  if (!fs.existsSync(TAFSIR_DIR)) return [];
  return fs
    .readdirSync(TAFSIR_DIR)
    .filter((d) => fs.statSync(path.join(TAFSIR_DIR, d)).isDirectory())
    .filter((d) => d in TAFSIR_LABELS) as TafsirName[];
}
