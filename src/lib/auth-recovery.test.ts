import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RECOVERY_LINK_TTL_SECONDS,
  CONSUMED_RECOVERY_STORAGE_KEY,
  isRecoverySessionAmrVerified,
  readConsumedRecoverySentAt,
  markRecoveryConsumed,
  clearConsumedRecoveryMarker,
} from './auth-recovery';

describe('isRecoverySessionAmrVerified', () => {
  const nowMs = Date.UTC(2026, 10, 14, 15, 0, 0);
  const nowSec = Math.floor(nowMs / 1000);

  it('returns false when authMethods are empty or missing', () => {
    expect(isRecoverySessionAmrVerified({ authMethods: null, nowMs })).toBe(false);
    expect(isRecoverySessionAmrVerified({ authMethods: [], nowMs })).toBe(false);
  });

  it('rejects password and oauth sessions even when a recent recovery_sent_at exists', () => {
    const recentSentAt = new Date((nowSec - 120) * 1000).toISOString();
    expect(
      isRecoverySessionAmrVerified({
        authMethods: [{ method: 'password', timestamp: nowSec - 60 }],
        recoverySentAt: recentSentAt,
        nowMs,
      })
    ).toBe(false);
    expect(
      isRecoverySessionAmrVerified({
        authMethods: [{ method: 'oauth', timestamp: nowSec - 60 }],
        recoverySentAt: recentSentAt,
        nowMs,
      })
    ).toBe(false);
    expect(
      isRecoverySessionAmrVerified({
        authMethods: ['password', 'oauth'],
        recoverySentAt: recentSentAt,
        nowMs,
      })
    ).toBe(false);
  });

  it('accepts otp AMR entry only when issued after a fresh recovery_sent_at within TTL', () => {
    const recentSentAt = new Date((nowSec - 120) * 1000).toISOString();
    expect(
      isRecoverySessionAmrVerified({
        authMethods: [{ method: 'otp', timestamp: nowSec - 60 }],
        recoverySentAt: recentSentAt,
        nowMs,
      })
    ).toBe(true);

    // Tolerates minor sub-second / clock skew between recovery_sent_at and JWT timestamp
    expect(
      isRecoverySessionAmrVerified({
        authMethods: [{ method: 'otp', timestamp: nowSec - 125 }],
        recoverySentAt: recentSentAt,
        nowMs,
      })
    ).toBe(true);

    // Rejects otp login that happened before recovery_sent_at (e.g. earlier Magic Link)
    expect(
      isRecoverySessionAmrVerified({
        authMethods: [{ method: 'otp', timestamp: nowSec - 600 }],
        recoverySentAt: recentSentAt,
        nowMs,
      })
    ).toBe(false);

    // Rejects otp without recovery_sent_at
    expect(
      isRecoverySessionAmrVerified({
        authMethods: [{ method: 'otp', timestamp: nowSec - 60 }],
        recoverySentAt: null,
        nowMs,
      })
    ).toBe(false);

    // Rejects expired recovery window (> 1 hour)
    const expiredSentAt = new Date((nowSec - RECOVERY_LINK_TTL_SECONDS - 60) * 1000).toISOString();
    expect(
      isRecoverySessionAmrVerified({
        authMethods: [{ method: 'otp', timestamp: nowSec - 60 }],
        recoverySentAt: expiredSentAt,
        nowMs,
      })
    ).toBe(false);
  });

  it('supports explicit recovery string and object AMR entries within TTL', () => {
    const recentSentAt = new Date((nowSec - 90) * 1000).toISOString();
    expect(
      isRecoverySessionAmrVerified({
        authMethods: ['recovery'],
        recoverySentAt: recentSentAt,
        nowMs,
      })
    ).toBe(true);
    expect(
      isRecoverySessionAmrVerified({
        authMethods: [{ method: 'recovery', timestamp: nowSec - 30 }],
        recoverySentAt: null,
        nowMs,
      })
    ).toBe(true);
    expect(
      isRecoverySessionAmrVerified({
        authMethods: [{ method: 'recovery', timestamp: nowSec - RECOVERY_LINK_TTL_SECONDS - 10 }],
        nowMs,
      })
    ).toBe(false);
    expect(
      isRecoverySessionAmrVerified({
        authMethods: [{ method: 'recovery' }],
        recoverySentAt: recentSentAt,
        nowMs,
      })
    ).toBe(true);
    expect(
      isRecoverySessionAmrVerified({
        authMethods: [{ method: 'recovery', timestamp: nowSec - 300 }],
        recoverySentAt: recentSentAt,
        nowMs,
      })
    ).toBe(false);
  });

  it('rejects malformed entries and already-consumed recovery_sent_at markers', () => {
    const recentSentAt = new Date((nowSec - 120) * 1000).toISOString();
    expect(
      isRecoverySessionAmrVerified({
        authMethods: [null as unknown as string, { method: 'otp', timestamp: nowSec - 60 }],
        recoverySentAt: recentSentAt,
        consumedRecoverySentAt: recentSentAt,
        nowMs,
      })
    ).toBe(false);

    expect(
      isRecoverySessionAmrVerified({
        authMethods: [{ method: 'otp', timestamp: nowSec - 60 }],
        recoverySentAt: 'not-a-date',
        nowMs,
      })
    ).toBe(false);
  });
});

describe('consumed recovery marker helpers', () => {
  beforeEach(() => {
    clearConsumedRecoveryMarker();
    window.sessionStorage.clear();
  });

  it('marks, reads, and selectively clears consumed recovery timestamps per user', () => {
    expect(readConsumedRecoverySentAt(null)).toBeNull();
    expect(readConsumedRecoverySentAt('u1')).toBeNull();

    markRecoveryConsumed('u1', '2026-11-14T12:00:00Z');
    markRecoveryConsumed('u2', '2026-11-14T12:05:00Z');
    expect(readConsumedRecoverySentAt('u1')).toBe('2026-11-14T12:00:00Z');
    expect(readConsumedRecoverySentAt('u2')).toBe('2026-11-14T12:05:00Z');

    // Reads through sessionStorage fallback after clearing in-memory cache via corrupted/valid check
    window.sessionStorage.setItem(
      CONSUMED_RECOVERY_STORAGE_KEY,
      JSON.stringify({ u3: '2026-11-14T13:00:00Z' })
    );
    expect(readConsumedRecoverySentAt('u3')).toBe('2026-11-14T13:00:00Z');

    clearConsumedRecoveryMarker('u1');
    expect(readConsumedRecoverySentAt('u1')).toBeNull();
    expect(readConsumedRecoverySentAt('u2')).toBe('2026-11-14T12:05:00Z');

    clearConsumedRecoveryMarker();
    expect(readConsumedRecoverySentAt('u2')).toBeNull();
    expect(window.sessionStorage.getItem(CONSUMED_RECOVERY_STORAGE_KEY)).toBeNull();
  });

  it('handles corrupted sessionStorage payloads and storage errors gracefully', () => {
    window.sessionStorage.setItem(CONSUMED_RECOVERY_STORAGE_KEY, 'not-json');
    expect(readConsumedRecoverySentAt('u-corrupt')).toBeNull();

    window.sessionStorage.setItem(CONSUMED_RECOVERY_STORAGE_KEY, JSON.stringify(['array']));
    expect(readConsumedRecoverySentAt('u-array')).toBeNull();

    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => markRecoveryConsumed('u1', '2026-11-14T12:00:00Z')).not.toThrow();
    setSpy.mockRestore();
  });
});
