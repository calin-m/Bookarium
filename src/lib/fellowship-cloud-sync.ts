import type { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/database.types';

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
  profileMap: Map<string, { username: string | null; display_name: string | null }>,
  userId: string,
  currentUsername: string,
  currentDisplayName: string
): [string, string] {
  const p = profileMap.get(userId);
  if (!p) return [currentUsername, currentDisplayName];
  return [
    p.username && isPlaceholderUsername(currentUsername) ? p.username : currentUsername,
    p.display_name || currentDisplayName,
  ];
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

