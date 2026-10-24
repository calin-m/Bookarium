import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFellowshipStore, useHydratedFellowship } from './useFellowshipStore';
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
});

