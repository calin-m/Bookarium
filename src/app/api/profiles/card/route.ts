/**
 * @module src/app/api/profiles/card/route
 * @scope Stateless Next.js GET route rendering 1200x630 OpenGraph PNG scholar profile cards via `ImageResponse` with strict ADR-033 anti-enumeration fallback.
 * @invariant Enforce `profileCardRateLimiter` via `getClientIp`, reject disallowed query keys outside `ALLOWED_PROFILE_CARD_QUERY_KEYS` with `createNoStoreErrorResponse` (`400 no-store`), decode `?s=<token>` strictly for visual flags (`theme`, `includeStats`) via `decodeProfileCardShareToken`, collapse private, missing, malformed, and unavailable accounts uniformly onto an identical neutral Bookarium card, and emit `Cross-Origin-Resource-Policy: cross-origin` on rendered PNG responses.
 * @rationale Rendering Scholar Sanctuary cards from live `is_public = true` Supabase rows while keeping `?s=` purely visual prevents client claim spoofing and guarantees zero profile enumeration across social crawler requests.
 * @adr ADR-022, ADR-033, ADR-080
 */

import React from 'react';
import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { SITE_CONFIG } from '@/config/site-config';
import { profileCardRateLimiter } from '@/lib/rate-limiter';
import {
  buildApiSecurityHeaders,
  createNoStoreErrorResponse,
  createRateLimitErrorResponse,
  getClientIp,
  hasUnexpectedQueryParams,
} from '@/lib/api-utils';
import { CARD_DIMENSIONS, CARD_PALETTES } from '@/lib/share-card-primitives';
import { decodeProfileCardShareToken } from '@/lib/profile-card-export';
import { fetchPublicScholarCardPayload } from '@/app/u/[username]/profile-layout-utils';

const ALLOWED_PROFILE_CARD_QUERY_KEYS = new Set(['username', 's']);

function renderNeutralScholarCardResponse(): ImageResponse {
  const palette = CARD_PALETTES.light;

  const neutralElement = React.createElement(
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
        'BOOKARIUM • SCHOLAR SANCTUARY'
      ),
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            color: palette.mutedInk,
            fontSize: '18px',
            fontWeight: 600,
            fontFamily: 'sans-serif',
          },
        },
        'PUBLIC DOMAIN ARCHIVE'
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
            fontSize: '52px',
            fontWeight: 700,
            lineHeight: 1.18,
            marginBottom: '18px',
          },
        },
        'Public Domain Scholar Sanctuary'
      ),
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            color: palette.secondaryInk,
            fontSize: '28px',
            fontStyle: 'italic',
            lineHeight: 1.35,
          },
        },
        'Explore curated classic bookshelves, Ex-Libris bookplates, and public domain literary notes on Bookarium.'
      )
    ),
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
            fontSize: '18px',
            fontWeight: 600,
            color: palette.accent,
          },
        },
        `${SITE_CONFIG.SITE_HOST}/u`
      )
    )
  );

  return new ImageResponse(neutralElement, {
    width: CARD_DIMENSIONS.width,
    height: CARD_DIMENSIONS.height,
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600',
      Vary: 'Accept-Encoding',
      ...buildApiSecurityHeaders('cross-origin'),
    },
  });
}

export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimit = profileCardRateLimiter.check(clientIp);
  if (!rateLimit.success) {
    return createRateLimitErrorResponse(rateLimit);
  }

  const { searchParams } = new URL(request.url);
  if (hasUnexpectedQueryParams(searchParams, ALLOWED_PROFILE_CARD_QUERY_KEYS)) {
    return createNoStoreErrorResponse('Unsupported or disallowed query parameter.', 400);
  }

  const rawUsername = (searchParams.get('username') || '').trim();
  const sParam = searchParams.get('s');

  const resolution = rawUsername
    ? await fetchPublicScholarCardPayload(rawUsername)
    : ({ status: 'private_or_missing' } as const);

  // Strict ADR-033 anti-enumeration: private, missing, malformed, and unavailable handles collapse
  // uniformly to an identical neutral Bookarium card with zero account details leaked.
  if (resolution.status !== 'public') {
    return renderNeutralScholarCardResponse();
  }

  const { card } = resolution;
  const decoded = decodeProfileCardShareToken(card.username, sParam) ?? {
    theme: 'light' as const,
    includeStats: true,
  };
  const palette = CARD_PALETTES[decoded.theme] ?? CARD_PALETTES.light;
  const displayedPills = decoded.includeStats ? card.statsPills : [];

  const truncatedBio =
    card.bio && card.bio.length > 155 ? `${card.bio.slice(0, 152).trimEnd()}…` : card.bio;
  const attributionText = card.bioBookTitle
    ? card.bioBookAuthor
      ? `— ${card.bioBookTitle}, ${card.bioBookAuthor}`
      : `— ${card.bioBookTitle}`
    : null;

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
        padding: '46px 56px',
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
        'BOOKARIUM • PUBLIC SCHOLAR'
      ),
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            color: palette.mutedInk,
            fontSize: '18px',
            fontWeight: 600,
            fontFamily: 'sans-serif',
          },
        },
        `SCHOLAR SINCE ${card.memberSince.toUpperCase()}`
      )
    ),
    React.createElement(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          marginTop: '12px',
          marginBottom: '12px',
        },
      },
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '22px',
            marginBottom: '20px',
          },
        },
        React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '72px',
              height: '72px',
              borderRadius: '999px',
              backgroundColor: palette.accentSoft,
              border: `2px solid ${palette.accent}`,
              color: palette.accent,
              fontSize: '26px',
              fontWeight: 700,
            },
          },
          card.initials
        ),
        React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              flexDirection: 'column',
            },
          },
          React.createElement(
            'div',
            {
              style: {
                display: 'flex',
                color: palette.primaryInk,
                fontSize: '46px',
                fontWeight: 700,
                lineHeight: 1.15,
              },
            },
            card.displayName.length > 42
              ? `${card.displayName.slice(0, 39).trimEnd()}…`
              : card.displayName
          ),
          React.createElement(
            'div',
            {
              style: {
                display: 'flex',
                color: palette.accent,
                fontSize: '22px',
                fontWeight: 600,
                fontFamily: 'sans-serif',
              },
            },
            `@${card.username.toLowerCase()}`
          )
        )
      ),
      truncatedBio
        ? React.createElement(
            'div',
            {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              },
            },
            React.createElement(
              'div',
              {
                style: {
                  display: 'flex',
                  color: palette.secondaryInk,
                  fontSize: '26px',
                  fontStyle: 'italic',
                  lineHeight: 1.35,
                },
              },
              `“${truncatedBio}”`
            ),
            attributionText
              ? React.createElement(
                  'div',
                  {
                    style: {
                      display: 'flex',
                      color: palette.mutedInk,
                      fontSize: '18px',
                      fontFamily: 'sans-serif',
                    },
                  },
                  attributionText.length > 90
                    ? `${attributionText.slice(0, 87).trimEnd()}…`
                    : attributionText
                )
              : null
          )
        : React.createElement(
            'div',
            {
              style: {
                display: 'flex',
                color: palette.secondaryInk,
                fontSize: '26px',
                fontStyle: 'italic',
                lineHeight: 1.35,
              },
            },
            'Curated public domain shelves, pinned Ex-Libris bookplates, and reading milestones.'
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
      displayedPills.length > 0
        ? React.createElement(
            'div',
            {
              style: {
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '18px',
              },
            },
            ...displayedPills.map((pill) =>
              React.createElement(
                'span',
                {
                  key: pill,
                  style: {
                    display: 'flex',
                    padding: '6px 16px',
                    borderRadius: '8px',
                    backgroundColor: palette.accentSoft,
                    border: `1.5px solid ${palette.innerBorder}`,
                    color: palette.accent,
                    fontSize: '17px',
                    fontWeight: 700,
                    fontFamily: 'sans-serif',
                  },
                },
                pill
              )
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
          'span',
          {
            style: {
              fontSize: '20px',
              color: palette.mutedInk,
            },
          },
          'Curated Public Domain Sanctuary'
        ),
        React.createElement(
          'span',
          {
            style: {
              fontSize: '19px',
              fontWeight: 700,
              color: palette.primaryInk,
            },
          },
          `${SITE_CONFIG.SITE_HOST}/u/${card.username.toLowerCase()}`
        )
      )
    )
  );

  return new ImageResponse(cardElement, {
    width: CARD_DIMENSIONS.width,
    height: CARD_DIMENSIONS.height,
    headers: {
      'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      Vary: 'Accept-Encoding',
      ...buildApiSecurityHeaders('cross-origin'),
    },
  });
}
