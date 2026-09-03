import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOfflineBooks } from './useOfflineBooks';
import { mockBooks } from '@/mocks/handlers';

vi.mock('@/lib/offline-storage', () => ({
  getOfflineBookIds: vi.fn().mockResolvedValue([11]),
  saveOfflineBook: vi.fn().mockResolvedValue(undefined),
  removeOfflineBook: vi.fn().mockResolvedValue(undefined),
  getStorageQuota: vi.fn().mockResolvedValue({
    usageBytes: 1024,
    quotaBytes: 10240,
    percentUsed: 10,
    isNearQuota: false,
  }),
}));

describe('useOfflineBooks hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes and fetches offline book IDs on mount', async () => {
    const { result } = renderHook(() => useOfflineBooks());

    await waitFor(() => {
      expect(result.current.offlineBookIds).toContain(11);
    });
    expect(result.current.isBookOffline(11)).toBe(true);
    expect(result.current.isBookOffline(999)).toBe(false);
  });

  it('downloads a single book and updates offline status', async () => {
    const { saveOfflineBook, getOfflineBookIds } = await import('@/lib/offline-storage');
    vi.mocked(getOfflineBookIds)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([mockBooks[0].id]);

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('Full text content of the book...', { status: 200 })
    );

    const { result } = renderHook(() => useOfflineBooks());

    let success = false;
    await act(async () => {
      success = await result.current.downloadBook(mockBooks[0]);
    });

    expect(success).toBe(true);
    expect(saveOfflineBook).toHaveBeenCalledWith(
      mockBooks[0].id,
      mockBooks[0].title,
      'Full text content of the book...'
    );

    fetchSpy.mockRestore();
  });

  it('handles download failure gracefully', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404 })
    );

    const { result } = renderHook(() => useOfflineBooks());

    let success = true;
    await act(async () => {
      success = await result.current.downloadBook(mockBooks[0]);
    });

    expect(success).toBe(false);
    fetchSpy.mockRestore();
  });

  it('removes an offline book and refreshes ids', async () => {
    const { removeOfflineBook, getOfflineBookIds } = await import('@/lib/offline-storage');
    vi.mocked(getOfflineBookIds)
      .mockResolvedValueOnce([11])
      .mockResolvedValueOnce([]);

    const { result } = renderHook(() => useOfflineBooks());

    await act(async () => {
      await result.current.removeBook(11);
    });

    expect(removeOfflineBook).toHaveBeenCalledWith(11);
  });

  it('downloads all missing books in batch with progress updates', async () => {
    const { saveOfflineBook, getOfflineBookIds } = await import('@/lib/offline-storage');
    vi.mocked(getOfflineBookIds).mockResolvedValue([]);

    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response('Sample batch content', { status: 200 }))
    );

    const { result } = renderHook(() => useOfflineBooks());

    await act(async () => {
      await result.current.downloadAll([mockBooks[0], mockBooks[1]]);
    });

    expect(saveOfflineBook).toHaveBeenCalledTimes(2);
    expect(result.current.isDownloading).toBe(false);
    expect(result.current.downloadAllProgress).toBeNull();

    fetchSpy.mockRestore();
  });

  it('removes all books in batch', async () => {
    const { removeOfflineBook } = await import('@/lib/offline-storage');
    const { result } = renderHook(() => useOfflineBooks());

    await act(async () => {
      await result.current.removeAll([mockBooks[0], mockBooks[1]]);
    });

    expect(removeOfflineBook).toHaveBeenCalledWith(mockBooks[0].id);
    expect(removeOfflineBook).toHaveBeenCalledWith(mockBooks[1].id);
  });
});
