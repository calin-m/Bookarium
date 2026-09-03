import { NextRequest, NextResponse } from 'next/server';
import { SITE_CONFIG } from '@/config/site-config';
import { bookContentRateLimiter } from '@/lib/rate-limiter';

const ALLOWED_HOSTS = new Set(['www.gutenberg.org', 'gutenberg.org']);

export function isSafeUpstreamUrl(rawUrl: string): boolean {
  try {
    if (rawUrl.includes('..') || rawUrl.includes('@')) return false;
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (parsed.username || parsed.password || parsed.port) return false;
    const hostname = parsed.hostname.toLowerCase();
    if (!ALLOWED_HOSTS.has(hostname)) return false;
    // Reject internal hostnames and IP addresses
    if (/^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(hostname)) {
      return false;
    }
    // Reject paths containing invalid characters
    if (!/^\/[a-zA-Z0-9/_\-\.]+$/.test(parsed.pathname)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function sanitizeUpstreamUrl(rawUrl: string): string | null {
  if (!isSafeUpstreamUrl(rawUrl)) return null;
  try {
    const parsed = new URL(rawUrl);
    const numericId =
      parsed.pathname.match(/\/(\d{1,8})(?:[./-]|$)/)?.[1] ||
      parsed.pathname.match(/pg(\d{1,8})\.txt/)?.[1];
    if (!numericId) return null;

    if (parsed.pathname.includes(`/files/${numericId}/${numericId}-0.txt`)) {
      return `https://gutenberg.org/files/${numericId}/${numericId}-0.txt`;
    }
    if (parsed.pathname.includes(`/files/${numericId}/${numericId}.txt`)) {
      return `https://gutenberg.org/files/${numericId}/${numericId}.txt`;
    }
    return `https://www.gutenberg.org/cache/epub/${numericId}/pg${numericId}.txt`;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  const rateLimit = bookContentRateLimiter.check(clientIp);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down and try again.' },
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

  const { searchParams } = new URL(request.url);
  const urlParam = searchParams.get('url') || '';
  const idParam = searchParams.get('id') || '';

  if (!urlParam && !idParam) {
    return NextResponse.json(
      { error: 'Missing "url" or "id" parameter.' },
      { status: 400 }
    );
  }

  if (urlParam && !isSafeUpstreamUrl(urlParam)) {
    return NextResponse.json(
      { error: 'Invalid or unauthorized upstream content URL.' },
      { status: 400 }
    );
  }

  // Strictly extract numeric digits, convert to integer primitive to break string taint flow
  const rawId =
    idParam.match(/^(\d{1,8})$/)?.[1] ||
    urlParam.match(/\/(\d{1,8})(?:[./-]|$)/)?.[1] ||
    urlParam.match(/pg(\d{1,8})\.txt/)?.[1] ||
    '';

  const bookId = parseInt(rawId, 10);
  if (!Number.isInteger(bookId) || bookId <= 0 || bookId > 10000000) {
    return NextResponse.json(
      { error: 'Missing or invalid Project Gutenberg book ID.' },
      { status: 400 }
    );
  }

  // Explicitly encode sanitized numeric ID and anchor to hardcoded Gutenberg origin via new URL
  const safeId = encodeURIComponent(String(Math.trunc(bookId)));
  const targetUrls: string[] = [
    new URL(`/cache/epub/${safeId}/pg${safeId}.txt`, 'https://www.gutenberg.org').toString(),
    new URL(`/files/${safeId}/${safeId}-0.txt`, 'https://www.gutenberg.org').toString(),
    new URL(`/files/${safeId}/${safeId}.txt`, 'https://www.gutenberg.org').toString(),
  ];

  let textContent = '';
  let fetchSuccess = false;

  for (const targetUrl of targetUrls) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(targetUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': `Bookarium-PublicDomain-Reader/1.0 (${SITE_CONFIG.GITHUB_REPO})`,
          Accept: 'text/plain, text/html, */*',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const text = await response.text();
        // Verify it's not a redirect HTML page
        if (text && !text.trim().startsWith('<p>The document has moved')) {
          textContent = text;
          fetchSuccess = true;
          break;
        }
      }
    } catch {
      clearTimeout(timeoutId);
    }
  }

  if (!fetchSuccess || !textContent) {
    return NextResponse.json(
      { error: 'Failed to fetch unabridged text from Project Gutenberg upstream.' },
      { status: 502 }
    );
  }

  return new NextResponse(textContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}


