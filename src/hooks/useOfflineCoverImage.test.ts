import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOfflineCoverImage, resolveBookCoverUrl } from './useOfflineCoverImage';
import {
  getOfflineBookCover,
  getMemoryCachedCoverUrl,
  getOrCreateMemoryCoverUrl,
  warmCoverCache,
} from '@/lib/offline-storage';

vi.mock('@/lib/offline-storage', () => ({
  getOfflineBookCover: vi.fn().mockResolvedValue(null),
  getMemoryCachedCoverUrl: vi.fn(() => null),
  getOrCreateMemoryCoverUrl: vi.fn(() => null),
  warmCoverCache: vi.fn(),
}));

describe('resolveBookCoverUrl', () => {
  it('routes Gutenberg and mirror cover URLs through same-origin /api/books/content without external hotlinking', () => {
    expect(resolveBookCoverUrl(1342, '')).toBeNull();
    expect(resolveBookCoverUrl(1342, null)).toBeNull();
    expect(resolveBookCoverUrl(1342, 'blob:local-cover')).toBe('blob:local-cover');
    expect(resolveBookCoverUrl(1342, '/local/cover.jpg')).toBe('/local/cover.jpg');
    expect(resolveBookCoverUrl(1342, 'https://example.com/custom-cover.jpg')).toBe(
      'https://example.com/custom-cover.jpg'
    );

    const gutenbergHosts = [
      'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg?v=1',
      'https://gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg',
      'https://aleph.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg',
      'https://gutenberg.pglaf.org/cache/epub/1342/pg1342.cover.medium.jpg',
      'https://gutenberg.readingroo.ms/cache/epub/1342/pg1342.cover.medium.jpg',
    ];
    for (const hostUrl of gutenbergHosts) {
      expect(resolveBookCoverUrl(1342, hostUrl)).toBe('/api/books/content?id=1342&type=cover');
    }

    expect(
      resolveBookCoverUrl(0, 'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg')
    ).toBeNull();
  });
});

describe('useOfflineCoverImage', () => {
  const originalIndexedDb = (globalThis as { indexedDB?: unknown }).indexedDB;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOfflineBookCover).mockResolvedValue(null);
    vi.mocked(getMemoryCachedCoverUrl).mockReturnValue(null);
    vi.mocked(getOrCreateMemoryCoverUrl).mockReturnValue(null);
  });

  afterEach(() => {
    if (originalIndexedDb === undefined) {
      delete (globalThis as { indexedDB?: unknown }).indexedDB;
    } else {
      (globalThis as { indexedDB?: unknown }).indexedDB = originalIndexedDb;
    }
  });

  it('sets imageError when not offline or when no cached cover blob exists', async () => {
    const { result } = renderHook(() => useOfflineCoverImage(1342, false));

    expect(result.current.imageError).toBe(false);
    expect(result.current.offlineCoverUrl).toBeNull();
    expect(result.current.activeCoverUrl).toBeNull();

    await act(async () => {
      await result.current.handleImageError();
    });

    expect(result.current.imageError).toBe(true);
    expect(getOfflineBookCover).not.toHaveBeenCalled();
  });

  it('resolves same-origin R2 cover route, transitions cleanly to imageError on failure, and resets on prop change', async () => {
    const { result, rerender } = renderHook(
      ({ id, offline, cover }) => useOfflineCoverImage(id, offline, cover),
      {
        initialProps: {
          id: 1342,
          offline: false,
          cover: 'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg',
        },
      }
    );

    expect(result.current.activeCoverUrl).toBe('/api/books/content?id=1342&type=cover');
    expect(result.current.imageError).toBe(false);

    await act(async () => {
      await result.current.handleImageError();
    });
    expect(result.current.imageError).toBe(true);

    rerender({
      id: 84,
      offline: false,
      cover: 'https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg',
    });
    expect(result.current.imageError).toBe(false);
    expect(result.current.activeCoverUrl).toBe('/api/books/content?id=84&type=cover');
  });

  it('loads a blob URL from IndexedDB when offline cover blob is available and revokes it on unmount', async () => {
    const fakeBlob = new Blob(['cover-bytes'], { type: 'image/jpeg' });
    vi.mocked(getOfflineBookCover).mockResolvedValueOnce(fakeBlob);
    const createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:offline-cover-1342');
    const revokeObjectURLSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});

    const { result, unmount } = renderHook(() => useOfflineCoverImage(1342, true));

    await act(async () => {
      await result.current.handleImageError();
    });

    expect(getOfflineBookCover).toHaveBeenCalledWith(1342);
    expect(result.current.offlineCoverUrl).toBe('blob:offline-cover-1342');
    expect(result.current.activeCoverUrl).toBe('blob:offline-cover-1342');
    expect(result.current.imageError).toBe(false);

    unmount();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:offline-cover-1342');

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  it('serves in-memory cached blob URL synchronously and avoids remote warming on blob URLs', () => {
    vi.mocked(getMemoryCachedCoverUrl).mockReturnValue('blob:sync-memory-cover');

    const { result } = renderHook(() =>
      useOfflineCoverImage(
        1342,
        false,
        'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg'
      )
    );

    expect(result.current.isCheckingLocalCache).toBe(false);
    expect(result.current.activeCoverUrl).toBe('blob:sync-memory-cover');

    act(() => {
      result.current.handleImageLoad();
    });
    expect(warmCoverCache).not.toHaveBeenCalled();
  });

  it('checks IndexedDB before serving same-origin cover route and warms cache on load miss', async () => {
    (globalThis as { indexedDB?: unknown }).indexedDB = {};

    const cachedBlob = new Blob(['cached-idb-jpeg'], { type: 'image/jpeg' });
    vi.mocked(getOfflineBookCover).mockResolvedValueOnce(cachedBlob);
    vi.mocked(getOrCreateMemoryCoverUrl).mockReturnValueOnce('blob:idb-shared-1342');
    const revokeObjectURLSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});

    const { result: hitResult, unmount: unmountHit } = renderHook(() =>
      useOfflineCoverImage(
        1342,
        false,
        'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg'
      )
    );

    expect(hitResult.current.isCheckingLocalCache).toBe(true);
    expect(hitResult.current.activeCoverUrl).toBeNull();

    await waitFor(() => {
      expect(hitResult.current.isCheckingLocalCache).toBe(false);
      expect(hitResult.current.activeCoverUrl).toBe('blob:idb-shared-1342');
    });

    unmountHit();
    expect(revokeObjectURLSpy).not.toHaveBeenCalled();

    vi.mocked(getOfflineBookCover).mockResolvedValueOnce(null);
    const { result: missResult } = renderHook(() =>
      useOfflineCoverImage(
        84,
        false,
        'https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg'
      )
    );

    await waitFor(() => {
      expect(missResult.current.isCheckingLocalCache).toBe(false);
      expect(missResult.current.activeCoverUrl).toBe('/api/books/content?id=84&type=cover');
    });

    act(() => {
      missResult.current.handleImageLoad();
    });
    expect(warmCoverCache).toHaveBeenCalledWith(84);

    revokeObjectURLSpy.mockRestore();
  });
});
