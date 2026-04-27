/**
 * Data cache layer — abstracts file access between local dev and Vercel + R2.
 *
 * Local mode: reads directly from `data/` (unchanged behaviour).
 * Vercel mode: downloads files from Cloudflare R2 on first access,
 *              caches them in `/tmp/tadabbur-data/` for the lifetime of the instance.
 *
 * Usage:
 *   import { readDataFile } from "@/lib/data-cache";
 *   const content = readDataFile("quran/quran.json");
 *   const tafsir = readDataFile("tafsir/tabari/001.txt");
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const LOCAL_DATA_DIR = path.join(process.cwd(), "data");
const TMP_CACHE_DIR = "/tmp/tadabbur-data";
const R2_BASE_URL = process.env.R2_PUBLIC_URL || "";

function isVercel(): boolean {
  return process.env.VERCEL === "1";
}

/**
 * Read a data file by its relative path within the `data/` directory.
 *
 * @param relativePath  e.g. "quran/quran.json" or "tafsir/tabari/001.txt"
 * @returns File contents as UTF-8 string.
 */
export function readDataFile(relativePath: string): string {
  if (isVercel()) {
    return readFromR2Cache(relativePath);
  }
  return fs.readFileSync(path.join(LOCAL_DATA_DIR, relativePath), "utf-8");
}

/**
 * Check if a data file exists.
 */
export function dataFileExists(relativePath: string): boolean {
  if (isVercel()) {
    const tmpPath = path.join(TMP_CACHE_DIR, relativePath);
    if (fs.existsSync(tmpPath)) return true;
    // We don't know without trying — optimistically return true
    return true;
  }
  return fs.existsSync(path.join(LOCAL_DATA_DIR, relativePath));
}

/**
 * Get file stats (size) — used by tafsir-loader for the 50MB guard.
 */
export function dataFileSize(relativePath: string): number {
  if (isVercel()) {
    const tmpPath = path.join(TMP_CACHE_DIR, relativePath);
    if (fs.existsSync(tmpPath)) {
      return fs.statSync(tmpPath).size;
    }
    // Unknown size — return 0 so the guard skips (will download and check later)
    return 0;
  }
  return fs.statSync(path.join(LOCAL_DATA_DIR, relativePath)).size;
}

// ── R2 cache helpers ───────────────────────────────────────────────────────

function readFromR2Cache(relativePath: string): string {
  const tmpPath = path.join(TMP_CACHE_DIR, relativePath);

  if (!fs.existsSync(tmpPath)) {
    downloadFromR2(relativePath, tmpPath);
  }

  return fs.readFileSync(tmpPath, "utf-8");
}

function downloadFromR2(relativePath: string, tmpPath: string): void {
  if (!R2_BASE_URL) {
    throw new Error(
      "R2_PUBLIC_URL is not set. Configure it in Vercel environment variables."
    );
  }

  const dir = path.dirname(tmpPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const url = `${R2_BASE_URL.replace(/\/+$/, "")}/${relativePath.replace(/\\/g, "/")}`;

  try {
    execSync(`curl -sf "${url}" --output "${tmpPath}"`, {
      timeout: 30_000,
      encoding: "utf-8",
    });
  } catch {
    // Clean up partial download on failure
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    throw new Error(`Failed to download ${url} from R2`);
  }
}
