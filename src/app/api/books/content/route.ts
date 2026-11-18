/**
 * @module src/app/api/books/content/route
 * @scope Multi-purpose book asset endpoint streaming plain-text volumes (`type=''`), R2-backed cover JPEGs (`type=cover`), and stateless `1200x630` OpenGraph reading cards (`type=card`).
 * @invariant Reject disallowed query params (allowing `s` exclusively with `type=card`), enforce mode-scoped rate limiters, validate upstream URLs via SSRF mirror allowlists (`isSafeUpstreamUrl`), reject HTTP `200` `text/html` outage/interstitial pages (`isHtmlPayload`), and bound payloads (`MAX_R2_BOOK_BYTES` text / `MAX_R2_COVER_BYTES` cover).
 * @invariant Enforce `HTTP 451` gatekeeping whenever resolved metadata restricts a volume in the caller's jurisdiction (including US `copyright === true` blocks) on plain-text and `type=card` requests, fail closed with `503` for non-US requests when metadata is unavailable, and bypass `resolveBookMetadata` for `type=cover` requests; emit `Cross-Origin-Resource-Policy: cross-origin` exclusively for `200` `type=card` PNGs.
 * @invariant Serve `type=cover` strictly from private Cloudflare R2 (`404` on miss or unconfigured, zero Project Gutenberg fallback), serve plain text strictly from R2 when `isR2Configured()` (falling back to Project Gutenberg mirrors only when `R2_*` env vars are unset), coalesce concurrent upstream fetches per `bookId` inside `inFlightMirrorFetches`, and cache resolved text in `bookContentLruCache`.
 * @rationale Keeping R2 credentials server-only avoids public bucket exposure while eliminating browser/runtime Gutenberg hotlinking and preserving zero-key local clone compatibility when unconfigured.
 * @adr ADR-016, ADR-022, ADR-039, ADR-080, ADR-082
 */

import React from 'react';
import { NextRequest, NextResponse } from 'next/server';
import { ImageResponse } from 'next/og';
import { SITE_CONFIG } from '@/config/site-config';
import {
  bookContentRateLimiter,
  bookCardRateLimiter,
  bookCoverRateLimiter,
} from '@/lib/rate-limiter';
import {
  getClientIp,
  createRateLimitErrorResponse,
  buildApiSecurityHeaders,
  hasUnexpectedQueryParams,
  createNoStoreErrorResponse,
} from '@/lib/api-utils';
import { isBookPublicDomainInJurisdiction } from '@/lib/copyright-engine';
import { resolveClientCountry } from '@/lib/country-resolver';
import { formatAuthorName } from '@/lib/utils';
import {
  CARD_DIMENSIONS,
  CARD_PALETTES,
  decodeReadingCardShareToken,
} from '@/lib/reading-card-export';
import {
  MAX_R2_BOOK_BYTES,
  isHtmlPayload,
  isR2Configured,
  fetchR2CoverBytes,
  fetchR2BookText,
} from '@/lib/r2-client';

import { isSafeUpstreamUrl } from './url-validator';
import {
  resolveBookMetadata,
  getCachedBookContent,
  setCachedBookContent,
} from './metadata-cache';
import { isSupabaseConfigured } from '@/lib/catalog/supabase-provider';
import { createClient } from '@/lib/supabase/client';

const ALLOWED_CONTENT_QUERY_KEYS = new Set(['id', 'url', 'type', 's']);
const DEV_ONLY_CONTENT_QUERY_KEYS = new Set(['country']);
const SUPPORTED_CONTENT_TYPES = new Set(['', 'cover', 'card']);
const inFlightMirrorFetches = new Map<
  number,
  Promise<{
    textContent: string;
    fetchSuccess: boolean;
    notFound?: boolean;
    source?: 'r2' | 'gutenberg-mirror';
  }>
>();

export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);
  const { searchParams } = new URL(request.url);
  const typeParam = (searchParams.get('type') || '').trim();

  const activeRateLimiter =
    typeParam === 'card'
      ? bookCardRateLimiter
      : typeParam === 'cover'
      ? bookCoverRateLimiter
      : bookContentRateLimiter;

  const rateLimit = activeRateLimiter.check(clientIp);
  if (!rateLimit.success) {
    return createRateLimitErrorResponse(rateLimit);
  }

  if (
    hasUnexpectedQueryParams(
      searchParams,
      ALLOWED_CONTENT_QUERY_KEYS,
      DEV_ONLY_CONTENT_QUERY_KEYS
    )
  ) {
    return createNoStoreErrorResponse('Unsupported or disallowed query parameter.', 400);
  }

  if (!SUPPORTED_CONTENT_TYPES.has(typeParam)) {
    return createNoStoreErrorResponse('Unsupported content "type" parameter.', 400);
  }

  if (searchParams.has('s') && typeParam !== 'card') {
    return createNoStoreErrorResponse('Share token "s" is only permitted with type=card.', 400);
  }

  const urlParam = searchParams.get('url') || '';
  const idParam = searchParams.get('id') || '';

  if (!urlParam && !idParam) {
    return createNoStoreErrorResponse('Missing "url" or "id" parameter.', 400);
  }

  if (urlParam && !isSafeUpstreamUrl(urlParam)) {
    return createNoStoreErrorResponse('Invalid or unauthorized upstream content URL.', 400);
  }

  // Strictly extract numeric digits, convert to integer primitive to break string taint flow
  const rawId =
    idParam.match(/^(\d{1,8})$/)?.[1] ||
    urlParam.match(/\/(\d{1,8})(?:[./-]|$)/)?.[1] ||
    urlParam.match(/pg(\d{1,8})\.txt/)?.[1] ||
    '';

  const bookId = parseInt(rawId, 10);
  if (!Number.isInteger(bookId) || bookId <= 0 || bookId > 10000000) {
    return createNoStoreErrorResponse('Missing or invalid Project Gutenberg book ID.', 400);
  }

  // Extract user jurisdiction through deterministic priority cascade
  const country = resolveClientCountry(request, searchParams);

  // Jurisdictional Copyright Gatekeeper:
  // Verify public domain status across US (`copyright === true` -> 451) and international jurisdictions (`503` fail-closed when metadata unavailable), while bypassing metadata lookups on `type=cover`.
  const resolvedMetadata = typeParam !== 'cover' ? await resolveBookMetadata(bookId) : null;

  if (country !== 'US' && typeParam !== 'cover' && !resolvedMetadata) {
    // Fail-closed: Cannot stream unverified titles to non-US users
    return createNoStoreErrorResponse(
      'Unable to verify copyright clearance for your jurisdiction at this time.',
      503,
      {
        country,
        reason:
          'Upstream metadata verification is unavailable. Streaming withheld under international fail-closed protocol.',
      }
    );
  }

  if (typeParam !== 'cover' && resolvedMetadata) {
    const evaluation = isBookPublicDomainInJurisdiction(resolvedMetadata, country);
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
            ...buildApiSecurityHeaders('same-origin'),
          },
        }
      );
    }
  }

  // ==========================================================================
  // Stateless On-the-Fly OpenGraph Social Reading Card (1200x630 PNG)
  // ==========================================================================
  if (typeParam === 'card') {
    const metadata = resolvedMetadata;
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
            `${SITE_CONFIG.SITE_HOST}/read/${bookId}`
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
        ...buildApiSecurityHeaders('cross-origin'),
      },
    });
  }

  // ==========================================================================
  // Binary Cover Image Streaming (Strict Private Cloudflare R2 Storage)
  // ==========================================================================
  if (typeParam === 'cover') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const coverResult = await fetchR2CoverBytes(bookId, controller.signal);
      clearTimeout(timeoutId);

      if (coverResult.status === 'ok') {
        return new NextResponse(coverResult.bytes, {
          status: 200,
          headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000',
            Vary: 'Accept-Encoding',
            'X-Bookarium-Source': 'r2',
            ...buildApiSecurityHeaders('same-origin'),
          },
        });
      }

      if (coverResult.status === 'not_found' || coverResult.status === 'unconfigured') {
        return createNoStoreErrorResponse(
          'Cover artwork is not available in R2 asset storage.',
          404
        );
      }

      return createNoStoreErrorResponse(
        'Failed to fetch cover image from R2 asset storage.',
        502
      );
    } catch {
      clearTimeout(timeoutId);
      return createNoStoreErrorResponse(
        'Failed to fetch cover image from R2 asset storage.',
        502
      );
    }
  }

  // ==========================================================================
  // Tier 0: Server-Side In-Memory LRU Cache (Cross-Jurisdiction Warm Hit)
  // ==========================================================================
  const cachedBook = getCachedBookContent(bookId);
  if (cachedBook) {
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      'Vary': 'x-vercel-ip-country, Accept-Encoding',
      ...buildApiSecurityHeaders('same-origin'),
    };
    if (cachedBook.source === 'supabase' || cachedBook.source === 'r2') {
      responseHeaders['X-Bookarium-Source'] = cachedBook.source;
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
            'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
            'Vary': 'x-vercel-ip-country, Accept-Encoding',
            'X-Bookarium-Source': 'supabase',
            ...buildApiSecurityHeaders('same-origin'),
          },
        });
      }
    } catch {
      // Degrade gracefully to Tier 1.5 / Tier 2 content source
    }
  }

  // ==========================================================================
  // Tier 1.5 / Tier 2: Cloudflare R2 (Strict When Configured) or Zero-Key Mirror Fallback
  // ==========================================================================
  let mirrorPromise = inFlightMirrorFetches.get(bookId);
  if (!mirrorPromise) {
    const r2Enabled = isR2Configured();

    if (r2Enabled) {
      mirrorPromise = (async () => {
        const r2Result = await fetchR2BookText(bookId);
        if (r2Result.status === 'ok') {
          return { textContent: r2Result.text, fetchSuccess: true, source: 'r2' as const };
        }
        return {
          textContent: '',
          fetchSuccess: false,
          notFound: r2Result.status === 'not_found',
          source: 'r2' as const,
        };
      })().finally(() => {
        inFlightMirrorFetches.delete(bookId);
      });
    } else {
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
              const upstreamContentType = response.headers?.get('content-type');
              if (isHtmlPayload(upstreamContentType)) {
                continue;
              }

              const contentLength = response.headers?.get('content-length');
              if (contentLength && parseInt(contentLength, 10) > MAX_R2_BOOK_BYTES) {
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
                    if (totalBytes > MAX_R2_BOOK_BYTES) {
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

              // Verify upstream payload is genuine plain text rather than an HTML redirect/outage page
              if (text && !isHtmlPayload(upstreamContentType, text.slice(0, 512))) {
                resolvedText = text;
                resolvedSuccess = true;
                break;
              }
            }
          } catch {
            clearTimeout(timeoutId);
          }
        }

        return {
          textContent: resolvedText,
          fetchSuccess: resolvedSuccess,
          source: 'gutenberg-mirror' as const,
        };
      })().finally(() => {
        inFlightMirrorFetches.delete(bookId);
      });
    }

    inFlightMirrorFetches.set(bookId, mirrorPromise);
  }

  const { textContent, fetchSuccess, notFound, source } = await mirrorPromise;

  if (!fetchSuccess || !textContent) {
    if (notFound) {
      return createNoStoreErrorResponse(
        'Book text is not available in R2 asset storage.',
        404
      );
    }
    return createNoStoreErrorResponse(
      source === 'r2'
        ? 'Failed to fetch unabridged text from R2 asset storage.'
        : 'Failed to fetch unabridged text from Project Gutenberg upstream.',
      502
    );
  }

  const resolvedSource = source || 'gutenberg-mirror';
  setCachedBookContent(bookId, textContent, resolvedSource);

  const okHeaders: Record<string, string> = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
    'Vary': 'x-vercel-ip-country, Accept-Encoding',
    ...buildApiSecurityHeaders('same-origin'),
  };
  if (resolvedSource === 'r2') {
    okHeaders['X-Bookarium-Source'] = 'r2';
  }

  return new NextResponse(textContent, {
    status: 200,
    headers: okHeaders,
  });
}
