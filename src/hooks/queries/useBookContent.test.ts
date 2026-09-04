import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useBookContent, fetchBookContent } from './useBookContent';
import { sampleBookText } from '@/mocks/handlers';

vi.mock('@/lib/offline-storage', () => ({
  getOfflineBook: vi.fn().mockResolvedValue(null),
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
});


