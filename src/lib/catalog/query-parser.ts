import { NextRequest } from 'next/server';
import type { CatalogQueryOptions } from '@/types/catalog.types';
import { resolveClientCountry } from '@/lib/country-resolver';

/**
 * Default and maximum volume count for the homepage Quote Pool (`?pool=quotes`), sized to cover
 * 24-hour deterministic rotation, 3-card Literary Quotes variety, and international copyright buffer
 * while keeping payload transfer at ~22 KB and preventing bulk quote-pool harvesting.
 */
export const DEFAULT_QUOTE_POOL_LIMIT = 48;
export const MAX_CATALOG_PAGE = 5000;
export const MAX_SEARCH_LENGTH = 120;
export const MAX_TOPIC_LENGTH = 120;
export const MAX_IDS_BATCH = 100;
export const MAX_LANGUAGES = 5;
export const MAX_MIME_TYPE_LENGTH = 64;
export const MIN_ERA_YEAR = -4000;
export const MAX_ERA_YEAR = 3000;

/**
 * Extracts, sanitizes, and normalizes query options from an incoming Next.js request.
 * Enforces security boundaries, length/range caps, single-character search defense,
 * and legal jurisdiction resolution.
 */
export function parseCatalogQuery(request: NextRequest): CatalogQueryOptions {
  const { searchParams } = new URL(request.url);

  // Search query: collapse multi-whitespace, cap length, and drop single-character wildcard probes
  const rawSearch = (searchParams.get('search') || '').trim().replace(/\s+/g, ' ');
  const search = rawSearch.slice(0, MAX_SEARCH_LENGTH).trim();

  const rawTopic = (searchParams.get('topic') || '').trim().replace(/\s+/g, ' ');
  const topic = rawTopic.slice(0, MAX_TOPIC_LENGTH).trim();

  // Languages: normalize lowercase ISO 639-1/2 tokens and bound to 5 values
  const rawLanguages = (searchParams.get('languages') || '').trim();
  const languages = rawLanguages
    ? Array.from(
        new Set(
          rawLanguages
            .split(',')
            .map((l) => l.trim().toLowerCase())
            .filter((l) => /^[a-z]{2,3}$/.test(l))
        )
      ).slice(0, MAX_LANGUAGES)
    : undefined;

  // Page parsing: enforce [1, MAX_CATALOG_PAGE] to block extreme SQL OFFSET / cache-busting probes
  const rawPage = parseInt(searchParams.get('page') || '1', 10);
  const page =
    Number.isInteger(rawPage) && rawPage >= 1 ? Math.min(rawPage, MAX_CATALOG_PAGE) : 1;

  // MIME type: validate structured content-type pattern (supporting charset parameters like `text/plain; charset=utf-8`)
  const rawMimeType = (searchParams.get('mime_type') || '').trim();
  const mimeType =
    rawMimeType.length > 0 &&
    rawMimeType.length <= MAX_MIME_TYPE_LENGTH &&
    /^[a-z0-9.+-]+\/[a-z0-9.+-]+(?:\s*;\s*[a-z0-9.-]+=[a-z0-9._-]+)?$/i.test(rawMimeType)
      ? rawMimeType
      : undefined;

  // Book IDs: preserve strictly deduplicated positive 1-8 digit IDs up to MAX_IDS_BATCH
  const rawIds = (searchParams.get('ids') || '').trim();
  const normalizedIdTokens = rawIds
    ? Array.from(
        new Set(
          rawIds
            .split(',')
            .map((part) => part.trim())
            .filter((part) => /^\d{1,8}$/.test(part) && parseInt(part, 10) > 0)
        )
      ).slice(0, MAX_IDS_BATCH)
    : [];
  const ids = normalizedIdTokens.length > 0 ? normalizedIdTokens.join(',') : undefined;
  const idCount = normalizedIdTokens.length;

  const rawPool = (searchParams.get('pool') || '').trim().toLowerCase();
  const pool = rawPool === 'quotes' ? ('quotes' as const) : undefined;

  // Limit / batch size (default 32 / max 100 for catalog, fixed 48 ceiling for quote pool)
  const rawLimitParam = searchParams.get('limit');
  const rawLimit = rawLimitParam !== null ? parseInt(rawLimitParam, 10) : NaN;
  const maxLimit = pool === 'quotes' ? DEFAULT_QUOTE_POOL_LIMIT : 100;
  const defaultLimit =
    pool === 'quotes' ? DEFAULT_QUOTE_POOL_LIMIT : idCount > 32 ? Math.min(100, idCount) : 32;
  const limit =
    Number.isInteger(rawLimit) && rawLimit >= 1 && rawLimit <= maxLimit ? rawLimit : defaultLimit;

  // Author year bounds clamped safely within historical catalog bounds
  const rawAuthorYearStart = searchParams.get('author_year_start');
  const parsedYearStart =
    rawAuthorYearStart !== null && rawAuthorYearStart.trim() !== ''
      ? parseInt(rawAuthorYearStart.trim(), 10)
      : NaN;
  const authorYearStart =
    Number.isInteger(parsedYearStart) &&
    parsedYearStart >= MIN_ERA_YEAR &&
    parsedYearStart <= MAX_ERA_YEAR
      ? parsedYearStart
      : undefined;

  const rawAuthorYearEnd = searchParams.get('author_year_end');
  const parsedYearEnd =
    rawAuthorYearEnd !== null && rawAuthorYearEnd.trim() !== ''
      ? parseInt(rawAuthorYearEnd.trim(), 10)
      : NaN;
  const authorYearEnd =
    Number.isInteger(parsedYearEnd) &&
    parsedYearEnd >= MIN_ERA_YEAR &&
    parsedYearEnd <= MAX_ERA_YEAR
      ? parsedYearEnd
      : undefined;

  // Sort direction
  const rawSort = (searchParams.get('sort') || '').trim();
  const sort =
    rawSort === 'popular' || rawSort === 'descending' || rawSort === 'ascending'
      ? rawSort
      : '';

  const hasQuotes = searchParams.get('has_quotes') === 'true';
  const includeRestrictedMetadata = searchParams.get('include_restricted_metadata') === 'true';

  // Resolve user country through deterministic priority cascade
  const country = resolveClientCountry(request, searchParams);

  return {
    search: search.length >= 2 ? search : undefined,
    topic: topic || undefined,
    languages: languages && languages.length > 0 ? languages : undefined,
    page,
    limit,
    authorYearStart,
    authorYearEnd,
    sort,
    mimeType,
    ids,
    hasQuotes: hasQuotes || undefined,
    pool,
    country,
    includeRestrictedMetadata: includeRestrictedMetadata || undefined,
  };
}

