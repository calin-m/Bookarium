import { NextRequest, NextResponse } from 'next/server';
import { API_ENDPOINTS } from '@/config/api-endpoints';
import type { GutendexBook, GutendexResponse } from '@/types/book.types';
import { booksApiRateLimiter } from '@/lib/rate-limiter';
import { getClientIp, createRateLimitErrorResponse } from '@/lib/api-utils';
import { isBookPublicDomainInJurisdiction, getJurisdictionRule, normalizeCountryCode } from '@/lib/copyright-engine';
import { GEO_COOKIE_NAME } from '@/proxy';

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

  const { searchParams } = new URL(request.url);
  const rawSearch = searchParams.get('search') || '';
  const search = rawSearch.trim().replace(/\s+/g, ' ');
  const topic = searchParams.get('topic') || '';
  const languages = searchParams.get('languages') || '';
  const page = searchParams.get('page') || '1';
  const authorYearStart = searchParams.get('author_year_start') || '';
  const authorYearEnd = searchParams.get('author_year_end') || '';
  const sort = searchParams.get('sort') || '';
  const mimeType = searchParams.get('mime_type') || '';
  const ids = searchParams.get('ids') || '';

  // Extract user jurisdiction from Vercel header, edge middleware header/cookie, or dev query param
  const devCountryOverride =
    process.env.NODE_ENV !== 'production' ? searchParams.get('country') : null;
  const rawCountry =
    devCountryOverride ||
    request.headers.get('x-vercel-ip-country') ||
    request.headers.get('x-bookarium-country') ||
    request.cookies.get(GEO_COOKIE_NAME)?.value ||
    'US';
  const country = normalizeCountryCode(rawCountry);
  const jurisdictionRule = getJurisdictionRule(country);

  const gutendexParams = new URLSearchParams();

  // Strictly enforce upstream US copyright filter
  gutendexParams.set('copyright', 'false');

  if (ids.trim()) {
    gutendexParams.set('ids', ids.trim());
  }
  if (search.length >= 2) {
    gutendexParams.set('search', search);
  }
  if (topic.trim()) {
    gutendexParams.set('topic', topic.trim());
  }
  if (languages.trim()) {
    gutendexParams.set('languages', languages.trim());
  }
  if (page && parseInt(page, 10) > 1) {
    gutendexParams.set('page', page);
  }
  if (authorYearStart.trim()) {
    gutendexParams.set('author_year_start', authorYearStart.trim());
  }
  if (authorYearEnd.trim()) {
    gutendexParams.set('author_year_end', authorYearEnd.trim());
  }
  if (sort.trim()) {
    gutendexParams.set('sort', sort.trim());
  }
  if (mimeType.trim()) {
    gutendexParams.set('mime_type', mimeType.trim());
  }

  const apiUrl = `${API_ENDPOINTS.GUTENDEX_BASE_URL}/?${gutendexParams.toString()}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for deep Gutenberg offset queries

    const response = await fetch(apiUrl, {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
        'User-Agent': 'Bookarium/1.0 (Public Domain Library Reader)',
      },
      signal: controller.signal,
      next: { revalidate: 3600 }, // Next.js SWR cache for 1 hour
    });

    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Upstream Gutenberg API error: ${response.statusText || response.status}`,
          status: response.status,
          latencyMs,
          results: [],
          count: 0,
          source: 'upstream',
          clientCountry: country,
          jurisdictionRule,
        },
        { status: response.status }
      );
    }

    let data: GutendexResponse;
    try {
      data = await response.json();
    } catch {
      return NextResponse.json(
        {
          error: 'Invalid JSON response from upstream Gutenberg API',
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

    // Apply strict jurisdictional copyright filtering
    const originalResults = data.results || [];
    const filteredResults = originalResults.filter((b: GutendexBook) => {
      const evaluation = isBookPublicDomainInJurisdiction(b, country);
      return evaluation.isAllowed;
    });

    const totalFiltered = originalResults.length - filteredResults.length;
    // Adjust count conservatively if any results were filtered on this page
    const adjustedCount = data.count !== undefined ? Math.max(0, data.count - totalFiltered) : filteredResults.length;

    return NextResponse.json(
      {
        ...data,
        results: filteredResults,
        count: adjustedCount,
        source: 'upstream',
        latencyMs,
        clientCountry: country,
        jurisdictionRule,
        totalFiltered,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
          'Vary': 'x-vercel-ip-country, Accept-Encoding',
        },
      }
    );
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
    const statusCode = isTimeout ? 504 : 502;

    return NextResponse.json(
      {
        error: isTimeout ? 'Gutenberg API request timed out' : 'Unable to connect to Gutenberg API',
        latencyMs,
        results: [],
        count: 0,
        source: 'upstream',
        clientCountry: country,
        jurisdictionRule,
      },
      { status: statusCode }
    );
  }
}
