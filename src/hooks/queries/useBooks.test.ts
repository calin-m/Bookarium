import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
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
} from './useBooks';
import { useJurisdictionStore } from '@/stores/useJurisdictionStore';

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

  it('should execute fetchBooks directly', async () => {
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
    expect(await fetchFeaturedQuotesMap([])).toEqual({});

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

    // 3. Valid rows + sentinel row filtering + error/reject handling
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

    const clientSpy = vi.spyOn(supabaseClientModule, 'createClient').mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          neq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: limitMock,
            })),
          })),
        })),
      })),
    } as unknown as ReturnType<typeof supabaseClientModule.createClient>);

    const books = await fetchQuoteEnrichedBooks(30);
    expect(books).toHaveLength(1);
    expect(books[0].id).toBe(1400);
    expect(books[0].quotes).toHaveLength(1);

    expect(await fetchQuoteEnrichedBooks(30)).toEqual([]);
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

    clientSpy.mockRestore();
    configSpy.mockRestore();
  });
});

