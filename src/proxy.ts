import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

import {
  resolveClientCountry,
  GEO_COOKIE_NAME,
  DEV_OVERRIDE_COOKIE_NAME,
} from '@/lib/country-resolver';

export { GEO_COOKIE_NAME, DEV_OVERRIDE_COOKIE_NAME } from '@/lib/country-resolver';

export async function proxy(request: NextRequest) {
  let response: NextResponse;
  try {
    response = await updateSession(request);
  } catch {
    response = NextResponse.next({ request });
  }

  const detectedCountry = resolveClientCountry(request);

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

  // Stamp header for downstream Route Handlers & Server Components
  response.headers.set('x-bookarium-country', detectedCountry);

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|icons|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};


