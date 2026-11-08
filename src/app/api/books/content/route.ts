import React from 'react';
import { NextRequest, NextResponse } from 'next/server';
import { ImageResponse } from 'next/og';
import { SITE_CONFIG } from '@/config/site-config';
import { bookContentRateLimiter } from '@/lib/rate-limiter';
import { getClientIp, createRateLimitErrorResponse } from '@/lib/api-utils';
import { isBookPublicDomainInJurisdiction } from '@/lib/copyright-engine';
import { resolveClientCountry } from '@/lib/country-resolver';
import { formatAuthorName } from '@/lib/utils';
import {
  CARD_DIMENSIONS,
  CARD_PALETTES,
  decodeReadingCardShareToken,
} from '@/lib/reading-card-export';

import { isSafeUpstreamUrl } from './url-validator';
import {
  resolveBookMetadata,
  getCachedBookContent,
  setCachedBookContent,
} from './metadata-cache';
import { isSupabaseConfigured } from '@/lib/catalog/supabase-provider';
import { createClient } from '@/lib/supabase/client';

const MAX_BOOK_BYTES = 15 * 1024 * 1024; // 15 MB threshold for Gutenberg plain text volumes
const MAX_COVER_BYTES = 2 * 1024 * 1024; // 2 MB threshold for Gutenberg cover images
const inFlightMirrorFetches = new Map<
  number,
  Promise<{ textContent: string; fetchSuccess: boolean }>
>();

export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);

  const rateLimit = bookContentRateLimiter.check(clientIp);
  if (!rateLimit.success) {
    return createRateLimitErrorResponse(rateLimit);
  }

  const { searchParams } = new URL(request.url);
  const urlParam = searchParams.get('url') || '';
  const idParam = searchParams.get('id') || '';
  const typeParam = searchParams.get('type') || '';

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

  // Extract user jurisdiction through deterministic priority cascade
  const country = resolveClientCountry(request, searchParams);

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

  // ==========================================================================
  // Stateless On-the-Fly OpenGraph Social Reading Card (1200x630 PNG)
  // ==========================================================================
  if (typeParam === 'card') {
    const metadata = await resolveBookMetadata(bookId);
    const rawTitle = metadata?.title || `Project Gutenberg Volume #${bookId}`;
    const firstAuthor = metadata?.authors?.[0];
    const rawAuthor = firstAuthor
      ? typeof firstAuthor === 'string'
        ? firstAuthor
        : firstAuthor.name
      : 'Classic Literature';
    const displayAuthor = formatAuthorName(rawAuthor) || 'Classic Literature';

    const sParam = searchParams.get('s');
    const decoded = decodeReadingCardShareToken(bookId, sParam) ?? {
      theme: 'light' as const,
      includeProgress: false,
      progress: 0,
      currentSection: 1,
      totalSections: 1,
    };
    const palette = CARD_PALETTES[decoded.theme];

    const cardElement = React.createElement(
      'div',
      {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: palette.cardSurface,
          padding: '48px 56px',
          border: `4px solid ${palette.outerBorder}`,
          boxSizing: 'border-box',
          fontFamily: 'Georgia, serif',
        },
      },
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          },
        },
        React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              padding: '8px 20px',
              borderRadius: '999px',
              backgroundColor: palette.accentSoft,
              border: `1.5px solid ${palette.innerBorder}`,
              color: palette.accent,
              fontSize: '18px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              fontFamily: 'sans-serif',
            },
          },
          decoded.includeProgress ? 'CURRENTLY READING' : 'FEATURED CLASSIC'
        ),
        React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              color: palette.mutedInk,
              fontSize: '20px',
              fontWeight: 600,
              fontFamily: 'sans-serif',
            },
          },
          `GUTENBERG #${bookId}`
        )
      ),
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            marginTop: '16px',
            marginBottom: '16px',
          },
        },
        React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              color: palette.primaryInk,
              fontSize: '54px',
              fontWeight: 700,
              lineHeight: 1.18,
              marginBottom: '16px',
            },
          },
          rawTitle.length > 90 ? `${rawTitle.slice(0, 87)}...` : rawTitle
        ),
        React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              color: palette.secondaryInk,
              fontSize: '30px',
              fontStyle: 'italic',
            },
          },
          `by ${displayAuthor}`
        )
      ),
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
          },
        },
        decoded.includeProgress
          ? React.createElement(
              'div',
              {
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                  marginBottom: '22px',
                },
              },
              React.createElement(
                'div',
                {
                  style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    width: '100%',
                    marginBottom: '10px',
                    fontFamily: 'sans-serif',
                    fontSize: '20px',
                    fontWeight: 600,
                    color: palette.mutedInk,
                  },
                },
                React.createElement(
                  'span',
                  null,
                  `Section ${decoded.currentSection} of ${decoded.totalSections}`
                ),
                React.createElement(
                  'span',
                  { style: { color: palette.accent, fontWeight: 700 } },
                  `${decoded.progress}% Completed`
                )
              ),
              React.createElement(
                'div',
                {
                  style: {
                    display: 'flex',
                    width: '100%',
                    height: '14px',
                    borderRadius: '999px',
                    backgroundColor: palette.trackBg,
                    overflow: 'hidden',
                  },
                },
                React.createElement('div', {
                  style: {
                    display: 'flex',
                    width: `${Math.max(2, decoded.progress)}%`,
                    height: '100%',
                    borderRadius: '999px',
                    backgroundColor: palette.accent,
                  },
                })
              )
            )
          : null,
        React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              paddingTop: '18px',
              borderTop: `1.5px solid ${palette.innerBorder}`,
              fontFamily: 'sans-serif',
            },
          },
          React.createElement(
            'div',
            {
              style: {
                display: 'flex',
                flexDirection: 'column',
              },
            },
            React.createElement(
              'span',
              {
                style: {
                  fontSize: '24px',
                  fontWeight: 700,
                  color: palette.primaryInk,
                  letterSpacing: '0.08em',
                },
              },
              'BOOKARIUM'
            ),
            React.createElement(
              'span',
              {
                style: {
                  fontSize: '16px',
                  color: palette.mutedInk,
                },
              },
              'Unabridged Public Domain Literature — Free & Legal Forever'
            )
          ),
          React.createElement(
            'span',
            {
              style: {
                fontSize: '18px',
                fontWeight: 600,
                color: palette.accent,
              },
            },
            `bookarium.vercel.app/read/${bookId}`
          )
        )
      )
    );

    return new ImageResponse(cardElement, {
      width: CARD_DIMENSIONS.width,
      height: CARD_DIMENSIONS.height,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        Vary: 'x-vercel-ip-country, Accept-Encoding',
      },
    });
  }

  // ==========================================================================
  // Binary Cover Image Streaming (Project Gutenberg Mirrors)
  // ==========================================================================
  if (typeParam === 'cover') {
    const safeId = encodeURIComponent(String(Math.trunc(bookId)));
    const targetCoverUrls: string[] = [
      new URL(`/cache/epub/${safeId}/pg${safeId}.cover.medium.jpg`, 'https://aleph.gutenberg.org').toString(),
      new URL(`/cache/epub/${safeId}/pg${safeId}.cover.medium.jpg`, 'https://gutenberg.pglaf.org').toString(),
      new URL(`/cache/epub/${safeId}/pg${safeId}.cover.medium.jpg`, 'https://gutenberg.readingroo.ms').toString(),
      new URL(`/cache/epub/${safeId}/pg${safeId}.cover.medium.jpg`, 'https://www.gutenberg.org').toString(),
    ];

    for (const targetUrl of targetCoverUrls) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        let currentUrl = targetUrl;
        let response = await fetch(currentUrl, {
          signal: controller.signal,
          redirect: 'manual',
          headers: {
            'User-Agent': SITE_CONFIG.USER_AGENT,
            Accept: 'image/jpeg, image/*, */*',
            Connection: 'keep-alive',
          },
        });

        // Follow up to 3 redirect hops only if each target location is verified safe (anti-SSRF)
        let blockedRedirect = false;
        for (
          let hop = 0;
          hop < 3 &&
          (response.status === 301 ||
            response.status === 302 ||
            response.status === 303 ||
            response.status === 307 ||
            response.status === 308);
          hop++
        ) {
          const redirectLocation = response.headers?.get('location');
          if (redirectLocation && isSafeUpstreamUrl(redirectLocation, currentUrl)) {
            currentUrl = new URL(redirectLocation, currentUrl).toString();
            response = await fetch(currentUrl, {
              signal: controller.signal,
              redirect: 'manual',
              headers: {
                'User-Agent': SITE_CONFIG.USER_AGENT,
                Accept: 'image/jpeg, image/*, */*',
                Connection: 'keep-alive',
              },
            });
          } else {
            blockedRedirect = true;
            break;
          }
        }

        clearTimeout(timeoutId);

        if (blockedRedirect || !response.ok) {
          continue;
        }

        const contentLength = response.headers?.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > MAX_COVER_BYTES) {
          continue;
        }

        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_COVER_BYTES || arrayBuffer.byteLength === 0) {
          continue;
        }

        return new NextResponse(arrayBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=2592000',
            'Vary': 'x-vercel-ip-country, Accept-Encoding',
          },
        });
      } catch {
        clearTimeout(timeoutId);
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch cover image from Project Gutenberg mirrors.' },
      { status: 502 }
    );
  }

  // ==========================================================================
  // Tier 0: Server-Side In-Memory LRU Cache (Cross-Jurisdiction Warm Hit)
  // ==========================================================================
  const cachedBook = getCachedBookContent(bookId);
  if (cachedBook) {
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      'Vary': 'x-vercel-ip-country, Accept-Encoding',
    };
    if (cachedBook.source === 'supabase') {
      responseHeaders['X-Bookarium-Source'] = 'supabase';
    }
    return new NextResponse(cachedBook.text, {
      status: 200,
      headers: responseHeaders,
    });
  }

  // ==========================================================================
  // Tier 1: Instant Streaming from Dedicated Supabase PostgreSQL Catalog
  // ==========================================================================
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('books')
        .select('content')
        .eq('id', bookId)
        .abortSignal(AbortSignal.timeout(2500))
        .maybeSingle();

      if (!error && data?.content && data.content.trim().length > 0) {
        setCachedBookContent(bookId, data.content, 'supabase');
        return new NextResponse(data.content, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
            'Vary': 'x-vercel-ip-country, Accept-Encoding',
            'X-Bookarium-Source': 'supabase',
          },
        });
      }
    } catch {
      // Degrade gracefully to external multi-mirror fetch
    }
  }

  // ==========================================================================
  // Tier 2: Resilient Multi-Mirror Upstream Fetching with In-Flight Coalescing
  // ==========================================================================
  let mirrorPromise = inFlightMirrorFetches.get(bookId);
  if (!mirrorPromise) {
    const safeId = encodeURIComponent(String(Math.trunc(bookId)));
    const targetUrls: string[] = [
      new URL(`/cache/epub/${safeId}/pg${safeId}.txt`, 'https://aleph.gutenberg.org').toString(),
      new URL(`/cache/epub/${safeId}/pg${safeId}.txt`, 'https://gutenberg.pglaf.org').toString(),
      new URL(`/cache/epub/${safeId}/pg${safeId}.txt`, 'https://gutenberg.readingroo.ms').toString(),
      new URL(`/cache/epub/${safeId}/pg${safeId}.txt`, 'https://www.gutenberg.org').toString(),
      new URL(`/files/${safeId}/${safeId}-0.txt`, 'https://www.gutenberg.org').toString(),
      new URL(`/files/${safeId}/${safeId}.txt`, 'https://www.gutenberg.org').toString(),
    ];

    mirrorPromise = (async () => {
      let resolvedText = '';
      let resolvedSuccess = false;

      for (const targetUrl of targetUrls) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        try {
          let currentUrl = targetUrl;
          let response = await fetch(currentUrl, {
            signal: controller.signal,
            redirect: 'manual',
            headers: {
              'User-Agent': SITE_CONFIG.USER_AGENT,
              Accept: 'text/plain, text/html, */*',
              'Accept-Encoding': 'gzip, deflate, br',
              Connection: 'keep-alive',
            },
          });

          // Follow up to 3 redirect hops only if each target location is verified safe (anti-SSRF)
          let blockedRedirect = false;
          for (
            let hop = 0;
            hop < 3 &&
            (response.status === 301 ||
              response.status === 302 ||
              response.status === 303 ||
              response.status === 307 ||
              response.status === 308);
            hop++
          ) {
            const redirectLocation = response.headers?.get('location');
            if (redirectLocation && isSafeUpstreamUrl(redirectLocation, currentUrl)) {
              currentUrl = new URL(redirectLocation, currentUrl).toString();
              response = await fetch(currentUrl, {
                signal: controller.signal,
                redirect: 'manual',
                headers: {
                  'User-Agent': SITE_CONFIG.USER_AGENT,
                  Accept: 'text/plain, text/html, */*',
                  'Accept-Encoding': 'gzip, deflate, br',
                  Connection: 'keep-alive',
                },
              });
            } else {
              blockedRedirect = true;
              break;
            }
          }

          clearTimeout(timeoutId);

          if (blockedRedirect) {
            continue;
          }

          if (response.ok) {
            const contentLength = response.headers?.get('content-length');
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
              text =
                chunks.map((c) => decoder.decode(c, { stream: true })).join('') + decoder.decode();
            } else {
              text = await response.text();
            }

            // Verify it's not a redirect HTML page
            if (text && !text.trim().startsWith('<p>The document has moved')) {
              resolvedText = text;
              resolvedSuccess = true;
              break;
            }
          }
        } catch {
          clearTimeout(timeoutId);
        }
      }

      return { textContent: resolvedText, fetchSuccess: resolvedSuccess };
    })().finally(() => {
      inFlightMirrorFetches.delete(bookId);
    });

    inFlightMirrorFetches.set(bookId, mirrorPromise);
  }

  const { textContent, fetchSuccess } = await mirrorPromise;

  if (!fetchSuccess || !textContent) {
    return NextResponse.json(
      { error: 'Failed to fetch unabridged text from Project Gutenberg upstream.' },
      { status: 502 }
    );
  }

  setCachedBookContent(bookId, textContent, 'gutenberg-mirror');

  return new NextResponse(textContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      'Vary': 'x-vercel-ip-country, Accept-Encoding',
    },
  });
}
