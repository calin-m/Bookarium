/**
 * @module src/app/u/[username]/profile-layout-utils
 * @scope Server-side public handle resolution and bounded LRU metadata cache (`serverProfileCache`) powering `/u/[username]` layout metadata, `/api/profiles/card`, and privacy gates.
 * @invariant Anchor `serverProfileCache` on `globalThis` bounded via `MAX_PROFILE_CACHE_ENTRIES` and `PROFILE_CACHE_TTL_MS`, normalize handles via `VALID_HANDLE_REGEX`, enforce exact lowercase username equality after `.ilike()` lookups, never cache `'unavailable'` errors, and collapse private or missing accounts uniformly to `private_or_missing`.
 * @invariant Gate `fetchPublicScholarCardPayload` metric queries and pill formatting strictly behind `is_public = true` and `show_streak`, `show_challenge`, `show_bookshelves`, `show_saved_books`, and `show_custom_shelves`, capping pinned bookplates at `MAX_PUBLIC_PINNED_BOOKPLATES`.
 * @rationale Bounding handle LRU entries and neutralizing SQL `_` wildcard matching protects server memory across warm SSR reloads and enforces ADR-033 anti-enumeration across public profile and OpenGraph card routes.
 * @adr ADR-033, ADR-053, ADR-080, ADR-086
 */

import { isSupabaseConfigured } from '@/lib/catalog/supabase-provider';
import { createClient } from '@/lib/supabase/client';
import { resolvePublicReadingHabits, type HabitTelemetryRow } from '@/lib/reading-analytics';
import { buildProfileCardStatPills, resolveScholarInitials } from '@/lib/profile-card-export';

const MAX_PUBLIC_PINNED_BOOKPLATES = 3;

export interface PublicScholarMetadataSummary {
  username: string;
  display_name: string | null;
  bio: string | null;
  bio_book_id?: number | null;
  bio_book_title?: string | null;
  bio_book_author?: string | null;
  is_public: boolean;
}

export type PublicScholarResolution =
  | { status: 'public'; profile: PublicScholarMetadataSummary }
  | { status: 'private_or_missing' }
  | { status: 'unavailable' };

export interface PublicScholarCardPayload {
  username: string;
  displayName: string;
  initials: string;
  memberSince: string;
  bio: string | null;
  bioBookTitle: string | null;
  bioBookAuthor: string | null;
  statsPills: string[];
}

export type PublicScholarCardResolution =
  | { status: 'public'; card: PublicScholarCardPayload }
  | { status: 'private_or_missing' }
  | { status: 'unavailable' };

interface ProfileCacheEntry {
  resolution: PublicScholarResolution;
  expiresAt: number;
}

export const MAX_PROFILE_CACHE_ENTRIES = 500;
export const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const VALID_HANDLE_REGEX = /^[a-z0-9_-]{1,40}$/;

const globalForProfileCache = globalThis as typeof globalThis & {
  __bookariumServerProfileCache?: Map<string, ProfileCacheEntry>;
};

const serverProfileCache =
  globalForProfileCache.__bookariumServerProfileCache ??
  (globalForProfileCache.__bookariumServerProfileCache = new Map<string, ProfileCacheEntry>());

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
      .select('display_name, username, bio, bio_book_id, bio_book_title, bio_book_author, is_public')
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
        bio_book_id: data.bio_book_id ?? null,
        bio_book_title: data.bio_book_title ?? null,
        bio_book_author: data.bio_book_author ?? null,
        is_public: data.is_public,
      },
    };
    setServerProfileCache(normalized, publicResult);
    return publicResult;
  } catch {
    return { status: 'unavailable' };
  }
}

interface ProfileCardDbRow {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  bio_book_id?: number | null;
  bio_book_title?: string | null;
  bio_book_author?: string | null;
  is_public: boolean;
  show_streak: boolean;
  show_challenge: boolean;
  show_bookshelves: boolean;
  show_saved_books?: boolean;
  show_custom_shelves?: boolean;
  created_at: string;
}

/**
 * Resolves full server-verified card payload (identity, motto + attribution, join date, and
 * privacy-gated summary stats) for `/api/profiles/card`, honoring ADR-033 anti-enumeration.
 */
export async function fetchPublicScholarCardPayload(
  rawUsername: string
): Promise<PublicScholarCardResolution> {
  const normalized = normalizeScholarHandle(rawUsername);
  if (!normalized || !VALID_HANDLE_REGEX.test(normalized)) {
    return { status: 'private_or_missing' };
  }

  if (!isSupabaseConfigured()) {
    return { status: 'unavailable' };
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, display_name, username, bio, bio_book_id, bio_book_title, bio_book_author, is_public, show_streak, show_challenge, show_bookshelves, show_saved_books, show_custom_shelves, created_at'
      )
      .ilike('username', normalized)
      .eq('is_public', true)
      .abortSignal(AbortSignal.timeout(1500))
      .maybeSingle();

    if (error) {
      return { status: 'unavailable' };
    }

    const row = data as ProfileCardDbRow | null;
    if (!row || !row.is_public || !row.username || row.username.toLowerCase() !== normalized) {
      return { status: 'private_or_missing' };
    }

    const showSavedBooks = row.show_saved_books ?? row.show_bookshelves ?? true;
    const showCustomShelves = row.show_custom_shelves ?? row.show_bookshelves ?? true;
    const shouldFetchHabits = Boolean(row.show_streak || row.show_challenge);
    const shouldFetchShelves = Boolean(row.show_bookshelves && (showSavedBooks || showCustomShelves));

    const [accoladesRes, habitsRes, shelvesRes] = await Promise.all([
      supabase
        .from('user_accolades')
        .select('accolade_id')
        .eq('user_id', row.id)
        .eq('is_pinned', true)
        .abortSignal(AbortSignal.timeout(1500)),
      shouldFetchHabits
        ? supabase
            .from('user_reading_habits')
            .select('annual_goal, active_dates, completed_books_count')
            .eq('user_id', row.id)
            .abortSignal(AbortSignal.timeout(1500))
            .maybeSingle()
        : Promise.resolve({ data: null }),
      shouldFetchShelves
        ? supabase
            .from('bookshelves')
            .select('id, is_default, is_public')
            .eq('user_id', row.id)
            .abortSignal(AbortSignal.timeout(1500))
        : Promise.resolve({ data: null }),
    ]);

    const pinnedAccoladesCount = Array.isArray(accoladesRes?.data)
      ? Math.min(MAX_PUBLIC_PINNED_BOOKPLATES, accoladesRes.data.length)
      : 0;
    const habits = shouldFetchHabits
      ? resolvePublicReadingHabits((habitsRes?.data as HabitTelemetryRow | null) ?? null)
      : null;

    let publicShelvesCount = 0;
    if (shouldFetchShelves && Array.isArray(shelvesRes?.data)) {
      publicShelvesCount = shelvesRes.data.filter(
        (s: { is_default: boolean; is_public?: boolean | null }) =>
          (s.is_default ? showSavedBooks : showCustomShelves) && s.is_public !== false
      ).length;
    }

    const memberSince = (() => {
      try {
        const parsed = new Date(row.created_at);
        if (Number.isNaN(parsed.getTime())) return 'Ancient Scholar';
        return parsed.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      } catch {
        return 'Ancient Scholar';
      }
    })();

    const cleanHandle = row.username.trim();
    const displayName = row.display_name?.trim() || `@${cleanHandle}`;
    const hasBioBook =
      typeof row.bio_book_id === 'number' &&
      Number.isInteger(row.bio_book_id) &&
      row.bio_book_id > 0 &&
      Boolean(row.bio_book_title?.trim());

    const statsPills = buildProfileCardStatPills({
      showStreak: Boolean(row.show_streak),
      showChallenge: Boolean(row.show_challenge),
      showBookshelves: Boolean(row.show_bookshelves),
      currentStreak: habits?.current_streak ?? null,
      annualGoal: habits?.annual_goal ?? null,
      completedBooksCount: habits?.completed_books_count ?? null,
      pinnedAccoladesCount,
      publicShelvesCount,
    });

    return {
      status: 'public',
      card: {
        username: cleanHandle,
        displayName,
        initials: resolveScholarInitials(row.display_name, cleanHandle),
        memberSince,
        bio: row.bio?.trim() || null,
        bioBookTitle: hasBioBook ? row.bio_book_title!.trim() : null,
        bioBookAuthor: hasBioBook ? row.bio_book_author?.trim() || null : null,
        statsPills,
      },
    };
  } catch {
    return { status: 'unavailable' };
  }
}
