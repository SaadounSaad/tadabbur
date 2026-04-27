const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ]/g;

export function normalizeArabic(text: string): string {
  return text
    .replace(TASHKEEL, "")
    .replace(/[أإآء]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ٱ/g, "ا")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  return normalizeArabic(text)
    .split(" ")
    .filter(t => t.length > 1);
}
