import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';

const MAX_FORWARDED_USER_AGENT_LENGTH = 512;

/**
 * Strips CR/LF/control whitespace from an incoming browser User-Agent header
 * before forwarding server-side Auth requests so Supabase records the real device/browser.
 */
export function sanitizeForwardedUserAgent(
  rawUserAgent?: string | null
): string | undefined {
  if (typeof rawUserAgent !== 'string') return undefined;
  const cleaned = rawUserAgent.replace(/[\r\n\t]+/g, ' ').trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, MAX_FORWARDED_USER_AGENT_LENGTH);
}

export const sanitizeSupabaseUrl = (rawUrl?: string): string => {
  if (!rawUrl) return 'https://placeholder.supabase.co';
  let cleaned = rawUrl.trim();
  cleaned = cleaned.replace(/\/rest(?:\/v\d+)?\/?$/, '');
  return cleaned.replace(/\/+$/, '') || 'https://placeholder.supabase.co';
};

export const createClient = () => {
  const supabaseUrl = sanitizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
};