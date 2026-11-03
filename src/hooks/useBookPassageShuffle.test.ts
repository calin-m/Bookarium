import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useBookPassageShuffle,
  readCachedBookPassages,
  writeCachedBookPassages,
  clearCachedBookPassages,
  EXTRACTED_PASSAGES_CACHE_KEY,
} from './useBookPassageShuffle';
import * as useBookContentModule from '@/hooks/queries/useBookContent';

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

const mockSupabasePassages = [
  {
    chapterLabel: 'Passage I • Classic',
    openingLine: '“First opening line from Supabase quotes column.”',
    quoteExcerpt: '“First quote excerpt from Supabase quotes column.”',
  },
  {
    chapterLabel: 'Passage II • Classic',
    openingLine: '“Second opening line from Supabase quotes column.”',
    quoteExcerpt: '“Second quote excerpt from Supabase quotes column.”',
  },
];

describe('useBookPassageShuffle', () => {
  beforeEach(() => {
    clearCachedBookPassages();
  });

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
          supabaseQuotes: mockSupabasePassages,
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
          supabaseQuotes: mockSupabasePassages,
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

  it('correctly sets isCuratedFeatured flag and prioritizes dynamic passages for non-featured books', async () => {
    const { result } = renderHook(
      () =>
        useBookPassageShuffle({
          id: 88888,
          title: 'Arbitrary Catalog Novel',
          authors: [{ name: 'Independent Writer' }],
          subjects: ['Literature'],
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isCuratedFeatured).toBe(false);

    // Initial state before query resolution shows the single bibliographic edition spread
    expect(result.current.currentPassage.chapterLabel).toContain('Volume Information');

    // Wait for useBookContent query to resolve from MSW
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Once rawBookText is resolved, dynamic passages take over Spread 1 (passages[0])
    expect(result.current.passages.length).toBeGreaterThan(0);
    expect(result.current.currentPassage.openingLine).toBeDefined();
    expect(result.current.currentPassage.chapterLabel).not.toContain('Volume Information');
  });

  it('automatically resets isTurningLeaf after 450ms safety timeout and normalizes string authors / id=0 fallback', () => {
    vi.useFakeTimers();
    const { result } = renderHook(
      () =>
        useBookPassageShuffle({
          id: 35,
          title: 'The Time Machine',
          authors: 'H. G. Wells',
          subjects: ['Science Fiction'],
          supabaseQuotes: mockSupabasePassages,
          enabled: false,
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.passages.length).toBeGreaterThanOrEqual(2);

    act(() => {
      result.current.shuffleNextPassage();
    });
    expect(result.current.isTurningLeaf).toBe(true);
    expect(result.current.activePassageIndex).toBe(1);

    act(() => {
      vi.advanceTimersByTime(460);
    });
    expect(result.current.isTurningLeaf).toBe(false);

    const { result: emptyResult } = renderHook(
      () =>
        useBookPassageShuffle({
          id: 0,
          title: '',
          authors: '',
          enabled: false,
        }),
      { wrapper: createWrapper() }
    );
    expect(emptyResult.current.passages).toEqual([]);
    expect(emptyResult.current.currentPassage.chapterLabel).toBe('Chapter I');

    const { result: arrayStringResult } = renderHook(
      () =>
        useBookPassageShuffle({
          id: 35,
          title: 'The Time Machine',
          authors: ['H. G. Wells'],
          supabaseQuotes: mockSupabasePassages,
          enabled: false,
        }),
      { wrapper: createWrapper() }
    );
    expect(arrayStringResult.current.passages.length).toBeGreaterThanOrEqual(2);

    // Prioritizes supabaseQuotes when provided and merges with dynamicPassages when > 1
    const contentSpy = vi.spyOn(useBookContentModule, 'useBookContent').mockReturnValue({
      data: 'CHAPTER I\n\nFirst dynamic paragraph of a very long classic work with authentic dialogue. "Dynamic quote one from chapter one."\n\nCHAPTER II\n\nSecond dynamic paragraph continuing the story with more dialogue. "Dynamic quote two from chapter two."',
      isLoading: false,
      isFetching: false,
      isError: false,
    } as unknown as ReturnType<typeof useBookContentModule.useBookContent>);

    const { result: supabasePriorityResult } = renderHook(
      () =>
        useBookPassageShuffle({
          id: 1342,
          title: 'Pride and Prejudice',
          supabaseQuotes: [
            {
              chapterLabel: 'Supabase Passage I',
              openingLine: 'Supabase opening line one',
              quoteExcerpt: 'Supabase quote excerpt one',
            },
          ],
          enabled: true,
        }),
      { wrapper: createWrapper() }
    );
    expect(supabasePriorityResult.current.passages[0].chapterLabel).toBe('Supabase Passage I');
    contentSpy.mockRestore();

    vi.useRealTimers();
  });

  it('persists dynamically extracted passages in 30-day localStorage LRU cache and serves them on subsequent opens without refetching', () => {
    expect(readCachedBookPassages(0)).toBeUndefined();
    writeCachedBookPassages(0, mockSupabasePassages);
    expect(readCachedBookPassages(0)).toBeUndefined();

    writeCachedBookPassages(77777, mockSupabasePassages);
    expect(readCachedBookPassages(77777)).toEqual(mockSupabasePassages);

    const contentSpy = vi.spyOn(useBookContentModule, 'useBookContent');
    const { result } = renderHook(
      () =>
        useBookPassageShuffle({
          id: 77777,
          title: 'Cached Catalog Book',
          authors: [{ name: 'Author Name' }],
          enabled: true,
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.passages).toEqual(mockSupabasePassages);
    // Because cachedPassages has >= 2 spreads, targetBookId is undefined so no network fetch is triggered
    expect(contentSpy).toHaveBeenCalledWith(undefined, undefined);
    contentSpy.mockRestore();

    // Verify 30-day TTL expiration and LRU 100-entry eviction
    window.localStorage.setItem(
      EXTRACTED_PASSAGES_CACHE_KEY,
      JSON.stringify({
        '77777': {
          updatedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
          passages: mockSupabasePassages,
        },
      })
    );
    expect(readCachedBookPassages(77777)).toBeUndefined();

    for (let id = 1; id <= 105; id++) {
      writeCachedBookPassages(id, mockSupabasePassages);
    }
    const rawCache = JSON.parse(
      window.localStorage.getItem(EXTRACTED_PASSAGES_CACHE_KEY) || '{}'
    ) as Record<string, unknown>;
    expect(Object.keys(rawCache).length).toBeLessThanOrEqual(100);
  });
});
