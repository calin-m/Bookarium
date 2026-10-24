import { describe, it, expect } from 'vitest';
import {
  FEATURED_HERO_BOOKS,
  FEATURED_HERO_BOOK,
  getBookPassages,
  getJurisdictionSafeFeaturedBooks,
  getHourlyHeroBook,
  getDailyEditorialBook,
} from './featured-books';

describe('featured-books configuration & passage selectors', () => {
  it('exports a curated list of featured hero books with Pride and Prejudice as primary default', () => {
    expect(FEATURED_HERO_BOOKS.length).toBeGreaterThanOrEqual(20);
    expect(FEATURED_HERO_BOOK.id).toBe(1342);
    expect(FEATURED_HERO_BOOK.title).toBe('Pride and Prejudice');
  });

  describe('getBookPassages', () => {
    it('returns curated multi-chapter passages for each specially mapped featured book ID', () => {
      const specialIds = [1342, 84, 2701, 64317, 11, 174, 1661, 345, 98, 35];
      for (const id of specialIds) {
        const passages = getBookPassages({ id, title: 'Lookup by ID' });
        expect(passages.length).toBeGreaterThanOrEqual(1);
        expect(passages[0].openingLine.length).toBeGreaterThan(20);
        expect(passages[0].quoteExcerpt.length).toBeGreaterThan(10);
      }
    });

    it('returns 3-act featured passages for other featured books matched by ID or case-insensitive title', () => {
      const byId = getBookPassages({ id: 2600, title: 'War and Peace' });
      expect(byId).toHaveLength(3);
      expect(byId[0].chapterLabel).toContain('The Opening Incipit');
      expect(byId[0].secondaryQuote).toContain('Leo Tolstoy');

      const byTitle = getBookPassages({ id: 999991, title: 'the metamorphosis' });
      expect(byTitle).toHaveLength(3);
      expect(byTitle[0].secondaryQuote).toContain('Franz Kafka');
    });

    it('synthesizes 3-act fallback passages for non-featured catalog books with or without authors/subjects', () => {
      const withMetadata = getBookPassages({
        id: 77777,
        title: 'Treatise on Astronomy',
        authors: [{ name: 'Galileo Galilei' }],
        subjects: ['Astronomy -- Early works to 1800'],
      });
      expect(withMetadata).toHaveLength(3);
      expect(withMetadata[0].openingLine).toContain('Treatise on Astronomy');
      expect(withMetadata[0].openingLine).toContain('Galileo Galilei');
      expect(withMetadata[0].commentary).toContain('#77777');

      const withoutMetadata = getBookPassages({
        id: 88888,
        title: 'Anonymous Chronicle',
      });
      expect(withoutMetadata).toHaveLength(3);
      expect(withoutMetadata[0].openingLine).toContain('the author');
    });
  });

  describe('getJurisdictionSafeFeaturedBooks', () => {
    it('allows all featured books in the US public domain', () => {
      const usBooks = getJurisdictionSafeFeaturedBooks('US');
      expect(usBooks.length).toBe(FEATURED_HERO_BOOKS.length);
    });

    it('filters out Life+100 restricted authors or translators in Mexico (MX)', () => {
      const mxBooks = getJurisdictionSafeFeaturedBooks('MX');
      expect(mxBooks.length).toBeLessThan(FEATURED_HERO_BOOKS.length);
      // F. Scott Fitzgerald (d. 1940) and H. G. Wells (d. 1946) are within Life+100
      expect(mxBooks.some((b) => b.id === 64317)).toBe(false);
      expect(mxBooks.some((b) => b.id === 35)).toBe(false);
      // Jane Austen (d. 1817) remains public domain everywhere
      expect(mxBooks.some((b) => b.id === 1342)).toBe(true);
    });
  });

  describe('getHourlyHeroBook & getDailyEditorialBook', () => {
    it('deterministically rotates the hourly hero book every 3,600,000 ms', () => {
      const t0 = 0;
      const t1 = 3600 * 1000;
      const first = getHourlyHeroBook(t0, 'US');
      const second = getHourlyHeroBook(t1, 'US');
      expect(first.id).toBe(FEATURED_HERO_BOOKS[0].id);
      expect(second.id).toBe(FEATURED_HERO_BOOKS[1].id);
    });

    it('advances getDailyEditorialBook to the next candidate when it collides with heroBookId', () => {
      const timestamp = 0; // dayIndex = 0 -> candidateIndex = 0 (id: 1342)
      const nonColliding = getDailyEditorialBook(84, timestamp, 'US');
      expect(nonColliding.id).toBe(FEATURED_HERO_BOOKS[0].id);

      const colliding = getDailyEditorialBook(FEATURED_HERO_BOOKS[0].id, timestamp, 'US');
      expect(colliding.id).toBe(FEATURED_HERO_BOOKS[1].id);
    });
  });
});

