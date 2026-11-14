import type { CatalogQueryOptions, CatalogQueryResult } from '@/types/catalog.types';
import type { GutendexBook } from '@/types/book.types';
import { FEATURED_HERO_BOOKS, type FeaturedHeroBook } from '@/config/featured-books';
import { featuredHeroToGutendexBook } from '@/lib/book-metadata';
import { getJurisdictionRule, isBookPublicDomainInJurisdiction } from '@/lib/copyright-engine';

function toCuratedCatalogBook(hero: FeaturedHeroBook, index: number): GutendexBook {
  const baseBook = featuredHeroToGutendexBook(hero, {
    formats: {
      'text/plain; charset=utf-8': `https://www.gutenberg.org/cache/epub/${hero.id}/pg${hero.id}.txt`,
      'text/html': `https://www.gutenberg.org/cache/epub/${hero.id}/pg${hero.id}-images.html`,
      'application/epub+zip': `https://www.gutenberg.org/cache/epub/${hero.id}/pg${hero.id}.epub`,
      'image/jpeg': `https://www.gutenberg.org/cache/epub/${hero.id}/pg${hero.id}.cover.medium.jpg`,
    },
    downloadCount: Math.max(1, FEATURED_HERO_BOOKS.length - index),
  });

  return {
    ...baseBook,
    translators: hero.translators ? [...hero.translators] : [],
    quotes:
      hero.quotes && hero.quotes.length > 0
        ? hero.quotes
        : hero.quoteExcerpt
          ? [
              {
                chapterLabel: hero.primarySubject,
                openingLine: hero.openingLine,
                quoteExcerpt: hero.quoteExcerpt,
              },
            ]
          : undefined,
  };
}

function matchesAuthorEra(
  book: GutendexBook,
  authorYearStart?: number,
  authorYearEnd?: number
): boolean {
  if (authorYearStart === undefined && authorYearEnd === undefined) {
    return true;
  }

  const authors = book.authors || [];
  if (authors.length === 0) {
    return false;
  }

  if (authorYearStart !== undefined) {
    const deathYears = authors
      .map((a) => a.death_year)
      .filter((y): y is number => typeof y === 'number');
    if (deathYears.length === 0 || Math.max(...deathYears) < authorYearStart) {
      return false;
    }
  }

  if (authorYearEnd !== undefined) {
    const birthYears = authors
      .map((a) => a.birth_year)
      .filter((y): y is number => typeof y === 'number');
    if (birthYears.length === 0 || Math.min(...birthYears) > authorYearEnd) {
      return false;
    }
  }

  return true;
}

/**
 * Deterministic keyless catalog fallback backed purely by bundled
 * `FEATURED_HERO_BOOKS` fixtures and multi-jurisdictional Berne copyright rules.
 * Used only when Supabase environment credentials are unconfigured.
 */
export function searchCuratedCatalogFallback(options: CatalogQueryOptions): CatalogQueryResult {
  const startTime = Date.now();
  const country = options.country;
  const jurisdictionRule = getJurisdictionRule(country);
  const currentYear = new Date().getFullYear();

  const allBooks = FEATURED_HERO_BOOKS.map((hero, index) => toCuratedCatalogBook(hero, index));

  const jurisdictionAllowed = options.includeRestrictedMetadata
    ? allBooks
    : allBooks.filter((b) => isBookPublicDomainInJurisdiction(b, country, currentYear).isAllowed);

  const totalFiltered = allBooks.length - jurisdictionAllowed.length;

  let filtered = jurisdictionAllowed;

  if (options.ids) {
    const idSet = new Set(
      options.ids
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !Number.isNaN(id))
    );
    if (idSet.size > 0) {
      filtered = filtered.filter((b) => idSet.has(b.id));
    }
  }

  const cleanSearch = options.search?.trim().toLowerCase();
  if (cleanSearch && cleanSearch.length >= 2) {
    filtered = filtered.filter((b) => {
      const titleMatch = b.title.toLowerCase().includes(cleanSearch);
      const authorMatch = (b.authors || []).some((a) => a.name.toLowerCase().includes(cleanSearch));
      const subjectMatch = [...(b.subjects || []), ...(b.bookshelves || [])].some((s) =>
        s.toLowerCase().includes(cleanSearch)
      );
      return titleMatch || authorMatch || subjectMatch;
    });
  }

  if (options.topic && options.topic.trim().length > 0) {
    const tokens = options.topic
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (tokens.length > 0) {
      filtered = filtered.filter((b) => {
        const haystack = [...(b.subjects || []), ...(b.bookshelves || [])]
          .join(' ')
          .toLowerCase();
        return tokens.some((token) => haystack.includes(token));
      });
    }
  }

  if (options.languages && options.languages.length > 0) {
    const langSet = new Set(options.languages.map((l) => l.toLowerCase()));
    filtered = filtered.filter((b) =>
      (b.languages || []).some((l) => langSet.has(l.toLowerCase()))
    );
  }

  if (options.authorYearStart !== undefined || options.authorYearEnd !== undefined) {
    filtered = filtered.filter((b) =>
      matchesAuthorEra(b, options.authorYearStart, options.authorYearEnd)
    );
  }

  if (options.mimeType) {
    const mimeTokens = options.mimeType
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    if (mimeTokens.length > 0) {
      filtered = filtered.filter((b) =>
        mimeTokens.some((fmt) => {
          const baseMime = fmt.split(';')[0].trim();
          return Object.keys(b.formats || {}).some(
            (key) => key === fmt || key.startsWith(baseMime)
          );
        })
      );
    }
  }

  if (options.hasQuotes || options.pool === 'quotes') {
    filtered = filtered.filter((b) => Array.isArray(b.quotes) && b.quotes.length > 0);
  }

  const sorted = [...filtered];
  if (options.sort === 'ascending') {
    sorted.sort((a, b) => a.id - b.id);
  } else if (options.sort === 'descending') {
    sorted.sort((a, b) => b.id - a.id);
  }

  const page = Math.max(1, options.page || 1);
  const limit = Math.max(1, Math.min(100, options.limit || 32));
  const from = (page - 1) * limit;
  const pageResults = sorted.slice(from, from + limit);

  const hasNext = from + limit < sorted.length;
  const hasPrev = page > 1;

  return {
    count: sorted.length,
    next: hasNext ? `/api/books?page=${page + 1}` : null,
    previous: hasPrev ? `/api/books?page=${page - 1}` : null,
    results: pageResults,
    source: 'cache',
    latencyMs: Date.now() - startTime,
    clientCountry: country,
    jurisdictionRule,
    totalFiltered,
  };
}
