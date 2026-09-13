import { NextRequest, NextResponse } from 'next/server';
import { booksApiRateLimiter } from '@/lib/rate-limiter';
import { getClientIp, createRateLimitErrorResponse } from '@/lib/api-utils';
import { supabaseCatalogProvider } from '@/lib/catalog/supabase-provider';

export const dynamic = 'force-dynamic';
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

  const { searchParams } = request.nextUrl;
  const rawId = searchParams.get('id');
  const bookId = parseInt(rawId || '', 10);

  if (!Number.isInteger(bookId) || bookId <= 0) {
    return NextResponse.json(
      { error: 'Valid positive numeric book id is required', results: [] },
      {
        status: 400,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }

  try {
    const translations = await supabaseCatalogProvider.getBookTranslations(bookId);

    return NextResponse.json(
      { results: translations },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    );
  } catch (err: unknown) {
    // Gracefully degrade to empty results with no-store to prevent edge caching error states
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch translations', results: [] },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
}

