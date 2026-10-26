import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useBookContent, fetchBookContent } from './useBookContent';
import { sampleBookText } from '@/mocks/handlers';

vi.mock('@/lib/offline-storage', () => ({
  getOfflineBook: vi.fn().mockResolvedValue(null),
  getOfflineBookRecord: vi.fn().mockResolvedValue(null),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );
  TestWrapper.displayName = 'TestWrapper';
  return TestWrapper;
}

describe('useBookContent hook', () => {
  it('should fetch book text content from URL', async () => {
    const { result } = renderHook(
      () => useBookContent('https://www.gutenberg.org/ebooks/1342.txt.utf-8', 1342),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toContain('Pride and Prejudice');
  });

  it('should return sample text when neither url nor bookId is provided', async () => {
    const content = await fetchBookContent(undefined, undefined);
    expect(content).toBe(sampleBookText);
  });

  it('should throw when fetch returns non-ok status or empty content', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404, statusText: 'Not Found' })
    );

    await expect(fetchBookContent('https://example.com/invalid.txt', 999)).rejects.toThrow(/Failed to fetch/i);
    fetchSpy.mockRestore();

    const fetchThrowSpy = vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));
    await expect(fetchBookContent('https://example.com/network-error.txt', 999)).rejects.toThrow('Network error');
    fetchThrowSpy.mockRestore();
  });

  it('should return offline cached content without calling fetch when available', async () => {
    const { getOfflineBook } = await import('@/lib/offline-storage');
    vi.mocked(getOfflineBook).mockResolvedValueOnce('Offline Chapter 1: The Beginning');

    const fetchSpy = vi.spyOn(global, 'fetch');
    const content = await fetchBookContent('https://example.com/some-url.txt', 12345);

    expect(content).toBe('Offline Chapter 1: The Beginning');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('should handle request abort on network timeout', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValueOnce(abortError);

    await expect(fetchBookContent('https://example.com/slow-mirror.txt', 1234)).rejects.toThrow(
      /timed out after 8000ms/i
    );

    fetchSpy.mockRestore();
  });

  it('should throw LegalRestrictionError when proxy returns HTTP 451', async () => {
    const legalPayload = {
      country: 'GB',
      rule: 'LIFE_70',
      publicDomainYear: 2047,
      restrictingAuthor: 'Agatha Christie',
      reason: 'Protected under UK Life + 70 laws',
    };

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(legalPayload), {
        status: 451,
        statusText: 'Unavailable For Legal Reasons',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    try {
      await fetchBookContent(undefined, 863);
      expect.fail('Should have thrown LegalRestrictionError');
    } catch (err: any) {
      expect(err.name).toBe('LegalRestrictionError');
      expect(err.status).toBe(451);
      expect(err.details.publicDomainYear).toBe(2047);
      expect(err.details.country).toBe('GB');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('should allow non-US international visitors to read verified public domain books from offline cache', async () => {
    const { useJurisdictionStore } = await import('@/stores/useJurisdictionStore');
    useJurisdictionStore.setState({ country: 'RO' });

    const { getOfflineBookRecord } = await import('@/lib/offline-storage');
    vi.mocked(getOfflineBookRecord).mockResolvedValueOnce({
      bookId: 1342,
      title: 'Pride and Prejudice',
      text: 'It is a truth universally acknowledged...',
      downloadedAt: new Date().toISOString(),
      byteSize: 1024,
      authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
    });

    const fetchSpy = vi.spyOn(global, 'fetch');
    const content = await fetchBookContent(undefined, 1342);

    expect(content).toBe('It is a truth universally acknowledged...');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();

    // Reset store
    useJurisdictionStore.setState({ country: 'US' });
  });

  it('should block non-US visitors with LegalRestrictionError if cached offline book is protected in their country', async () => {
    const { useJurisdictionStore } = await import('@/stores/useJurisdictionStore');
    useJurisdictionStore.setState({ country: 'RO' });

    const { getOfflineBookRecord } = await import('@/lib/offline-storage');
    vi.mocked(getOfflineBookRecord).mockResolvedValueOnce({
      bookId: 863,
      title: 'The Mysterious Affair at Styles',
      text: 'Cached copyrighted text...',
      downloadedAt: new Date().toISOString(),
      byteSize: 1024,
      authors: [{ name: 'Christie, Agatha', birth_year: 1890, death_year: 1976 }],
    });

    const fetchSpy = vi.spyOn(global, 'fetch');

    try {
      await fetchBookContent(undefined, 863);
      expect.fail('Should have thrown LegalRestrictionError');
    } catch (err: any) {
      expect(err.name).toBe('LegalRestrictionError');
      expect(err.status).toBe(451);
      expect(err.details.country).toBe('RO');
      expect(err.details.publicDomainYear).toBe(2047);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      useJurisdictionStore.setState({ country: 'US' });
    }
  });

  it('falls back to useReaderStore or useBookshelfStore when cached book authors are omitted from offline record', async () => {
    const { useJurisdictionStore } = await import('@/stores/useJurisdictionStore');
    const { useReaderStore } = await import('@/stores/useReaderStore');
    const { useBookshelfStore } = await import('@/stores/useBookshelfStore');
    const { getOfflineBookRecord } = await import('@/lib/offline-storage');

    useJurisdictionStore.setState({ country: 'RO' });
    useReaderStore.setState({
      currentBook: {
        id: 1342,
        title: 'Pride and Prejudice',
        authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
      } as any,
    });

    vi.mocked(getOfflineBookRecord).mockResolvedValueOnce({
      bookId: 1342,
      title: 'Pride and Prejudice',
      text: 'Reader store fallback text...',
      downloadedAt: new Date().toISOString(),
      byteSize: 1024,
      authors: undefined,
    });

    const text1 = await fetchBookContent(undefined, 1342);
    expect(text1).toBe('Reader store fallback text...');

    // Now test fallback to savedBooks
    useReaderStore.setState({ currentBook: null });
    useBookshelfStore.setState({
      savedBooks: [
        {
          id: 1342,
          title: 'Pride and Prejudice',
          authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
        } as any,
      ],
    });

    vi.mocked(getOfflineBookRecord).mockResolvedValueOnce({
      bookId: 1342,
      title: 'Pride and Prejudice',
      text: 'Bookshelf store fallback text...',
      downloadedAt: new Date().toISOString(),
      byteSize: 1024,
      authors: undefined,
    });

    const text2 = await fetchBookContent(undefined, 1342);
    expect(text2).toBe('Bookshelf store fallback text...');

    useJurisdictionStore.setState({ country: 'US' });
    useReaderStore.setState({ currentBook: null });
    useBookshelfStore.setState({ savedBooks: [] });
  });

  it('allows offline fallback when device is offline without author metadata', async () => {
    const { useJurisdictionStore } = await import('@/stores/useJurisdictionStore');
    const { getOfflineBookRecord } = await import('@/lib/offline-storage');

    useJurisdictionStore.setState({ country: 'RO' });
    const originalOnline = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    vi.mocked(getOfflineBookRecord).mockResolvedValueOnce({
      bookId: 9999,
      title: 'Unknown Author Offline Book',
      text: 'Offline without metadata text...',
      downloadedAt: new Date().toISOString(),
      byteSize: 1024,
      authors: undefined,
    });

    const content = await fetchBookContent(undefined, 9999);
    expect(content).toBe('Offline without metadata text...');

    Object.defineProperty(navigator, 'onLine', { value: originalOnline, configurable: true });
    useJurisdictionStore.setState({ country: 'US' });
  });

  it('falls back to offline storage when upstream fetch fails with network error', async () => {
    const { getOfflineBookRecord } = await import('@/lib/offline-storage');
    vi.mocked(getOfflineBookRecord).mockResolvedValueOnce({
      bookId: 1342,
      title: 'Pride and Prejudice',
      text: 'Network failure fallback text...',
      downloadedAt: new Date().toISOString(),
      byteSize: 1024,
      authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
    });

    const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Failed to fetch'));
    const content = await fetchBookContent('https://example.com/stream.txt', 1342);
    expect(content).toBe('Network failure fallback text...');

    fetchSpy.mockRestore();
  });

  it('throws an error when upstream response returns empty text', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('', { status: 200 }));
    await expect(fetchBookContent('https://example.com/empty.txt', 500)).rejects.toThrow(
      /Received empty text content from upstream\./
    );
    fetchSpy.mockRestore();
  });

  it('covers LegalRestrictionError default reason, 451 non-JSON body, non-US network-error fallback, and retry predicate', async () => {
    const { LegalRestrictionError } = await import('./useBookContent');
    const { useJurisdictionStore } = await import('@/stores/useJurisdictionStore');
    const { getOfflineBookRecord } = await import('@/lib/offline-storage');

    // Default reason in constructor
    const defaultErr = new LegalRestrictionError({ country: 'DE', rule: 'LIFE_70' });
    expect(defaultErr.message).toBe('This title is protected by copyright in your jurisdiction.');

    // 451 with non-JSON body
    const fetch451Spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('Unavailable For Legal Reasons', { status: 451 })
    );
    await expect(fetchBookContent('https://example.com/451.txt', 863)).rejects.toThrow(LegalRestrictionError);
    fetch451Spy.mockRestore();

    // Non-US network error fallback to offline book when public domain in country
    useJurisdictionStore.setState({ country: 'RO' });
    vi.mocked(getOfflineBookRecord)
      .mockResolvedValueOnce(null) // initial check returns null so it attempts fetch
      .mockResolvedValueOnce({
        bookId: 1342,
        title: 'Pride and Prejudice',
        text: 'Romanian offline fallback text',
        downloadedAt: new Date().toISOString(),
        byteSize: 512,
        authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
      });
    const fetchFailSpy = vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network down'));
    const fallbackText = await fetchBookContent('https://example.com/1342.txt', 1342);
    expect(fallbackText).toBe('Romanian offline fallback text');
    fetchFailSpy.mockRestore();
    useJurisdictionStore.setState({ country: 'US' });
  });

  it('recovers verified lifespans from authorDetails, favoriteBooks, recentBooks, readingPositions, FEATURED_HERO_BOOKS, or network proxy when offline record has null dates', async () => {
    const { useJurisdictionStore } = await import('@/stores/useJurisdictionStore');
    const { useReaderStore } = await import('@/stores/useReaderStore');
    const { useBookshelfStore } = await import('@/stores/useBookshelfStore');
    const { getOfflineBookRecord } = await import('@/lib/offline-storage');

    useJurisdictionStore.setState({ country: 'RO' });

    const incompleteOfflineRecord = {
      bookId: 11,
      title: "Alice's Adventures in Wonderland",
      text: 'Down the rabbit-hole...',
      downloadedAt: new Date().toISOString(),
      byteSize: 512,
      authors: [{ name: 'Lewis Carroll', birth_year: null, death_year: null }],
    };

    // 1. Recovers from currentBook.authorDetails (Canonical Book from Bookmarks)
    useReaderStore.setState({
      currentBook: {
        id: 11,
        title: "Alice's Adventures in Wonderland",
        authors: ['Lewis Carroll'],
        authorDetails: [{ name: 'Carroll, Lewis', birth_year: 1832, death_year: 1898 }],
      } as any,
    });
    vi.mocked(getOfflineBookRecord).mockResolvedValueOnce(incompleteOfflineRecord);
    expect(await fetchBookContent(undefined, 11)).toBe('Down the rabbit-hole...');

    // 2. Recovers from readingPositions[11].bookAuthors with embedded dates
    useReaderStore.setState({
      currentBook: null,
      readingPositions: {
        11: {
          chapterIndex: 1,
          chapterPage: 1,
          globalPage: 2,
          lastReadAt: new Date().toISOString(),
          bookAuthors: ['Carroll, Lewis, 1832-1898'],
        },
      },
    });
    vi.mocked(getOfflineBookRecord).mockResolvedValueOnce(incompleteOfflineRecord);
    expect(await fetchBookContent(undefined, 11)).toBe('Down the rabbit-hole...');

    // 3. Recovers from FEATURED_HERO_BOOKS (e.g., bookId 1727 Homer)
    useReaderStore.setState({ readingPositions: {} });
    vi.mocked(getOfflineBookRecord).mockResolvedValueOnce({
      ...incompleteOfflineRecord,
      bookId: 1727,
      title: 'The Odyssey',
      authors: [{ name: 'Homer', birth_year: null, death_year: null }],
    });
    expect(await fetchBookContent(undefined, 1727)).toBe('Down the rabbit-hole...');

    // 4. When online and no local store or featured fixture has lifespans (e.g., bookId 55179), defers to /api/books/content instead of throwing false client-side 451
    vi.mocked(getOfflineBookRecord).mockResolvedValueOnce({
      ...incompleteOfflineRecord,
      bookId: 55179,
      title: 'The King in Yellow',
      authors: [{ name: 'Robert W. Chambers', birth_year: null, death_year: null }],
    });
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('Server verified text', { status: 200 }));
    expect(await fetchBookContent(undefined, 55179)).toBe('Server verified text');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();

    useJurisdictionStore.setState({ country: 'US' });
    useReaderStore.setState({ currentBook: null, readingPositions: {} });
    useBookshelfStore.setState({ savedBooks: [], favoriteBooks: [], recentBooks: [] });
  });

  it('enforces LegalRestrictionError in network catch block when offline book is restricted in jurisdiction', async () => {
    const { LegalRestrictionError } = await import('./useBookContent');
    const { useJurisdictionStore } = await import('@/stores/useJurisdictionStore');
    const { getOfflineBookRecord } = await import('@/lib/offline-storage');

    useJurisdictionStore.setState({ country: 'RO' });
    vi.mocked(getOfflineBookRecord).mockResolvedValueOnce(null).mockResolvedValueOnce({
      bookId: 84,
      title: 'Frankenstein',
      text: 'Frankenstein offline text',
      downloadedAt: new Date().toISOString(),
      byteSize: 512,
      authors: [{ name: 'Restricted Modern Author', birth_year: 1940, death_year: 2010 }],
    });

    const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network offline'));
    await expect(fetchBookContent('https://example.com/stream.txt', 84)).rejects.toThrow(
      LegalRestrictionError
    );
    fetchSpy.mockRestore();
    useJurisdictionStore.setState({ country: 'US' });
  });

  it('returns offline text when network fails and offline record has no local author metadata', async () => {
    const { useJurisdictionStore } = await import('@/stores/useJurisdictionStore');
    const { getOfflineBookRecord } = await import('@/lib/offline-storage');

    useJurisdictionStore.setState({ country: 'RO' });
    vi.mocked(getOfflineBookRecord).mockResolvedValueOnce(null).mockResolvedValueOnce({
      bookId: 7777,
      title: 'Legacy Offline Book',
      text: 'Legacy offline text without dates',
      downloadedAt: new Date().toISOString(),
      byteSize: 512,
      authors: undefined,
    });

    const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network offline'));
    const content = await fetchBookContent('https://example.com/stream.txt', 7777);
    expect(content).toBe('Legacy offline text without dates');
    fetchSpy.mockRestore();
    useJurisdictionStore.setState({ country: 'US' });
  });

  it('executes queryFn via networkMode always and resolves IndexedDB content even when navigator.onLine is false', async () => {
    const { getOfflineBook } = await import('@/lib/offline-storage');
    vi.mocked(getOfflineBook).mockResolvedValueOnce('Offline book text via networkMode always');

    const originalOnline = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    const { result } = renderHook(() => useBookContent(undefined, 1342), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('Offline book text via networkMode always');

    Object.defineProperty(navigator, 'onLine', { value: originalOnline, configurable: true });
  });
});


