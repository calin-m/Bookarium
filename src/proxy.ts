import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export const GEO_COOKIE_NAME = 'bookarium-geo-country';

export async function proxy(request: NextRequest) {
  let response: NextResponse;
  try {
    response = await updateSession(request);
  } catch {
    response = NextResponse.next({ request });
  }

  // Check development override via query param ?country=XX
  const isDev = process.env.NODE_ENV !== 'production';
  const queryOverride = isDev ? request.nextUrl.searchParams.get('country') : null;

  // Resolve country from query override, Vercel IP header, geo property, or existing cookie
  const detectedCountry =
    (queryOverride && queryOverride.trim().toUpperCase().slice(0, 2)) ||
    request.headers.get('x-vercel-ip-country')?.trim().toUpperCase().slice(0, 2) ||
    ((request as unknown as { geo?: { country?: string } }).geo?.country?.trim().toUpperCase().slice(0, 2)) ||
    request.cookies.get(GEO_COOKIE_NAME)?.value?.trim().toUpperCase().slice(0, 2) ||
    'US';

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


