import { SURAH_NAME_TO_NUMBER } from "./surah-map";

export interface BahoussVerse {
  index: number;
  surah: number;
  surahName: string;
  ayah: number;
  text: string;
  morphResult: string;
}

// Matches النتيجة (singular) or النتائج (plural)
const RESULT_RE = /(?:النتيجة|النتائج)\s*[:：]?\s*(.+)/;
// Matches الآية: (verse text) [SurahName:AyahNum]
const VERSE_LINE_RE = /الآية\s*[:：]?\s*[（(﴿]([\s\S]+?)[）)﴾]\s*\[([^\]]+)\]/;

export function parseBahoussText(raw: string): BahoussVerse[] {
  // Strip optional header "عدد الآيات N:"
  const body = raw.replace(/^عدد الآيات\s*\d+\s*:?\s*\n?/m, "");

  // Split on numbered block markers: "N)" alone on a line
  const blockRe = /^(\d+)\)\s*$/m;
  const parts = body.split(blockRe);
  // parts: [preamble, "1", block1, "2", block2, ...]

  const results: BahoussVerse[] = [];

  for (let i = 1; i < parts.length - 1; i += 2) {
    const idx = parseInt(parts[i], 10);
    const block = parts[i + 1];

    try {
      const resultMatch = block.match(RESULT_RE);
      if (!resultMatch) continue;
      const morphResult = resultMatch[1].trim();

      const verseMatch = block.match(VERSE_LINE_RE);
      if (!verseMatch) continue;
      const text = verseMatch[1].replace(/\s+/g, " ").trim();
      const refStr = verseMatch[2].trim(); // "SurahName:AyahNum"

      const colonIdx = refStr.lastIndexOf(":");
      if (colonIdx === -1) continue;
      const surahName = refStr.slice(0, colonIdx).trim();
      const ayah = parseInt(refStr.slice(colonIdx + 1), 10);
      if (isNaN(ayah) || ayah <= 0) continue;

      const surah = SURAH_NAME_TO_NUMBER[surahName] ?? 0;

      results.push({ index: idx, surah, surahName, ayah, text, morphResult });
    } catch {
      // skip unparseable blocks
    }
  }

  return results.sort((a, b) => a.index - b.index);
}
