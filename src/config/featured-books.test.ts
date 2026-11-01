import { describe, it, expect } from 'vitest';
import {
  FEATURED_HERO_BOOKS,
  FEATURED_HERO_BOOK,
  getBookPassages,
  hasCuratedBookPassages,
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

  describe('hasCuratedBookPassages', () => {
    it('identifies curated featured classic volumes by id or case-insensitive title', () => {
      expect(hasCuratedBookPassages(1342)).toBe(true);
      expect(hasCuratedBookPassages(2600)).toBe(true);
      expect(hasCuratedBookPassages(99999, 'the metamorphosis')).toBe(true);
      expect(hasCuratedBookPassages(77777, 'Treatise on Astronomy')).toBe(false);
      expect(hasCuratedBookPassages(0)).toBe(false);
    });
  });

  describe('getBookPassages', () => {
    it('prioritizes multi-spread passages from book.quotes when present on the volume', () => {
      const enrichedPassages = [
        {
          chapterLabel: 'Passage I • Pride and Prejudice',
          openingLine: '“It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.”',
          quoteExcerpt: '“I declare after all there is no enjoyment like reading!”',
          secondaryQuote: '— Jane Austen, Pride and Prejudice',
        },
        {
          chapterLabel: 'Passage II • Pride and Prejudice',
          openingLine: '“She is tolerable; but not handsome enough to tempt me; and I am in no humour at present to give consequence to young ladies.”',
          quoteExcerpt: '“You must allow me to tell you how ardently I admire and love you.”',
          secondaryQuote: '— Jane Austen, Pride and Prejudice',
        },
      ];
      const passages = getBookPassages({
        id: 1342,
        title: 'Pride and Prejudice',
        quotes: enrichedPassages,
      });
      expect(passages).toEqual(enrichedPassages);
      expect(passages).toHaveLength(2);
    });

    it('returns the canonical 1-spread static fallback for featured books when Supabase quotes are not yet loaded', () => {
      const specialIds = [1342, 84, 2701, 64317, 11, 174, 1661, 345, 98, 35];
      for (const id of specialIds) {
        const passages = getBookPassages({ id, title: 'Lookup by ID' });
        expect(passages).toHaveLength(1);
        expect(passages[0].openingLine.length).toBeGreaterThan(20);
        expect(passages[0].quoteExcerpt.length).toBeGreaterThan(10);
      }

      const byId = getBookPassages({ id: 2600, title: 'War and Peace' });
      expect(byId).toHaveLength(1);
      expect(byId[0].chapterLabel).toContain('The Opening Incipit');
      expect(byId[0].secondaryQuote).toContain('Leo Tolstoy');
      expect(byId[0].quoteExcerpt).toBeDefined();

      const byTitle = getBookPassages({ id: 999991, title: 'the metamorphosis' });
      expect(byTitle).toHaveLength(1);
      expect(byTitle[0].secondaryQuote).toContain('Franz Kafka');
    });

    it('synthesizes truthful bibliographic edition spread for non-featured catalog books without generic other-author quotes', () => {
      const withMetadata = getBookPassages({
        id: 77777,
        title: 'Treatise on Astronomy',
        authors: [{ name: 'Galileo Galilei' }],
        subjects: ['Astronomy -- Early works to 1800'],
      });
      expect(withMetadata).toHaveLength(1);
      expect(withMetadata[0].chapterLabel).toContain('Volume Information');
      expect(withMetadata[0].openingLine).toContain('Treatise on Astronomy');
      expect(withMetadata[0].secondaryQuote).toContain('Galileo Galilei');
      expect(withMetadata[0].commentary).toContain('#77777');
      expect(withMetadata[0].quoteExcerpt).toContain('Extracting authentic passages');

      const withoutMetadata = getBookPassages({
        id: 88888,
        title: 'Anonymous Chronicle',
      });
      expect(withoutMetadata).toHaveLength(1);
      expect(withoutMetadata[0].openingLine).toContain('Anonymous Chronicle');
      expect(withoutMetadata[0].secondaryQuote).toBeUndefined();
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

