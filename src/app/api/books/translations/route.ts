/**
 * @module
 * @scope Stateless API route handler (`GET /api/books/translations`) serving FRBR-linked alternate language
 *        editions filtered by resolved client copyright jurisdiction.
 * @invariant Enforce IP rate limiting (`booksApiRateLimiter`), reject unknown query keys outside `id` (plus dev-only `country`), and validate numeric `bookId` within `1..MAX_BOOK_ID` (`10_000_000`).
 * @invariant Emit `Cache-Control` with `Vary: x-vercel-ip-country` and `Vercel-Cache-Tag: translations` on `200` responses, and fail closed with `Cache-Control: no-store` (`createNoStoreErrorResponse`) on `400`/`500` errors.
 * @rationale Varying Edge caches strictly by Geo-IP country prevents cross-jurisdiction public-domain leakage while pinning error responses to `no-store` prevents Edge caching transient failures.
 * @adr ADR-010, ADR-016, ADR-022
 */

import { NextRequest, NextResponse } from 'next/server';
import { booksApiRateLimiter } from '@/lib/rate-limiter';
import {
  getClientIp,
  createRateLimitErrorResponse,
  buildApiSecurityHeaders,
  hasUnexpectedQueryParams,
  createNoStoreErrorResponse,
} from '@/lib/api-utils';
import { supabaseCatalogProvider } from '@/lib/catalog/supabase-provider';
import { resolveClientCountry } from '@/lib/country-resolver';

const ALLOWED_TRANSLATIONS_QUERY_KEYS = new Set(['id']);
const DEV_ONLY_TRANSLATIONS_QUERY_KEYS = new Set(['country']);
const MAX_BOOK_ID = 10_000_000;

export const maxDuration = 15; // seconds

export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimit = booksApiRateLimiter.check(clientIp);
  if (!rateLimit.success) {
    return createRateLimitErrorResponse(
      rateLimit,
      'Too many requests. Please slow down and try again.',
      { results: [] }
    );
  }

  const searchParams = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
  if (
    hasUnexpectedQueryParams(
      searchParams,
      ALLOWED_TRANSLATIONS_QUERY_KEYS,
      DEV_ONLY_TRANSLATIONS_QUERY_KEYS
    )
  ) {
    return createNoStoreErrorResponse('Unsupported or disallowed query parameter.', 400, {
      results: [],
    });
  }

  const rawId = (searchParams.get('id') || '').trim();
  const isNumericToken = /^\d{1,8}$/.test(rawId);
  const bookId = isNumericToken ? parseInt(rawId, 10) : NaN;

  if (!isNumericToken || !Number.isInteger(bookId) || bookId <= 0 || bookId > MAX_BOOK_ID) {
    return createNoStoreErrorResponse('Valid positive numeric book id is required', 400, {
      results: [],
    });
  }

  try {
    const clientCountry = resolveClientCountry(request);
    const translations = await supabaseCatalogProvider.getBookTranslations(bookId, clientCountry);

    return NextResponse.json(
      { results: translations },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
          'Vary': 'x-vercel-ip-country',
          'Vercel-Cache-Tag': 'translations',
          ...buildApiSecurityHeaders('same-origin'),
        },
      }
    );
  } catch (err: unknown) {
    // Gracefully degrade to empty results with no-store to prevent edge caching error states
    return createNoStoreErrorResponse(
      err instanceof Error ? err.message : 'Failed to fetch translations',
      500,
      { results: [] }
    );
  }
}

