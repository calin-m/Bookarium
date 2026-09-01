import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryRateLimiter } from './rate-limiter';

describe('InMemoryRateLimiter', () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter({
      windowMs: 1000,
      maxRequests: 3,
    });
  });

  it('allows requests within the configured max limit', () => {
    const res1 = limiter.check('client-1');
    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(2);

    const res2 = limiter.check('client-1');
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = limiter.check('client-1');
    expect(res3.success).toBe(true);
    expect(res3.remaining).toBe(0);
  });

  it('blocks requests exceeding the max limit within the sliding window', () => {
    limiter.check('client-1');
    limiter.check('client-1');
    limiter.check('client-1');

    const blockedRes = limiter.check('client-1');
    expect(blockedRes.success).toBe(false);
    expect(blockedRes.remaining).toBe(0);
    expect(blockedRes.resetMs).toBeGreaterThan(0);
  });

  it('isolates rate limits between different clients', () => {
    limiter.check('client-1');
    limiter.check('client-1');
    limiter.check('client-1');

    // client-1 is blocked
    expect(limiter.check('client-1').success).toBe(false);

    // client-2 is unaffected
    const client2Res = limiter.check('client-2');
    expect(client2Res.success).toBe(true);
    expect(client2Res.remaining).toBe(2);
  });

  it('resets sliding window after the windowMs expires', async () => {
    vi.useFakeTimers();

    limiter.check('client-1');
    limiter.check('client-1');
    limiter.check('client-1');
    expect(limiter.check('client-1').success).toBe(false);

    // Advance past windowMs
    vi.advanceTimersByTime(1100);

    const afterRes = limiter.check('client-1');
    expect(afterRes.success).toBe(true);
    expect(afterRes.remaining).toBe(2);

    vi.useRealTimers();
  });

  it('cleans up stale records during periodic garbage collection and preserves active ones', () => {
    vi.useFakeTimers();
    limiter.check('stale-client');

    // Advance 20 seconds, check an active client
    vi.advanceTimersByTime(20000);
    limiter.check('active-client');

    // Advance another 15 seconds (total 35s since start > 30s cleanup interval)
    vi.advanceTimersByTime(15000);

    // Stale client was cleaned up (now starts fresh)
    const staleRes = limiter.check('stale-client');
    expect(staleRes.success).toBe(true);
    expect(staleRes.remaining).toBe(2);

    vi.useRealTimers();
  });

  it('allows manual reset of all records', () => {
    limiter.check('client-1');
    limiter.check('client-1');
    limiter.check('client-1');
    expect(limiter.check('client-1').success).toBe(false);

    limiter.reset();

    const resetRes = limiter.check('client-1');
    expect(resetRes.success).toBe(true);
    expect(resetRes.remaining).toBe(2);
  });

  it('supports default options in constructor and global exports', () => {
    const defaultLimiter = new InMemoryRateLimiter();
    const res = defaultLimiter.check('any-client');
    expect(res.success).toBe(true);
    expect(res.limit).toBe(60);
    expect(res.remaining).toBe(59);
  });
});



