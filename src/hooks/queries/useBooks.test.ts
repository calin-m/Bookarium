import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useBooks,
  fetchBooks,
  usePrefetchNextPage,
  fetchFeaturedQuotesMap,
  useFeaturedQuotes,
  fetchQuoteEnrichedBooks,
  useQuoteEnrichedBooks,
  readCachedQuoteEnrichedBooks,
  writeCachedQuoteEnrichedBooks,
  QUOTE_ENRICHED_BOOKS_CACHE_KEY,
  QUOTE_POOL_SETTLE_TIMEOUT_MS,
} from './useBooks';
import { useJurisdictionStore } from '@/stores/useJurisdictionStore';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';

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
  return { queryClient, TestWrapper };
}

describe('useBooks hook', () => {
  it('should fetch public domain books list successfully', async () => {
    const { TestWrapper } = createWrapper();
    const { result } = renderHook(() => useBooks(), {
      wrapper: TestWrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.results.length).toBeGreaterThan(0);
    expect(result.current.data?.results[0].title).toBe('Pride and Prejudice');
  });

  it('should filter books by search term, topic, languages, era, and sort', async () => {
    const { TestWrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useBooks({
          search: 'Frankenstein',
          topic: 'science fiction',
          languages: 'en',
          authorYearStart: 1700,
          authorYearEnd: 1900,
          sort: 'popular',
          mimeType: 'text/html',
          page: 1,
          copyright: false,
        }),
      {
        wrapper: TestWrapper,
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const books = result.current.data?.results || [];
    expect(books.some((b) => b.title.includes('Frankenstein'))).toBe(true);
  });

  it('should execute fetchBooks directly and attach measured client latencyMs', async () => {
    const data = await fetchBooks({
      search: 'Republic',
      topic: 'philosophy',
      languages: 'en',
      authorYearStart: -500,
      authorYearEnd: 0,
      sort: 'popular',
      mimeType: 'text/plain',
      page: 2,
    });
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.results[0].title).toBe('The Republic');
    expect(typeof data.latencyMs).toBe('number');
    expect(data.latencyMs).toBeGreaterThanOrEqual(1);
  });

  it('should support predictive prefetching for next page', async () => {
    const { queryClient, TestWrapper } = createWrapper();
    const prefetchSpy = vi.spyOn(queryClient, 'prefetchQuery');

    const { result } = renderHook(
      () => usePrefetchNextPage({ search: 'Austen', page: 1 }, true),
      { wrapper: TestWrapper }
    );

    expect(typeof result.current).toBe('function');
    act(() => {
      result.current();
    });

    expect(prefetchSpy).toHaveBeenCalled();
    prefetchSpy.mockRestore();
  });

  it('should fallback to direct upstream when internal proxy fails', async () => {
    let callCount = 0;
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      callCount++;
      if (String(url).includes('/api/books')) {
        return new Response(JSON.stringify({ error: 'Proxy timeout' }), { status: 504 });
      }
      return new Response(
        JSON.stringify({
          count: 1,
          next: null,
          previous: null,
          results: [{ id: 1342, title: 'Direct Gutenberg Pride', copyright: false, authors: [] }],
        }),
        { status: 200 }
      );
    });

    const data = await fetchBooks({ search: 'Pride' });
    expect(data).toBeDefined();
    expect(data.results[0].title).toBe('Direct Gutenberg Pride');
    expect(data.source).toBe('upstream');
    expect(typeof data.latencyMs).toBe('number');
    expect(data.latencyMs).toBeGreaterThanOrEqual(1);
    expect(callCount).toBeGreaterThanOrEqual(2);
    fetchSpy.mockRestore();
  });

  it('should throw error when both internal proxy and direct API fail', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network connection failed'));

    await expect(fetchBooks({ search: 'Pride' })).rejects.toThrow('Failed to fetch books:');
    fetchSpy.mockRestore();
  });

  it('should throw when direct upstream returns non-ok status', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('/api/books')) {
        return new Response(JSON.stringify({ error: 'Proxy timeout' }), { status: 504 });
      }
      return new Response('Upstream error', { status: 500, statusText: 'Internal Server Error' });
    });

    await expect(fetchBooks({ search: 'Pride' })).rejects.toThrow('Failed to fetch books:');
    fetchSpy.mockRestore();
  });

  it('should fetch in server environment when window is undefined', async () => {
    const originalWindow = global.window;
    delete (global as any).window;

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          count: 1,
          results: [{ id: 1342, title: 'Server Gutenberg Pride', copyright: false, authors: [] }],
        }),
        { status: 200 }
      )
    );

    const data = await fetchBooks({ search: 'Pride' });
    expect(data.results[0].title).toBe('Server Gutenberg Pride');
    fetchSpy.mockRestore();
    (global as any).window = originalWindow;
  });

  it('should throw in server environment when server fetch fails', async () => {
    const originalWindow = global.window;
    delete (global as any).window;

    const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Server socket error'));

    await expect(fetchBooks({ search: 'Pride' })).rejects.toThrow('Failed to fetch books:');
    fetchSpy.mockRestore();
    (global as any).window = originalWindow;
  });

  it('should handle simulated offline network drop in useBooks hook', async () => {
    const { TestWrapper } = createWrapper();
    const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('NetworkError: Failed to fetch'));

    const { result } = renderHook(() => useBooks({ search: 'NonExistent' }), {
      wrapper: TestWrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
    fetchSpy.mockRestore();
  });

  it('should respect enabled: false and not fetch books', () => {
    const { TestWrapper } = createWrapper();
    const fetchSpy = vi.spyOn(global, 'fetch');

    const { result } = renderHook(() => useBooks({ ids: '9999' }, { enabled: false }), {
      wrapper: TestWrapper,
    });

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('should throw when upstream returns invalid non-JSON body', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('/api/books')) {
        return new Response(JSON.stringify({ error: 'Proxy timeout' }), { status: 504 });
      }
      return new Response('<html>502 Bad Gateway</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    });

    await expect(fetchBooks({ search: 'Pride' })).rejects.toThrow('Invalid JSON response');
    fetchSpy.mockRestore();
  });

  it('should filter protected books during Strategy 2 fallback for international users', async () => {
    useJurisdictionStore.getState().setCountry('GB');

    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('/api/books')) {
        return new Response(JSON.stringify({ error: 'Proxy timeout' }), { status: 504 });
      }
      return new Response(
        JSON.stringify({
          count: 2,
          results: [
            {
              id: 1342,
              title: 'Pride and Prejudice',
              authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
              translators: [],
              copyright: false,
            },
            {
              id: 863,
              title: 'The Mysterious Affair at Styles',
              authors: [{ name: 'Christie, Agatha', birth_year: 1890, death_year: 1976 }],
              translators: [],
              copyright: false,
            },
          ],
        }),
        { status: 200 }
      );
    });

    const data = await fetchBooks({ search: 'detective' });
    expect(data.results).toHaveLength(1);
    expect(data.results[0].title).toBe('Pride and Prejudice');

    fetchSpy.mockRestore();
    useJurisdictionStore.getState().resetOverride();
  });

  it('should retain protected books during Strategy 2 fallback when includeRestrictedMetadata is true', async () => {
    useJurisdictionStore.getState().setCountry('GB');

    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('/api/books')) {
        return new Response(JSON.stringify({ error: 'Proxy timeout' }), { status: 504 });
      }
      return new Response(
        JSON.stringify({
          count: 2,
          results: [
            {
              id: 1342,
              title: 'Pride and Prejudice',
              authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
              translators: [],
              copyright: false,
            },
            {
              id: 863,
              title: 'The Mysterious Affair at Styles',
              authors: [{ name: 'Christie, Agatha', birth_year: 1890, death_year: 1976 }],
              translators: [],
              copyright: false,
            },
          ],
        }),
        { status: 200 }
      );
    });

    const data = await fetchBooks({ search: 'detective', includeRestrictedMetadata: true });
    expect(data.results).toHaveLength(2);
    expect(data.results.some((b) => b.title.includes('Mysterious Affair'))).toBe(true);

    fetchSpy.mockRestore();
    useJurisdictionStore.getState().resetOverride();
  });

  it('should use calibrated baseline count during Strategy 2 fallback for unfiltered catalog queries in RO', async () => {
    useJurisdictionStore.getState().setCountry('RO');

    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('/api/books')) {
        return new Response(JSON.stringify({ error: 'Proxy timeout' }), { status: 504 });
      }
      return new Response(
        JSON.stringify({
          count: 78500,
          results: [
            {
              id: 1342,
              title: 'Pride and Prejudice',
              authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
              translators: [],
              copyright: false,
            },
          ],
        }),
        { status: 200 }
      );
    });

    const data = await fetchBooks();
    expect(data.clientCountry).toBe('RO');
    expect(data.jurisdictionRule).toBe('LIFE_70');
    expect(data.count).toBe(55754);

    fetchSpy.mockRestore();
    useJurisdictionStore.getState().resetOverride();
  });

  it('should schedule idle prefetch via requestIdleCallback when available and cancel on unmount', () => {
    const { queryClient, TestWrapper } = createWrapper();
    const prefetchSpy = vi.spyOn(queryClient, 'prefetchQuery').mockResolvedValue(undefined);
    let capturedCb: (() => void) | null = null;
    const cancelSpy = vi.fn();

    (window as unknown as Record<string, unknown>).requestIdleCallback = vi.fn((cb: () => void) => {
      capturedCb = cb;
      return 77;
    });
    (window as unknown as Record<string, unknown>).cancelIdleCallback = cancelSpy;

    const { unmount } = renderHook(
      () => usePrefetchNextPage({ search: 'Dickens', page: 2 }, true),
      { wrapper: TestWrapper }
    );

    expect(capturedCb).not.toBeNull();
    act(() => {
      capturedCb?.();
    });
    expect(prefetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['books', { search: 'Dickens', page: 3 }],
      })
    );

    unmount();
    expect(cancelSpy).toHaveBeenCalledWith(77);

    delete (window as unknown as Record<string, unknown>).requestIdleCallback;
    delete (window as unknown as Record<string, unknown>).cancelIdleCallback;
    prefetchSpy.mockRestore();
  });

  it('should fallback to setTimeout in usePrefetchNextPage and skip when hasNextPage is false', () => {
    vi.useFakeTimers();
    const { queryClient, TestWrapper } = createWrapper();
    const prefetchSpy = vi.spyOn(queryClient, 'prefetchQuery').mockResolvedValue(undefined);

    const { result: disabledResult } = renderHook(
      () => usePrefetchNextPage({ search: 'Austen', page: 1 }, false),
      { wrapper: TestWrapper }
    );
    act(() => {
      disabledResult.current();
      vi.advanceTimersByTime(500);
    });
    expect(prefetchSpy).not.toHaveBeenCalled();

    renderHook(
      () => usePrefetchNextPage({ search: 'Austen' }, true),
      { wrapper: TestWrapper }
    );
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(prefetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['books', { search: 'Austen', page: 2 }],
      })
    );

    prefetchSpy.mockRestore();
    vi.useRealTimers();
  });

  it('should handle server runtime non-ok status, invalid JSON, and copyright filtering', async () => {
    const originalWindow = global.window;
    delete (global as unknown as Record<string, unknown>).window;

    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('Error', { status: 503, statusText: 'Service Unavailable' }))
      .mockResolvedValueOnce(new Response('not-json', { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              { id: 1342, title: 'Pride', copyright: false, authors: [] },
              { id: 9999, title: 'Copyrighted Work', copyright: true, authors: [] },
            ],
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [{ id: 9999, title: 'Copyrighted Work', copyright: true, authors: [] }],
          }),
          { status: 200 }
        )
      );

    await expect(fetchBooks({ search: 'Pride' })).rejects.toThrow('Service Unavailable');
    await expect(fetchBooks({ search: 'Pride' })).rejects.toThrow('Invalid JSON response');

    const filteredData = await fetchBooks({ search: 'Pride' });
    expect(filteredData.results).toHaveLength(1);
    expect(filteredData.count).toBe(1);

    const unrestrictedData = await fetchBooks({ search: 'Pride', includeRestrictedMetadata: true });
    expect(unrestrictedData.results).toHaveLength(1);

    fetchSpy.mockRestore();
    (global as unknown as Record<string, unknown>).window = originalWindow;
  });

  it('fetches featured quotes map from Supabase with fail-safe fallback when unconfigured, offline, or errored', async () => {
    const supabaseClientModule = await import('@/lib/supabase/client');
    const supabaseProviderModule = await import('@/lib/catalog/supabase-provider');

    // 1. Empty IDs or unconfigured Supabase returns {}
    window.localStorage.removeItem('bookarium-quote-enriched-books-v1');
    expect(await fetchFeaturedQuotesMap([])).toEqual({});

    // 1b. Resolves directly from local bookarium-quote-enriched-books-v1 cache when present
    window.localStorage.setItem(
      'bookarium-quote-enriched-books-v1',
      JSON.stringify({
        updatedAt: Date.now(),
        books: [
          {
            id: 1342,
            title: 'Pride and Prejudice',
            quotes: [
              {
                chapterLabel: 'Cached Chapter I',
                openingLine: 'Cached opening line',
                quoteExcerpt: 'Cached quote excerpt',
              },
            ],
          },
        ],
      })
    );
    const cachedMap = await fetchFeaturedQuotesMap([1342]);
    expect(cachedMap[1342]?.[0].chapterLabel).toBe('Cached Chapter I');
    window.localStorage.removeItem('bookarium-quote-enriched-books-v1');

    const configSpy = vi
      .spyOn(supabaseProviderModule, 'isSupabaseConfigured')
      .mockReturnValue(true);

    // 2. Offline browser returns {}
    const onLineGetter = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    expect(await fetchFeaturedQuotesMap([1342])).toEqual({});
    onLineGetter.mockReturnValue(true);

    // 3. Valid Supabase response maps valid BookPassage rows
    const inMock = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            id: 1342,
            quotes: [
              {
                chapterLabel: 'Chapter I',
                openingLine: 'It is a truth universally acknowledged...',
                quoteExcerpt: 'I declare after all there is no enjoyment like reading!',
              },
              { invalid: true },
            ],
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'column quotes does not exist' },
      })
      .mockRejectedValueOnce(new Error('Network failure'));

    const clientSpy = vi.spyOn(supabaseClientModule, 'createClient').mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: inMock,
        })),
      })),
    } as unknown as ReturnType<typeof supabaseClientModule.createClient>);

    const quotesMap = await fetchFeaturedQuotesMap([1342, 84]);
    expect(quotesMap[1342]).toHaveLength(1);
    expect(quotesMap[1342][0].chapterLabel).toBe('Chapter I');

    // 4. PostgREST error or rejected promise safely returns {}
    expect(await fetchFeaturedQuotesMap([1342])).toEqual({});
    expect(await fetchFeaturedQuotesMap([1342])).toEqual({});

    // 5. useFeaturedQuotes hook resolves quotes map
    inMock.mockResolvedValueOnce({
      data: [
        {
          id: 84,
          quotes: [
            {
              chapterLabel: 'Letter I',
              openingLine: 'You will rejoice to hear...',
              quoteExcerpt: 'Beware; for I am fearless, and therefore powerful.',
            },
          ],
        },
      ],
      error: null,
    });

    const { TestWrapper } = createWrapper();
    const { result } = renderHook(() => useFeaturedQuotes([84]), {
      wrapper: TestWrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[84]?.[0].chapterLabel).toBe('Letter I');

    // 6. Resolves directly from 7-day Edge-cached /api/books?ids=...&has_quotes=true without hitting Supabase client
    server.use(
      http.get('/api/books', ({ request }) => {
        const url = new URL(request.url, 'http://localhost:3000');
        if (url.searchParams.get('has_quotes') === 'true') {
          return HttpResponse.json({
            count: 1,
            source: 'supabase',
            results: [
              {
                id: 2701,
                title: 'Moby Dick',
                quotes: [
                  {
                    chapterLabel: 'Loomings',
                    openingLine: 'Call me Ishmael.',
                    quoteExcerpt: 'Whenever I find myself growing grim about the mouth...',
                  },
                ],
              },
            ],
          });
        }
        return HttpResponse.json({ results: [], count: 0 });
      })
    );
    const edgeQuotesMap = await fetchFeaturedQuotesMap([2701]);
    expect(edgeQuotesMap[2701]?.[0].chapterLabel).toBe('Loomings');
    server.resetHandlers();

    clientSpy.mockRestore();
    configSpy.mockRestore();
  });

  it('fetches quote-enriched books from Supabase, filters sentinel records, and falls back when unconfigured or offline', async () => {
    const supabaseClientModule = await import('@/lib/supabase/client');
    const supabaseProviderModule = await import('@/lib/catalog/supabase-provider');

    // 1. Unconfigured returns []
    const configSpy = vi
      .spyOn(supabaseProviderModule, 'isSupabaseConfigured')
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    expect(await fetchQuoteEnrichedBooks()).toEqual([]);

    // 2. Offline returns []
    const onLineGetter = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValueOnce(false);
    expect(await fetchQuoteEnrichedBooks()).toEqual([]);
    onLineGetter.mockRestore();

    // 2.5. Primary Edge API route (/api/books?pool=quotes) succeeds, slices to 2 spreads, and caches
    server.use(
      http.get('/api/books', ({ request }) => {
        const url = new URL(request.url, 'http://localhost:3000');
        if (url.searchParams.get('pool') === 'quotes') {
          return HttpResponse.json({
            count: 1,
            next: null,
            previous: null,
            results: [
              {
                id: 1342,
                title: 'Pride and Prejudice',
                authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
                translators: [],
                subjects: ['Classic Literature'],
                bookshelves: ['Best Books Ever'],
                languages: ['en'],
                copyright: false,
                media_type: 'Text',
                formats: { 'text/plain; charset=utf-8': 'https://gutenberg.pglaf.org/1/3/4/1342/1342-0.txt' },
                download_count: 50000,
                quotes: [
                  { chapterLabel: 'Passage I', openingLine: 'Line 1', quoteExcerpt: 'Excerpt 1', commentary: 'Comm 1' },
                  { chapterLabel: 'Passage II', openingLine: 'Line 2', quoteExcerpt: 'Excerpt 2', commentary: 'Comm 2' },
                  { chapterLabel: 'Passage III', openingLine: 'Line 3', quoteExcerpt: 'Excerpt 3', commentary: 'Comm 3' },
                ],
              },
            ],
          });
        }
        return HttpResponse.json({ results: [], count: 0 });
      })
    );
    window.localStorage.removeItem('bookarium-quote-enriched-books-v1');
    const edgeBooks = await fetchQuoteEnrichedBooks(30);
    expect(edgeBooks.length).toBeGreaterThan(0);
    expect(edgeBooks[0].quotes).toHaveLength(2);
    expect(readCachedQuoteEnrichedBooks(30)?.books.length).toBe(edgeBooks.length);
    window.localStorage.removeItem('bookarium-quote-enriched-books-v1');
    server.resetHandlers();

    // 3. Fallback to client Supabase when Edge API fails (MSW returns 503 by default for pool=quotes):
    // valid rows + sentinel row filtering + error/reject handling
    const fetchFailSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Edge route offline'));
    const limitMock = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            id: 1400,
            title: 'Great Expectations',
            authors: [{ name: 'Dickens, Charles', birth_year: 1812, death_year: 1870 }],
            translators: [],
            subjects: ['Bildungsromans'],
            bookshelves: ['Best Books Ever'],
            languages: ['en'],
            copyright: false,
            media_type: 'Text',
            formats: { 'text/plain; charset=utf-8': 'https://gutenberg.pglaf.org/1/4/0/1400/1400-0.txt' },
            download_count: 35000,
            quotes: [
              {
                chapterLabel: 'Passage I • Great Expectations',
                openingLine: '“My father’s family name being Pirrip, and my Christian name Philip.”',
                quoteExcerpt: '“Suffering has been stronger than all other teaching.”',
              },
            ],
          },
          {
            id: 29999,
            title: 'Index Volume',
            quotes: [
              {
                chapterLabel: 'Edition Record • Project Gutenberg',
                openingLine: '“Index Volume” — preserved in the Bookarium archive.',
                quoteExcerpt: 'Unabridged public domain text.',
                commentary: 'Bibliographic sentinel record — automated passage extraction completed.',
              },
            ],
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Query error' },
      })
      .mockRejectedValueOnce(new Error('Connection error'));

    const inEnrichedMock = vi.fn(() => ({
      neq: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: limitMock,
        })),
      })),
    }));

    const clientSpy = vi.spyOn(supabaseClientModule, 'createClient').mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn((cols: string) =>
          cols === 'id'
            ? {
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({ data: [{ id: 1400 }], error: null }),
                })),
              }
            : {
                in: inEnrichedMock,
                neq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: limitMock,
                  })),
                })),
              }
        ),
      })),
    } as unknown as ReturnType<typeof supabaseClientModule.createClient>);

    window.localStorage.removeItem('bookarium-quote-enriched-books-v1');
    const books = await fetchQuoteEnrichedBooks(30);
    expect(books).toHaveLength(1);
    expect(books[0].id).toBe(1400);
    expect(books[0].quotes).toHaveLength(1);
    const inCallIds = (inEnrichedMock.mock.calls[0] as unknown as [string, number[]])?.[1] ?? [];
    expect(inCallIds).toContain(1342);
    expect(inCallIds).toContain(35);
    expect(inCallIds).toContain(120);

    // Persisted localStorage cache is returned when offline or on transient query errors, and [] when cache is cleared
    expect((await fetchQuoteEnrichedBooks(30))[0].id).toBe(1400);
    window.localStorage.removeItem('bookarium-quote-enriched-books-v1');
    expect(await fetchQuoteEnrichedBooks(30)).toEqual([]);

    // 4. useQuoteEnrichedBooks hook resolves enriched books
    limitMock.mockResolvedValueOnce({
      data: [
        {
          id: 1400,
          title: 'Great Expectations',
          authors: [{ name: 'Dickens, Charles', birth_year: 1812, death_year: 1870 }],
          quotes: [
            {
              chapterLabel: 'Passage I • Great Expectations',
              openingLine: '“My father’s family name being Pirrip.”',
              quoteExcerpt: '“Suffering has been stronger than all other teaching.”',
            },
          ],
        },
      ],
      error: null,
    });

    const { TestWrapper } = createWrapper();
    const { result } = renderHook(() => useQuoteEnrichedBooks({ limit: 25 }), {
      wrapper: TestWrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]?.title).toBe('Great Expectations');

    // 5. Exercises candidate id ordering with download_count and id fallbacks
    window.localStorage.removeItem('bookarium-quote-enriched-books-v1');
    const singleScanMock = vi.fn().mockResolvedValue({ data: null, error: new Error('Scan fail') });
    clientSpy.mockReturnValueOnce({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: singleScanMock,
          })),
        })),
      })),
    } as unknown as ReturnType<typeof supabaseClientModule.createClient>);
    const emptyScanBooks = await fetchQuoteEnrichedBooks(10);
    expect(emptyScanBooks).toEqual([]);

    window.localStorage.removeItem('bookarium-quote-enriched-books-v1');
    fetchFailSpy.mockRestore();
    clientSpy.mockRestore();
    configSpy.mockRestore();
  });
});

describe('useQuoteEnrichedBooks isPoolSettled hydration signal', () => {
  const CACHE_KEY = 'bookarium-quote-enriched-books-v1';

  const writeWarmCache = () => {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        updatedAt: Date.now(),
        books: [
          {
            id: 1400,
            title: 'Great Expectations',
            authors: [],
            quotes: [
              {
                chapterLabel: 'Passage I • Great Expectations',
                openingLine: '“My father’s family name being Pirrip.”',
                quoteExcerpt: '“Suffering has been stronger than all other teaching.”',
              },
            ],
          },
        ],
      })
    );
  };

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.localStorage.removeItem(CACHE_KEY);
  });

  it('is false during server rendering when Supabase is configured, so static fallback text is never painted as final', async () => {
    const supabaseProviderModule = await import('@/lib/catalog/supabase-provider');
    vi.spyOn(supabaseProviderModule, 'isSupabaseConfigured').mockReturnValue(true);
    writeWarmCache();

    const { TestWrapper } = createWrapper();
    const Probe = () => {
      const { isPoolSettled } = useQuoteEnrichedBooks();
      return React.createElement('span', { 'data-settled': String(isPoolSettled) });
    };
    const html = renderToString(React.createElement(TestWrapper, null, React.createElement(Probe)));
    expect(html).toContain('data-settled="false"');
  });

  it('is true immediately when Supabase is unconfigured or the caller opts out with enabled: false', async () => {
    const supabaseProviderModule = await import('@/lib/catalog/supabase-provider');
    const configSpy = vi.spyOn(supabaseProviderModule, 'isSupabaseConfigured').mockReturnValue(false);
    const { TestWrapper } = createWrapper();

    const unconfigured = renderHook(() => useQuoteEnrichedBooks(), { wrapper: TestWrapper });
    expect(unconfigured.result.current.isPoolSettled).toBe(true);
    unconfigured.unmount();

    configSpy.mockReturnValue(true);
    const optedOut = renderHook(() => useQuoteEnrichedBooks({ enabled: false }), {
      wrapper: TestWrapper,
    });
    expect(optedOut.result.current.isPoolSettled).toBe(true);
  });

  it('is true on mount with a warm localStorage cache and exposes the cached books', async () => {
    const supabaseProviderModule = await import('@/lib/catalog/supabase-provider');
    vi.spyOn(supabaseProviderModule, 'isSupabaseConfigured').mockReturnValue(true);
    writeWarmCache();

    const { TestWrapper } = createWrapper();
    const { result } = renderHook(() => useQuoteEnrichedBooks(), { wrapper: TestWrapper });

    expect(result.current.isPoolSettled).toBe(true);
    expect(result.current.data?.[0]?.id).toBe(1400);
  });

  it('stays false with a cold cache while the fetch is pending, then settles via the timeout safety net', async () => {
    const supabaseProviderModule = await import('@/lib/catalog/supabase-provider');
    const supabaseClientModule = await import('@/lib/supabase/client');
    vi.spyOn(supabaseProviderModule, 'isSupabaseConfigured').mockReturnValue(true);
    vi.spyOn(supabaseClientModule, 'createClient').mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => new Promise(() => {})),
          })),
        })),
      })),
    } as unknown as ReturnType<typeof supabaseClientModule.createClient>);
    window.localStorage.removeItem(CACHE_KEY);

    vi.useFakeTimers();
    const { TestWrapper } = createWrapper();
    const { result } = renderHook(() => useQuoteEnrichedBooks(), { wrapper: TestWrapper });
    expect(result.current.isPoolSettled).toBe(false);

    act(() => {
      vi.advanceTimersByTime(QUOTE_POOL_SETTLE_TIMEOUT_MS - 1);
    });
    expect(result.current.isPoolSettled).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.isPoolSettled).toBe(true);
  });

  it('settles with a cold cache once the fetch completes, including when the fetch fails', async () => {
    const supabaseProviderModule = await import('@/lib/catalog/supabase-provider');
    const supabaseClientModule = await import('@/lib/supabase/client');
    vi.spyOn(supabaseProviderModule, 'isSupabaseConfigured').mockReturnValue(true);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Edge route offline'));
    vi.spyOn(supabaseClientModule, 'createClient').mockImplementation(() => {
      throw new Error('Supabase unavailable');
    });
    window.localStorage.removeItem(CACHE_KEY);

    const { TestWrapper } = createWrapper();
    const { result } = renderHook(() => useQuoteEnrichedBooks(), { wrapper: TestWrapper });

    await waitFor(() => expect(result.current.isPoolSettled).toBe(true));
    expect(result.current.data ?? []).toEqual([]);
  });

  it('forwards all optional query parameters in usePrefetchNextPage and sorts cached quote-enriched books deterministically', () => {
    const { queryClient, TestWrapper } = createWrapper();
    const prefetchSpy = vi.spyOn(queryClient, 'prefetchQuery');

    const { result } = renderHook(
      () =>
        usePrefetchNextPage(
          {
            ids: '1342,84',
            search: 'Austen',
            topic: 'fiction',
            languages: 'en',
            copyright: false,
            authorYearStart: 1800,
            authorYearEnd: 1900,
            sort: 'popular',
            mimeType: 'text/plain',
            includeRestrictedMetadata: true,
          },
          true
        ),
      { wrapper: TestWrapper }
    );

    act(() => {
      result.current();
    });

    expect(prefetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [
          'books',
          {
            ids: '1342,84',
            search: 'Austen',
            topic: 'fiction',
            languages: 'en',
            copyright: false,
            authorYearStart: 1800,
            authorYearEnd: 1900,
            sort: 'popular',
            mimeType: 'text/plain',
            includeRestrictedMetadata: true,
            page: 2,
          },
        ],
      })
    );

    // Test writeCachedQuoteEnrichedBooks & readCachedQuoteEnrichedBooks deterministic sorting and edge cases
    writeCachedQuoteEnrichedBooks([]);
    window.localStorage.setItem(QUOTE_ENRICHED_BOOKS_CACHE_KEY, '{invalid-json');
    expect(readCachedQuoteEnrichedBooks()).toBeUndefined();

    window.localStorage.setItem(QUOTE_ENRICHED_BOOKS_CACHE_KEY, JSON.stringify({ books: [] }));
    expect(readCachedQuoteEnrichedBooks()).toBeUndefined();

    window.localStorage.setItem(
      QUOTE_ENRICHED_BOOKS_CACHE_KEY,
      JSON.stringify({ books: [{ invalid: true }] })
    );
    expect(readCachedQuoteEnrichedBooks()).toBeUndefined();

    const baseBook = {
      authors: [],
      translators: [],
      subjects: [],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 100,
    };

    writeCachedQuoteEnrichedBooks([
      { ...baseBook, id: 99992, title: 'Low Popularity Book', download_count: 50 },
      { ...baseBook, id: 84, title: 'Frankenstein', download_count: 50000 },
      { ...baseBook, id: 99991, title: 'High Popularity Book', download_count: 500 },
      { ...baseBook, id: 1342, title: 'Pride and Prejudice', download_count: 60000 },
    ]);

    const cached = readCachedQuoteEnrichedBooks(10);
    expect(cached).toBeDefined();
    expect(cached?.books.map((b) => b.id)).toEqual([1342, 84, 99991, 99992]);
    expect(cached?.isFresh).toBe(true);
  });
});

