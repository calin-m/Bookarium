/**
 * @module
 * @scope Request-scoped Next.js Server Component & Route Handler Supabase SSR client factory.
 * @invariant Bind per-request `cookies()` getters/setters while catching `cookieStore.set` read-only throws inside Server Components, and forward only sanitized User-Agent headers (`sanitizeForwardedUserAgent`).
 * @rationale Allows Server Components and `/auth/callback` route handlers to read authenticated Supabase sessions cleanly while preserving accurate multi-device session logs without crashing RSC renders.
 * @adr ADR-005, ADR-042
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database.types';
import { sanitizeSupabaseUrl, sanitizeForwardedUserAgent } from './client';

export interface ServerClientOptions {
  userAgent?: string | null;
}

export const createClient = async (options?: ServerClientOptions) => {
  const cookieStore = await cookies();
  const supabaseUrl = sanitizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
  const sanitizedUserAgent = sanitizeForwardedUserAgent(options?.userAgent);

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    ...(sanitizedUserAgent
      ? {
          global: {
            headers: {
              'user-agent': sanitizedUserAgent,
            },
          },
        }
      : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
            cookieStore.set(name, value, cookieOptions);
          });
        } catch {
          // Called from a Server Component. Ignored if middleware refreshes sessions.
        }
      },
    },
  });
};