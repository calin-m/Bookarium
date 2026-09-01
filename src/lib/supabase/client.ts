import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';

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