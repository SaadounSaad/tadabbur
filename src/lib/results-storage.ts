/**
 * Results storage — persists tadabbur results to Cloudflare R2.
 *
 * On Vercel: reads/writes to the `tadabbur-results` bucket via S3 SDK.
 * In local dev: falls back to localStorage (unchanged behaviour).
 *
 * Each result is stored as a JSON file keyed by a UUID:
 *   results/{id}.json
 *
 * A manifest file `results/index.json` keeps the list of all results
 * (limited to the 50 most recent) for fast history loading.
 */
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const RESULTS_BUCKET = "tadabbur-results";
const RESULTS_PREFIX = "results/";
const INDEX_KEY = "results/index.json";

// ── S3 client (lazy) ───────────────────────────────────────────────────────

let _s3: S3Client | null = null;

function getS3Client(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT || "",
      credentials: {
        accessKeyId: process.env.R2_RESULTS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_RESULTS_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return _s3;
}

function isVercel(): boolean {
  return process.env.VERCEL === "1";
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface StoredResult {
  id: string;
  surah: string;
  surahNumber: number;
  verseRange: string;
  fromVerse: number;
  toVerse: number;
  depth: "brief" | "medium" | "detailed";
  tafsirs: string[];
  timestamp: number;
  text: string;
  resolvedVerses?: string[] | null;
  contextTafsirs?: Array<{ name: string; labelAr: string; content: string }>;
  crossReferences?: Array<{ index: number; surah: number; surahName: string; ayah: number; text: string; morphResult: string }>;
}

interface ResultsIndex {
  items: Array<{
    id: string;
    surah: string;
    verseRange: string;
    depth: string;
    timestamp: number;
  }>;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Save a result to R2. Updates both the individual file and the index.
 */
export async function saveResult(result: StoredResult): Promise<void> {
  if (!isVercel()) {
    // Local dev: store in localStorage under a special key
    try {
      const key = `td:r2:${result.id}`;
      localStorage.setItem(key, JSON.stringify(result));
      // Update local index
      const localIndex = loadLocalIndex();
      const existing = localIndex.findIndex((i) => i.id === result.id);
      const entry = { id: result.id, surah: result.surah, verseRange: result.verseRange, depth: result.depth, timestamp: result.timestamp };
      if (existing >= 0) localIndex[existing] = entry;
      else localIndex.unshift(entry);
      localStorage.setItem("td:r2:index", JSON.stringify(localIndex.slice(0, 50)));
    } catch { /* localStorage full — ignore */ }
    return;
  }

  const client = getS3Client();

  // Save individual result
  await client.send(
    new PutObjectCommand({
      Bucket: RESULTS_BUCKET,
      Key: `${RESULTS_PREFIX}${result.id}.json`,
      Body: JSON.stringify(result),
      ContentType: "application/json",
    })
  );

  // Update index
  await appendToIndex(client, result);
}

/**
 * Load all results (from index, then fetch each one).
 * Returns the 20 most recent results.
 */
export async function loadResults(): Promise<StoredResult[]> {
  if (!isVercel()) {
    try {
      const localIndex = loadLocalIndex();
      const results: StoredResult[] = [];
      for (const entry of localIndex.slice(0, 20)) {
        const raw = localStorage.getItem(`td:r2:${entry.id}`);
        if (raw) {
          try { results.push(JSON.parse(raw)); } catch { /* skip corrupt */ }
        }
      }
      return results;
    } catch { return []; }
  }

  try {
    const client = getS3Client();
    const index = await fetchIndex(client);
    if (!index) return [];

    // Fetch individual results in parallel (max 20)
    const ids = index.items.slice(0, 20).map((i) => i.id);
    const results = await Promise.all(
      ids.map((id) => fetchResult(client, id))
    );
    return results.filter((r): r is StoredResult => r !== null);
  } catch {
    return [];
  }
}

/**
 * Delete a result by ID.
 */
export async function deleteResult(id: string): Promise<void> {
  if (!isVercel()) {
    try {
      localStorage.removeItem(`td:r2:${id}`);
      const localIndex = loadLocalIndex().filter((i) => i.id !== id);
      localStorage.setItem("td:r2:index", JSON.stringify(localIndex));
    } catch { /* ignore */ }
    return;
  }

  try {
    const client = getS3Client();
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await client.send(
      new DeleteObjectCommand({
        Bucket: RESULTS_BUCKET,
        Key: `${RESULTS_PREFIX}${id}.json`,
      })
    );
    // Rebuild index
    await rebuildIndex(client);
  } catch { /* ignore */ }
}

// ── Internal helpers ───────────────────────────────────────────────────────

function loadLocalIndex(): ResultsIndex["items"] {
  try {
    const raw = localStorage.getItem("td:r2:index");
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

async function fetchIndex(client: S3Client): Promise<ResultsIndex | null> {
  try {
    const cmd = new GetObjectCommand({ Bucket: RESULTS_BUCKET, Key: INDEX_KEY });
    const response = await client.send(cmd);
    const body = await response.Body?.transformToString();
    if (!body) return null;
    return JSON.parse(body);
  } catch {
    return null;
  }
}

async function fetchResult(client: S3Client, id: string): Promise<StoredResult | null> {
  try {
    const cmd = new GetObjectCommand({ Bucket: RESULTS_BUCKET, Key: `${RESULTS_PREFIX}${id}.json` });
    const response = await client.send(cmd);
    const body = await response.Body?.transformToString();
    if (!body) return null;
    return JSON.parse(body);
  } catch {
    return null;
  }
}

async function appendToIndex(client: S3Client, result: StoredResult): Promise<void> {
  const index = (await fetchIndex(client)) ?? { items: [] };
  const entry = {
    id: result.id,
    surah: result.surah,
    verseRange: result.verseRange,
    depth: result.depth,
    timestamp: result.timestamp,
  };

  const existing = index.items.findIndex((i) => i.id === result.id);
  if (existing >= 0) index.items[existing] = entry;
  else index.items.unshift(entry);

  // Keep only the 50 most recent
  index.items = index.items.slice(0, 50);

  await client.send(
    new PutObjectCommand({
      Bucket: RESULTS_BUCKET,
      Key: INDEX_KEY,
      Body: JSON.stringify(index),
      ContentType: "application/json",
    })
  );
}

async function rebuildIndex(client: S3Client): Promise<void> {
  try {
    // List all result files
    const listCmd = new ListObjectsV2Command({
      Bucket: RESULTS_BUCKET,
      Prefix: RESULTS_PREFIX,
    });
    const listResponse = await client.send(listCmd);
    const keys = (listResponse.Contents ?? [])
      .map((c) => c.Key)
      .filter((k): k is string => !!k && k.endsWith(".json") && k !== INDEX_KEY);

    // Fetch all in parallel
    const results = await Promise.all(
      keys.map((key) => {
        const id = key.replace(RESULTS_PREFIX, "").replace(".json", "");
        return fetchResult(client, id);
      })
    );

    const items = results
      .filter((r): r is StoredResult => r !== null)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50)
      .map((r) => ({
        id: r.id,
        surah: r.surah,
        verseRange: r.verseRange,
        depth: r.depth,
        timestamp: r.timestamp,
      }));

    await client.send(
      new PutObjectCommand({
        Bucket: RESULTS_BUCKET,
        Key: INDEX_KEY,
        Body: JSON.stringify({ items }),
        ContentType: "application/json",
      })
    );
  } catch { /* ignore */ }
}
