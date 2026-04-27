/**
 * Upload script — syncs `data/` directory to Cloudflare R2.
 *
 * Usage:
 *   1. Set env vars: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT
 *      (or create .env.local with these values)
 *   2. npx tsx scripts/upload-to-r2.ts
 *
 * The script walks `data/` recursively and uploads every file,
 * preserving the relative path as the object key.
 */
import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { lookup } from "mime-types";

// ── Config ─────────────────────────────────────────────────────────────────

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing ${key} in environment or .env.local`);
  return val;
}

// Try loading .env.local manually (tsx doesn't auto-load it)
const envLocalPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const lines = fs.readFileSync(envLocalPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const ACCESS_KEY_ID = getEnv("R2_ACCESS_KEY_ID");
const SECRET_ACCESS_KEY = getEnv("R2_SECRET_ACCESS_KEY");
const BUCKET_NAME = getEnv("R2_BUCKET_NAME");
const ENDPOINT = getEnv("R2_ENDPOINT"); // e.g. https://<accountid>.r2.cloudflarestorage.com

const DATA_DIR = path.join(process.cwd(), "data");

// ── S3 client ──────────────────────────────────────────────────────────────

const s3 = new S3Client({
  region: "auto",
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

// ── Walk & upload ──────────────────────────────────────────────────────────

interface FileEntry {
  relativePath: string; // e.g. "quran/quran.json" or "tafsir/tabari/001.txt"
  absolutePath: string;
}

function walkDir(dir: string, baseDir: string): FileEntry[] {
  const entries: FileEntry[] = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const absPath = path.join(dir, item.name);
    const relPath = path.relative(baseDir, absPath).replace(/\\/g, "/");
    if (item.isDirectory()) {
      entries.push(...walkDir(absPath, baseDir));
    } else if (item.isFile()) {
      entries.push({ relativePath: relPath, absolutePath: absPath });
    }
  }
  return entries;
}

async function uploadFile(entry: FileEntry): Promise<void> {
  const content = fs.readFileSync(entry.absolutePath);
  const contentType = lookup(entry.relativePath) || "text/plain";

  console.log(`  ↑ ${entry.relativePath} (${(content.length / 1024).toFixed(1)} KB, ${contentType})`);

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: entry.relativePath,
      Body: content,
      ContentType: contentType,
    })
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n📁 Scanning ${DATA_DIR}...\n`);
  const files = walkDir(DATA_DIR, DATA_DIR);
  console.log(`Found ${files.length} files to upload.\n`);

  let success = 0;
  let failed = 0;

  for (const file of files) {
    try {
      await uploadFile(file);
      success++;
    } catch (err) {
      console.error(`  ✗ ${file.relativePath}: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(`\n✅ Done — ${success} uploaded, ${failed} failed.\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
