import { NextRequest, NextResponse } from 'next/server';
import { SITE_CONFIG } from '@/config/site-config';
import { bookContentRateLimiter } from '@/lib/rate-limiter';
import { getClientIp, createRateLimitErrorResponse } from '@/lib/api-utils';
import { isBookPublicDomainInJurisdiction, normalizeCountryCode, type GenericBookInput } from '@/lib/copyright-engine';
import { GEO_COOKIE_NAME } from '@/proxy';
import { API_ENDPOINTS } from '@/config/api-endpoints';

import { isSafeUpstreamUrl } from './url-validator';

import { resolveBookMetadata } from './metadata-cache';

const MAX_BOOK_BYTES = 15 * 1024 * 1024; // 15 MB threshold for Gutenberg plain text volumes

export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);

  const rateLimit = bookContentRateLimiter.check(clientIp);
  if (!rateLimit.success) {
    return createRateLimitErrorResponse(rateLimit);
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

  // Extract user jurisdiction
  const devCountryOverride =
    process.env.NODE_ENV !== 'production' ? searchParams.get('country') : null;
  const rawCountry =
    devCountryOverride ||
    request.headers.get('x-vercel-ip-country') ||
    request.headers.get('x-bookarium-country') ||
    request.cookies.get(GEO_COOKIE_NAME)?.value ||
    'US';
  const country = normalizeCountryCode(rawCountry);

  // Jurisdictional Copyright Gatekeeper:
  // In international jurisdictions, verify book public domain status before streaming any bytes
  if (country !== 'US') {
    const metadata = await resolveBookMetadata(bookId);

    if (!metadata) {
      // Fail-closed: Cannot stream unverified titles to non-US users
      return NextResponse.json(
        {
          error: 'Unable to verify copyright clearance for your jurisdiction at this time.',
          country,
          reason: 'Upstream metadata verification is unavailable. Streaming withheld under international fail-closed protocol.',
        },
        {
          status: 503,
          headers: {
            'Vary': 'x-vercel-ip-country, Accept-Encoding',
          },
        }
      );
    }

    const evaluation = isBookPublicDomainInJurisdiction(metadata, country);
    if (!evaluation.isAllowed) {
      // Return HTTP 451 (Unavailable For Legal Reasons)
      return NextResponse.json(
        {
          error: 'This work is protected by copyright in your jurisdiction and cannot be streamed.',
          country: evaluation.country,
          rule: evaluation.rule,
          restrictingAuthor: evaluation.restrictingAuthor,
          restrictingDeathYear: evaluation.restrictingDeathYear,
          publicDomainYear: evaluation.publicDomainYear,
          reason: evaluation.reason,
        },
        {
          status: 451,
          headers: {
            'Content-Type': 'application/json',
            'Vary': 'x-vercel-ip-country, Accept-Encoding',
            'Cache-Control': 'public, s-maxage=86400',
          },
        }
      );
    }
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
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > MAX_BOOK_BYTES) {
          continue;
        }

        let text = '';
        if (response.body && typeof response.body.getReader === 'function') {
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let totalBytes = 0;
          let oversized = false;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              totalBytes += value.length;
              if (totalBytes > MAX_BOOK_BYTES) {
                oversized = true;
                controller.abort();
                break;
              }
              chunks.push(value);
            }
          }

          if (oversized) {
            continue;
          }

          const decoder = new TextDecoder('utf-8');
          text = chunks.map((c) => decoder.decode(c, { stream: true })).join('') + decoder.decode();
        } else {
          text = await response.text();
        }

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
      'Vary': 'x-vercel-ip-country, Accept-Encoding',
    },
  });
}
