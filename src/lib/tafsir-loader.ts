import fs from "fs";
import path from "path";
import { readDataFile, dataFileExists, dataFileSize } from "@/lib/data-cache";

export type TafsirName =
  | "tabari"
  | "ibn-kathir"
  | "fakhri-razi"
  | "ibn-achour"
  | "muharrar"
  | "fi-zilal";

export interface TafsirEntry {
  name: TafsirName;
  label: string;
  labelAr: string;
  content: string;
}

const TAFSIR_LABELS: Record<TafsirName, { ar: string; fr: string }> = {
  "ibn-achour": {
    ar: "التحرير والتنوير — ابن عاشور",
    fr: "Al-Tahrir wal-Tanwir — Ibn Achour",
  },
  muharrar: { ar: "التفسير المحرر — الدرر السنية", fr: "Al-Tafsir Al-Muharrar — Dorar" },
  tabari: { ar: "تفسير الطبري", fr: "Tafsir Al-Tabari" },
  "fakhri-razi": { ar: "تفسير الفخر الرازي", fr: "Tafsir Fakhr Al-Razi" },
  "ibn-kathir": { ar: "تفسير ابن كثير", fr: "Tafsir Ibn Kathir" },
  "fi-zilal": { ar: "في ظلال القرآن — سيد قطب", fr: "Fi Zilal Al-Quran — Sayyid Qutb" },
};

const MAX_CHARS_PER_TAFSIR = 15000;
const MAX_TOTAL_PER_TAFSIR = 30000;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// ── Helpers ────────────────────────────────────────────────────────────────

const AR_DIGITS: Record<string, string> = {
  "0":"٠","1":"١","2":"٢","3":"٣","4":"٤","5":"٥","6":"٦","7":"٧","8":"٨","9":"٩",
};
function toArabicNum(n: number): string {
  return String(n).split("").map(d => AR_DIGITS[d] ?? d).join("");
}

function stripHtml(text: string): string {
  return text
    .replace(/<span[^>]*>\[([^\]]+)\]<\/span>/g, "[$1]")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
}

function normalizeLines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

// Diacritics only: U+0610-U+061A (sign marks), U+064B-U+065F (tashkeel), U+0670 (superscript alef),
// U+06D6-U+06DC, U+06DF-U+06E4, U+06E7-U+06E8, U+06EA-U+06ED
const TASHKEEL_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g;
function stripTashkeel(s: string) { return s.replace(TASHKEEL_RE, ""); }

function truncateAtSentence(s: string, max: number): string {
  if (s.length <= max) return s;
  // Try to break at a line or sentence boundary near the limit
  const slice = s.slice(0, max);
  const lastNewline = slice.lastIndexOf("\n");
  const lastPeriod = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf(".\n"),
    slice.lastIndexOf(".\r"),
  );
  const breakAt = Math.max(lastNewline, lastPeriod > 0 ? lastPeriod + 1 : 0);
  return breakAt > max * 0.7 ? slice.slice(0, breakAt) : slice;
}

function joinChunks(chunks: string[]): string | null {
  if (chunks.length === 0) return null;
  const joined = chunks.join("\n\n");
  return truncateAtSentence(joined, MAX_TOTAL_PER_TAFSIR);
}

// ── Absolute ayah index (tabari / ibn-kathir) ──────────────────────────────

let _ayahOffsets: number[] | null = null;

function getAyahOffsets(): number[] {
  if (_ayahOffsets) return _ayahOffsets;
  const quran: Record<string, Record<string, string>> = JSON.parse(
    readDataFile("quran/quran.json")
  );
  const offsets: number[] = [0]; // index 0 unused; 1-based
  let cumulative = 1;
  for (let s = 1; s <= 114; s++) {
    offsets[s] = cumulative;
    cumulative += Object.keys(quran[String(s)]).length;
  }
  _ayahOffsets = offsets;
  return offsets;
}

function absoluteAyah(surahNum: number, verseNum: number): number {
  return getAyahOffsets()[surahNum] + verseNum - 1;
}

// ── Per-tafsir extractors ──────────────────────────────────────────────────

/**
 * tabari / ibn-kathir: <span id="aya-N"> where N is the absolute ayah number.
 * Extract raw HTML between consecutive aya spans, then strip HTML.
 */
function extractWithAyaSpan(
  rawContent: string,
  surahNum: number,
  verseNumbers: number[]
): string | null {
  const chunks: string[] = [];

  for (const verseNum of verseNumbers) {
    const absAyah = absoluteAyah(surahNum, verseNum);
    const startMarker = `id="aya-${absAyah}"`;
    const markerIdx = rawContent.indexOf(startMarker);
    if (markerIdx === -1) continue;

    // Skip past the closing > of the span that contains the marker
    const tagEnd = rawContent.indexOf(">", markerIdx);
    const startIdx = tagEnd !== -1 ? tagEnd + 1 : markerIdx;

    const endMarker = `id="aya-${absAyah + 1}"`;
    // End at the START of the next span tag
    let endIdx = rawContent.indexOf(endMarker, startIdx);
    if (endIdx !== -1) {
      const spanStart = rawContent.lastIndexOf("<", endIdx);
      if (spanStart > startIdx) endIdx = spanStart;
    }

    const rawChunk =
      endIdx === -1
        ? rawContent.slice(startIdx, startIdx + MAX_CHARS_PER_TAFSIR * 5)
        : rawContent.slice(startIdx, endIdx);

    const clean = normalizeLines(stripHtml(rawChunk)).trim();
    if (clean) chunks.push(truncateAtSentence(clean, MAX_CHARS_PER_TAFSIR));
  }

  return joinChunks(chunks);
}

/**
 * muharrar: grouped blocks headed by === ... الآيات (START-END) ===
 * Multiple verses may share the same group; return each group once.
 */
function extractMuharrar(rawContent: string, verseNumbers: number[]): string | null {
  const lines = normalizeLines(rawContent).split("\n");
  const HEADER_RE = /الآي(?:ة|تان|ات)\s*\((\d+)(?:-(\d+))?\)/;

  const groups: { start: number; end: number; lineStart: number; lineEnd: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("===")) continue;
    const m = HEADER_RE.exec(stripTashkeel(lines[i]));
    if (!m) continue;
    groups.push({
      start: parseInt(m[1]),
      end: m[2] ? parseInt(m[2]) : parseInt(m[1]),
      lineStart: i,
      lineEnd: lines.length,
    });
  }
  for (let g = 0; g < groups.length - 1; g++) {
    groups[g].lineEnd = groups[g + 1].lineStart;
  }

  const seen = new Set<number>();
  const chunks: string[] = [];
  for (const vn of verseNumbers) {
    const group = groups.find(g => vn >= g.start && vn <= g.end);
    if (!group || seen.has(group.lineStart)) continue;
    seen.add(group.lineStart);
    const chunk = lines.slice(group.lineStart, group.lineEnd).join("\n").trim();
    if (chunk) chunks.push(truncateAtSentence(chunk, MAX_CHARS_PER_TAFSIR));
  }

  return joinChunks(chunks);
}

// ── Span-title extractor (ibn-achour / fakhri-razi) ───────────────────────

function isStrictMarker(line: string, num: number, arNum: string): boolean {
  const t = line.trim();
  return t === `[${num}]` || t === `[${arNum}]` || t === `(${num})` || t === `(${arNum})`;
}

function isSpanMarker(line: string, verseNum: number, arNum: string): boolean {
  const t = stripTashkeel(line.trim());
  return (
    t.endsWith(`آية ${verseNum}]`) ||
    t.endsWith(`آية ${arNum}]`) ||
    t.endsWith(`آية: ${verseNum}]`) ||
    t.endsWith(`آية: ${arNum}]`)
  );
}

function extractSpanTitle(rawContent: string, verseNumbers: number[]): string | null {
  if (!rawContent.trim()) return null;

  const content = normalizeLines(stripHtml(rawContent));
  const lines = content.split("\n");
  const chunks: string[] = [];

  for (const verseNum of verseNumbers) {
    const arNum = toArabicNum(verseNum);
    let startLine = -1;

    // Pass 1: strict standalone [N] or (N)
    for (let i = 0; i < lines.length; i++) {
      if (isStrictMarker(lines[i], verseNum, arNum)) { startLine = i; break; }
    }

    // Pass 2: span title marker [سورة X : آية N]
    if (startLine === -1) {
      for (let i = 0; i < lines.length; i++) {
        if (isSpanMarker(lines[i], verseNum, arNum)) { startLine = i; break; }
      }
    }

    // Pass 3: loose fallback patterns
    if (startLine === -1) {
      const loose = [
        new RegExp(`[اآ]لآية[\\s:]*(?:${verseNum}|${arNum})(?:[^\\d٠-٩]|$)`),
        new RegExp(`^(?:${verseNum}|${arNum})[\\s\\-\\.،]`),
      ];
      for (let i = 0; i < lines.length; i++) {
        if (loose.some(p => p.test(lines[i]))) { startLine = i; break; }
      }
    }

    if (startLine === -1) continue;

    const nextNum = verseNum + 1;
    const arNext = toArabicNum(nextNum);
    const chunk: string[] = [];

    for (let i = startLine; i < lines.length; i++) {
      if (i > startLine && (
        isStrictMarker(lines[i], nextNum, arNext) ||
        isSpanMarker(lines[i], nextNum, arNext)
      )) break;
      chunk.push(lines[i]);
    }
    if (chunk.length > 0) {
      const raw = chunk.join("\n");
      chunks.push(truncateAtSentence(raw, MAX_CHARS_PER_TAFSIR));
    }
  }

  return joinChunks(chunks);
}

// ── Public API ─────────────────────────────────────────────────────────────

export function getTafsirForVerses(
  surahNumber: number,
  verseNumbers: number[],
  selectedNames?: TafsirName[]
): TafsirEntry[] {
  const results: TafsirEntry[] = [];
  const names = selectedNames ?? (Object.keys(TAFSIR_LABELS) as TafsirName[]);

  for (const tafsirName of names) {
    const surahFile = path.join(
      "tafsir",
      tafsirName,
      `${String(surahNumber).padStart(3, "0")}.txt`
    );
    if (!dataFileExists(surahFile)) continue;
    if (dataFileSize(surahFile) > MAX_FILE_SIZE) {
      console.warn(`Tafsir file too large, skipping: ${surahFile}`);
      continue;
    }

    const rawContent = readDataFile(surahFile);

    let extracted: string | null;
    if (tafsirName === "tabari" || tafsirName === "ibn-kathir") {
      extracted = extractWithAyaSpan(rawContent, surahNumber, verseNumbers);
    } else if (tafsirName === "muharrar") {
      extracted = extractMuharrar(rawContent, verseNumbers);
    } else {
      // ibn-achour, fakhri-razi, fi-zilal (span-title format)
      extracted = extractSpanTitle(rawContent, verseNumbers);
    }

    const fallback = truncateAtSentence(normalizeLines(stripHtml(rawContent)), MAX_CHARS_PER_TAFSIR);

    results.push({
      name: tafsirName,
      label: TAFSIR_LABELS[tafsirName].fr,
      labelAr: TAFSIR_LABELS[tafsirName].ar,
      content: extracted ?? fallback,
    });
  }

  return results;
}

export function listAvailableTafsirs(): TafsirName[] {
  const dataDir = path.join(process.cwd(), "data", "tafsir");
  if (!fs.existsSync(dataDir)) return [];
  return fs
    .readdirSync(dataDir)
    .filter((d) => fs.statSync(path.join(dataDir, d)).isDirectory())
    .filter((d) => d in TAFSIR_LABELS) as TafsirName[];
}
