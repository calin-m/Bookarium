import { describe, it, expect } from 'vitest';
import {
  sortBooks,
  BOOKSHELF_SORT_OPTIONS,
  FAVORITES_SORT_OPTIONS,
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
    expect(FAVORITES_SORT_OPTIONS.some((o) => o.value === 'downloads_desc')).toBe(true);
  });

  it('handles empty arrays, undefined inputs, and single-item arrays safely', () => {
    expect(sortBooks([], 'title_asc')).toEqual([]);
    expect(sortBooks([mockBookA], 'title_asc')).toEqual([mockBookA]);
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

  it('preserves order when sortBy is "recent" or unrecognized', () => {
    const books = [mockBookB, mockBookA, mockBookC];
    const recent = sortBooks(books, 'recent');
    expect(recent.map((b) => b.id)).toEqual([2, 1, 3]);

    const fallback = sortBooks(books, 'unknown_key');
    expect(fallback.map((b) => b.id)).toEqual([2, 1, 3]);
  });
});

