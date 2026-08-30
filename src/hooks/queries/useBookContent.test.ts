import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useBookContent, fetchBookContent } from './useBookContent';
import { sampleBookText } from '@/mocks/handlers';

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

  it('should fallback to sample text when url is empty or failing', async () => {
    const content = await fetchBookContent(undefined, 100);
    expect(content).toBe(sampleBookText);
  });

  it('should fallback when fetch throws network error or non-ok status', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('Error', { status: 404, statusText: 'Not Found' })
    );

    const content = await fetchBookContent('https://example.com/invalid.txt', 999);
    expect(content).toBe(sampleBookText);
    fetchSpy.mockRestore();

    const fetchThrowSpy = vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));
    const contentThrow = await fetchBookContent('https://example.com/network-error.txt', 999);
    expect(contentThrow).toBe(sampleBookText);
    fetchThrowSpy.mockRestore();
  });
});

