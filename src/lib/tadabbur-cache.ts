/**
 * In-memory cache for tadabbur API responses.
 * Avoids redundant Anthropic API calls for identical requests.
 *
 * Cache key = hash(surahNumber + verseRange + depth + tafsirs + crossReferences)
 * TTL = 24 hours by default (configurable via CACHE_TTL_MS env var)
 */
import crypto from "crypto";

interface CacheEntry {
  /** Full generated text (concatenated SSE text deltas) */
  text: string;
  /** Tafsir entries sent as context event */
  tafsirEntries: Array<{ name: string; labelAr: string; content: string }>;
  /** Resolved verses (only when isPlaceholder) */
  resolvedVerses: string[] | null;
  /** Whether original request used placeholders */
  isPlaceholder: boolean;
  /** When this entry was created (ms) */
  createdAt: number;
}

export class TadabburCache {
  private store = new Map<string, CacheEntry>();
  private readonly ttlMs: number;
  private lastCleanup = Date.now();

  constructor(ttlMs?: number) {
    this.ttlMs = ttlMs ?? getEnvInt("CACHE_TTL_MS", 86_400_000); // 24h default
  }

  /**
   * Build a deterministic cache key from request parameters.
   * Cross-references are sorted by index to ensure key stability.
   */
  static makeKey(params: {
    surahNumber?: number;
    verseNumbers?: number[];
    depth?: string;
    tafsirs?: string[];
    crossReferences?: Array<{ index: number }>;
  }): string {
    const parts: string[] = [];
    parts.push(String(params.surahNumber ?? ""));
    parts.push((params.verseNumbers ?? []).join(","));
    parts.push(params.depth ?? "medium");
    parts.push((params.tafsirs ?? []).slice().sort().join(","));
    // Sort cross-references by index for deterministic ordering
    const refs = (params.crossReferences ?? []).slice().sort((a, b) => a.index - b.index);
    parts.push(refs.map((r) => String(r.index)).join(","));
    return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
  }

  get(key: string): CacheEntry | null {
    this.cleanupIfNeeded();
    const entry = this.store.get(key);
    if (!entry) return null;
    // Check TTL
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  set(key: string, entry: Omit<CacheEntry, "createdAt">): void {
    this.cleanupIfNeeded();
    this.store.set(key, { ...entry, createdAt: Date.now() });
  }

  private cleanupIfNeeded(): void {
    const now = Date.now();
    if (now - this.lastCleanup < 60_000) return; // once per minute
    this.lastCleanup = now;
    const cutoff = now - this.ttlMs;
    for (const [key, entry] of this.store) {
      if (entry.createdAt < cutoff) this.store.delete(key);
    }
  }

  /** Exposed for testing */
  get size(): number {
    return this.store.size;
  }

  reset(): void {
    this.store.clear();
  }
}

function getEnvInt(key: string, fallback: number): number {
  const val = process.env[key];
  if (val === undefined || val === "") return fallback;
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Singleton instance */
export const tadabburCache = new TadabburCache();
