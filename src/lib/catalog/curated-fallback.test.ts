import { describe, it, expect } from 'vitest';
import { searchCuratedCatalogFallback } from './curated-fallback';
import { FEATURED_HERO_BOOKS } from '@/config/featured-books';

describe('searchCuratedCatalogFallback', () => {
  it('returns curated public domain books with cache source, formats, quotes, and pagination metadata', () => {
    const page1 = searchCuratedCatalogFallback({
      page: 1,
      limit: 8,
      country: 'US',
    });

    expect(page1.source).toBe('cache');
    expect(page1.clientCountry).toBe('US');
    expect(page1.jurisdictionRule).toBe('US_PUBLIC_DOMAIN');
    expect(page1.results).toHaveLength(8);
    expect(page1.previous).toBeNull();
    expect(page1.next).toBe('/api/books?page=2');
    expect(page1.count).toBeGreaterThan(8);
    expect(page1.latencyMs).toBeGreaterThanOrEqual(0);

    const first = page1.results[0];
    expect(first.copyright).toBe(false);
    expect(first.formats['text/plain; charset=utf-8']).toMatch(/^https:\/\/www\.gutenberg\.org\/cache\/epub\//);
    expect(first.formats['application/epub+zip']).toMatch(/\.epub$/);
    expect(first.formats['image/jpeg']).toMatch(/cover\.medium\.jpg$/);
    expect(Array.isArray(first.quotes)).toBe(true);
    expect(first.quotes?.length).toBeGreaterThan(0);

    const lastPageNum = Math.ceil(page1.count / 8);
    const lastPage = searchCuratedCatalogFallback({
      page: lastPageNum,
      limit: 8,
      country: 'US',
    });
    expect(lastPage.previous).toBe(`/api/books?page=${lastPageNum - 1}`);
    expect(lastPage.next).toBeNull();

    const beyondEnd = searchCuratedCatalogFallback({
      page: lastPageNum + 5,
      limit: 8,
      country: 'US',
    });
    expect(beyondEnd.results).toEqual([]);
    expect(beyondEnd.next).toBeNull();
  });

  it('enforces multi-jurisdictional Life+100 filtering in MX and bypasses when includeRestrictedMetadata is true', () => {
    const usGatsby = searchCuratedCatalogFallback({
      ids: '64317',
      page: 1,
      limit: 32,
      country: 'US',
    });
    expect(usGatsby.results.map((b) => b.id)).toEqual([64317]);

    const mxGatsby = searchCuratedCatalogFallback({
      ids: '64317',
      page: 1,
      limit: 32,
      country: 'MX',
    });
    expect(mxGatsby.jurisdictionRule).toBe('LIFE_100');
    expect(mxGatsby.results).toEqual([]);
    expect(mxGatsby.totalFiltered).toBeGreaterThan(0);

    const mxIncluded = searchCuratedCatalogFallback({
      ids: '64317',
      page: 1,
      limit: 32,
      country: 'MX',
      includeRestrictedMetadata: true,
    });
    expect(mxIncluded.results.map((b) => b.id)).toEqual([64317]);
    expect(mxIncluded.totalFiltered).toBe(0);
  });

  it('filters by search query (>= 2 chars), topic, languages, author era, mimeType, quotes/pool, and sorts by ID', () => {
    // Single-character search query is ignored
    const shortSearch = searchCuratedCatalogFallback({
      search: 'a',
      page: 1,
      limit: 32,
      country: 'US',
    });
    expect(shortSearch.count).toBeLessThanOrEqual(FEATURED_HERO_BOOKS.length);
    expect(shortSearch.count).toBeGreaterThan(5);

    // Search matches title, author, or subject
    const austenSearch = searchCuratedCatalogFallback({
      search: 'Jane Austen',
      page: 1,
      limit: 32,
      country: 'US',
    });
    expect(austenSearch.results.some((b) => b.id === 1342)).toBe(true);

    // Topic comma-separated matching
    const gothicTopic = searchCuratedCatalogFallback({
      topic: 'gothic, nonexistent-genre',
      page: 1,
      limit: 32,
      country: 'US',
    });
    expect(gothicTopic.results.some((b) => b.id === 84)).toBe(true);

    // Languages filter
    const englishOnly = searchCuratedCatalogFallback({
      languages: ['en'],
      page: 1,
      limit: 8,
      country: 'US',
    });
    expect(englishOnly.results.length).toBeGreaterThan(0);
    const nonExistentLang = searchCuratedCatalogFallback({
      languages: ['zz'],
      page: 1,
      limit: 8,
      country: 'US',
    });
    expect(nonExistentLang.results).toEqual([]);

    // Author era bounds
    const nineteenthCentury = searchCuratedCatalogFallback({
      authorYearStart: 1800,
      authorYearEnd: 1850,
      page: 1,
      limit: 32,
      country: 'US',
    });
    expect(nineteenthCentury.results.every((b) => b.authors.length > 0)).toBe(true);
    expect(nineteenthCentury.results.some((b) => b.id === 1342)).toBe(true);
    expect(nineteenthCentury.results.some((b) => b.id === 64317)).toBe(false);

    // Mime type matching (including base mime type stripping charset)
    const plainMatch = searchCuratedCatalogFallback({
      mimeType: 'text/plain; charset=us-ascii',
      page: 1,
      limit: 8,
      country: 'US',
    });
    expect(plainMatch.results.length).toBeGreaterThan(0);
    const pdfMatch = searchCuratedCatalogFallback({
      mimeType: 'application/pdf',
      page: 1,
      limit: 8,
      country: 'US',
    });
    expect(pdfMatch.results).toEqual([]);

    // Quotes pool filter and ascending / descending sorting
    const ascending = searchCuratedCatalogFallback({
      pool: 'quotes',
      sort: 'ascending',
      page: 1,
      limit: 16,
      country: 'US',
    });
    expect(ascending.results.length).toBeGreaterThan(1);
    for (let i = 1; i < ascending.results.length; i++) {
      expect(ascending.results[i].id).toBeGreaterThanOrEqual(ascending.results[i - 1].id);
    }

    const descending = searchCuratedCatalogFallback({
      hasQuotes: true,
      sort: 'descending',
      page: 1,
      limit: 16,
      country: 'US',
    });
    expect(descending.results.length).toBeGreaterThan(1);
    for (let i = 1; i < descending.results.length; i++) {
      expect(descending.results[i].id).toBeLessThanOrEqual(descending.results[i - 1].id);
    }
  });
});
