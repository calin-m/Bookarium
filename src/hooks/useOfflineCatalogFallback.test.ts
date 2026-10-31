import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useOfflineCatalogFallback } from './useOfflineCatalogFallback';
import type { GutendexBook } from '@/types/book.types';

describe('useOfflineCatalogFallback', () => {
  const sampleBooks: GutendexBook[] = [
    {
      id: 1342,
      title: 'Pride and Prejudice',
      authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
      translators: [],
      subjects: ['Domestic fiction', 'Courtship'],
      bookshelves: ['Best Books Ever Listings'],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 50000,
    },
    {
      id: 2701,
      title: 'Moby-Dick; or, The Whale',
      authors: [{ name: 'Melville, Herman', birth_year: 1819, death_year: 1891 }],
      translators: [],
      subjects: ['Whaling', 'Sea stories'],
      bookshelves: ['Adventure'],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 35000,
    },
  ];

  it('returns empty results when online and filters/sorts/paginates downloaded books when offline', () => {
    const { result: onlineResult } = renderHook(() =>
      useOfflineCatalogFallback({
        isOffline: false,
        resolvedOfflineBooks: sampleBooks,
        search: '',
        topic: '',
        language: '',
        sort: 'popular',
        page: 1,
        pageSize: 8,
      })
    );
    expect(onlineResult.current.filteredOfflineCatalogBooks).toHaveLength(0);

    const { result: offlineFiltered } = renderHook(() =>
      useOfflineCatalogFallback({
        isOffline: true,
        resolvedOfflineBooks: sampleBooks,
        search: '',
        topic: 'Whaling',
        language: 'en',
        authorYearStart: 1800,
        authorYearEnd: 1900,
        sort: 'ascending',
        page: 1,
        pageSize: 1,
      })
    );
    expect(offlineFiltered.current.filteredOfflineCatalogBooks).toHaveLength(1);
    expect(offlineFiltered.current.paginatedOfflineCatalogBooks[0].id).toBe(2701);
    expect(offlineFiltered.current.hasNextOfflinePage).toBe(false);
  });
});

