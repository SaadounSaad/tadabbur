import fs from "fs";
import path from "path";

const SOURCE_DIR = "C:\\Mes Projets\\Usine\\Quran\\Quran-Json\\data\\json\\verses";
const OUT_FILE = path.join(process.cwd(), "data", "quran", "quran.json");

const quran: Record<string, Record<string, string>> = {};

const files = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith(".json"));

for (const file of files) {
  const parts = file.replace(".json", "").split("_");
  const surahNum = parseInt(parts[0], 10);
  const verseNum = parseInt(parts[1], 10);
  const data = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, file), "utf-8"));
  if (!quran[surahNum]) quran[surahNum] = {};
  quran[surahNum][verseNum] = data.text.ar;
}

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(quran));
console.log(`Done — ${files.length} verses → ${OUT_FILE}`);
