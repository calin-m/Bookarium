import { NextRequest, NextResponse } from 'next/server';
import { booksApiRateLimiter } from '@/lib/rate-limiter';
import {
  getClientIp,
  createRateLimitErrorResponse,
  buildApiSecurityHeaders,
  hasUnexpectedQueryParams,
  createNoStoreErrorResponse,
} from '@/lib/api-utils';
import { getJurisdictionRule } from '@/lib/copyright-engine';
import { parseCatalogQuery } from '@/lib/catalog/query-parser';
import { searchCuratedCatalogFallback } from '@/lib/catalog/curated-fallback';
import {
  supabaseCatalogProvider,
  isSupabaseConfigured,
} from '@/lib/catalog/supabase-provider';
import { CatalogProviderError } from '@/types/catalog.types';
import type { CatalogQueryResult } from '@/types/catalog.types';

const ALLOWED_CATALOG_QUERY_KEYS = new Set([
  'copyright',
  'include_restricted_metadata',
  'ids',
  'search',
  'topic',
  'languages',
  'page',
  'limit',
  'author_year_start',
  'author_year_end',
  'sort',
  'mime_type',
  'has_quotes',
  'pool',
]);
const DEV_ONLY_CATALOG_QUERY_KEYS = new Set(['country']);

// Ensure Vercel runs this serverless function with extended timeout
export const maxDuration = 30; // seconds

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const clientIp = getClientIp(request);

  const rateLimit = booksApiRateLimiter.check(clientIp);
  if (!rateLimit.success) {
    return createRateLimitErrorResponse(
      rateLimit,
      'Too many requests. Please slow down and try again.',
      {
        results: [],
        count: 0,
        source: 'supabase',
        latencyMs: Date.now() - startTime,
      }
    );
  }

  const searchParams = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
  if (hasUnexpectedQueryParams(searchParams, ALLOWED_CATALOG_QUERY_KEYS, DEV_ONLY_CATALOG_QUERY_KEYS)) {
    return createNoStoreErrorResponse(
      'Unsupported or disallowed query parameter.',
      400,
      {
        results: [],
        count: 0,
        source: 'supabase',
        latencyMs: Date.now() - startTime,
      }
    );
  }

  const queryOptions = parseCatalogQuery(request);

  try {
    const supabaseConfigured = isSupabaseConfigured();
    const shouldQuerySupabase =
      supabaseConfigured || (await supabaseCatalogProvider.isHealthy().catch(() => false));

    let result: CatalogQueryResult;

    if (shouldQuerySupabase) {
      try {
        result = await supabaseCatalogProvider.searchBooks(queryOptions);
      } catch {
        throw new CatalogProviderError(
          'Catalog database temporarily unavailable. Please try again.',
          503,
          'supabase'
        );
      }
    } else if (queryOptions.pool === 'quotes') {
      return createNoStoreErrorResponse('Quote pool unavailable from database', 503, {
        results: [],
        count: 0,
        source: 'supabase',
        latencyMs: Date.now() - startTime,
        clientCountry: queryOptions.country,
        jurisdictionRule: getJurisdictionRule(queryOptions.country),
      });
    } else {
      result = searchCuratedCatalogFallback(queryOptions);
    }

    const isQuotePool = queryOptions.pool === 'quotes';
    const isJurisdictionIndependentLookup = Boolean(
      queryOptions.includeRestrictedMetadata || (queryOptions.ids && queryOptions.hasQuotes)
    );

    const cacheControl =
      result.source === 'cache'
        ? 'no-store, max-age=0'
        : isQuotePool
          ? 'public, max-age=3600, s-maxage=43200, stale-while-revalidate=604800'
          : isJurisdictionIndependentLookup
            ? 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000'
            : 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800';

    const varyHeader =
      isQuotePool || isJurisdictionIndependentLookup
        ? 'Accept-Encoding'
        : 'x-vercel-ip-country, cf-ipcountry, x-bookarium-country, Accept-Encoding';

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Cache-Control': cacheControl,
        'Vary': varyHeader,
        ...buildApiSecurityHeaders('same-origin'),
      },
    });
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const country = queryOptions.country;
    const jurisdictionRule = getJurisdictionRule(country);

    if (err instanceof CatalogProviderError) {
      return createNoStoreErrorResponse(err.message, err.statusCode, {
        status: err.statusCode,
        latencyMs,
        results: [],
        count: 0,
        source: err.source,
        clientCountry: country,
        jurisdictionRule,
      });
    }

    return createNoStoreErrorResponse('Catalog service temporarily unavailable.', 503, {
      latencyMs,
      results: [],
      count: 0,
      source: 'supabase',
      clientCountry: country,
      jurisdictionRule,
    });
  }
}
