import { NextResponse, type NextRequest } from 'next/server';
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

  return false;
}

export async function proxy(request: NextRequest) {
  const isPublicBookApi = request.nextUrl.pathname.startsWith('/api/books');
  const isSwPrecache = request.headers.get('x-bookarium-sw-precache') === '1';
  const rawShareToken = request.nextUrl.searchParams.get('s');
  const validShareToken =
    rawShareToken && /^[A-Za-z0-9_-]{8,64}$/.test(rawShareToken)
      ? rawShareToken
      : null;

  if (validShareToken) {
    request.headers.set('x-bookarium-share-token', validShareToken);
  }

  let response: NextResponse;

  if (shouldSkipSessionRefresh(request)) {
    response = NextResponse.next({ request });
  } else {
    try {
      response = await updateSession(request);
    } catch {
      response = NextResponse.next({ request });
    }
  }

  const detectedCountry = resolveClientCountry(request);

  if (!isPublicBookApi && !isSwPrecache) {
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
          maxAge: 60 * 60 * 24 * 7,
        });
      }
    }

    // Propagate to client-accessible cookie for synchronous UI evaluation
    response.cookies.set(GEO_COOKIE_NAME, detectedCountry, {
      path: '/',
      sameSite: 'lax',
      httpOnly: false, // Must be readable by client React hooks
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


