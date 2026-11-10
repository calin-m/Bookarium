import { describe, it, expect } from 'vitest';
import {
  sortBooks,
  mergeDownloadedShelfBooks,
  resolveBookshelfViewState,
  filterCustomShelfBooks,
  BOOKSHELF_SORT_OPTIONS,
  FAVORITES_SORT_OPTIONS,
  BOOKSHELF_BASE_SORT_OPTIONS,
  FAVORITES_BASE_SORT_OPTIONS,
  resolveBookSortKey,
  decomposeBookSortKey,
} from './book-sorting';
import type { GutendexBook } from '@/types/book.types';

const mockBookA: GutendexBook = {
  id: 1,
  title: 'The Project Gutenberg eBook of Alice in Wonderland',
  authors: [{ name: 'Carroll, Lewis', birth_year: 1832, death_year: 1898 }],
  translators: [],
  subjects: ['Fantasy'],
  bookshelves: [],
  languages: ['en'],
  copyright: false,
  media_type: 'Text',
  formats: {},
  download_count: 5000,
};

const mockBookB: GutendexBook = {
  id: 2,
  title: 'Moby Dick; Or, The Whale',
  authors: [{ name: 'Melville, Herman', birth_year: 1819, death_year: 1891 }],
  translators: [],
  subjects: ['Sea stories'],
  bookshelves: [],
  languages: ['en'],
  copyright: false,
  media_type: 'Text',
  formats: {},
  download_count: 20000,
};

const mockBookC: GutendexBook = {
  id: 3,
  title: 'Frankenstein; Or, The Modern Prometheus',
  authors: [{ name: 'Shelley, Mary Wollstonecraft', birth_year: 1797, death_year: 1851 }],
  translators: [],
  subjects: ['Gothic'],
  bookshelves: [],
  languages: ['en'],
  copyright: false,
  media_type: 'Text',
  formats: {},
  download_count: 12000,
};

const mockBookWithoutAuthor: GutendexBook = {
  id: 4,
  title: 'Anonymous Ancient Folktales',
  authors: [],
  translators: [],
  subjects: ['Folklore'],
  bookshelves: [],
  languages: ['en'],
  copyright: false,
  media_type: 'Text',
  formats: {},
  download_count: 100,
};

describe('book-sorting utility', () => {
  it('exposes defined sort option lists for Bookshelf and Favorites', () => {
    expect(BOOKSHELF_SORT_OPTIONS.length).toBeGreaterThan(0);
    expect(FAVORITES_SORT_OPTIONS.length).toBeGreaterThan(0);
    expect(BOOKSHELF_SORT_OPTIONS.some((o) => o.value === 'recent')).toBe(true);
    expect(BOOKSHELF_SORT_OPTIONS.some((o) => o.value === 'downloaded')).toBe(true);
    expect(FAVORITES_SORT_OPTIONS.some((o) => o.value === 'downloads_desc')).toBe(true);
    expect(FAVORITES_SORT_OPTIONS.some((o) => o.value === 'downloaded')).toBe(true);
  });

  it('handles empty arrays, undefined inputs, and single-item arrays safely', () => {
    expect(sortBooks(undefined as unknown as GutendexBook[], 'title_asc')).toEqual([]);
    expect(sortBooks([], 'title_asc')).toEqual([]);
    expect(sortBooks([mockBookA], 'title_asc')).toEqual([mockBookA]);
  });

  it('handles undefined authors, undefined readingProgress, and missing download_count', () => {
    const bookNoFieldsA = { ...mockBookA, id: 10, authors: undefined as any, download_count: undefined as any };
    const bookNoFieldsB = { ...mockBookB, id: 20, authors: undefined as any, download_count: undefined as any };
    expect(sortBooks([bookNoFieldsA, bookNoFieldsB], 'author_asc')).toHaveLength(2);
    expect(sortBooks([bookNoFieldsA, bookNoFieldsB], 'author_desc')).toHaveLength(2);
    expect(sortBooks([bookNoFieldsA, bookNoFieldsB], 'progress_desc')).toHaveLength(2);
    expect(sortBooks([bookNoFieldsA, bookNoFieldsB], 'progress_asc')).toHaveLength(2);
    expect(sortBooks([bookNoFieldsA, bookNoFieldsB], 'downloads_desc')).toHaveLength(2);
  });

  it('does not mutate the original array (immutability check)', () => {
    const original = [mockBookB, mockBookA];
    const sorted = sortBooks(original, 'title_asc');
    expect(original[0].id).toBe(2);
    expect(sorted[0].id).toBe(1);
    expect(sorted).not.toBe(original);
  });

  it('sorts alphabetically by title ascending and descending (cleans preamble)', () => {
    // Cleaned titles:
    // mockBookA: "Alice in Wonderland"
    // mockBookC: "Frankenstein; Or, The Modern Prometheus"
    // mockBookB: "Moby Dick; Or, The Whale"
    const books = [mockBookB, mockBookA, mockBookC];

    const asc = sortBooks(books, 'title_asc');
    expect(asc.map((b) => b.id)).toEqual([1, 3, 2]); // Alice, Frankenstein, Moby Dick

    const desc = sortBooks(books, 'title_desc');
    expect(desc.map((b) => b.id)).toEqual([2, 3, 1]); // Moby Dick, Frankenstein, Alice
  });

  it('sorts alphabetically by author ascending and descending', () => {
    // Formatted natural author names:
    // mockBookWithoutAuthor: ""
    // mockBookB: "Herman Melville"
    // mockBookA: "Lewis Carroll"
    // mockBookC: "Mary Wollstonecraft Shelley"
    const books = [mockBookC, mockBookA, mockBookB, mockBookWithoutAuthor];

    const asc = sortBooks(books, 'author_asc');
    expect(asc[0].id).toBe(4); // empty author first
    expect(asc[1].id).toBe(2); // Herman Melville
    expect(asc[2].id).toBe(1); // Lewis Carroll
    expect(asc[3].id).toBe(3); // Mary Wollstonecraft Shelley

    const desc = sortBooks(books, 'author_desc');
    expect(desc[0].id).toBe(3); // Mary Wollstonecraft Shelley
    expect(desc[1].id).toBe(1); // Lewis Carroll
    expect(desc[2].id).toBe(2); // Herman Melville
    expect(desc[3].id).toBe(4); // empty author last
  });

  it('sorts by reading progress percentage descending and ascending', () => {
    const readingProgress: Record<number, number> = {
      1: 25,
      2: 90,
      3: 0,
    };
    const books = [mockBookA, mockBookB, mockBookC];

    const desc = sortBooks(books, 'progress_desc', readingProgress);
    expect(desc.map((b) => b.id)).toEqual([2, 1, 3]); // 90%, 25%, 0%

    const asc = sortBooks(books, 'progress_asc', readingProgress);
    expect(asc.map((b) => b.id)).toEqual([3, 1, 2]); // 0%, 25%, 90%
  });

  it('sorts by download count (popularity) descending', () => {
    const books = [mockBookA, mockBookB, mockBookC]; // 5000, 20000, 12000
    const sorted = sortBooks(books, 'downloads_desc');
    expect(sorted.map((b) => b.id)).toEqual([2, 3, 1]); // 20000, 12000, 5000
  });

  it('preserves order when sortBy is "recent", "downloaded", or unrecognized', () => {
    const books = [mockBookB, mockBookA, mockBookC];
    const recent = sortBooks(books, 'recent');
    expect(recent.map((b) => b.id)).toEqual([2, 1, 3]);

    const downloaded = sortBooks(books, 'downloaded');
    expect(downloaded.map((b) => b.id)).toEqual([2, 1, 3]);

    const fallback = sortBooks(books, 'unknown_key');
    expect(fallback.map((b) => b.id)).toEqual([2, 1, 3]);
  });

  it('merges and deduplicates downloaded shelf books across savedBooks and offlineBooks', () => {
    const isBookOffline = (id: number) => id === 1 || id === 3;
    const merged = mergeDownloadedShelfBooks(
      [mockBookA, mockBookB],
      [mockBookA, mockBookC],
      isBookOffline
    );
    expect(merged.map((b) => b.id)).toEqual([1, 3]);
  });

  it('resolves bookshelf view state across default, downloaded, and custom shelves', () => {
    const shelves = [
      { id: 'shelf-general', name: 'General', is_default: true },
      { id: 'shelf-gothic', name: 'Gothic', is_default: false },
    ];

    const defaultState = resolveBookshelfViewState({
      cloudBookshelves: shelves,
      activeBookshelfId: null,
      downloadedShelfId: '__downloaded__',
    });
    expect(defaultState.defaultShelf?.id).toBe('shelf-general');
    expect(defaultState.currentActiveShelfId).toBe('shelf-general');
    expect(defaultState.isViewingGeneral).toBe(true);
    expect(defaultState.isViewingDownloaded).toBe(false);

    const downloadedState = resolveBookshelfViewState({
      cloudBookshelves: shelves,
      activeBookshelfId: '__downloaded__',
      downloadedShelfId: '__downloaded__',
    });
    expect(downloadedState.isViewingDownloaded).toBe(true);
    expect(downloadedState.isViewingGeneral).toBe(false);
    expect(downloadedState.activeShelf?.id).toBe('shelf-general');

    const customState = resolveBookshelfViewState({
      cloudBookshelves: shelves,
      activeBookshelfId: 'shelf-gothic',
      downloadedShelfId: '__downloaded__',
    });
    expect(customState.isViewingDownloaded).toBe(false);
    expect(customState.isViewingGeneral).toBe(false);
    expect(customState.activeShelf?.id).toBe('shelf-gothic');

    const filtered = filterCustomShelfBooks(
      [mockBookA, mockBookB, mockBookC],
      [
        { bookshelf_id: 'shelf-gothic', book_id: 3 },
        { bookshelf_id: 'shelf-general', book_id: 1 },
      ],
      'shelf-gothic'
    );
    expect(filtered.map((b) => b.id)).toEqual([3]);
  });

  describe('base sort options and key resolution/decomposition', () => {
    it('exposes de-duplicated base sort options without dual directional options', () => {
      expect(BOOKSHELF_BASE_SORT_OPTIONS.map((o) => o.value)).toEqual([
        'recent',
        'title',
        'author',
        'progress',
        'downloaded',
      ]);
      expect(FAVORITES_BASE_SORT_OPTIONS.map((o) => o.value)).toEqual([
        'recent',
        'title',
        'author',
        'popularity',
        'downloaded',
      ]);
    });

    it('resolves composite sort keys from base fields and directions correctly', () => {
      expect(resolveBookSortKey('title', 'asc')).toBe('title_asc');
      expect(resolveBookSortKey('title', 'desc')).toBe('title_desc');
      expect(resolveBookSortKey('author', 'asc')).toBe('author_asc');
      expect(resolveBookSortKey('author', 'desc')).toBe('author_desc');
      expect(resolveBookSortKey('progress', 'asc')).toBe('progress_asc');
      expect(resolveBookSortKey('progress', 'desc')).toBe('progress_desc');
      expect(resolveBookSortKey('popularity', 'asc')).toBe('downloads_asc');
      expect(resolveBookSortKey('popularity', 'desc')).toBe('downloads_desc');
      expect(resolveBookSortKey('downloaded', 'asc')).toBe('downloaded');
      expect(resolveBookSortKey('recent', 'asc')).toBe('recent_asc');
      expect(resolveBookSortKey('recent', 'desc')).toBe('recent');
    });

    it('decomposes composite sort keys into base fields, directions, and disabled states correctly', () => {
      expect(decomposeBookSortKey('recent')).toEqual({
        baseField: 'recent',
        direction: 'desc',
        isDirectionDisabled: false,
      });
      expect(decomposeBookSortKey('recent_asc')).toEqual({
        baseField: 'recent',
        direction: 'asc',
        isDirectionDisabled: false,
      });
      expect(decomposeBookSortKey('downloaded')).toEqual({
        baseField: 'downloaded',
        direction: 'desc',
        isDirectionDisabled: true,
      });
      expect(decomposeBookSortKey('downloads_desc')).toEqual({
        baseField: 'popularity',
        direction: 'desc',
        isDirectionDisabled: false,
      });
      expect(decomposeBookSortKey('downloads_asc')).toEqual({
        baseField: 'popularity',
        direction: 'asc',
        isDirectionDisabled: false,
      });
      expect(decomposeBookSortKey('title_asc')).toEqual({
        baseField: 'title',
        direction: 'asc',
        isDirectionDisabled: false,
      });
      expect(decomposeBookSortKey('title_desc')).toEqual({
        baseField: 'title',
        direction: 'desc',
        isDirectionDisabled: false,
      });
      expect(decomposeBookSortKey('author_asc')).toEqual({
        baseField: 'author',
        direction: 'asc',
        isDirectionDisabled: false,
      });
      expect(decomposeBookSortKey('author_desc')).toEqual({
        baseField: 'author',
        direction: 'desc',
        isDirectionDisabled: false,
      });
      expect(decomposeBookSortKey('progress_asc')).toEqual({
        baseField: 'progress',
        direction: 'asc',
        isDirectionDisabled: false,
      });
      expect(decomposeBookSortKey('progress_desc')).toEqual({
        baseField: 'progress',
        direction: 'desc',
        isDirectionDisabled: false,
      });
      expect(decomposeBookSortKey('unknown_key')).toEqual({
        baseField: 'recent',
        direction: 'desc',
        isDirectionDisabled: false,
      });
    });

    it('sorts by date added ascending (reversal) and popularity ascending', () => {
      const books = [mockBookA, mockBookB, mockBookC];
      const reversed = sortBooks(books, 'recent_asc');
      expect(reversed.map((b) => b.id)).toEqual([3, 2, 1]);

      const leastDownloaded = sortBooks(books, 'downloads_asc');
      expect(leastDownloaded.map((b) => b.id)).toEqual([1, 3, 2]); // 5000, 12000, 20000
    });
  });
});


