import { describe, it, expect } from 'vitest';
import { API_ENDPOINTS } from './api-endpoints';
import {
  LITERARY_ERAS,
  SORT_OPTIONS,
  GENRE_FACETS,
  HERO_POPULAR_TOPICS,
  EXTENDED_LANGUAGES,
  HERO_LANGUAGES,
  FORMAT_FILTERS,
} from './catalog-filters';
import { FEATURED_HERO_BOOK } from './featured-books';
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
      expect(LITERARY_ERAS.length).toBeGreaterThanOrEqual(6);
      const antiquity = LITERARY_ERAS.find((e) => e.id === 'antiquity');
      expect(antiquity?.start).toBe(-800);
      expect(antiquity?.end).toBe(500);
    });

    it('provides genre facets with valid IDs and labels', () => {
      expect(GENRE_FACETS.length).toBeGreaterThanOrEqual(8);
      expect(HERO_POPULAR_TOPICS.length).toBeGreaterThanOrEqual(6);
    });

    it('provides language mappings with ISO-639 codes', () => {
      expect(EXTENDED_LANGUAGES.some((l) => l.value === 'en')).toBe(true);
      expect(EXTENDED_LANGUAGES.some((l) => l.value === 'la')).toBe(true);
      expect(HERO_LANGUAGES.some((l) => l.value === 'fr')).toBe(true);
    });

    it('provides valid sort and format options', () => {
      expect(SORT_OPTIONS.some((s) => s.value === 'popular')).toBe(true);
      expect(FORMAT_FILTERS.some((f) => f.value.includes('epub'))).toBe(true);
    });
  });

  describe('featured-books', () => {
    it('provides valid hero book spotlight', () => {
      expect(FEATURED_HERO_BOOK.id).toBe(1342);
      expect(FEATURED_HERO_BOOK.title).toBe('Pride and Prejudice');
      expect(FEATURED_HERO_BOOK.author).toBe('Jane Austen');
      expect(FEATURED_HERO_BOOK.license).toContain('Public Domain');
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
      expect(READER_THEMES.sepia.surface).toContain('bg-[#f4ebd9]');
      expect(READER_THEMES.dark.surface).toContain('bg-[#0e1117]');
      expect(READER_THEMES.sepia.header).toContain('bg-[#ede2cc]');
      expect(READER_THEMES.dark.header).toContain('bg-[#161b26]');
    });
  });
});

