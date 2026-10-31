import { describe, it, expect } from 'vitest';
import {
  LITERARY_ERAS,
  SORT_OPTIONS,
  GENRE_FACETS,
  HERO_POPULAR_TOPICS,
  CATALOG_LANGUAGES,
  FORMAT_FILTERS,
  INITIAL_VISIBLE_FACET_COUNT,
  INITIAL_VISIBLE_LANGUAGE_COUNT,
} from './catalog-filters';

describe('catalog-filters configuration', () => {
  it('defines chronological LITERARY_ERAS with valid start < end boundaries', () => {
    expect(LITERARY_ERAS[0]).toEqual({ id: '', label: 'All Historical Eras' });
    const boundedEras = LITERARY_ERAS.slice(1);
    expect(boundedEras.length).toBeGreaterThanOrEqual(6);

    for (const era of boundedEras) {
      expect(era.id.length).toBeGreaterThan(0);
      expect(typeof era.start).toBe('number');
      expect(typeof era.end).toBe('number');
      expect(era.start!).toBeLessThan(era.end!);
    }
  });

  it('defines all 32 Project Gutenberg Bookshelf & Subject facets and 20 top languages with progressive disclosure limits', () => {
    expect(SORT_OPTIONS.map((o) => o.value)).toEqual(['descending', 'popular', 'ascending']);

    expect(INITIAL_VISIBLE_FACET_COUNT).toBe(13);
    expect(INITIAL_VISIBLE_LANGUAGE_COUNT).toBe(13);

    expect(GENRE_FACETS).toHaveLength(33); // 'All Bookshelves & Subjects' + 32 Gutenberg shelves
    const genreIds = new Set(GENRE_FACETS.map((g) => g.id));
    expect(genreIds.size).toBe(GENRE_FACETS.length);
    expect(genreIds.has('')).toBe(true);
    expect(genreIds.has('science fiction')).toBe(true);
    expect(genreIds.has('mythology')).toBe(true);
    expect(genreIds.has('cookery')).toBe(true);

    for (const heroTopic of HERO_POPULAR_TOPICS) {
      expect(genreIds.has(heroTopic.id)).toBe(true);
    }

    expect(CATALOG_LANGUAGES).toHaveLength(21); // 'All Languages' + 20 Gutenberg languages
    const langCodes = new Set(CATALOG_LANGUAGES.map((l) => l.value));
    expect(langCodes.size).toBe(CATALOG_LANGUAGES.length);
    expect(langCodes.has('en')).toBe(true);
    expect(langCodes.has('ro')).toBe(true);
    expect(langCodes.has('eo')).toBe(true);
    expect(langCodes.has('ja')).toBe(true);

    const formatValues = new Set(FORMAT_FILTERS.map((f) => f.value));
    expect(formatValues.size).toBe(FORMAT_FILTERS.length);
    expect(formatValues.has('application/epub+zip')).toBe(true);
  });
});

