export const RECOVERY_LINK_TTL_SECONDS = 3600;
export const DEFAULT_RECOVERY_CLOCK_SKEW_SECONDS = 10;
export const CONSUMED_RECOVERY_STORAGE_KEY = 'bookarium-consumed-recovery';

export interface AmrMethodEntry {
  method?: string;
  timestamp?: number;
}

export type AmrMethodInput = AmrMethodEntry | string;

export interface RecoveryAmrVerificationParams {
  authMethods?: readonly AmrMethodInput[] | null;
  recoverySentAt?: string | null;
  consumedRecoverySentAt?: string | null;
  nowMs?: number;
  clockSkewSeconds?: number;
}

const memoryConsumedRecoveryMap = new Map<string, string>();

/**
 * Verifies whether the current Supabase session's signed JWT `amr` claim
 * reflects a genuine, unconsumed password recovery verification rather than
 * a password login, OAuth sign-in, or stale Magic Link session.
 */
export function isRecoverySessionAmrVerified({
  authMethods,
  recoverySentAt,
  consumedRecoverySentAt,
  nowMs = Date.now(),
  clockSkewSeconds = DEFAULT_RECOVERY_CLOCK_SKEW_SECONDS,
}: RecoveryAmrVerificationParams): boolean {
  if (!Array.isArray(authMethods) || authMethods.length === 0) {
    return false;
  }

  if (recoverySentAt && consumedRecoverySentAt && recoverySentAt === consumedRecoverySentAt) {
    return false;
  }

  const nowSec = Math.floor(nowMs / 1000);
  const parsedSentMs = recoverySentAt ? Date.parse(recoverySentAt) : Number.NaN;
  const hasValidSentTimestamp = Number.isFinite(parsedSentMs);
  const recoverySentSec = hasValidSentTimestamp ? Math.floor(parsedSentMs / 1000) : null;

  for (const rawEntry of authMethods) {
    if (typeof rawEntry === 'string') {
      if (
        rawEntry === 'recovery' &&
        recoverySentSec !== null &&
        nowSec >= recoverySentSec - clockSkewSeconds &&
        nowSec - recoverySentSec <= RECOVERY_LINK_TTL_SECONDS
      ) {
        return true;
      }
      continue;
    }

    if (!rawEntry || typeof rawEntry !== 'object') {
      continue;
    }

    const { method, timestamp } = rawEntry;
    if (method === 'recovery') {
      if (typeof timestamp === 'number') {
        if (timestamp > nowSec + clockSkewSeconds || nowSec - timestamp > RECOVERY_LINK_TTL_SECONDS) {
          continue;
        }
        if (recoverySentSec !== null && timestamp < recoverySentSec - clockSkewSeconds) {
          continue;
        }
        return true;
      }
      if (recoverySentSec !== null && nowSec - recoverySentSec <= RECOVERY_LINK_TTL_SECONDS) {
        return true;
      }
      continue;
    }

    if (method === 'otp') {
      if (recoverySentSec === null || typeof timestamp !== 'number') {
        continue;
      }
      const isAfterRecoveryRequest = timestamp >= recoverySentSec - clockSkewSeconds;
      const isSentWithinWindow =
        nowSec >= recoverySentSec - clockSkewSeconds &&
        nowSec - recoverySentSec <= RECOVERY_LINK_TTL_SECONDS;
      const isAuthWithinWindow =
        timestamp <= nowSec + clockSkewSeconds &&
        nowSec - timestamp <= RECOVERY_LINK_TTL_SECONDS;
      if (isAfterRecoveryRequest && isSentWithinWindow && isAuthWithinWindow) {
        return true;
      }
    }
  }

  return false;
}

function readStorageRecord(): Record<string, string> {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return {};
  }
  try {
    const raw = window.sessionStorage.getItem(CONSUMED_RECOVERY_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && v.length > 0) {
        clean[k] = v;
      }
    }
    return clean;
  } catch {
    return {};
  }
}

export function readConsumedRecoverySentAt(userId?: string | null): string | null {
  if (!userId) return null;
  const memValue = memoryConsumedRecoveryMap.get(userId);
  if (memValue) return memValue;
  const stored = readStorageRecord()[userId];
  if (stored) {
    memoryConsumedRecoveryMap.set(userId, stored);
    return stored;
  }
  return null;
}

export function markRecoveryConsumed(userId?: string | null, recoverySentAt?: string | null): void {
  if (!userId || !recoverySentAt) return;
  memoryConsumedRecoveryMap.set(userId, recoverySentAt);
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const current = readStorageRecord();
      current[userId] = recoverySentAt;
      window.sessionStorage.setItem(CONSUMED_RECOVERY_STORAGE_KEY, JSON.stringify(current));
    } catch {
      // Ignore storage failures in private browsing modes
    }
  }
}

export function clearConsumedRecoveryMarker(userId?: string | null): void {
  if (!userId) {
    memoryConsumedRecoveryMap.clear();
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem(CONSUMED_RECOVERY_STORAGE_KEY);
      } catch {
        // Ignore storage failures
      }
    }
    return;
  }

  memoryConsumedRecoveryMap.delete(userId);
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const current = readStorageRecord();
      delete current[userId];
      if (Object.keys(current).length === 0) {
        window.sessionStorage.removeItem(CONSUMED_RECOVERY_STORAGE_KEY);
      } else {
        window.sessionStorage.setItem(CONSUMED_RECOVERY_STORAGE_KEY, JSON.stringify(current));
      }
    } catch {
      // Ignore storage failures
    }
  }
}
