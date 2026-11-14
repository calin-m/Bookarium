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