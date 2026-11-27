/**
 * @module src/app/api/books/content/asset-renders
 * @scope Shared server-side R2 cover response helper, stateless `1200x630` OpenGraph reading card renderer (`next/og`), and `HTTP 451` card jurisdiction gate shared across `/api/books/content`, `/covers/[file]`, and `/og/books/[file]`.
 * @invariant Enforce unified `HTTP 451` US + international copyright blocking (`503` fail-closed for non-US metadata outages) ahead of OpenGraph card rendering (`enforceBookAssetJurisdictionGate`), serve binary covers strictly from private Cloudflare R2 (`404 no-store` on miss/unconfigured, `502 no-store` on R2 error), and avoid caching errors via Edge CDN tags.
 * @rationale Centralizing cover streaming and reading card rendering avoids duplicating `ImageResponse` layout JSX and R2 error-handling logic across internal API and crawler-accessible clean image routes.
 * @adr ADR-016, ADR-036, ADR-080, ADR-082, ADR-084
 */

import React from 'react';
import { NextRequest, NextResponse } from 'next/server';
import { ImageResponse } from 'next/og';
import { SITE_CONFIG } from '@/config/site-config';
import {
  buildApiSecurityHeaders,
  createNoStoreErrorResponse,
} from '@/lib/api-utils';
import { isBookPublicDomainInJurisdiction, type GenericBookInput } from '@/lib/copyright-engine';
import { resolveClientCountry } from '@/lib/country-resolver';
import { formatAuthorName } from '@/lib/utils';
import {
  CARD_DIMENSIONS,
  CARD_PALETTES,
  decodeReadingCardShareToken,
} from '@/lib/reading-card-export';
import { fetchR2CoverBytes } from '@/lib/r2-client';
import { resolveBookMetadata } from './metadata-cache';

export const CONTENT_COVER_CACHE_CONTROL =
  'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=2592000';

export const CONTENT_CARD_CACHE_CONTROL =
  'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800';

export type CardJurisdictionResult =
  | { allowed: true; metadata: GenericBookInput | null }
  | { allowed: false; response: NextResponse };

/**
 * Evaluates US and international public domain clearance ahead of card PNG generation.
 */
export async function enforceBookAssetJurisdictionGate(
  bookId: number,
  request: NextRequest,
  searchParams: URLSearchParams
): Promise<CardJurisdictionResult> {
  const country = resolveClientCountry(request, searchParams);
  const resolvedMetadata = await resolveBookMetadata(bookId);

  if (country !== 'US' && !resolvedMetadata) {
    return {
      allowed: false,
      response: createNoStoreErrorResponse(
        'Unable to verify copyright clearance for your jurisdiction at this time.',
        503,
        {
          country,
          reason:
            'Upstream metadata verification is unavailable. Streaming withheld under international fail-closed protocol.',
        }
      ),
    };
  }

  if (resolvedMetadata) {
    const evaluation = isBookPublicDomainInJurisdiction(resolvedMetadata, country);
    if (!evaluation.isAllowed) {
      return {
        allowed: false,
        response: NextResponse.json(
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
              Vary: 'x-vercel-ip-country, Accept-Encoding',
              'Cache-Control': 'public, s-maxage=86400',
              ...buildApiSecurityHeaders('same-origin'),
            },
          }
        ),
      };
    }
  }

  return { allowed: true, metadata: resolvedMetadata };
}

/**
 * Renders the canonical stateless 1200x630 OpenGraph reading card PNG via `next/og`.
 */
export function renderBookCardAssetResponse(options: {
  bookId: number;
  metadata: GenericBookInput | null;
  shareToken: string | null;
}): ImageResponse {
  const { bookId, metadata, shareToken } = options;
  const rawTitle = metadata?.title || `Project Gutenberg Volume #${bookId}`;
  const firstAuthor = metadata?.authors?.[0];
  const rawAuthor = firstAuthor
    ? typeof firstAuthor === 'string'
      ? firstAuthor
      : firstAuthor.name
    : 'Classic Literature';
  const displayAuthor = formatAuthorName(rawAuthor) || 'Classic Literature';

  const decoded = decodeReadingCardShareToken(bookId, shareToken) ?? {
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
      'Cache-Control': CONTENT_CARD_CACHE_CONTROL,
      Vary: 'x-vercel-ip-country, Accept-Encoding',
      ...buildApiSecurityHeaders('cross-origin'),
    },
  });
}

/**
 * Fetches binary cover bytes strictly from private Cloudflare R2 and maps errors cleanly.
 */
export async function fetchR2CoverAssetResponse(
  bookId: number,
  buildSuccessHeaders: () => Record<string, string>
): Promise<NextResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const coverResult = await fetchR2CoverBytes(bookId, controller.signal);
    clearTimeout(timeoutId);

    if (coverResult.status === 'ok') {
      return new NextResponse(coverResult.bytes, {
        status: 200,
        headers: buildSuccessHeaders(),
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
