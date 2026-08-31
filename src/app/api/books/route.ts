import { NextRequest, NextResponse } from 'next/server';
import { API_ENDPOINTS } from '@/config/api-endpoints';
import type { GutendexBook, GutendexResponse } from '@/mocks/handlers';

// Ensure Vercel runs this as a dynamic serverless function with extended timeout
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // seconds

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const topic = searchParams.get('topic') || '';
  const languages = searchParams.get('languages') || '';
  const page = searchParams.get('page') || '1';
  const authorYearStart = searchParams.get('author_year_start') || '';
  const authorYearEnd = searchParams.get('author_year_end') || '';
  const sort = searchParams.get('sort') || '';
  const mimeType = searchParams.get('mime_type') || '';
  const ids = searchParams.get('ids') || '';

  const gutendexParams = new URLSearchParams();

  // public domain filter will be applied after fetching the data

  if (ids.trim()) {
    gutendexParams.set('ids', ids.trim());
  }
  if (search.trim()) {
    gutendexParams.set('search', search.trim());
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
        'User-Agent': 'Bookarium/1.0 (Public Domain Library Reader)',
      },
      signal: controller.signal,
      next: { revalidate: 120 }, // Next.js SWR cache for 2 minutes
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
        },
        { status: 502 }
      );
    }

    const filteredResults = (data.results || []).filter((b: GutendexBook) => b.copyright !== true);
    const filteredCount = filteredResults.length;
    return NextResponse.json(
      { ...data, results: filteredResults, count: filteredCount, source: 'upstream', latencyMs },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        },
      }
    );
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const isTimeout = err instanceof Error && err.name === 'AbortError';

    return NextResponse.json(
      {
        error: isTimeout ? 'Gutenberg API request timed out' : 'Unable to connect to Gutenberg API',
        latencyMs,
        results: [],
        count: 0,
        source: 'upstream',
      },
      { status: 504 }
    );
  }
}
