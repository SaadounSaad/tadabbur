/**
 * In-memory sliding window rate limiter.
 * Tracks requests per IP with automatic cleanup of expired entries.
 * Suitable for single-user/personal deployments — no Redis needed.
 */

interface WindowEntry {
  /** Timestamps of requests within the current window (ms) */
  timestamps: number[];
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

export class RateLimiter {
  private store = new Map<string, WindowEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private cleanupIntervalMs: number;
  private lastCleanup = Date.now();

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.cleanupIntervalMs = Math.max(windowMs, 60_000); // cleanup at most once per window
  }

  check(key: string): RateLimitResult {
    const now = Date.now();

    // Periodic cleanup of stale entries
    if (now - this.lastCleanup > this.cleanupIntervalMs) {
      this.cleanup(now);
      this.lastCleanup = now;
    }

    let entry = this.store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.store.set(key, entry);
    }

    // Remove timestamps outside the window
    const cutoff = now - this.windowMs;
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    if (entry.timestamps.length >= this.maxRequests) {
      const oldest = entry.timestamps[0];
      const resetInMs = Math.max(0, oldest + this.windowMs - now);
      return { allowed: false, remaining: 0, resetInMs };
    }

    entry.timestamps.push(now);
    return { allowed: true, remaining: this.maxRequests - entry.timestamps.length, resetInMs: 0 };
  }

  private cleanup(now: number) {
    const cutoff = now - this.windowMs;
    for (const [key, entry] of this.store) {
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
      if (entry.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }

  /** Exposed for testing — resets all state */
  reset(): void {
    this.store.clear();
  }
}

/**
 * Default instance: 10 requests per hour per IP.
 * Adjust via RATE_LIMIT_MAX and RATE_LIMIT_WINDOW_MS env vars.
 */
function getEnvInt(key: string, fallback: number): number {
  const val = process.env[key];
  if (val === undefined || val === "") return fallback;
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const maxReqs = getEnvInt("RATE_LIMIT_MAX", 10);
const windowMs = getEnvInt("RATE_LIMIT_WINDOW_MS", 3_600_000); // 1 hour default

export const defaultLimiter = new RateLimiter(maxReqs, windowMs);
