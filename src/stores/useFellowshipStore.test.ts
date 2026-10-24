import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useFellowshipStore,
  useHydratedFellowship,
  isPlaceholderUsername,
  formatFellowScholarLabel,
} from './useFellowshipStore';
import { useAuthStore } from './useAuthStore';

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: (...args: any[]) => mockRpc(...args),
    from: (...args: any[]) => mockFrom(...args),
  }),
}));

describe('useFellowshipStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFellowshipStore.getState().clearFellowshipState();
    useAuthStore.setState({
      user: {
        id: 'user-host',
        email: 'austen@bookarium.test',
        user_metadata: { display_name: 'Jane Austen' },
      } as any,
      profile: {
        id: 'user-host',
        username: 'jane_austen',
        display_name: 'Jane Austen',
      } as any,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      ilike: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
  });

  it('invites a Fellow Scholar by @username via RPC lookup and accepts invitation', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ id: 'user-fellow', username: 'charlotte_bronte', display_name: 'Charlotte Brontë' }],
      error: null,
    });

    const { error, circle } = await useFellowshipStore
      .getState()
      .inviteFellowByUsername('@charlotte_bronte');

    expect(error).toBeNull();
    expect(circle).toBeDefined();
    expect(circle?.recipient_username).toBe('charlotte_bronte');
    expect(circle?.status).toBe('pending');

    // Prevent duplicate invitation
    const duplicate = await useFellowshipStore
      .getState()
      .inviteFellowByProfile({
        id: 'user-fellow',
        username: 'charlotte_bronte',
        displayName: 'Charlotte Brontë',
      });
    expect(duplicate.error?.message).toMatch(/already pending/i);

    // Accept the circle invite
    await useFellowshipStore.getState().respondToCircleInvite(circle!.id, 'accept');
    const accepted = useFellowshipStore.getState().getAcceptedFellows('user-host');
    expect(accepted).toHaveLength(1);
    expect(accepted[0].username).toBe('charlotte_bronte');
  });

  it('validates empty and self @username invitations and handles missing handles', async () => {
    const emptyRes = await useFellowshipStore.getState().inviteFellowByUsername('   ');
    expect(emptyRes.error?.message).toMatch(/valid @username/i);

    const selfRes = await useFellowshipStore.getState().inviteFellowByUsername('jane_austen');
    expect(selfRes.error?.message).toMatch(/cannot invite yourself/i);

    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    const missingRes = await useFellowshipStore.getState().inviteFellowByUsername('unknown_scholar');
    expect(missingRes.error?.message).toMatch(/No scholar sanctuary found/i);
  });

  it('creates a Literary Symposium invite, accepts it, and synchronizes reading progress to completion', async () => {
    const { error, session } = await useFellowshipStore.getState().createSymposiumInvite({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      fellowId: 'user-fellow',
      fellowUsername: 'charlotte_bronte',
      fellowDisplayName: 'Charlotte Brontë',
    });

    expect(error).toBeNull();
    expect(session?.book_id).toBe(1342);
    expect(session?.status).toBe('pending');

    // Accept symposium
    await useFellowshipStore.getState().respondToSymposiumInvite(session!.id, 'accept');
    const active = useFellowshipStore.getState().getActiveSymposiumForBook(1342, 'user-host');
    expect(active?.status).toBe('active');

    // Sync host progress
    await useFellowshipStore.getState().syncSymposiumProgress(1342, 4, 50);
    expect(
      useFellowshipStore.getState().getActiveSymposiumForBook(1342, 'user-host')?.host_progress
    ).toBe(50);

    // Switch to fellow user and sync to 100% after host reaches 100%
    await useFellowshipStore.getState().syncSymposiumProgress(1342, 10, 100);
    useAuthStore.setState({ user: { id: 'user-fellow' } as any });
    await useFellowshipStore.getState().syncSymposiumProgress(1342, 10, 100);

    const completed = useFellowshipStore.getState().getActiveSymposiumForBook(1342, 'user-fellow');
    expect(completed?.status).toBe('completed');
    expect(completed?.fellow_progress).toBe(100);

    // No-op when progress and chapter have not changed (prevents re-render cascades / infinite loops)
    const stateBefore = useFellowshipStore.getState().symposiums;
    await useFellowshipStore.getState().syncSymposiumProgress(1342, 10, 100);
    expect(useFellowshipStore.getState().symposiums).toBe(stateBefore);
  });

  it('calculates incoming pending invite count and cascades fellow removal to symposiums', async () => {
    useFellowshipStore.setState({
      circles: [
        {
          id: 'c-in',
          requester_id: 'user-fellow',
          requester_username: 'charlotte',
          requester_display_name: 'Charlotte',
          recipient_id: 'user-host',
          recipient_username: 'jane_austen',
          recipient_display_name: 'Jane Austen',
          status: 'pending',
          created_at: '',
          updated_at: '',
        },
      ],
      symposiums: [
        {
          id: 's-in',
          book_id: 84,
          book_title: 'Frankenstein',
          host_id: 'user-fellow',
          host_username: 'charlotte',
          host_display_name: 'Charlotte',
          fellow_id: 'user-host',
          fellow_username: 'jane_austen',
          fellow_display_name: 'Jane Austen',
          status: 'pending',
          host_chapter: 0,
          host_progress: 0,
          fellow_chapter: 0,
          fellow_progress: 0,
          created_at: '',
          updated_at: '',
        },
      ],
    });

    expect(useFellowshipStore.getState().getPendingInviteCount('user-host')).toBe(2);

    // Declining circle invite removes the fellow and any symposiums with that fellow
    await useFellowshipStore.getState().respondToCircleInvite('c-in', 'decline');
    expect(useFellowshipStore.getState().circles).toHaveLength(0);
    expect(useFellowshipStore.getState().symposiums).toHaveLength(0);
  });

  it('fetches fellowship data and exposes hydrated fellowship hook', async () => {
    await useFellowshipStore.getState().fetchFellowshipData('user-host');
    expect(useFellowshipStore.getState().isLoading).toBe(false);

    const { result } = renderHook(() => useHydratedFellowship());
    expect(result.current.isHydrated).toBe(true);
    expect(result.current.circles).toEqual([]);
  });

  it('covers unauthenticated guards, profile lookup fallback, duplicate symposiums, decline symposium, and error recovery', async () => {
    // 1. Unauthenticated guards
    useAuthStore.setState({ user: null, profile: null });
    await useFellowshipStore.getState().fetchFellowshipData();
    expect((await useFellowshipStore.getState().inviteFellowByUsername('@plato')).error?.message).toMatch(
      /Sign in required/i
    );
    expect(
      (
        await useFellowshipStore.getState().inviteFellowByProfile({
          id: 'u2',
          username: 'plato',
          displayName: 'Plato',
        })
      ).error?.message
    ).toMatch(/Sign in required/i);
    expect(
      (
        await useFellowshipStore.getState().createSymposiumInvite({
          bookId: 1342,
          bookTitle: 'Pride',
          fellowId: 'u2',
          fellowUsername: 'plato',
          fellowDisplayName: 'Plato',
        })
      ).error?.message
    ).toMatch(/Sign in required/i);
    expect(useFellowshipStore.getState().getAcceptedFellows()).toEqual([]);
    expect(useFellowshipStore.getState().getPendingInviteCount()).toBe(0);
    expect(useFellowshipStore.getState().getActiveSymposiumForBook(1342)).toBeUndefined();
    await useFellowshipStore.getState().syncSymposiumProgress(1342, 1, 20);

    // Restore authenticated user
    useAuthStore.setState({
      user: { id: 'user-host', email: 'austen@bookarium.test' } as unknown as ReturnType<typeof useAuthStore.getState>['user'],
      profile: { id: 'user-host', username: 'jane_austen', display_name: 'Jane Austen' } as unknown as ReturnType<typeof useAuthStore.getState>['profile'],
    });

    // 2. Self-invite by profile ID
    expect(
      (
        await useFellowshipStore.getState().inviteFellowByProfile({
          id: 'user-host',
          username: 'other_handle',
          displayName: 'Other',
        })
      ).error?.message
    ).toMatch(/cannot invite yourself/i);

    // 3. Fallback to profiles.ilike.maybeSingle when RPC throws, and insert returning server data
    mockRpc.mockRejectedValueOnce(new Error('RPC missing'));
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: 'user-emily', username: 'emily_bronte', display_name: 'Emily Brontë' },
          error: null,
        }),
      }),
    });
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'srv-circle-1',
              requester_id: 'user-emily',
              requester_username: 'emily_bronte',
              requester_display_name: 'Emily Brontë',
              recipient_id: 'user-host',
              recipient_username: 'jane_austen',
              recipient_display_name: 'Jane Austen',
              status: 'accepted',
              created_at: '',
              updated_at: '',
            },
            error: null,
          }),
        }),
      }),
    });

    const fallbackInvite = await useFellowshipStore.getState().inviteFellowByUsername('@emily_bronte');
    expect(fallbackInvite.error).toBeNull();
    expect(fallbackInvite.circle?.id).toBe('srv-circle-1');

    // Duplicate invite when already accepted
    const dupAccepted = await useFellowshipStore.getState().inviteFellowByProfile({
      id: 'user-emily',
      username: 'emily_bronte',
      displayName: 'Emily Brontë',
    });
    expect(dupAccepted.error?.message).toMatch(/already in your Reader Circle/i);

    // getAcceptedFellows when currentUserId is the recipient (isRequester === false)
    const fellowsAsRecipient = useFellowshipStore.getState().getAcceptedFellows('user-host');
    expect(fellowsAsRecipient[0].fellowId).toBe('user-emily');
    expect(fellowsAsRecipient[0].username).toBe('emily_bronte');

    // 4. createSymposiumInvite with server data, duplicate check, and decline (leaveSymposium)
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'srv-sym-1',
              book_id: 768,
              book_title: 'Wuthering Heights',
              host_id: 'user-host',
              host_username: 'jane_austen',
              host_display_name: 'Jane Austen',
              fellow_id: 'user-emily',
              fellow_username: 'emily_bronte',
              fellow_display_name: 'Emily Brontë',
              status: 'pending',
              host_chapter: 0,
              host_progress: 0,
              fellow_chapter: 0,
              fellow_progress: 0,
              created_at: '',
              updated_at: '',
            },
            error: null,
          }),
        }),
      }),
    });
    const symCreated = await useFellowshipStore.getState().createSymposiumInvite({
      bookId: 768,
      bookTitle: 'Wuthering Heights',
      fellowId: 'user-emily',
      fellowUsername: 'emily_bronte',
      fellowDisplayName: 'Emily Brontë',
    });
    expect(symCreated.session?.id).toBe('srv-sym-1');

    const dupSym = await useFellowshipStore.getState().createSymposiumInvite({
      bookId: 768,
      bookTitle: 'Wuthering Heights',
      fellowId: 'user-emily',
      fellowUsername: 'emily_bronte',
      fellowDisplayName: 'Emily Brontë',
    });
    expect(dupSym.error?.message).toMatch(/already exists/i);

    await useFellowshipStore.getState().respondToSymposiumInvite('srv-sym-1', 'decline');
    expect(useFellowshipStore.getState().symposiums).toHaveLength(0);

    // 5. fetchFellowshipData error catch
    mockFrom.mockImplementationOnce(() => {
      throw new Error('Database unreachable');
    });
    await useFellowshipStore.getState().fetchFellowshipData('user-host');
    expect(useFellowshipStore.getState().error).toBe('Database unreachable');
  });

  it('heals companion placeholder identities during fetchFellowshipData and covers companion progress and fellow removal', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'reader_circles') {
        return {
          select: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'circle-stale-1',
                requester_id: 'user-host',
                requester_username: 'jane_austen',
                requester_display_name: 'Jane Austen',
                recipient_id: 'user-stale-fellow',
                recipient_username: 'scholar',
                recipient_display_name: '',
                status: 'accepted',
                created_at: '',
                updated_at: '',
              },
              {
                id: 'circle-stale-2',
                requester_id: 'user-stale-fellow',
                requester_username: 'scholar',
                requester_display_name: '',
                recipient_id: 'user-host',
                recipient_username: 'jane_austen',
                recipient_display_name: 'Jane Austen',
                status: 'accepted',
                created_at: '',
                updated_at: '',
              },
            ],
            error: null,
          }),
        };
      }
      if (table === 'symposium_sessions') {
        return {
          select: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'sym-stale-1',
                book_id: 1342,
                book_title: 'Pride and Prejudice',
                host_id: 'user-stale-fellow',
                host_username: 'fellow_scholar',
                host_display_name: '',
                fellow_id: 'user-host',
                fellow_username: 'jane_austen',
                fellow_display_name: 'Jane Austen',
                status: 'active',
                host_chapter: 3,
                host_progress: 45,
                fellow_chapter: 1,
                fellow_progress: 15,
                created_at: '',
                updated_at: '',
              },
              {
                id: 'sym-stale-2',
                book_id: 84,
                book_title: 'Frankenstein',
                host_id: 'user-host',
                host_username: 'jane_austen',
                host_display_name: 'Jane Austen',
                fellow_id: 'user-stale-fellow',
                fellow_username: 'scholar',
                fellow_display_name: '',
                status: 'active',
                host_chapter: 0,
                host_progress: 0,
                fellow_chapter: 0,
                fellow_progress: 0,
                created_at: '',
                updated_at: '',
              },
            ],
            error: null,
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'user-stale-fellow',
                username: 'mary_shelley',
                display_name: 'Mary Shelley',
              },
            ],
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    });

    await useFellowshipStore.getState().fetchFellowshipData('user-host');

    const circles = useFellowshipStore.getState().circles;
    expect(circles[0].recipient_username).toBe('mary_shelley');
    expect(circles[0].recipient_display_name).toBe('Mary Shelley');

    const syms = useFellowshipStore.getState().symposiums;
    expect(syms[0].host_username).toBe('mary_shelley');
    expect(syms[0].host_display_name).toBe('Mary Shelley');

    // Verify getActiveSymposiumForBook
    const activeSym = useFellowshipStore
      .getState()
      .getActiveSymposiumForBook(1342, 'user-host');
    expect(activeSym?.host_username).toBe('mary_shelley');
    expect(activeSym?.host_display_name).toBe('Mary Shelley');
    expect(activeSym?.host_progress).toBe(45);
    expect(activeSym?.host_chapter).toBe(3);
    expect(activeSym?.fellow_progress).toBe(15);
    expect(activeSym?.fellow_chapter).toBe(1);

    // removeFellow
    await useFellowshipStore.getState().removeFellow('circle-stale-1');
    expect(useFellowshipStore.getState().circles).toHaveLength(1);
    await useFellowshipStore.getState().removeFellow('circle-stale-2');
    expect(useFellowshipStore.getState().circles).toHaveLength(0);
    expect(useFellowshipStore.getState().symposiums).toHaveLength(0);
  });

  it('resolves stale placeholder recipient identities via profiles lookup in inviteFellowByProfile and createSymposiumInvite', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'user-healed-fellow', username: 'hypatia_real', display_name: 'Hypatia of Alexandria' },
              error: null,
            }),
          }),
        };
      }
      if (table === 'reader_circles') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'circle-healed-1',
                  requester_id: 'user-host',
                  requester_username: 'jane_austen',
                  recipient_id: 'user-healed-fellow',
                  recipient_username: 'hypatia_real',
                  recipient_display_name: 'Hypatia of Alexandria',
                  status: 'pending',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'symposium_sessions') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'sym-healed-1',
                  book_id: 11,
                  book_title: 'Alice in Wonderland',
                  host_id: 'user-host',
                  fellow_id: 'user-healed-fellow',
                  fellow_username: 'hypatia_real',
                  fellow_display_name: 'Hypatia of Alexandria',
                  status: 'pending',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnThis() };
    });

    const inviteRes = await useFellowshipStore.getState().inviteFellowByProfile({
      id: 'user-healed-fellow',
      username: 'scholar',
      displayName: '',
    });
    expect(inviteRes.error).toBeNull();
    expect(inviteRes.circle?.recipient_username).toBe('hypatia_real');

    const symRes = await useFellowshipStore.getState().createSymposiumInvite({
      bookId: 11,
      bookTitle: 'Alice in Wonderland',
      fellowId: 'user-healed-fellow',
      fellowUsername: 'scholar',
      fellowDisplayName: '',
    });
    expect(symRes.error).toBeNull();
    expect(symRes.session?.fellow_username).toBe('hypatia_real');

    // Also test when current host profile is not hydrated in useAuthStore (null profile)
    useAuthStore.setState({
      user: { id: 'user-host', email: 'jane@bookarium.test' } as any,
      profile: null,
    });
    const inviteFallbackRes = await useFellowshipStore.getState().inviteFellowByProfile({
      id: 'user-healed-fellow-2',
      username: 'ada_lovelace',
      displayName: 'Ada Lovelace',
    });
    expect(inviteFallbackRes.error).toBeNull();

    const hostFallbackRes = await useFellowshipStore.getState().createSymposiumInvite({
      bookId: 84,
      bookTitle: 'Frankenstein',
      fellowId: 'user-healed-fellow-2',
      fellowUsername: 'ada_lovelace',
      fellowDisplayName: 'Ada Lovelace',
    });
    expect(hostFallbackRes.error).toBeNull();

    // Verify syncSymposiumProgress preserves non-matching symposiums
    useFellowshipStore.setState({
      symposiums: [
        {
          id: 's-other',
          book_id: 9999,
          host_id: 'user-host',
          fellow_id: 'user-other',
          status: 'pending',
          host_chapter: 0,
          host_progress: 0,
          fellow_chapter: 0,
          fellow_progress: 0,
          created_at: '',
          updated_at: '',
        } as any,
        {
          id: 's-active',
          book_id: 11,
          host_id: 'user-host',
          fellow_id: 'user-healed-fellow',
          status: 'active',
          host_chapter: 0,
          host_progress: 0,
          fellow_chapter: 0,
          fellow_progress: 0,
          created_at: '',
          updated_at: '',
        } as any,
      ],
    });
    await useFellowshipStore.getState().syncSymposiumProgress(11, 2, 30);
    const preservedOther = useFellowshipStore.getState().symposiums.find((s) => s.id === 's-other');
    expect(preservedOther?.host_progress).toBe(0);
    const updatedActive = useFellowshipStore.getState().symposiums.find((s) => s.id === 's-active');
    expect(updatedActive?.host_progress).toBe(30);
  });

  describe('isPlaceholderUsername and formatFellowScholarLabel helpers', () => {
    it('correctly identifies placeholder usernames', () => {
      expect(isPlaceholderUsername(null)).toBe(true);
      expect(isPlaceholderUsername(undefined)).toBe(true);
      expect(isPlaceholderUsername('')).toBe(true);
      expect(isPlaceholderUsername('   ')).toBe(true);
      expect(isPlaceholderUsername('scholar')).toBe(true);
      expect(isPlaceholderUsername('SCHOLAR')).toBe(true);
      expect(isPlaceholderUsername('fellow_scholar')).toBe(true);
      expect(isPlaceholderUsername('FELLOW_SCHOLAR')).toBe(true);

      expect(isPlaceholderUsername('johndoe')).toBe(false);
      expect(isPlaceholderUsername('jane_austen')).toBe(false);
    });

    it('formats fellow scholar labels cleanly avoiding (@scholar)', () => {
      // With custom handle
      expect(formatFellowScholarLabel('John Doe', 'johndoe')).toBe('John Doe (@johndoe)');
      // Identical display name and username
      expect(formatFellowScholarLabel('johndoe', 'johndoe')).toBe('@johndoe');
      // Empty display name with custom handle
      expect(formatFellowScholarLabel('', 'johndoe')).toBe('@johndoe');
      // Placeholder username with real display name should not append (@scholar)
      expect(formatFellowScholarLabel('John Doe', 'scholar')).toBe('John Doe');
      expect(formatFellowScholarLabel('John Doe', 'fellow_scholar')).toBe('John Doe');
      expect(formatFellowScholarLabel('John Doe', '')).toBe('John Doe');
      // No display name and placeholder handle
      expect(formatFellowScholarLabel('', 'scholar')).toBe('Fellow Scholar');
      expect(formatFellowScholarLabel(null, null)).toBe('Fellow Scholar');
    });
  });
});

