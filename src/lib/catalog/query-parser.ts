import { NextRequest } from 'next/server';
import type { CatalogQueryOptions } from '@/types/catalog.types';
import { normalizeCountryCode } from '@/lib/copyright-engine';
import { GEO_COOKIE_NAME } from '@/proxy';

/**
 * Extracts, sanitizes, and normalizes query options from an incoming Next.js request.
 * Enforces security boundaries, single-character search defense, and legal jurisdiction resolution.
 */
export function parseCatalogQuery(request: NextRequest): CatalogQueryOptions {
  const { searchParams } = new URL(request.url);

  // Search query: trim and collapse multi-whitespace
  const rawSearch = searchParams.get('search') || '';
  const search = rawSearch.trim().replace(/\s+/g, ' ');

  const topic = (searchParams.get('topic') || '').trim();
  const rawLanguages = (searchParams.get('languages') || '').trim();
  const languages = rawLanguages
    ? rawLanguages.split(',').map((l) => l.trim()).filter(Boolean)
    : undefined;

  // Page parsing: fallback to 1, enforce minimum 1
  const rawPage = parseInt(searchParams.get('page') || '1', 10);
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;

  // Limit / batch size (default 32)
  const rawLimit = parseInt(searchParams.get('limit') || '32', 10);
  const limit = Number.isInteger(rawLimit) && rawLimit >= 1 && rawLimit <= 100 ? rawLimit : 32;

  // Author year bounds
  const rawAuthorYearStart = searchParams.get('author_year_start');
  const authorYearStart =
    rawAuthorYearStart !== null && rawAuthorYearStart.trim() !== '' && !isNaN(parseInt(rawAuthorYearStart, 10))
      ? parseInt(rawAuthorYearStart, 10)
      : undefined;

  const rawAuthorYearEnd = searchParams.get('author_year_end');
  const authorYearEnd =
    rawAuthorYearEnd !== null && rawAuthorYearEnd.trim() !== '' && !isNaN(parseInt(rawAuthorYearEnd, 10))
      ? parseInt(rawAuthorYearEnd, 10)
      : undefined;

  // Sort direction
  const rawSort = (searchParams.get('sort') || '').trim();
  const sort =
    rawSort === 'popular' || rawSort === 'descending' || rawSort === 'ascending'
      ? rawSort
      : '';

  const mimeType = (searchParams.get('mime_type') || '').trim() || undefined;
  const ids = (searchParams.get('ids') || '').trim() || undefined;

  // Resolve user country: query override (dev) -> edge IP header -> edge proxy header -> cookie -> 'US'
  const devCountryOverride =
    process.env.NODE_ENV !== 'production' ? searchParams.get('country') : null;
  const rawCountry =
    devCountryOverride ||
    request.headers.get('x-vercel-ip-country') ||
    request.headers.get('x-bookarium-country') ||
    request.cookies.get(GEO_COOKIE_NAME)?.value ||
    'US';
  const country = normalizeCountryCode(rawCountry);

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
    country,
  };
}

