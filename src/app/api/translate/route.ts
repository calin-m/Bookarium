import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { InMemoryRateLimiter } from '@/lib/rate-limiter';
import { SITE_CONFIG } from '@/config/site-config';

// Generous rate limiting for normal reader flow (60 translation requests / min per IP)
export const translateRateLimiter = new InMemoryRateLimiter({
  windowMs: 60_000,
  maxRequests: 60,
});

export class SimpleLRUCache<K, V> {
  private cache = new Map<K, V>();
  constructor(private readonly maxEntries: number = 1000) {}

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const val = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }

  set(key: K, val: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, val);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const serverTranslationCache = new SimpleLRUCache<string, TranslationResponse>(1000);

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
  if (text.length > 15000) {
    return NextResponse.json(
      { error: 'Text payload exceeds maximum allowed size of 15,000 characters.' },
      { status: 400 }
    );
  }

  const targetLang = to.trim();
  const sourceLang = typeof from === 'string' && from.trim() ? from.trim() : 'auto';

  const cacheKey = crypto
    .createHash('sha256')
    .update(`${sourceLang}:${targetLang}:${text}`)
    .digest('hex');

  const cached = serverTranslationCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        'X-Cache-Lookup': 'HIT',
      },
    });
  }

  try {
    const upstreamUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
      sourceLang
    )}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;

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

    serverTranslationCache.set(cacheKey, result);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        'X-Cache-Lookup': 'MISS',
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
