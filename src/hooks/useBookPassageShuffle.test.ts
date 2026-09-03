import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useBookPassageShuffle } from './useBookPassageShuffle';

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
  const TestWrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  TestWrapper.displayName = 'TestWrapper';
  return TestWrapper;
}

describe('useBookPassageShuffle', () => {
  it('initializes with curated fallback passages for known books', () => {
    const { result } = renderHook(
      () =>
        useBookPassageShuffle({
          id: 1342,
          title: 'Pride and Prejudice',
          authors: [{ name: 'Jane Austen' }],
          subjects: ['Classic Literature'],
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.passages.length).toBeGreaterThan(0);
    expect(result.current.currentPassage).toBeDefined();
    expect(result.current.activePassageIndex).toBe(0);
    expect(result.current.isTurningLeaf).toBe(false);
  });

  it('cycles to the next passage on shuffleNextPassage', () => {
    const { result } = renderHook(
      () =>
        useBookPassageShuffle({
          id: 1342,
          title: 'Pride and Prejudice',
          authors: [{ name: 'Jane Austen' }],
          subjects: ['Classic Literature'],
        }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.shuffleNextPassage();
    });

    expect(result.current.isTurningLeaf).toBe(true);
    expect(result.current.activePassageIndex).toBe(1);

    act(() => {
      result.current.setIsTurningLeaf(false);
    });

    expect(result.current.isTurningLeaf).toBe(false);
  });

  it('resets passages to index 0 on resetPassages', () => {
    const { result } = renderHook(
      () =>
        useBookPassageShuffle({
          id: 1342,
          title: 'Pride and Prejudice',
          authors: [{ name: 'Jane Austen' }],
          subjects: ['Classic Literature'],
        }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.shuffleNextPassage();
    });
    expect(result.current.activePassageIndex).toBe(1);

    act(() => {
      result.current.resetPassages();
    });
    expect(result.current.activePassageIndex).toBe(0);
    expect(result.current.isTurningLeaf).toBe(false);
  });
});
