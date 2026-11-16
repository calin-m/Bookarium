import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOfflineCoverImage, resolveGutenbergCoverCandidates } from './useOfflineCoverImage';
import { getOfflineBookCover } from '@/lib/offline-storage';

vi.mock('@/lib/offline-storage', () => ({
  getOfflineBookCover: vi.fn(),
}));

describe('resolveGutenbergCoverCandidates', () => {
  it('orders official Gutenberg mirrors ahead of www.gutenberg.org and preserves non-Gutenberg URLs', () => {
    expect(resolveGutenbergCoverCandidates('')).toEqual([]);
    expect(resolveGutenbergCoverCandidates(null)).toEqual([]);
    expect(resolveGutenbergCoverCandidates('https://example.com/custom-cover.jpg')).toEqual([
      'https://example.com/custom-cover.jpg',
    ]);
    expect(resolveGutenbergCoverCandidates('/local/cover.jpg')).toEqual(['/local/cover.jpg']);

    expect(
      resolveGutenbergCoverCandidates(
        'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg?v=1'
      )
    ).toEqual([
      'https://aleph.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg?v=1',
      'https://gutenberg.pglaf.org/cache/epub/1342/pg1342.cover.medium.jpg?v=1',
      'https://gutenberg.readingroo.ms/cache/epub/1342/pg1342.cover.medium.jpg?v=1',
      'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg?v=1',
    ]);
  });
});

describe('useOfflineCoverImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('steps through Gutenberg mirror candidates on repeated errors and resets on prop change', async () => {
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

    expect(result.current.activeCoverUrl).toBe(
      'https://aleph.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg'
    );

    await act(async () => {
      await result.current.handleImageError();
    });
    expect(result.current.activeCoverUrl).toBe(
      'https://gutenberg.pglaf.org/cache/epub/1342/pg1342.cover.medium.jpg'
    );
    expect(result.current.imageError).toBe(false);

    await act(async () => {
      await result.current.handleImageError();
    });
    expect(result.current.activeCoverUrl).toBe(
      'https://gutenberg.readingroo.ms/cache/epub/1342/pg1342.cover.medium.jpg'
    );

    await act(async () => {
      await result.current.handleImageError();
    });
    expect(result.current.activeCoverUrl).toBe(
      'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg'
    );

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
    expect(result.current.activeCoverUrl).toBe(
      'https://aleph.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg'
    );
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
});
