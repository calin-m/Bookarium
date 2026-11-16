/**
 * @module
 * @scope Browser Supabase SSR client factory plus shared URL and User-Agent sanitization helpers
 *        consumed across browser, server, and Edge middleware Supabase clients.
 * @invariant Strip trailing `/rest/v*` suffixes and trailing slashes inside `sanitizeSupabaseUrl`, falling back to `https://placeholder.supabase.co` and `'placeholder-anon-key'` when env vars are unset so zero-API-key builds succeed.
 * @invariant Strip CR/LF/tabs and cap `sanitizeForwardedUserAgent` at `512` characters before forwarding client User-Agent headers in server-side Supabase Auth requests.
 * @rationale Header injection sanitization prevents malformed Auth session telemetry, while keyless placeholders maintain strict local offline parity without mandatory `.env` setup.
 * @adr ADR-005, ADR-072
 */

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