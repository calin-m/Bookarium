import { NextRequest, NextResponse } from 'next/server';
import { booksApiRateLimiter } from '@/lib/rate-limiter';
import { getClientIp, createRateLimitErrorResponse } from '@/lib/api-utils';
import { getJurisdictionRule } from '@/lib/copyright-engine';
import { parseCatalogQuery } from '@/lib/catalog/query-parser';
import { gutendexProvider } from '@/lib/catalog/gutendex-provider';
import { supabaseCatalogProvider } from '@/lib/catalog/supabase-provider';
import { CatalogProviderError } from '@/types/catalog.types';
import type { CatalogQueryResult } from '@/types/catalog.types';

// Ensure Vercel runs this as a dynamic serverless function with extended timeout
export const dynamic = 'force-dynamic';
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
        source: 'upstream',
        latencyMs: Date.now() - startTime,
      }
    );
  }

  const queryOptions = parseCatalogQuery(request);

  try {
    let result: CatalogQueryResult | null = null;

    // Strangler Fig Gateway: Query self-hosted Supabase PostgreSQL catalog first
    try {
      const isSupabaseHealthy = await supabaseCatalogProvider.isHealthy();
      if (isSupabaseHealthy) {
        result = await supabaseCatalogProvider.searchBooks(queryOptions);
      }
    } catch {
      // Supabase query failure or network glitch: gracefully degrade to upstream Gutendex
      result = null;
    }

    // Fall back to upstream Gutendex API if Supabase is unseeded, unhealthy, or throws
    if (!result) {
      result = await gutendexProvider.searchBooks(queryOptions);
    }

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'Vary': 'x-vercel-ip-country, Accept-Encoding',
      },
    });
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const country = queryOptions.country;
    const jurisdictionRule = getJurisdictionRule(country);

    if (err instanceof CatalogProviderError) {
      return NextResponse.json(
        {
          error: err.message,
          status: err.statusCode,
          latencyMs,
          results: [],
          count: 0,
          source: err.source,
          clientCountry: country,
          jurisdictionRule,
        },
        { status: err.statusCode }
      );
    }

    return NextResponse.json(
      {
        error: 'Unable to connect to Gutenberg API',
        latencyMs,
        results: [],
        count: 0,
        source: 'upstream',
        clientCountry: country,
        jurisdictionRule,
      },
      { status: 502 }
    );
  }
}
