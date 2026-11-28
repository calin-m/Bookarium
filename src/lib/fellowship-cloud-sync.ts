/**
 * @module src/lib/fellowship-cloud-sync
 * @scope Privacy-safe scholar identity resolution, handle formatting, and authoritative `public.profiles` hydration for normalized Reader Circles and Symposiums.
 * @invariant Treat blank, `'scholar'`, and `'fellow_scholar'` strings as replaceable placeholders (`isPlaceholderUsername`) and prefer authoritative live `public.profiles` usernames/display names during `healProfileIdentity` while falling back cleanly to cached local identities offline.
 * @invariant Batch-query only non-sensitive public columns (`id, username, display_name`) from `public.profiles` and hydrate lean `reader_circles`/`symposium_sessions` DB rows via `hydrateReaderCircleRow` / `hydrateSymposiumSessionRow` without storing duplicated identity columns in PostgreSQL.
 * @rationale Keeping `public.profiles` as the single source of truth eliminates multi-row profile cascade triggers while keeping fellow handle resolution zero-PII and offline-resilient across Bookmarks, Notebook, Account, and Reader popovers.
 * @adr ADR-033, ADR-055, ADR-059, ADR-068, ADR-087
 */

import type { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type {
  Profile,
  ReaderCircleDbRow,
  ReaderCircleRow,
  SymposiumSessionDbRow,
  SymposiumSessionRow,
} from '@/types/database.types';

export interface ScholarProfileIdentity {
  username: string | null;
  display_name: string | null;
}

export type LegacyOrLeanReaderCircleRow = ReaderCircleDbRow &
  Partial<
    Pick<
      ReaderCircleRow,
      | 'requester_username'
      | 'requester_display_name'
      | 'recipient_username'
      | 'recipient_display_name'
    >
  >;

export type LegacyOrLeanSymposiumSessionRow = SymposiumSessionDbRow &
  Partial<
    Pick<
      SymposiumSessionRow,
      'host_username' | 'host_display_name' | 'fellow_username' | 'fellow_display_name'
    >
  >;

export function isPlaceholderUsername(username?: string | null): boolean {
  if (!username) return true;
  const clean = username.trim().toLowerCase();
  return clean === '' || clean === 'scholar' || clean === 'fellow_scholar';
}

export function formatFellowScholarLabel(
  displayName?: string | null,
  username?: string | null
): string {
  const cleanDisplayName = displayName?.trim();
  const cleanUsername = username?.trim();
  const isPlaceholder = isPlaceholderUsername(cleanUsername);

  if (
    cleanDisplayName &&
    !isPlaceholder &&
    cleanUsername &&
    cleanDisplayName !== cleanUsername
  ) {
    return `${cleanDisplayName} (@${cleanUsername})`;
  }
  if (!isPlaceholder && cleanUsername) {
    return `@${cleanUsername}`;
  }
  return cleanDisplayName || 'Fellow Scholar';
}

export function healProfileIdentity(
  profileMap: Map<string, ScholarProfileIdentity>,
  userId: string,
  currentUsername: string = '',
  currentDisplayName: string = ''
): [string, string] {
  const p = profileMap.get(userId);
  if (!p) {
    return [currentUsername || 'scholar', currentDisplayName || 'Scholar'];
  }
  const authoritativeUsername =
    p.username && !isPlaceholderUsername(p.username) ? p.username : null;
  const authoritativeDisplayName = p.display_name?.trim() || null;

  return [
    authoritativeUsername || currentUsername || 'scholar',
    authoritativeDisplayName || currentDisplayName || 'Scholar',
  ];
}

/**
 * Hydrates a normalized `public.reader_circles` row with authoritative scholar usernames and
 * display names resolved from `public.profiles`, falling back to any legacy row fields or
 * cached local identities when offline.
 */
export function hydrateReaderCircleRow(
  row: LegacyOrLeanReaderCircleRow,
  profileMap: Map<string, ScholarProfileIdentity>,
  fallbackIdentities?: Map<string, ScholarProfileIdentity>
): ReaderCircleRow {
  const reqFallback = fallbackIdentities?.get(row.requester_id);
  const recFallback = fallbackIdentities?.get(row.recipient_id);

  const [reqU, reqD] = healProfileIdentity(
    profileMap,
    row.requester_id,
    row.requester_username || reqFallback?.username || '',
    row.requester_display_name || reqFallback?.display_name || ''
  );
  const [recU, recD] = healProfileIdentity(
    profileMap,
    row.recipient_id,
    row.recipient_username || recFallback?.username || '',
    row.recipient_display_name || recFallback?.display_name || ''
  );

  return {
    ...row,
    requester_username: reqU,
    requester_display_name: reqD,
    recipient_username: recU,
    recipient_display_name: recD,
  };
}

/**
 * Hydrates a normalized `public.symposium_sessions` row with authoritative scholar usernames and
 * display names resolved from `public.profiles`, falling back to any legacy row fields or
 * cached local identities when offline.
 */
export function hydrateSymposiumSessionRow(
  row: LegacyOrLeanSymposiumSessionRow,
  profileMap: Map<string, ScholarProfileIdentity>,
  fallbackIdentities?: Map<string, ScholarProfileIdentity>
): SymposiumSessionRow {
  const hostFallback = fallbackIdentities?.get(row.host_id);
  const fellowFallback = fallbackIdentities?.get(row.fellow_id);

  const [hostU, hostD] = healProfileIdentity(
    profileMap,
    row.host_id,
    row.host_username || hostFallback?.username || '',
    row.host_display_name || hostFallback?.display_name || ''
  );
  const [fellowU, fellowD] = healProfileIdentity(
    profileMap,
    row.fellow_id,
    row.fellow_username || fellowFallback?.username || '',
    row.fellow_display_name || fellowFallback?.display_name || ''
  );

  return {
    ...row,
    host_username: hostU,
    host_display_name: hostD,
    fellow_username: fellowU,
    fellow_display_name: fellowD,
  };
}

/**
 * Batch-fetches scholar identities (`id`, `username`, `display_name`) from `public.profiles`
 * and returns a lookup map keyed by `user_id`. Gracefully returns an empty map when offline
 * or if the query fails.
 */
export async function fetchScholarProfilesMap(
  supabase: ReturnType<typeof createClient>,
  userIds: string[]
): Promise<Map<string, { username: string | null; display_name: string | null }>> {
  const profileMap = new Map<string, { username: string | null; display_name: string | null }>();
  if (!supabase || !Array.isArray(userIds) || userIds.length === 0) {
    return profileMap;
  }

  try {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .in('id', userIds);

    if (Array.isArray(profilesData)) {
      for (const p of profilesData as Array<{
        id: string;
        username: string | null;
        display_name: string | null;
      }>) {
        if (p?.id) {
          profileMap.set(p.id, { username: p.username, display_name: p.display_name });
        }
      }
    }
  } catch {
    // Non-blocking fallback when profiles query is unavailable or offline
  }

  return profileMap;
}

export async function resolveSelfScholarIdentity(
  currentUser: User,
  currentProfile: Profile | null,
  supabase: ReturnType<typeof createClient>
): Promise<{ myUsername: string; myDisplayName: string }> {
  let myUsername = currentProfile?.username || '';
  let myDisplayName =
    currentProfile?.display_name || currentUser.user_metadata?.display_name || '';

  if (isPlaceholderUsername(myUsername) && supabase) {
    try {
      const { data: selfProf } = await supabase
        .from('profiles')
        .select('username, display_name')
        .eq('id', currentUser.id)
        .maybeSingle();
      if (selfProf?.username) myUsername = selfProf.username;
      if (selfProf?.display_name) myDisplayName = selfProf.display_name;
    } catch {
      // Non-blocking fallback
    }
  }
  return {
    myUsername: myUsername || 'scholar',
    myDisplayName: myDisplayName || 'Scholar',
  };
}

