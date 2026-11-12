import { describe, it, expect } from 'vitest';
import type { GutendexBook } from '@/types/book.types';
import {
  FEATURED_HERO_BOOKS,
  FEATURED_HERO_BOOK,
  getBookPassages,
  hasCuratedBookPassages,
  getJurisdictionSafeFeaturedBooks,
  getHourlyHeroBook,
  getDailyEditorialBook,
  isClassicCatalogBook,
  gutendexBookToFeaturedHeroBook,
  selectHourlyHeroFromPool,
  selectDailyClassicFromPool,
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

    it('filters out Life+70 and Life+100 restricted authors or translators in Romania (RO) and Mexico (MX)', () => {
      const roBooks = getJurisdictionSafeFeaturedBooks('RO');
      // The Metamorphosis (ID 5200) and The Art of War (ID 132, Lionel Giles d. 1958) are blocked in Life+70
      expect(roBooks.some((b) => b.id === 5200)).toBe(false);
      expect(roBooks.some((b) => b.id === 132)).toBe(false);
      expect(roBooks.some((b) => b.title === 'War and Peace')).toBe(true);
      expect(roBooks.some((b) => b.title === 'Pride and Prejudice')).toBe(true);

      const mxBooks = getJurisdictionSafeFeaturedBooks('MX');
      expect(mxBooks.length).toBeLessThan(FEATURED_HERO_BOOKS.length);
      // F. Scott Fitzgerald (d. 1940) and H. G. Wells (d. 1946) are within Life+100
      expect(mxBooks.some((b) => b.id === 64317)).toBe(false);
      expect(mxBooks.some((b) => b.id === 35)).toBe(false);
      expect(mxBooks.some((b) => b.title === 'War and Peace')).toBe(false);
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
      expect(getHourlyHeroBook()).toBeDefined();
    });

    it('advances getDailyEditorialBook to the next candidate when it collides with heroBookId and wraps around at the end', () => {
      const dayMs = 86400000;
      const timestamp = 0; // dayIndex = 0 -> candidateIndex = 0 (id: 1342)
      const nonColliding = getDailyEditorialBook(84, timestamp, 'US');
      expect(nonColliding.id).toBe(FEATURED_HERO_BOOKS[0].id);

      const colliding = getDailyEditorialBook(FEATURED_HERO_BOOKS[0].id, timestamp, 'US');
      expect(colliding.id).toBe(FEATURED_HERO_BOOKS[1].id);

      const lastIndex = FEATURED_HERO_BOOKS.length - 1;
      const lastCandidateId = FEATURED_HERO_BOOKS[lastIndex].id;
      const wrappedLast = getDailyEditorialBook(lastCandidateId, lastIndex * dayMs, 'US');
      expect(wrappedLast).toBe(FEATURED_HERO_BOOKS[0]);
      expect(getDailyEditorialBook()).toBeDefined();
    });
  });

  describe('isClassicCatalogBook, gutendexBookToFeaturedHeroBook & DB-First Pool Selectors', () => {
    const mockClassicDbBook = {
      id: 1400,
      title: 'Great Expectations',
      authors: [{ name: 'Dickens, Charles', birth_year: 1812, death_year: 1870 }],
      translators: [],
      subjects: ['Bildungsromans'],
      bookshelves: ['Best Books Ever'],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 35000,
      quotes: [
        {
          chapterLabel: 'Passage I • Great Expectations',
          openingLine: '“My father’s family name being Pirrip.”',
          quoteExcerpt: '“Suffering has been stronger than all other teaching.”',
        },
      ],
    };

    const mockModernDbBook = {
      id: 75001,
      title: 'Twentieth Century Aviation Chronicle',
      authors: [{ name: 'Wright, Modern', birth_year: 1890, death_year: 1945 }],
      translators: [],
      subjects: ['Aeronautics'],
      bookshelves: ['Technology'],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 15000,
      quotes: [
        {
          chapterLabel: 'Chapter I • Flight',
          openingLine: '“The sky opened before the silver wings.”',
          quoteExcerpt: '“Above the clouds, distance ceased to exist.”',
        },
      ],
    };

    it('identifies Classics by canonical ID, pre-1900 author death_year, or classical taxonomy', () => {
      expect(isClassicCatalogBook(mockClassicDbBook)).toBe(true);
      expect(isClassicCatalogBook(mockModernDbBook)).toBe(false);
      expect(
        isClassicCatalogBook({
          ...mockModernDbBook,
          id: 75002,
          subjects: ['Philosophy -- Ancient'],
        })
      ).toBe(true);
      expect(isClassicCatalogBook({ id: 1342 })).toBe(true);
      expect(isClassicCatalogBook(null as unknown as { id: number })).toBe(false);
    });

    it('maps GutendexBook to FeaturedHeroBook using exclusively database quotes', () => {
      const mapped = gutendexBookToFeaturedHeroBook(mockClassicDbBook);
      expect(mapped.id).toBe(1400);
      expect(mapped.author).toBe('Charles Dickens');
      expect(mapped.year).toBe('1812–1870');
      expect(mapped.quoteExcerpt).toBe('“Suffering has been stronger than all other teaching.”');
      expect(mapped.quotes).toEqual(mockClassicDbBook.quotes);
      expect(mapped.rawBook).toBe(mockClassicDbBook);
    });

    it('selects Featured Book from the entire quoteEnrichedBooks pool and supports topic/language filters', () => {
      const pool = [mockModernDbBook, mockClassicDbBook];
      const h0 = selectHourlyHeroFromPool(pool, 0, 'US');
      const h1 = selectHourlyHeroFromPool(pool, 3600 * 1000, 'US');
      expect(h0.id).toBe(75001);
      expect(h1.id).toBe(1400);

      // Topic filter narrows to matching book in DB pool
      const filteredByTopic = selectHourlyHeroFromPool(pool, 0, 'US', {
        topic: 'bildungsromans',
        language: 'en',
      });
      expect(filteredByTopic.id).toBe(1400);

      // Falls back to static FEATURED_HERO_BOOKS when pool is empty
      const fallback = selectHourlyHeroFromPool([], 0, 'US');
      expect(fallback.id).toBe(FEATURED_HERO_BOOKS[0].id);
    });

    it('selects Classic of the Day strictly from Classics in quoteEnrichedBooks and avoids heroBookId collision', () => {
      const pool = [mockModernDbBook, mockClassicDbBook];
      // Even though mockModernDbBook is index 0, Classic of the Day filters strictly to Classics (mockClassicDbBook #1400)
      const dailyClassic = selectDailyClassicFromPool(pool, 75001, 0, 'US');
      expect(dailyClassic.id).toBe(1400);

      // Collision avoidance when two classics exist
      const secondClassic = {
        ...mockClassicDbBook,
        id: 98,
        title: 'A Tale of Two Cities',
      };
      const twoClassicsPool = [mockClassicDbBook, secondClassic];
      const avoided = selectDailyClassicFromPool(twoClassicsPool, 1400, 0, 'US');
      expect(avoided.id).toBe(98);

      // Fallback when DB pool is empty
      const fallback = selectDailyClassicFromPool([], 1342, 0, 'US');
      expect(fallback.id).toBe(FEATURED_HERO_BOOKS[1].id);
    });

    it('enriches SSR fallback when ssrMatch is present and preserves SSR fallback across 12-hour cache window boundaries without swapping', () => {
      // At timestamp = 12 * 3600 * 1000 (12:00 UTC), getHourlyHeroBook selects FEATURED_HERO_BOOKS[12 % len] (e.g. index 12)
      const afternoonTimestamp = 12 * 3600 * 1000;
      const expectedHourlyFallback = getHourlyHeroBook(afternoonTimestamp, 'US');
      const expectedDailyFallback = getDailyEditorialBook(
        expectedHourlyFallback.id,
        afternoonTimestamp,
        'US'
      );

      // Morning cache slice contains curated FEATURED_HERO_BOOKS from the prior 12h window, but NOT the 12:00 UTC fallback ID
      const morningHeroDbBookA: GutendexBook = {
        ...mockClassicDbBook,
        id: FEATURED_HERO_BOOKS[2].id,
        title: FEATURED_HERO_BOOKS[2].title,
      };
      const morningHeroDbBookB: GutendexBook = {
        ...mockClassicDbBook,
        id: FEATURED_HERO_BOOKS[3].id,
        title: FEATURED_HERO_BOOKS[3].title,
      };
      const straddlingMorningPool = [
        morningHeroDbBookA,
        morningHeroDbBookB,
        mockModernDbBook,
        mockClassicDbBook,
      ];

      const preservedHourly = selectHourlyHeroFromPool(
        straddlingMorningPool,
        afternoonTimestamp,
        'US'
      );
      expect(preservedHourly.id).toBe(expectedHourlyFallback.id);
      expect(preservedHourly.title).toBe(expectedHourlyFallback.title);
      expect(preservedHourly.rawBook?.id).toBe(expectedHourlyFallback.id);

      const preservedDaily = selectDailyClassicFromPool(
        straddlingMorningPool,
        expectedHourlyFallback.id,
        afternoonTimestamp,
        'US'
      );
      expect(preservedDaily.id).toBe(expectedDailyFallback.id);
      expect(preservedDaily.title).toBe(expectedDailyFallback.title);

      // When the pool includes the exact SSR fallback ID (ssrMatch), it enriches with DB quotes while preserving Spread 0
      const matchingHourlyDbBook: GutendexBook = {
        ...mockClassicDbBook,
        id: expectedHourlyFallback.id,
        title: expectedHourlyFallback.title,
        quotes: [
          {
            chapterLabel: 'Chapter II • DB Enriched',
            openingLine: '“Database enriched opening line.”',
            quoteExcerpt: '“Database enriched quote excerpt.”',
          },
        ],
      };
      const matchingDailyDbBook: GutendexBook = {
        ...mockClassicDbBook,
        id: expectedDailyFallback.id,
        title: expectedDailyFallback.title,
        quotes: [
          {
            chapterLabel: 'Chapter III • Daily DB Enriched',
            openingLine: '“Daily database enriched opening line.”',
            quoteExcerpt: '“Daily database enriched quote excerpt.”',
          },
        ],
      };
      const alignedPool = [matchingHourlyDbBook, matchingDailyDbBook];

      const enrichedHourly = selectHourlyHeroFromPool(alignedPool, afternoonTimestamp, 'US');
      expect(enrichedHourly.id).toBe(expectedHourlyFallback.id);
      expect(enrichedHourly.quoteExcerpt).toBe(expectedHourlyFallback.quoteExcerpt);
      expect(enrichedHourly.quotes?.[1]?.quoteExcerpt).toBe('“Database enriched quote excerpt.”');

      const enrichedDaily = selectDailyClassicFromPool(
        alignedPool,
        expectedHourlyFallback.id,
        afternoonTimestamp,
        'US'
      );
      expect(enrichedDaily.id).toBe(expectedDailyFallback.id);
      expect(enrichedDaily.quoteExcerpt).toBe(expectedDailyFallback.quoteExcerpt);
      expect(enrichedDaily.quotes?.[1]?.quoteExcerpt).toBe(
        '“Daily database enriched quote excerpt.”'
      );
    });
  });
});

