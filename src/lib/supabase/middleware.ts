import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database.types';
import { sanitizeSupabaseUrl } from './client';

export const SUPABASE_AUTH_COOKIE_PATTERN = /^sb-.*-auth-token(\.\d+)?$/;

export const updateSession = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!rawUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => SUPABASE_AUTH_COOKIE_PATTERN.test(cookie.name));
  if (!hasAuthCookie) {
    return supabaseResponse;
  }

  const supabaseUrl = sanitizeSupabaseUrl(rawUrl);

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Prevent a failed/raced server-side token refresh from emitting Max-Age=0
        // cookie deletions that wipe a valid session rotated by a concurrent request.
        // Explicit sign-outs execute client-side via createBrowserClient.
        const hasNonEmptyCookieValue = cookiesToSet.some(({ value }) => Boolean(value));
        if (!hasNonEmptyCookieValue) {
          return;
        }
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  try {
    await supabase.auth.getUser();
  } catch {
    // Non-blocking fallback: never fail route transitions if auth sync fails
  }

  return supabaseResponse;
};