import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBrowserClient } from '@supabase/ssr';
import { createClient, sanitizeSupabaseUrl } from './client';

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({
    auth: { getUser: vi.fn() },
  })),
}));

describe('src/lib/supabase/client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sanitizeSupabaseUrl', () => {
    it('returns placeholder URL when input is undefined, empty, or only slashes', () => {
      expect(sanitizeSupabaseUrl(undefined)).toBe('https://placeholder.supabase.co');
      expect(sanitizeSupabaseUrl('')).toBe('https://placeholder.supabase.co');
      expect(sanitizeSupabaseUrl('   ///   ')).toBe('https://placeholder.supabase.co');
    });

    it('strips trailing /rest/v1 suffixes and trailing slashes', () => {
      expect(sanitizeSupabaseUrl('https://project.supabase.co/rest/v1/')).toBe(
        'https://project.supabase.co'
      );
      expect(sanitizeSupabaseUrl('https://project.supabase.co/rest/')).toBe(
        'https://project.supabase.co'
      );
      expect(sanitizeSupabaseUrl('  https://project.supabase.co///  ')).toBe(
        'https://project.supabase.co'
      );
    });
  });

  describe('createClient', () => {
    it('initializes createBrowserClient with sanitized URL and anon key fallback', () => {
      const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const origKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      try {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        const client = createClient();
        expect(client).toBeDefined();
        expect(createBrowserClient).toHaveBeenCalledWith(
          'https://placeholder.supabase.co',
          'placeholder-anon-key'
        );

        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://live.supabase.co/rest/v1';
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-public-key';

        createClient();
        expect(createBrowserClient).toHaveBeenLastCalledWith(
          'https://live.supabase.co',
          'anon-public-key'
        );
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origKey;
      }
    });
  });
});

