import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useBooks, fetchBooks, usePrefetchNextPage } from './useBooks';

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
});
