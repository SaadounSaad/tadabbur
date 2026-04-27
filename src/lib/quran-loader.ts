import { readDataFile } from "@/lib/data-cache";

type QuranData = Record<string, Record<string, string>>;

let cache: QuranData | null = null;

function load(): QuranData {
  if (cache) return cache;
  cache = JSON.parse(readDataFile("quran/quran.json"));
  return cache!;
}

export function getVerses(surahNumber: number, from: number, to: number): string[] {
  const surah = load()[String(surahNumber)];
  if (!surah) return [];
  const out: string[] = [];
  for (let v = from; v <= to; v++) {
    const text = surah[String(v)];
    if (text) out.push(text);
  }
  return out;
}
