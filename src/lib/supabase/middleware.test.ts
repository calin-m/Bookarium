import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';
import { updateSession } from './middleware';

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

describe('src/lib/supabase/middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bypasses Supabase client creation when environment variables are missing', async () => {
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const origKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    try {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const req = new NextRequest('https://bookarium.app/bookshelf');
      const res = await updateSession(req);

      expect(res.status).toBe(200);
      expect(createServerClient).not.toHaveBeenCalled();
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origKey;
    }
  });

  it('propagates request and response cookies and refreshes auth user session', async () => {
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const origKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    try {
      let capturedCookies: {
        getAll: () => unknown[];
        setAll: (items: { name: string; value: string; options?: Record<string, unknown> }[]) => void;
      } | null = null;

      vi.mocked(createServerClient).mockImplementationOnce((_url, _key, options) => {
        capturedCookies = options.cookies as never;
        return {
          auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
          },
        } as never;
      });

      const req = new NextRequest('https://bookarium.app/account');
      const res = await updateSession(req);

      expect(res.status).toBe(200);
      expect(capturedCookies).not.toBeNull();
      expect(Array.isArray(capturedCookies!.getAll())).toBe(true);

      capturedCookies!.setAll([
        { name: 'sb-access-token', value: 'jwt-123', options: { path: '/' } },
      ]);
      expect(req.cookies.get('sb-access-token')?.value).toBe('jwt-123');
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origKey;
    }
  });

  it('suppresses auth.getUser rejections without failing route navigation', async () => {
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const origKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    try {
      vi.mocked(createServerClient).mockImplementationOnce(() => {
        return {
          auth: {
            getUser: vi.fn().mockRejectedValue(new Error('Upstream timeout')),
          },
        } as never;
      });

      const req = new NextRequest('https://bookarium.app/');
      const res = await updateSession(req);
      expect(res.status).toBe(200);
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origKey;
    }
  });
});

