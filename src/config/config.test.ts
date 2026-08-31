import { describe, it, expect } from 'vitest';
import { API_ENDPOINTS } from './api-endpoints';
import {
  LITERARY_ERAS,
  SORT_OPTIONS,
  GENRE_FACETS,
  CATALOG_LANGUAGES,
  FORMAT_FILTERS,
} from './catalog-filters';
import { FEATURED_HERO_BOOK, FEATURED_HERO_BOOKS, getBookPassages } from './featured-books';
import { LITERARY_QUOTES } from './literary-quotes';
import { READER_THEMES } from './reader-themes';

describe('src/config configuration modules', () => {
  describe('API_ENDPOINTS', () => {
    it('defines valid non-empty endpoint URLs', () => {
      expect(API_ENDPOINTS.GUTENDEX_BASE_URL).toContain('gutendex.com');
      expect(API_ENDPOINTS.GUTENBERG_CACHE_BASE_URL).toContain('gutenberg.org');
      expect(API_ENDPOINTS.GUTENBERG_FILES_BASE_URL).toContain('gutenberg.org');
      expect(API_ENDPOINTS.INTERNAL_API_BOOKS).toBe('/api/books');
      expect(API_ENDPOINTS.INTERNAL_API_CONTENT).toBe('/api/books/content');
    });
  });

  describe('catalog-filters', () => {
    it('provides literary eras with valid date boundaries', () => {
      expect(LITERARY_ERAS.length).toBeGreaterThan(0);
      expect(LITERARY_ERAS.some((e) => e.label.includes('All'))).toBe(true);
    });

    it('provides genre facets with valid IDs and labels', () => {
      expect(GENRE_FACETS.length).toBeGreaterThan(0);
      expect(GENRE_FACETS[0].label).toBe('All Subjects');
    });

    it('provides language mappings with ISO-639 codes', () => {
      expect(CATALOG_LANGUAGES.length).toBeGreaterThan(0);
      expect(CATALOG_LANGUAGES.some((l) => l.value === 'en')).toBe(true);
    });

    it('provides valid sort and format options', () => {
      expect(SORT_OPTIONS.length).toBeGreaterThanOrEqual(3);
      expect(FORMAT_FILTERS.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('featured-books', () => {
    it('provides valid hero book spotlight and collection of classics', () => {
      expect(FEATURED_HERO_BOOK.title).toBe('Pride and Prejudice');
      expect(FEATURED_HERO_BOOK.author).toBe('Jane Austen');
      expect(FEATURED_HERO_BOOK.license).toContain('Public Domain');
      expect(FEATURED_HERO_BOOK.openingLine).toBeDefined();
      expect(FEATURED_HERO_BOOK.openingLine.length).toBeGreaterThan(10);

      expect(FEATURED_HERO_BOOKS.length).toBeGreaterThanOrEqual(10);
      expect(FEATURED_HERO_BOOKS.every((b) => b.openingLine && b.openingLine.length > 5)).toBe(true);
      expect(FEATURED_HERO_BOOKS.some((b) => b.title === 'Frankenstein')).toBe(true);
      expect(FEATURED_HERO_BOOKS.some((b) => b.title === 'Moby Dick')).toBe(true);
      expect(FEATURED_HERO_BOOKS.some((b) => b.title === 'The Great Gatsby')).toBe(true);
    });

    it('extracts passages for featured and generic books via getBookPassages', () => {
      const testBookIds = [1342, 84, 2701, 64317, 11, 174, 1661, 345, 98, 35, 9999];
      for (const id of testBookIds) {
        const passages = getBookPassages({
          id,
          title: `Book ${id}`,
          authors: [{ name: 'Test Author' }],
          subjects: ['Literature'],
        });
        expect(passages.length).toBeGreaterThanOrEqual(1);
        expect(passages[0].openingLine).toBeDefined();
        expect(passages[0].quoteExcerpt).toBeDefined();
      }

      const genericPassages = getBookPassages({
        id: 99999,
        title: 'Unknown Volume',
        authors: [{ name: 'Unknown Author' }],
        subjects: ['Philosophy'],
      });
      expect(genericPassages.length).toBe(3);
      expect(genericPassages[0].openingLine).toContain('Unknown Volume');
    });
  });

  describe('literary-quotes', () => {
    it('provides 12 curated quotes with non-empty metadata', () => {
      expect(LITERARY_QUOTES.length).toBe(12);
      for (const q of LITERARY_QUOTES) {
        expect(q.id).toBeGreaterThan(0);
        expect(q.bookId).toBeGreaterThan(0);
        expect(q.bookTitle.length).toBeGreaterThan(0);
        expect(q.author.length).toBeGreaterThan(0);
        expect(q.quote.length).toBeGreaterThan(10);
        expect(q.citation.length).toBeGreaterThan(0);
      }
    });
  });

  describe('reader-themes', () => {
    it('provides complete theme configs for light, sepia, and dark', () => {
      expect(READER_THEMES.light.surface).toContain('bg-[#fcfbf9]');
      expect(READER_THEMES.sepia.surface).toContain('bg-[#2b1d16]');
      expect(READER_THEMES.dark.surface).toContain('bg-[#0e1117]');
      expect(READER_THEMES.sepia.header).toContain('bg-[#332219]');
      expect(READER_THEMES.dark.header).toContain('bg-[#161b26]');
    });
  });
});

