import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  syncAllStoresWithCloud,
  hasSupabaseAuthCookie,
  shouldVerifyCloudSession,
  verifyActiveCloudSession,
} from './sync-utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useAnnotationStore } from '@/stores/useAnnotationStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { useHabitsStore } from '@/stores/useHabitsStore';
import { useAccoladesStore } from '@/stores/useAccoladesStore';
import { useFellowshipStore } from '@/stores/useFellowshipStore';
import * as supabaseClientModule from '@/lib/supabase/client';

describe('syncAllStoresWithCloud', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggers syncWithCloud concurrently on Auth, Bookshelf, Annotation, Reader, Habits, and Accolades stores, plus Fellowship hydration', async () => {
    const authMock = vi.fn().mockResolvedValue(undefined);
    const bookshelfMock = vi.fn().mockResolvedValue(undefined);
    const annotationMock = vi.fn().mockResolvedValue(undefined);
    const readerMock = vi.fn().mockResolvedValue(undefined);
    const habitsMock = vi.fn().mockResolvedValue(undefined);
    const accoladesMock = vi.fn().mockResolvedValue(undefined);
    const fellowshipMock = vi.fn().mockResolvedValue(undefined);

    useAuthStore.setState({ syncWithCloud: authMock });
    useBookshelfStore.setState({ syncWithCloud: bookshelfMock });
    useAnnotationStore.setState({ syncWithCloud: annotationMock });
    useReaderStore.setState({ syncWithCloud: readerMock });
    useHabitsStore.setState({ syncWithCloud: habitsMock });
    useAccoladesStore.setState({ syncWithCloud: accoladesMock });
    useFellowshipStore.setState({ fetchFellowshipData: fellowshipMock });

    await syncAllStoresWithCloud('user-456');

    expect(authMock).toHaveBeenCalledWith('user-456');
    expect(bookshelfMock).toHaveBeenCalledWith('user-456');
    expect(annotationMock).toHaveBeenCalledWith('user-456');
    expect(readerMock).toHaveBeenCalledWith('user-456');
    expect(habitsMock).toHaveBeenCalledWith('user-456');
    expect(accoladesMock).toHaveBeenCalledWith('user-456');
    expect(fellowshipMock).toHaveBeenCalledWith('user-456');
  });

  it('safely exits without calling stores if userId is empty', async () => {
    const bookshelfMock = vi.fn().mockResolvedValue(undefined);
    const habitsMock = vi.fn().mockResolvedValue(undefined);
    const accoladesMock = vi.fn().mockResolvedValue(undefined);
    useBookshelfStore.setState({ syncWithCloud: bookshelfMock });
    useHabitsStore.setState({ syncWithCloud: habitsMock });
    useAccoladesStore.setState({ syncWithCloud: accoladesMock });

    await syncAllStoresWithCloud('');

    expect(bookshelfMock).not.toHaveBeenCalled();
    expect(habitsMock).not.toHaveBeenCalled();
    expect(accoladesMock).not.toHaveBeenCalled();
  });

  it('gracefully settles and does not throw if one store encounters a network rejection', async () => {
    const bookshelfMock = vi.fn().mockRejectedValue(new Error('Network error'));
    const annotationMock = vi.fn().mockResolvedValue(undefined);
    const readerMock = vi.fn().mockResolvedValue(undefined);
    const habitsMock = vi.fn().mockResolvedValue(undefined);
    const accoladesMock = vi.fn().mockResolvedValue(undefined);

    useBookshelfStore.setState({ syncWithCloud: bookshelfMock });
    useAnnotationStore.setState({ syncWithCloud: annotationMock });
    useReaderStore.setState({ syncWithCloud: readerMock });
    useHabitsStore.setState({ syncWithCloud: habitsMock });
    useAccoladesStore.setState({ syncWithCloud: accoladesMock });

    await expect(syncAllStoresWithCloud('user-789')).resolves.toBeUndefined();

    expect(bookshelfMock).toHaveBeenCalledWith('user-789');
    expect(annotationMock).toHaveBeenCalledWith('user-789');
    expect(readerMock).toHaveBeenCalledWith('user-789');
    expect(habitsMock).toHaveBeenCalledWith('user-789');
    expect(accoladesMock).toHaveBeenCalledWith('user-789');
  });

  it('verifies active cloud session, skips unauthenticated syncs when cookies are cleared, and preserves user on transient wake-up errors', async () => {
    // 1. Cookie presence helper
    document.cookie = 'sb-projref-auth-token=; Max-Age=0; path=/';
    expect(hasSupabaseAuthCookie()).toBe(false);
    document.cookie = 'sb-projref-auth-token=valid-cookie; path=/';
    expect(hasSupabaseAuthCookie()).toBe(true);
    document.cookie = 'sb-projref-auth-token=; Max-Age=0; path=/';

    // 2. shouldVerifyCloudSession and verifyActiveCloudSession edge cases
    expect(shouldVerifyCloudSession(null)).toBe(false);
    expect(await verifyActiveCloudSession(null, '')).toBe(false);

    // 3. When cookies are cleared (session: null, error: null, no sb-*-auth-token cookie),
    // syncAllStoresWithCloud skips all stores and resets stale useAuthStore.user to null
    const mockGetSession = vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    });
    const createClientSpy = vi
      .spyOn(supabaseClientModule, 'createClient')
      .mockReturnValue({
        auth: { getSession: mockGetSession },
      } as unknown as ReturnType<typeof supabaseClientModule.createClient>);

    const readerMock = vi.fn().mockResolvedValue(undefined);
    useReaderStore.setState({ syncWithCloud: readerMock });
    useAuthStore.setState({
      user: { id: 'user-cleared-1', email: 'cleared@test.com' } as unknown as ReturnType<
        typeof useAuthStore.getState
      >['user'],
    });

    await syncAllStoresWithCloud('user-cleared-1');
    expect(readerMock).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();

    // 4. When wake-up token refresh encounters a transient error (error != null),
    // skips unauthenticated sync without logging the user out
    useAuthStore.setState({
      user: { id: 'user-wakeup-1', email: 'wakeup@test.com' } as unknown as ReturnType<
        typeof useAuthStore.getState
      >['user'],
    });
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
      error: new Error('AuthRetryableFetchError'),
    });

    await syncAllStoresWithCloud('user-wakeup-1');
    expect(readerMock).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user?.id).toBe('user-wakeup-1');

    // 5. When session is valid and matches userId, proceeds with store synchronization
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'jwt-token-123',
          user: { id: 'user-wakeup-1' },
        },
      },
      error: null,
    });
    await syncAllStoresWithCloud('user-wakeup-1');
    expect(readerMock).toHaveBeenCalledWith('user-wakeup-1');

    createClientSpy.mockRestore();
    useAuthStore.setState({ user: null });
  });

  it('coalesces overlapping syncAllStoresWithCloud calls per user and allows subsequent sequential runs', async () => {
    let resolveSession!: (val: {
      data: { session: { access_token: string; user: { id: string } } };
      error: null;
    }) => void;
    const mockGetSession = vi
      .fn()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSession = resolve;
        })
      )
      .mockResolvedValueOnce({
        data: { session: { access_token: 'tok-seq', user: { id: 'user-concurrent-1' } } },
        error: null,
      });

    const createClientSpy = vi
      .spyOn(supabaseClientModule, 'createClient')
      .mockReturnValue({
        auth: { getSession: mockGetSession },
      } as unknown as ReturnType<typeof supabaseClientModule.createClient>);

    const authMock = vi.fn().mockResolvedValue(undefined);
    const bookshelfMock = vi.fn().mockResolvedValue(undefined);
    const annotationMock = vi.fn().mockResolvedValue(undefined);
    const readerMock = vi.fn().mockResolvedValue(undefined);
    const habitsMock = vi.fn().mockResolvedValue(undefined);
    const accoladesMock = vi.fn().mockResolvedValue(undefined);
    const fellowshipMock = vi.fn().mockResolvedValue(undefined);

    useAuthStore.setState({ syncWithCloud: authMock });
    useBookshelfStore.setState({ syncWithCloud: bookshelfMock });
    useAnnotationStore.setState({ syncWithCloud: annotationMock });
    useReaderStore.setState({ syncWithCloud: readerMock });
    useHabitsStore.setState({ syncWithCloud: habitsMock });
    useAccoladesStore.setState({ syncWithCloud: accoladesMock });
    useFellowshipStore.setState({ fetchFellowshipData: fellowshipMock });

    const p1 = syncAllStoresWithCloud('user-concurrent-1');
    const p2 = syncAllStoresWithCloud('user-concurrent-1');
    expect(p1).toBe(p2);

    resolveSession({
      data: { session: { access_token: 'tok-1', user: { id: 'user-concurrent-1' } } },
      error: null,
    });
    await p1;

    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(authMock).toHaveBeenCalledTimes(1);
    expect(bookshelfMock).toHaveBeenCalledTimes(1);
    expect(annotationMock).toHaveBeenCalledTimes(1);
    expect(readerMock).toHaveBeenCalledTimes(1);
    expect(habitsMock).toHaveBeenCalledTimes(1);
    expect(accoladesMock).toHaveBeenCalledTimes(1);
    expect(fellowshipMock).toHaveBeenCalledTimes(1);

    // Subsequent sequential run triggers cleanly
    await syncAllStoresWithCloud('user-concurrent-1');
    expect(mockGetSession).toHaveBeenCalledTimes(2);
    expect(readerMock).toHaveBeenCalledTimes(2);

    createClientSpy.mockRestore();
  });
});

