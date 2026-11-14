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

      const req = new NextRequest('https://bookarium.app/account', {
        headers: { cookie: 'sb-project-auth-token=jwt-initial' },
      });
      const res = await updateSession(req);

      expect(res.status).toBe(200);
      expect(capturedCookies).not.toBeNull();
      expect(Array.isArray(capturedCookies!.getAll())).toBe(true);

      capturedCookies!.setAll([
        { name: 'sb-project-auth-token.0', value: 'jwt-chunk-0', options: { path: '/' } },
        { name: 'sb-project-auth-token.1', value: '', options: { path: '/', maxAge: 0 } },
      ]);
      expect(req.cookies.get('sb-project-auth-token.0')?.value).toBe('jwt-chunk-0');

      // When all cookie values are empty (failed/raced server refresh), setAll must ignore the deletion
      capturedCookies!.setAll([
        { name: 'sb-project-auth-token.0', value: '', options: { path: '/', maxAge: 0 } },
        { name: 'sb-project-auth-token.1', value: '', options: { path: '/', maxAge: 0 } },
      ]);
      expect(req.cookies.get('sb-project-auth-token.0')?.value).toBe('jwt-chunk-0');
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origKey;
    }
  });

  it('bypasses Supabase client creation for anonymous requests or PKCE code-verifier-only cookies', async () => {
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const origKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    try {
      const req = new NextRequest('https://bookarium.app/catalog', {
        headers: {
          cookie:
            'bookarium-geo-country=US; sb-project-auth-token-code-verifier=pkce-verifier-123',
        },
      });
      const res = await updateSession(req);

      expect(res.status).toBe(200);
      expect(createServerClient).not.toHaveBeenCalled();
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

      const req = new NextRequest('https://bookarium.app/', {
        headers: { cookie: 'sb-project-auth-token=jwt-initial' },
      });
      const res = await updateSession(req);
      expect(res.status).toBe(200);
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origKey;
    }
  });

  it('forwards sanitized User-Agent headers and sets bookarium-client-ip-sync only when auth cookies rotate with non-empty values', async () => {
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const origKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    try {
      let capturedOptions: Record<string, unknown> | undefined;
      vi.mocked(createServerClient).mockImplementationOnce((_url, _key, options) => {
        capturedOptions = options as unknown as Record<string, unknown>;
        return {
          auth: {
            getUser: vi.fn(async () => {
              const cookiesAdapter = options.cookies as unknown as {
                setAll: (items: { name: string; value: string; options?: Record<string, unknown> }[]) => void;
              };
              cookiesAdapter.setAll([
                { name: 'sb-project-auth-token', value: 'rotated-jwt', options: { path: '/' } },
              ]);
              return { data: { user: { id: 'u1' } }, error: null };
            }),
          },
        } as never;
      });

      const req = new NextRequest('https://bookarium.app/account', {
        headers: {
          cookie: 'sb-project-auth-token=jwt-initial',
        },
      });
      const origHeadersGet = req.headers.get.bind(req.headers);
      vi.spyOn(req.headers, 'get').mockImplementation((name) =>
        name.toLowerCase() === 'user-agent'
          ? 'Mozilla/5.0 Chrome/131.0.0.0\r\nInjected: bad'
          : origHeadersGet(name)
      );
      const res = await updateSession(req);

      expect(res.status).toBe(200);
      expect(
        (capturedOptions?.global as { headers?: Record<string, string> })?.headers?.['user-agent']
      ).toBe('Mozilla/5.0 Chrome/131.0.0.0 Injected: bad');
      expect(res.cookies.get('bookarium-client-ip-sync')?.value).toBe('1');
      expect(res.cookies.get('sb-project-auth-token')?.value).toBe('rotated-jwt');

      // Deleting-only setAll must NOT set bookarium-client-ip-sync
      vi.mocked(createServerClient).mockImplementationOnce((_url, _key, options) => {
        return {
          auth: {
            getUser: vi.fn(async () => {
              const cookiesAdapter = options.cookies as unknown as {
                setAll: (items: { name: string; value: string; options?: Record<string, unknown> }[]) => void;
              };
              cookiesAdapter.setAll([
                { name: 'sb-project-auth-token', value: '', options: { path: '/', maxAge: 0 } },
              ]);
              return { data: { user: null }, error: { status: 403 } };
            }),
          },
        } as never;
      });

      const revokedReq = new NextRequest('https://bookarium.app/account', {
        headers: { cookie: 'sb-project-auth-token=jwt-revoked' },
      });
      const revokedRes = await updateSession(revokedReq);
      expect(revokedRes.cookies.get('bookarium-client-ip-sync')).toBeUndefined();
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origKey;
    }
  });
});

