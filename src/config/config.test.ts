import { describe, it, expect } from 'vitest';
import { API_ENDPOINTS } from './api-endpoints';
import {
  LITERARY_ERAS,
  SORT_OPTIONS,
  GENRE_FACETS,
  CATALOG_LANGUAGES,
  FORMAT_FILTERS,
} from './catalog-filters';
import {
  FEATURED_HERO_BOOK,
  FEATURED_HERO_BOOKS,
  getBookPassages,
  getHourlyHeroBook,
  getDailyEditorialBook,
  getJurisdictionSafeFeaturedBooks,
} from './featured-books';
import { LITERARY_QUOTES } from './literary-quotes';
import { READER_THEMES, getReaderTheme } from './reader-themes';

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

    it('getHourlyHeroBook returns deterministic book based on hourly index', () => {
      const hourMs = 3600000;
      const bookHour0 = getHourlyHeroBook(0);
      const bookHour1 = getHourlyHeroBook(1 * hourMs);
      const bookHour10 = getHourlyHeroBook(10 * hourMs);

      expect(bookHour0).toBe(FEATURED_HERO_BOOKS[0]);
      expect(bookHour1).toBe(FEATURED_HERO_BOOKS[1]);
      expect(bookHour10).toBe(FEATURED_HERO_BOOKS[0]);
      expect(getHourlyHeroBook()).toBeDefined();
    });

    it('getDailyEditorialBook rotates daily and avoids collision with heroBookId', () => {
      const dayMs = 86400000;
      const day0 = getDailyEditorialBook(undefined, 0);
      const day1 = getDailyEditorialBook(undefined, 1 * dayMs);
      const day10 = getDailyEditorialBook(undefined, 10 * dayMs);

      expect(day0).toBe(FEATURED_HERO_BOOKS[0]);
      expect(day1).toBe(FEATURED_HERO_BOOKS[1]);
      expect(day10).toBe(FEATURED_HERO_BOOKS[0]);

      // When collision occurs with heroBookId, advance to subsequent book
      const collidingHeroId = FEATURED_HERO_BOOKS[0].id;
      const avoidedDay0 = getDailyEditorialBook(collidingHeroId, 0);
      expect(avoidedDay0).toBe(FEATURED_HERO_BOOKS[1]);
      expect(avoidedDay0.id).not.toBe(collidingHeroId);

      // When no collision, returns standard candidate
      const nonCollidingHeroId = 999999;
      const standardDay0 = getDailyEditorialBook(nonCollidingHeroId, 0);
      expect(standardDay0).toBe(FEATURED_HERO_BOOKS[0]);

      // When candidate is last element (index 9) and collides, wraps to index 0
      const day9CandidateId = FEATURED_HERO_BOOKS[9].id;
      const wrappedDay9 = getDailyEditorialBook(day9CandidateId, 9 * dayMs);
      expect(wrappedDay9).toBe(FEATURED_HERO_BOOKS[0]);

      // Default timestamp works
      expect(getDailyEditorialBook()).toBeDefined();
    });

    it('filters out titles protected in Life + 100 countries (Mexico)', () => {
      const mxBooks = getJurisdictionSafeFeaturedBooks('MX');
      expect(mxBooks.some((b) => b.title === 'The Great Gatsby')).toBe(false);
      expect(mxBooks.some((b) => b.title === 'The Adventures of Sherlock Holmes')).toBe(false);
      expect(mxBooks.some((b) => b.title === 'Pride and Prejudice')).toBe(true);
      expect(mxBooks.some((b) => b.title === 'Frankenstein')).toBe(true);
    });

    it('includes all featured books for US jurisdiction', () => {
      const usBooks = getJurisdictionSafeFeaturedBooks('US');
      expect(usBooks.length).toBe(FEATURED_HERO_BOOKS.length);
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
      expect(READER_THEMES.light.header).toContain('shadow-sm');
      expect(READER_THEMES.sepia.header).toContain('bg-[#332219]');
      expect(READER_THEMES.sepia.header).toContain('shadow-sm');
      expect(READER_THEMES.dark.header).toContain('bg-[#161b26]');
      expect(READER_THEMES.dark.header).toContain('shadow-sm');
    });

    it('getReaderTheme returns exact theme or falls back to light', () => {
      expect(getReaderTheme('sepia')).toEqual(READER_THEMES.sepia);
      expect(getReaderTheme('dark')).toEqual(READER_THEMES.dark);
      expect(getReaderTheme('light')).toEqual(READER_THEMES.light);
      expect(getReaderTheme(undefined)).toEqual(READER_THEMES.light);
      expect(getReaderTheme(null)).toEqual(READER_THEMES.light);
      expect(getReaderTheme('invalid' as any)).toEqual(READER_THEMES.light);
    });
  });
});

