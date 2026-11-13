import { isSupabaseConfigured } from '@/lib/catalog/supabase-provider';
import { createClient } from '@/lib/supabase/client';

export interface PublicScholarMetadataSummary {
  username: string;
  display_name: string | null;
  bio: string | null;
  is_public: boolean;
}

export type PublicScholarResolution =
  | { status: 'public'; profile: PublicScholarMetadataSummary }
  | { status: 'private_or_missing' }
  | { status: 'unavailable' };

interface ProfileCacheEntry {
  resolution: PublicScholarResolution;
  expiresAt: number;
}

export const MAX_PROFILE_CACHE_ENTRIES = 500;
export const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const VALID_HANDLE_REGEX = /^[a-z0-9_-]{1,40}$/;

const serverProfileCache = new Map<string, ProfileCacheEntry>();

export function normalizeScholarHandle(rawUsername: string): string {
  try {
    return decodeURIComponent(rawUsername).toLowerCase().trim();
  } catch {
    return rawUsername.toLowerCase().trim();
  }
}

export function hasCachedScholarProfile(rawUsername: string): boolean {
  const key = normalizeScholarHandle(rawUsername);
  const entry = serverProfileCache.get(key);
  if (!entry) return false;
  if (entry.expiresAt <= Date.now()) {
    serverProfileCache.delete(key);
    return false;
  }
  return true;
}

export function setServerProfileCache(
  rawUsername: string,
  resolution: PublicScholarResolution,
  ttlMs = PROFILE_CACHE_TTL_MS
): void {
  if (resolution.status === 'unavailable') return;
  const key = normalizeScholarHandle(rawUsername);
  if (serverProfileCache.has(key)) {
    serverProfileCache.delete(key);
  } else if (serverProfileCache.size >= MAX_PROFILE_CACHE_ENTRIES) {
    const oldestKey = serverProfileCache.keys().next().value;
    if (typeof oldestKey === 'string') {
      serverProfileCache.delete(oldestKey);
    }
  }
  serverProfileCache.set(key, {
    resolution,
    expiresAt: Date.now() + ttlMs,
  });
}

export function clearServerProfileCache(): void {
  serverProfileCache.clear();
}

/**
 * Resolves public-only scholar metadata by handle without leaking private or nonexistent
 * accounts (both collapse uniformly to `private_or_missing`, honoring ADR-033 anti-enumeration).
 */
export async function fetchPublicScholarProfileSummary(
  rawUsername: string
): Promise<PublicScholarResolution> {
  const normalized = normalizeScholarHandle(rawUsername);
  if (!normalized || !VALID_HANDLE_REGEX.test(normalized)) {
    return { status: 'private_or_missing' };
  }

  const cached = serverProfileCache.get(normalized);
  if (cached) {
    if (cached.expiresAt > Date.now()) {
      serverProfileCache.delete(normalized);
      serverProfileCache.set(normalized, cached);
      return cached.resolution;
    }
    serverProfileCache.delete(normalized);
  }

  if (!isSupabaseConfigured()) {
    return { status: 'unavailable' };
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, username, bio, is_public')
      .ilike('username', normalized)
      .eq('is_public', true)
      .abortSignal(AbortSignal.timeout(1500))
      .maybeSingle();

    if (error) {
      return { status: 'unavailable' };
    }

    // Neutralize SQL ILIKE '_' single-character wildcard with exact normalized equality
    if (
      !data ||
      !data.is_public ||
      !data.username ||
      data.username.toLowerCase() !== normalized
    ) {
      const hidden: PublicScholarResolution = { status: 'private_or_missing' };
      setServerProfileCache(normalized, hidden);
      return hidden;
    }

    const publicResult: PublicScholarResolution = {
      status: 'public',
      profile: {
        username: data.username,
        display_name: data.display_name,
        bio: data.bio,
        is_public: data.is_public,
      },
    };
    setServerProfileCache(normalized, publicResult);
    return publicResult;
  } catch {
    return { status: 'unavailable' };
  }
}
