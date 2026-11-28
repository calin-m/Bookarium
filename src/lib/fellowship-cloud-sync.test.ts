import { describe, it, expect, vi } from 'vitest';
import {
  isPlaceholderUsername,
  formatFellowScholarLabel,
  healProfileIdentity,
  hydrateReaderCircleRow,
  hydrateSymposiumSessionRow,
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

  it('prefers authoritative live profile handles and falls back cleanly when offline or placeholder', () => {
    const map = new Map([
      ['u1', { username: 'healed_user', display_name: 'Healed Display' }],
      ['u2', { username: 'scholar', display_name: '' }],
    ]);
    expect(healProfileIdentity(map, 'u1', 'scholar', 'Old Name')).toEqual([
      'healed_user',
      'Healed Display',
    ]);
    expect(healProfileIdentity(map, 'u1', 'renamed_old_handle', 'Old Name')).toEqual([
      'healed_user',
      'Healed Display',
    ]);
    expect(healProfileIdentity(map, 'u2', 'cached_handle', 'Cached Name')).toEqual([
      'cached_handle',
      'Cached Name',
    ]);
    expect(healProfileIdentity(map, 'missing', 'scholar', 'Old Name')).toEqual([
      'scholar',
      'Old Name',
    ]);
    expect(healProfileIdentity(map, 'missing', '', '')).toEqual(['scholar', 'Scholar']);
  });

  it('hydrates lean normalized reader_circles and symposium_sessions rows from profiles and offline fallbacks', () => {
    const liveProfiles = new Map([
      ['u-host', { username: 'jane_new', display_name: 'Jane Austen' }],
      ['u-fellow', { username: 'mary_shelley', display_name: 'Mary Shelley' }],
    ]);
    const offlineFallback = new Map([
      ['u-offline', { username: 'cached_fellow', display_name: 'Cached Scholar' }],
    ]);

    const hydratedCircle = hydrateReaderCircleRow(
      {
        id: 'c-1',
        requester_id: 'u-host',
        recipient_id: 'u-fellow',
        status: 'accepted',
        created_at: '2026-11-28T00:00:00Z',
        updated_at: '2026-11-28T00:00:00Z',
      },
      liveProfiles,
      offlineFallback
    );
    expect(hydratedCircle).toEqual(
      expect.objectContaining({
        requester_username: 'jane_new',
        requester_display_name: 'Jane Austen',
        recipient_username: 'mary_shelley',
        recipient_display_name: 'Mary Shelley',
      })
    );

    const hydratedOfflineSym = hydrateSymposiumSessionRow(
      {
        id: 's-1',
        book_id: 84,
        book_title: 'Frankenstein',
        host_id: 'u-host',
        fellow_id: 'u-offline',
        status: 'active',
        host_chapter: 1,
        host_progress: 20,
        fellow_chapter: 2,
        fellow_progress: 35,
        created_at: '2026-11-28T00:00:00Z',
        updated_at: '2026-11-28T00:00:00Z',
      },
      liveProfiles,
      offlineFallback
    );
    expect(hydratedOfflineSym).toEqual(
      expect.objectContaining({
        host_username: 'jane_new',
        host_display_name: 'Jane Austen',
        fellow_username: 'cached_fellow',
        fellow_display_name: 'Cached Scholar',
      })
    );
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

