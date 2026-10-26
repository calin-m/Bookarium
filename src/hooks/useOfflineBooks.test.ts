import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOfflineBooks } from './useOfflineBooks';
import { mockBooks } from '@/mocks/handlers';

vi.mock('@/lib/offline-storage', () => ({
  getOfflineBookIds: vi.fn().mockResolvedValue([11]),
  getAllOfflineBookMetas: vi.fn().mockResolvedValue([
    {
      id: 11,
      title: "Alice's Adventures in Wonderland",
      authors: [{ name: 'Carroll, Lewis', birth_year: 1832, death_year: 1898 }],
      translators: [],
      subjects: [],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 0,
    },
  ]),
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

  it('initializes and fetches offline book IDs and metadata on mount', async () => {
    const { result } = renderHook(() => useOfflineBooks());

    await waitFor(() => {
      expect(result.current.offlineBookIds).toContain(11);
    });
    expect(result.current.isBookOffline(11)).toBe(true);
    expect(result.current.isBookOffline(999)).toBe(false);
    expect(result.current.offlineBooks).toHaveLength(1);
    expect(result.current.offlineBooks[0].id).toBe(11);
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
      'Full text content of the book...',
      mockBooks[0].authors
    );

    const { useBookshelfStore } = await import('@/stores/useBookshelfStore');
    expect(useBookshelfStore.getState().isBookSaved(mockBooks[0].id)).toBe(true);

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

  it('removes all books in batch', async () => {
    const { removeOfflineBook } = await import('@/lib/offline-storage');
    const { result } = renderHook(() => useOfflineBooks());

    await act(async () => {
      await result.current.removeAll([mockBooks[0], mockBooks[1]]);
    });

    expect(removeOfflineBook).toHaveBeenCalledWith(mockBooks[0].id);
    expect(removeOfflineBook).toHaveBeenCalledWith(mockBooks[1].id);
  });

  it('normalizes authorDetails and embedded lifespan strings when saving a book offline', async () => {
    const { saveOfflineBook, getOfflineBookIds } = await import('@/lib/offline-storage');
    vi.mocked(getOfflineBookIds).mockResolvedValue([]);

    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('Alice offline text...', { status: 200 }));

    const { result } = renderHook(() => useOfflineBooks());

    await act(async () => {
      await result.current.downloadBook({
        id: 11,
        title: "Alice's Adventures in Wonderland",
        authors: ['Carroll, Lewis, 1832-1898'],
        authorDetails: [{ name: 'Carroll, Lewis, 1832-1898', birth_year: null, death_year: null }],
      } as any);
    });

    expect(saveOfflineBook).toHaveBeenCalledWith(
      11,
      "Alice's Adventures in Wonderland",
      'Alice offline text...',
      [{ name: 'Carroll, Lewis, 1832-1898', birth_year: 1832, death_year: 1898 }]
    );

    fetchSpy.mockRestore();
  });

  it('normalizes author from favoriteBooks and recentBooks when authors is Anonymous or missing', async () => {
    const { saveOfflineBook, getOfflineBookIds } = await import('@/lib/offline-storage');
    const { useBookshelfStore } = await import('@/stores/useBookshelfStore');
    vi.mocked(getOfflineBookIds).mockResolvedValue([]);

    useBookshelfStore.setState({
      favoriteBooks: [
        {
          id: 555,
          title: 'Favorite Title',
          authors: [{ name: 'Favorite Author', birth_year: 1850, death_year: 1920 }],
          translators: [],
          subjects: [],
          bookshelves: [],
          languages: ['en'],
          copyright: false,
          media_type: 'Text',
          formats: {},
          download_count: 10,
        },
      ],
      recentBooks: [
        {
          id: 777,
          title: 'Recent Title',
          authors: [{ name: 'Recent Author', birth_year: 1860, death_year: 1930 }],
          translators: [],
          subjects: [],
          bookshelves: [],
          languages: ['en'],
          copyright: false,
          media_type: 'Text',
          formats: {},
          download_count: 10,
        },
      ],
    });

    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockImplementation(() => Promise.resolve(new Response('Book text...', { status: 200 })));

    const { result } = renderHook(() => useOfflineBooks());

    // 1. Recover from favoriteBooks
    await act(async () => {
      await result.current.downloadBook({
        id: 555,
        title: 'Favorite Title',
        authors: [{ name: 'Anonymous', birth_year: null, death_year: null }],
        formats: {},
      } as any);
    });
    expect(saveOfflineBook).toHaveBeenCalledWith(
      555,
      'Favorite Title',
      'Book text...',
      [{ name: 'Favorite Author', birth_year: 1850, death_year: 1920 }]
    );

    // 2. Recover from recentBooks
    await act(async () => {
      await result.current.downloadBook({
        id: 777,
        title: 'Recent Title',
        authors: [],
        formats: {},
      } as any);
    });
    expect(saveOfflineBook).toHaveBeenCalledWith(
      777,
      'Recent Title',
      'Book text...',
      [{ name: 'Recent Author', birth_year: 1860, death_year: 1930 }]
    );

    // 3. Fallback to FEATURED_HERO_BOOKS when no shelf match
    await act(async () => {
      await result.current.downloadBook({
        id: 11,
        title: "Alice's Adventures in Wonderland",
        authors: [{ name: 'Anonymous', birth_year: null, death_year: null }],
        formats: {},
      } as any);
    });
    expect(saveOfflineBook).toHaveBeenCalledWith(
      11,
      "Alice's Adventures in Wonderland",
      'Book text...',
      [{ name: 'Carroll, Lewis, 1832-1898', birth_year: 1832, death_year: 1898 }]
    );

    // 4. Fallback to Anonymous when not in FEATURED_HERO_BOOKS
    await act(async () => {
      await result.current.downloadBook({
        id: 999999,
        title: 'Non Hero Book',
        authors: [{ name: 'Anonymous', birth_year: null, death_year: null }],
        formats: {},
      } as any);
    });
    expect(saveOfflineBook).toHaveBeenCalledWith(
      999999,
      'Non Hero Book',
      'Book text...',
      [{ name: 'Anonymous', birth_year: null, death_year: null }]
    );

    fetchSpy.mockRestore();
  });

  it('handles canonical Book object conversion and empty text failure', async () => {
    const { saveOfflineBook, getOfflineBookIds } = await import('@/lib/offline-storage');
    const { useBookshelfStore } = await import('@/stores/useBookshelfStore');
    vi.mocked(getOfflineBookIds).mockResolvedValue([]);

    const fetchSpy = vi.spyOn(global, 'fetch');
    // First call: empty text
    fetchSpy.mockResolvedValueOnce(new Response('   ', { status: 200 }));

    const { result } = renderHook(() => useOfflineBooks());

    let emptySuccess = true;
    await act(async () => {
      emptySuccess = await result.current.downloadBook({
        id: 888,
        title: 'Empty Book',
        authors: ['Empty Author'],
      } as any);
    });
    expect(emptySuccess).toBe(false);

    // Second call: canonical Book model with urls
    fetchSpy.mockResolvedValueOnce(new Response('Canonical text...', { status: 200 }));
    let canonicalSuccess = false;
    await act(async () => {
      canonicalSuccess = await result.current.downloadBook({
        id: 999,
        title: 'Canonical Book',
        authors: ['Canonical Author, 1800-1850'],
        coverUrl: 'https://example.com/cover.jpg',
        epubUrl: 'https://example.com/book.epub',
        htmlUrl: 'https://example.com/book.html',
        txtUrl: 'https://example.com/book.txt',
        downloadCount: 42,
        copyright: true,
        languages: ['fr'],
        translators: [{ name: 'Translator Person', birth_year: 1840, death_year: 1900 }],
        subjects: ['Classics'],
      } as any);
    });
    expect(canonicalSuccess).toBe(true);
    expect(saveOfflineBook).toHaveBeenCalled();
    expect(useBookshelfStore.getState().isBookSaved(999)).toBe(true);

    fetchSpy.mockRestore();
  });

  it('handles removeAll with empty array and handles custom events', async () => {
    const { removeOfflineBook, getStorageQuota } = await import('@/lib/offline-storage');
    const { result } = renderHook(() => useOfflineBooks());

    // removeAll([]) should early return
    await act(async () => {
      await result.current.removeAll([]);
    });
    expect(removeOfflineBook).not.toHaveBeenCalled();

    // handleDownloadingEvent
    act(() => {
      window.dispatchEvent(
        new CustomEvent('bookarium:offline-downloading', { detail: { bookId: 123 } })
      );
    });
    expect(result.current.downloadingBookId).toBe(123);

    // refreshStorageQuota and refreshOfflineIds
    await act(async () => {
      await result.current.refreshStorageQuota();
      await result.current.refreshOfflineIds();
    });
    expect(getStorageQuota).toHaveBeenCalled();
  });

  it('synchronizes offlineBookIds across multiple mounted hook instances via window event broadcast', async () => {
    const { getOfflineBookIds } = await import('@/lib/offline-storage');
    vi.mocked(getOfflineBookIds).mockResolvedValue([11]);

    const instanceA = renderHook(() => useOfflineBooks());
    const instanceB = renderHook(() => useOfflineBooks());

    await waitFor(() => {
      expect(instanceA.result.current.isBookOffline(11)).toBe(true);
      expect(instanceB.result.current.isBookOffline(11)).toBe(true);
    });

    vi.mocked(getOfflineBookIds).mockResolvedValue([]);

    await act(async () => {
      await instanceA.result.current.removeBook(11);
    });

    await waitFor(() => {
      expect(instanceA.result.current.isBookOffline(11)).toBe(false);
      expect(instanceB.result.current.isBookOffline(11)).toBe(false);
    });
  });

  it('handles getOfflineBookIds rejection on mount', async () => {
    const { getOfflineBookIds } = await import('@/lib/offline-storage');
    vi.mocked(getOfflineBookIds).mockRejectedValueOnce(new Error('IndexedDB blocked'));
    const { result } = renderHook(() => useOfflineBooks());
    await waitFor(() => {
      expect(getOfflineBookIds).toHaveBeenCalled();
    });
    expect(result.current.offlineBookIds).toEqual([]);
  });

  it('handles getAllOfflineBookMetas and getStorageQuota rejection on mount and offline-updated event', async () => {
    const { getAllOfflineBookMetas, getStorageQuota, getOfflineBookIds } = await import(
      '@/lib/offline-storage'
    );
    vi.mocked(getAllOfflineBookMetas).mockRejectedValueOnce(new Error('Meta read error'));
    vi.mocked(getStorageQuota).mockRejectedValueOnce(new Error('Quota read error'));

    const { result } = renderHook(() => useOfflineBooks());

    await waitFor(() => {
      expect(getAllOfflineBookMetas).toHaveBeenCalled();
      expect(getStorageQuota).toHaveBeenCalled();
    });

    // Fire offline-updated with rejected promises to cover event catch handlers
    vi.mocked(getOfflineBookIds).mockRejectedValueOnce(new Error('Update IDs error'));
    vi.mocked(getAllOfflineBookMetas).mockRejectedValueOnce(new Error('Update metas error'));
    vi.mocked(getStorageQuota).mockRejectedValueOnce(new Error('Update quota error'));

    act(() => {
      window.dispatchEvent(new CustomEvent('bookarium:offline-updated'));
    });

    // Also test refresh methods with rejections to cover catch blocks
    vi.mocked(getStorageQuota).mockRejectedValueOnce(new Error('Refresh quota error'));
    await act(async () => {
      await result.current.refreshStorageQuota();
    });

    vi.mocked(getAllOfflineBookMetas).mockRejectedValueOnce(new Error('Refresh metas error'));
    await act(async () => {
      await result.current.refreshOfflineIds();
    });
  });

  it('updates storage quota state across quota change transitions', async () => {
    const { getStorageQuota } = await import('@/lib/offline-storage');
    const { result } = renderHook(() => useOfflineBooks());

    // Transition 1: usageBytes changed
    vi.mocked(getStorageQuota).mockResolvedValueOnce({
      usageBytes: 2048,
      quotaBytes: 10240,
      percentUsed: 20,
      isNearQuota: false,
    });
    await act(async () => {
      await result.current.refreshStorageQuota();
    });
    expect(result.current.storageQuota?.usageBytes).toBe(2048);

    // Transition 2: quotaBytes changed
    vi.mocked(getStorageQuota).mockResolvedValueOnce({
      usageBytes: 2048,
      quotaBytes: 20480,
      percentUsed: 10,
      isNearQuota: false,
    });
    await act(async () => {
      await result.current.refreshStorageQuota();
    });
    expect(result.current.storageQuota?.quotaBytes).toBe(20480);

    // Transition 3: quota is null
    vi.mocked(getStorageQuota).mockResolvedValueOnce(null as any);
    await act(async () => {
      await result.current.refreshStorageQuota();
    });
    expect(result.current.storageQuota).toBeNull();

    // Transition 4: quota unchanged (same null)
    vi.mocked(getStorageQuota).mockResolvedValueOnce(null as any);
    await act(async () => {
      await result.current.refreshStorageQuota();
    });
    expect(result.current.storageQuota).toBeNull();
  });

  it('handles edge cases in normalizeOfflineAuthors and downloading events', async () => {
    const { saveOfflineBook, getOfflineBookIds } = await import('@/lib/offline-storage');
    const { useBookshelfStore } = await import('@/stores/useBookshelfStore');
    vi.mocked(getOfflineBookIds).mockResolvedValue([]);

    useBookshelfStore.setState({
      savedBooks: [
        {
          id: 601,
          title: 'Placeholder Shelf Book',
          authors: [{ name: 'Unknown', birth_year: null, death_year: null }],
          translators: [],
          subjects: [],
          bookshelves: [],
          languages: ['en'],
          copyright: false,
          media_type: 'Text',
          formats: {},
          download_count: 5,
        },
      ],
      favoriteBooks: [],
      recentBooks: [],
    });

    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockImplementation(() => Promise.resolve(new Response('Book text...', { status: 200 })));

    const { result } = renderHook(() => useOfflineBooks());

    // 1. authorDetails is empty array -> falls back to authors
    await act(async () => {
      await result.current.downloadBook({
        id: 601,
        title: 'Placeholder Shelf Book',
        authorDetails: [],
        authors: [{ name: 'Anonymous', birth_year: null, death_year: null }],
        formats: {},
      } as any);
    });
    expect(saveOfflineBook).toHaveBeenCalledWith(
      601,
      'Placeholder Shelf Book',
      'Book text...',
      [{ name: 'Anonymous', birth_year: null, death_year: null }]
    );

    // 2. CustomEvent without detail.bookId
    act(() => {
      window.dispatchEvent(new CustomEvent('bookarium:offline-downloading', { detail: {} }));
    });
    expect(result.current.downloadingBookId).toBeNull();

    // 3. CustomEvent without detail
    act(() => {
      window.dispatchEvent(new CustomEvent('bookarium:offline-downloading'));
    });
    expect(result.current.downloadingBookId).toBeNull();

    // 4. Author-change reactivity in updateOfflineBooksState for same book ID
    const { getAllOfflineBookMetas } = await import('@/lib/offline-storage');
    vi.mocked(getAllOfflineBookMetas).mockResolvedValueOnce([
      {
        id: 11,
        title: "Alice's Adventures in Wonderland",
        authors: [{ name: 'Anonymous', birth_year: null, death_year: null }],
        translators: [],
        subjects: [],
        bookshelves: [],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: {},
        download_count: 0,
      },
    ]);
    await act(async () => {
      await result.current.refreshOfflineIds();
    });
    expect(result.current.offlineBooks[0].authors[0].name).toBe('Anonymous');

    vi.mocked(getAllOfflineBookMetas).mockResolvedValueOnce([
      {
        id: 11,
        title: "Alice's Adventures in Wonderland",
        authors: [{ name: 'Carroll, Lewis', birth_year: 1832, death_year: 1898 }],
        translators: [],
        subjects: [],
        bookshelves: [],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: {},
        download_count: 0,
      },
    ]);
    await act(async () => {
      await result.current.refreshOfflineIds();
    });
    expect(result.current.offlineBooks[0].authors[0].name).toBe('Carroll, Lewis');

    fetchSpy.mockRestore();
  });
});
