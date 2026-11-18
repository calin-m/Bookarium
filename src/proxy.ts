/**
 * @module src/proxy
 * @scope Edge middleware proxy coordinating Fetch Metadata anti-deeplink/cross-site isolation on `/api/books/content*`, jurisdiction resolution (`x-vercel-ip-country` / `bookarium-geo-country`), share token forwarding (`?s=`), and conditional Supabase SSR session refresh.
 * @invariant Short-circuit direct browser deeplinks (`Sec-Fetch-Dest: document|iframe|frame|embed|object|fencedframe`, `Sec-Fetch-Mode: navigate`) and `cross-site` subresource hotlinks on `/api/books/content*` (outside `type=card`) with `403 no-store` (`guardContentAssetRequest`) ahead of origin execution while leaving missing-header crawlers and `Vary` keys untouched; never execute `updateSession` or set `bookarium-geo-country` cookies on public `/api/books*` paths, `/auth/*` routes, service-worker precaches, or Next.js router prefetches; configure browser-readable geo/override cookies with `sameSite: 'lax'` and protocol-aware `secure: isHttpsRequest(request)`.
 * @invariant Bypass SSR token rotation on App Router RSC navigations (`rsc: 1`) outside `/account` and `/account/*`; only set `x-middleware-override-headers` when `validShareToken` is present.
 * @rationale Rejecting browser deeplinks and cross-site hotlinks at the Edge via Fetch Metadata protects private Cloudflare R2 assets without altering `Vary` or fragmenting `s-maxage` CDN keys, while skipping cookies and `x-middleware-override-headers` on public API and RSC requests preserves Edge caching and prevents concurrent OAuth refresh races.
 * @adr ADR-035, ADR-042, ADR-080, ADR-082
 */

import { NextResponse, type NextRequest } from 'next/server';
import { guardContentAssetRequest, isHttpsRequest } from '@/lib/api-utils';
import { updateSession } from '@/lib/supabase/middleware';

import {
  resolveClientCountry,
  GEO_COOKIE_NAME,
  DEV_OVERRIDE_COOKIE_NAME,
} from '@/lib/country-resolver';

export { GEO_COOKIE_NAME, DEV_OVERRIDE_COOKIE_NAME } from '@/lib/country-resolver';

/**
 * Determines whether a request should skip server-side Supabase session refresh.
 * Skipping background prefetches, Service Worker precache/warm requests, public APIs,
 * and OAuth callback routes prevents concurrent server requests from racing to rotate
 * single-use refresh tokens or splitting chunked OAuth cookies (sb-*-auth-token.0/.1).
 */
export function shouldSkipSessionRefresh(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/api/books') ||
    pathname.startsWith('/auth/') ||
    pathname === '/sw.js' ||
    pathname === '/manifest.webmanifest'
  ) {
    return true;
  }

  const purpose = request.headers.get('purpose');
  const secPurpose = request.headers.get('sec-purpose');
  if (
    purpose === 'prefetch' ||
    Boolean(secPurpose && secPurpose.includes('prefetch')) ||
    request.headers.get('next-router-prefetch') !== null ||
    request.headers.get('x-middleware-prefetch') !== null ||
    request.headers.get('x-bookarium-sw-precache') === '1'
  ) {
    return true;
  }

  // Client-side App Router RSC navigations outside protected /account routes do not
  // need server-side session token rotation; browser hydration checks session once on mount.
  if (
    request.headers.get('rsc') === '1' &&
    pathname !== '/account' &&
    !pathname.startsWith('/account/')
  ) {
    return true;
  }

  return false;
}

export async function proxy(request: NextRequest) {
  const isPublicBookApi = request.nextUrl.pathname.startsWith('/api/books');
  const isContentAssetApi = isPublicBookApi && request.nextUrl.pathname.includes('/content');
  if (isContentAssetApi) {
    const blockedAssetResponse = guardContentAssetRequest(request);
    if (blockedAssetResponse) {
      return blockedAssetResponse;
    }
  }
  const isSwPrecache = request.headers.get('x-bookarium-sw-precache') === '1';
  const rawShareToken = request.nextUrl.searchParams.get('s');
  const validShareToken =
    rawShareToken && /^[A-Za-z0-9_-]{8,64}$/.test(rawShareToken)
      ? rawShareToken
      : null;

  const detectedCountry = resolveClientCountry(request);
  if (validShareToken || !isContentAssetApi) {
    request.headers.set('x-bookarium-country', detectedCountry);
  }

  if (validShareToken) {
    request.headers.set('x-bookarium-share-token', validShareToken);
  }

  let response: NextResponse;

  if (shouldSkipSessionRefresh(request)) {
    response =
      validShareToken || !isContentAssetApi
        ? NextResponse.next({ request })
        : NextResponse.next();
  } else {
    try {
      response = await updateSession(request);
    } catch {
      response = NextResponse.next({ request });
    }
  }

  if (!isPublicBookApi && !isSwPrecache) {
    const secureCookie = isHttpsRequest(request);
    // If in development and the user passed ?country=XX, persist it to dev override cookie
    const isDev = process.env.NODE_ENV !== 'production';
    const queryOverride = isDev ? request.nextUrl.searchParams.get('country') : null;
    if (isDev && queryOverride && queryOverride.trim()) {
      const cleanOverride = queryOverride.trim().toUpperCase().slice(0, 2);
      if (/^[A-Z]{2}$/.test(cleanOverride)) {
        response.cookies.set(DEV_OVERRIDE_COOKIE_NAME, cleanOverride, {
          path: '/',
          sameSite: 'lax',
          httpOnly: false,
          secure: secureCookie,
          maxAge: 60 * 60 * 24 * 7,
        });
      }
    }

    // Propagate to client-accessible cookie for synchronous UI evaluation
    response.cookies.set(GEO_COOKIE_NAME, detectedCountry, {
      path: '/',
      sameSite: 'lax',
      httpOnly: false, // Must be readable by client React hooks
      secure: secureCookie,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
  }

  // Stamp header for downstream Route Handlers & Server Components
  response.headers.set('x-bookarium-country', detectedCountry);
  if (validShareToken) {
    response.headers.set('x-bookarium-share-token', validShareToken);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|sw\\.js|manifest\\.webmanifest|favicon\\.ico|robots\\.txt|sitemap\\.xml|icons|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};


