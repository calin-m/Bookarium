/**
 * Lightweight, zero-dependency in-memory sliding window rate limiter.
 * Protects upstream public domain APIs without requiring external services or API keys.
 */

interface RateLimitRecord {
  timestamps: number[];
}

export interface RateLimitOptions {
  windowMs?: number; // Time window in milliseconds (default: 60,000ms / 1 min)
  maxRequests?: number; // Max requests allowed within window (default: 60)
  maxKeys?: number; // Maximum tracked keys in memory to prevent unbounded Map growth (default: 10,000)
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

export class InMemoryRateLimiter {
  private records = new Map<string, RateLimitRecord>();
  private windowMs: number;
  private maxRequests: number;
  private maxKeys: number;
  private lastCleanup: number = Date.now();

  constructor(options: RateLimitOptions = {}) {
    this.windowMs = options.windowMs ?? 60_000;
    this.maxRequests = options.maxRequests ?? 60;
    this.maxKeys = options.maxKeys ?? 10_000;
  }

  /**
   * Evaluates whether a given key (e.g. client IP or route identifier) is rate limited.
   */
  public check(key: string): RateLimitResult {
    const now = Date.now();
    this.cleanupOldEntries(now);

    let record = this.records.get(key);
    if (!record) {
      if (this.records.size >= this.maxKeys) {
        this.pruneStaleRecords(now);
        if (this.records.size >= this.maxKeys) {
          const oldestKey = this.records.keys().next().value;
          if (oldestKey !== undefined) {
            this.records.delete(oldestKey);
          }
        }
      }
      record = { timestamps: [] };
      this.records.set(key, record);
    }

    // Filter out timestamps outside the sliding window
    const windowStart = now - this.windowMs;
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    if (record.timestamps.length >= this.maxRequests) {
      const oldestInWindow = record.timestamps[0] || now;
      const resetMs = Math.max(0, oldestInWindow + this.windowMs - now);

      return {
        success: false,
        limit: this.maxRequests,
        remaining: 0,
        resetMs,
      };
    }

    // Record this request
    record.timestamps.push(now);

    return {
      success: true,
      limit: this.maxRequests,
      remaining: Math.max(0, this.maxRequests - record.timestamps.length),
      resetMs: this.windowMs,
    };
  }

  /**
   * Resets rate limit records (useful for testing or manual administrative reset).
   */
  public reset(): void {
    this.records.clear();
  }

  private cleanupOldEntries(now: number): void {
    // Run garbage collection at most once every 30 seconds
    if (now - this.lastCleanup < 30_000) return;
    this.lastCleanup = now;
    this.pruneStaleRecords(now);
  }

  private pruneStaleRecords(now: number): void {
    const windowStart = now - this.windowMs;
    for (const [key, record] of this.records.entries()) {
      record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
      if (record.timestamps.length === 0) {
        this.records.delete(key);
      }
    }
  }
}

// Global default limiter instances
export const booksApiRateLimiter = new InMemoryRateLimiter({
  windowMs: 60_000,
  maxRequests: 60, // 60 requests/minute
});

export const bookContentRateLimiter = new InMemoryRateLimiter({
  windowMs: 60_000,
  maxRequests: 30, // 30 full-text requests/minute
});

