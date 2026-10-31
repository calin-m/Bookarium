import { describe, it, expect, vi } from 'vitest';
import {
  isPlaceholderUsername,
  formatFellowScholarLabel,
  healProfileIdentity,
  fetchScholarProfilesMap,
  resolveSelfScholarIdentity,
} from './fellowship-cloud-sync';
import type { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/database.types';

describe('fellowship-cloud-sync', () => {
  it('evaluates placeholder usernames and formats fellow scholar labels', () => {
    expect(isPlaceholderUsername('')).toBe(true);
    expect(isPlaceholderUsername('scholar')).toBe(true);
    expect(isPlaceholderUsername('fellow_scholar')).toBe(true);
    expect(isPlaceholderUsername('jane_austen')).toBe(false);

    expect(formatFellowScholarLabel('Jane Austen', 'jane_austen')).toBe(
      'Jane Austen (@jane_austen)'
    );
    expect(formatFellowScholarLabel(null, 'jane_austen')).toBe('@jane_austen');
    expect(formatFellowScholarLabel('Jane Austen', 'scholar')).toBe('Jane Austen');
    expect(formatFellowScholarLabel(null, 'scholar')).toBe('Fellow Scholar');
  });

  it('heals placeholder usernames from a profile map without overwriting valid handles', () => {
    const map = new Map([
      ['u1', { username: 'healed_user', display_name: 'Healed Display' }],
    ]);
    expect(healProfileIdentity(map, 'u1', 'scholar', 'Old Name')).toEqual([
      'healed_user',
      'Healed Display',
    ]);
    expect(healProfileIdentity(map, 'u1', 'existing_handle', 'Old Name')).toEqual([
      'existing_handle',
      'Healed Display',
    ]);
    expect(healProfileIdentity(map, 'missing', 'scholar', 'Old Name')).toEqual([
      'scholar',
      'Old Name',
    ]);
  });

  it('fetches scholar profile maps and resolves self scholar identity from Supabase', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'u1', username: 'melville', display_name: 'Herman Melville' }],
          }),
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { username: 'self_handle', display_name: 'Self Scholar' },
            }),
          })),
        })),
      })),
    } as unknown as ReturnType<typeof createClient>;

    const profileMap = await fetchScholarProfilesMap(mockSupabase, ['u1']);
    expect(profileMap.get('u1')).toEqual({
      username: 'melville',
      display_name: 'Herman Melville',
    });

    const selfIdentity = await resolveSelfScholarIdentity(
      { id: 'self-1', user_metadata: {} } as unknown as User,
      { username: 'scholar', display_name: null } as unknown as Profile,
      mockSupabase
    );
    expect(selfIdentity).toEqual({
      myUsername: 'self_handle',
      myDisplayName: 'Self Scholar',
    });
  });
});

