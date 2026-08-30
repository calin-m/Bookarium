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

  it('should throw error when fetch fails', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('Server error', { status: 500, statusText: 'Internal Server Error' })
    );

    await expect(fetchBooks()).rejects.toThrow('Failed to fetch books: Internal Server Error');
    fetchSpy.mockRestore();
  });
});
