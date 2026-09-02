import { NextRequest, NextResponse } from 'next/server';
import { InMemoryRateLimiter } from '@/lib/rate-limiter';
import { SITE_CONFIG } from '@/config/site-config';

// Generous rate limiting for normal reader flow (60 translation requests / min per IP)
export const translateRateLimiter = new InMemoryRateLimiter({
  windowMs: 60_000,
  maxRequests: 60,
});

export interface TranslationSegment {
  original: string;
  translated: string;
}

export interface TranslationResponse {
  translatedText: string;
  detectedSourceLanguage: string;
  targetLanguage: string;
  segments: TranslationSegment[];
}

export async function POST(request: NextRequest) {
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  const rateLimit = translateRateLimiter.check(clientIp);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Too many translation requests. Please slow down and try again.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.max(1, Math.ceil(rateLimit.resetMs / 1000))),
          'X-RateLimit-Limit': String(rateLimit.limit),
          'X-RateLimit-Remaining': String(rateLimit.remaining),
        },
      }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request payload.' },
      { status: 400 }
    );
  }

  const { text, to, from = 'auto' } = body || {};

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json(
      { error: 'Missing or empty "text" parameter.' },
      { status: 400 }
    );
  }

  if (!to || typeof to !== 'string' || !/^[a-zA-Z\-]{2,10}$/.test(to.trim())) {
    return NextResponse.json(
      { error: 'Invalid or missing target language "to" parameter.' },
      { status: 400 }
    );
  }

  // Guard against excessively large translation requests (15,000 characters limit per page)
  const trimmedText = text.slice(0, 15000);
  const targetLang = to.trim();
  const sourceLang = typeof from === 'string' && from.trim() ? from.trim() : 'auto';

  try {
    const upstreamUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
      sourceLang
    )}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(trimmedText)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        'User-Agent': `Bookarium-PublicDomain-Reader/1.0 (${SITE_CONFIG.GITHUB_REPO})`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream translation error (${response.status})` },
        { status: 502 }
      );
    }

    const data = await response.json();

    if (!Array.isArray(data) || !Array.isArray(data[0])) {
      return NextResponse.json(
        { error: 'Malformed response received from translation service.' },
        { status: 502 }
      );
    }

    const rawSegments = data[0] as Array<[string, string, ...any[]]>;
    const segments: TranslationSegment[] = [];
    let fullTranslatedText = '';

    for (const chunk of rawSegments) {
      if (chunk && typeof chunk[0] === 'string') {
        fullTranslatedText += chunk[0];
        segments.push({
          translated: chunk[0],
          original: typeof chunk[1] === 'string' ? chunk[1] : '',
        });
      }
    }

    const detectedSourceLanguage = typeof data[2] === 'string' ? data[2] : sourceLang;

    const result: TranslationResponse = {
      translatedText: fullTranslatedText,
      detectedSourceLanguage,
      targetLanguage: targetLang,
      segments,
    };

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Translation request timed out. Please try again.' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process translation request.' },
      { status: 500 }
    );
  }
}
