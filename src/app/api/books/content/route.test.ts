import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { clearBookMetadataCache, clearBookContentCache } from './metadata-cache';
import { isSafeUpstreamUrl, sanitizeUpstreamUrl } from './url-validator';
import { sampleBookText } from '@/mocks/handlers';
import {
  bookContentRateLimiter,
  bookCardRateLimiter,
  bookCoverRateLimiter,
} from '@/lib/rate-limiter';
import { encodeReadingCardShareToken } from '@/lib/reading-card-export';

describe('GET /api/books/content', () => {
  /**
   * Configures Supabase env vars and mocks the Tier 2 `public.books` metadata query
   * so cross-jurisdiction tests verify DB-backed copyright checks without external HTTP calls.
   */
  async function mockSupabaseBookQuery(rowData: Record<string, unknown> | null) {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://valid-project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'valid-anon-key-12345');

    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: rowData,
      error: null,
    });
    const mockAbortSignal = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEq = vi.fn().mockReturnValue({ abortSignal: mockAbortSignal });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const supabaseClientModule = await import('@/lib/supabase/client');
    const clientSpy = vi.spyOn(supabaseClientModule, 'createClient').mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof supabaseClientModule.createClient>);

    return { clientSpy, mockFrom, mockSelect, mockEq };
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    bookContentRateLimiter.reset();
    bookCardRateLimiter.reset();
    bookCoverRateLimiter.reset();
    clearBookMetadataCache();
    clearBookContentCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should return 429 when client exceeds rate limits', async () => {
    vi.spyOn(bookContentRateLimiter, 'check').mockReturnValueOnce({
      success: false,
      limit: 30,
      remaining: 0,
      resetMs: 30000,
    });

    const blockedReq = new NextRequest('http://localhost:3000/api/books/content?id=1342');
    const blockedRes = await GET(blockedReq);
    expect(blockedRes.status).toBe(429);
    const json = await blockedRes.json();
    expect(json.error).toMatch(/too many requests/i);
    expect(blockedRes.headers.get('Retry-After')).toBe('30');
    expect(blockedRes.headers.get('X-RateLimit-Limit')).toBe('30');
    expect(blockedRes.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('should return 400 if neither url nor id is provided', async () => {
    const req = new NextRequest('http://localhost:3000/api/books/content');
    const res = await GET(req);

    expect(res.status).toBe(400);
    expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    const json = await res.json();
    expect(json.error).toMatch(/missing/i);
  });

  it('should reject unknown query params, unsupported types, stray share tokens, and production ?country= overrides', async () => {
    const unknownRes = await GET(
      new NextRequest('http://localhost:3000/api/books/content?id=1342&unexpected=1')
    );
    expect(unknownRes.status).toBe(400);
    expect(unknownRes.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    expect(unknownRes.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    expect(unknownRes.headers.get('X-Content-Type-Options')).toBe('nosniff');

    const badTypeRes = await GET(
      new NextRequest('http://localhost:3000/api/books/content?id=1342&type=pdf')
    );
    expect(badTypeRes.status).toBe(400);
    expect(badTypeRes.headers.get('Cache-Control')).toBe('no-store, max-age=0');

    const strayShareRes = await GET(
      new NextRequest('http://localhost:3000/api/books/content?id=1342&s=abc')
    );
    expect(strayShareRes.status).toBe(400);
    expect(strayShareRes.headers.get('Cache-Control')).toBe('no-store, max-age=0');

    vi.stubEnv('NODE_ENV', 'production');
    const prodCountryRes = await GET(
      new NextRequest('http://localhost:3000/api/books/content?id=1342&country=GB')
    );
    expect(prodCountryRes.status).toBe(400);
    expect(prodCountryRes.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    vi.unstubAllEnvs();
  });

  it('routes type=card and type=cover requests through dedicated mode-scoped rate limiters', async () => {
    const cardSpy = vi.spyOn(bookCardRateLimiter, 'check').mockReturnValueOnce({
      success: false,
      limit: 20,
      remaining: 0,
      resetMs: 30000,
    });
    const cardBlocked = await GET(
      new NextRequest('http://localhost:3000/api/books/content?id=1342&type=card')
    );
    expect(cardSpy).toHaveBeenCalledTimes(1);
    expect(cardBlocked.status).toBe(429);
    expect(cardBlocked.headers.get('X-RateLimit-Limit')).toBe('20');
    expect(cardBlocked.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');

    const coverSpy = vi.spyOn(bookCoverRateLimiter, 'check').mockReturnValueOnce({
      success: false,
      limit: 60,
      remaining: 0,
      resetMs: 25000,
    });
    const coverBlocked = await GET(
      new NextRequest('http://localhost:3000/api/books/content?id=1342&type=cover')
    );
    expect(coverSpy).toHaveBeenCalledTimes(1);
    expect(coverBlocked.status).toBe(429);
    expect(coverBlocked.headers.get('X-RateLimit-Limit')).toBe('60');
  });

  it('should block SSRF attempts targeting cloud metadata or internal network', async () => {
    const maliciousUrls = [
      'http://169.254.169.254/latest/meta-data/',
      'http://localhost:54321',
      'http://127.0.0.1:3000',
      'http://10.0.0.1:8080',
      'https://evil.attacker.com/steal',
    ];

    for (const url of maliciousUrls) {
      expect(isSafeUpstreamUrl(url)).toBe(false);
    }

    const req = new NextRequest('http://localhost:3000/api/books/content?url=http://169.254.169.254/latest/meta-data/');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/unauthorized/i);
  });

  it('should validate official Gutenberg upstream URLs as safe and sanitize them', () => {
    expect(isSafeUpstreamUrl('https://www.gutenberg.org/cache/epub/1342/pg1342.txt')).toBe(true);
    expect(isSafeUpstreamUrl('https://gutenberg.org/files/1342/1342-0.txt')).toBe(true);

    expect(sanitizeUpstreamUrl('https://www.gutenberg.org/cache/epub/1342/pg1342.txt')).toBe(
      'https://www.gutenberg.org/cache/epub/1342/pg1342.txt'
    );
    expect(sanitizeUpstreamUrl('https://gutenberg.org/files/1342/1342-0.txt')).toBe(
      'https://gutenberg.org/files/1342/1342-0.txt'
    );
  });

  it('should reject path traversal attempts in upstream URLs', () => {
    expect(isSafeUpstreamUrl('https://www.gutenberg.org/../../etc/passwd')).toBe(false);
    expect(isSafeUpstreamUrl('https://gutenberg.org/cache/epub/1342/../../../secret')).toBe(false);
    expect(sanitizeUpstreamUrl('https://www.gutenberg.org/../../etc/passwd')).toBeNull();
  });

  it('should return HTTP 451 Unavailable For Legal Reasons when book is protected in UK', async () => {
    // Resolve non-featured Agatha Christie metadata via Tier 2 Supabase `public.books`
    const christieMeta = {
      id: 863,
      title: 'The Mysterious Affair at Styles',
      authors: [{ name: 'Christie, Agatha', birth_year: 1890, death_year: 1976 }],
      translators: [],
      copyright: false,
    };

    const { clientSpy, mockFrom, mockSelect, mockEq } = await mockSupabaseBookQuery(christieMeta);
    const fetchSpy = vi.spyOn(global, 'fetch');

    try {
      const req = new NextRequest('http://localhost:3000/api/books/content?id=863', {
        headers: {
          'x-vercel-ip-country': 'GB',
        },
      });

      const res = await GET(req);
      expect(res.status).toBe(451);
      expect(res.headers.get('Vary')).toContain('x-vercel-ip-country');
      expect(mockFrom).toHaveBeenCalledWith('books');
      expect(mockSelect).toHaveBeenCalledWith('id, title, authors, translators, copyright');
      expect(mockEq).toHaveBeenCalledWith('id', 863);
      expect(fetchSpy).not.toHaveBeenCalled();

      const json = await res.json();
      expect(json.country).toBe('GB');
      expect(json.rule).toBe('LIFE_70');
      expect(json.publicDomainYear).toBe(2047);
      expect(json.restrictingDeathYear).toBe(1976);
    } finally {
      clientSpy.mockRestore();
      fetchSpy.mockRestore();
    }
  });

  it('should return HTTP 451 in local development via ?country=GB query parameter without headers', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const christieMeta = {
      id: 863,
      title: 'The Mysterious Affair at Styles',
      authors: [{ name: 'Christie, Agatha', birth_year: 1890, death_year: 1976 }],
      translators: [],
      copyright: false,
    };

    const { clientSpy, mockFrom, mockEq } = await mockSupabaseBookQuery(christieMeta);
    const fetchSpy = vi.spyOn(global, 'fetch');

    try {
      const req = new NextRequest('http://localhost:3000/api/books/content?id=863&country=GB');
      const res = await GET(req);

      expect(res.status).toBe(451);
      expect(mockFrom).toHaveBeenCalledWith('books');
      expect(mockEq).toHaveBeenCalledWith('id', 863);
      expect(fetchSpy).not.toHaveBeenCalled();

      const json = await res.json();
      expect(json.country).toBe('GB');
      expect(json.rule).toBe('LIFE_70');
      expect(json.publicDomainYear).toBe(2047);
      expect(json.restrictingDeathYear).toBe(1976);
    } finally {
      clientSpy.mockRestore();
      fetchSpy.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it('should return HTTP 451 when book is protected in Mexico (Life + 100)', async () => {
    // Book 64317 resolves author lifespan (F. Scott Fitzgerald, death_year: 1940) via Tier 3 FEATURED_HERO_BOOKS
    const fetchSpy = vi.spyOn(global, 'fetch');

    try {
      const req = new NextRequest('http://localhost:3000/api/books/content?id=64317', {
        headers: {
          'x-vercel-ip-country': 'MX',
        },
      });

      const res = await GET(req);
      expect(res.status).toBe(451);
      expect(fetchSpy).not.toHaveBeenCalled();

      const json = await res.json();
      expect(json.country).toBe('MX');
      expect(json.rule).toBe('LIFE_100');
      expect(json.publicDomainYear).toBe(2041);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('should return HTTP 503 fail-closed when metadata cannot be retrieved for international user', async () => {
    // Non-featured book 9999 with unconfigured Supabase fails closed without outbound HTTP lookups
    const fetchSpy = vi.spyOn(global, 'fetch');

    try {
      const req = new NextRequest('http://localhost:3000/api/books/content?id=9999', {
        headers: {
          'x-vercel-ip-country': 'FR',
        },
      });

      const res = await GET(req);
      expect(res.status).toBe(503);
      expect(fetchSpy).not.toHaveBeenCalled();

      const json = await res.json();
      expect(json.error).toContain('Unable to verify copyright clearance');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('should fetch and return book text for valid public domain id in US', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => sampleBookText,
    } as any);

    const req = new NextRequest('http://localhost:3000/api/books/content?id=1342', {
      headers: {
        'x-vercel-ip-country': 'US',
      },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/plain');
    expect(res.headers.get('Cache-Control')).toContain('max-age=86400');
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=86400');
    expect(res.headers.get('Vary')).toContain('x-vercel-ip-country');
    const text = await res.text();
    expect(text).toContain('Pride and Prejudice');
  }, 15000);

  it('should stream public domain book to GB user when metadata confirms death year <= 1955', async () => {
    // Book 1342 resolves Jane Austen lifespan (death_year: 1817) via Tier 3 FEATURED_HERO_BOOKS; only text mirror is fetched
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(sampleBookText, { status: 200 })
    );

    try {
      const req = new NextRequest('http://localhost:3000/api/books/content?id=1342', {
        headers: {
          'x-vercel-ip-country': 'GB',
        },
      });
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const text = await res.text();
      expect(text).toContain('Pride and Prejudice');
    } finally {
      fetchSpy.mockRestore();
    }
  }, 15000);

  it('should return 502 if upstream text mirrors fail or time out', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Connection aborted'));

    const req = new NextRequest('http://localhost:3000/api/books/content?id=99999');
    const res = await GET(req);

    expect(res.status).toBe(502);
  });

  it('guarantees fetch is strictly called with canonical Gutenberg endpoints only', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => sampleBookText,
    } as any);

    const req = new NextRequest('http://localhost:3000/api/books/content?url=https://www.gutenberg.org/cache/epub/1342/pg1342.txt');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalled();
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toMatch(
      /^https:\/\/(aleph\.gutenberg\.org|gutenberg\.pglaf\.org|gutenberg\.readingroo\.ms|www\.gutenberg\.org)\/(cache\/epub|files)\/\d{1,8}\//
    );
  });

  it('falls back to secondary mirror when primary mirror returns 404', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
      .mockResolvedValueOnce(new Response(sampleBookText, { status: 200 }));

    const req = new NextRequest('http://localhost:3000/api/books/content?id=1342');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const text = await res.text();
    expect(text).toContain('Pride and Prejudice');
  });

  it('streams content directly from Supabase (Tier 1) without external network fetch', async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://valid-project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key-12345';

    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { content: 'The Project Gutenberg eBook of Pride and Prejudice, by Jane Austen...' },
      error: null,
    });
    const mockAbortSignal = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEq = vi.fn().mockReturnValue({ abortSignal: mockAbortSignal });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const supabaseClientModule = await import('@/lib/supabase/client');
    const clientSpy = vi.spyOn(supabaseClientModule, 'createClient').mockReturnValue({
      from: mockFrom,
    } as any);

    const fetchSpy = vi.spyOn(global, 'fetch');

    try {
      const req = new NextRequest('http://localhost:3000/api/books/content?id=1342');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('X-Bookarium-Source')).toBe('supabase');
      expect(mockFrom).toHaveBeenCalledWith('books');
      expect(mockSelect).toHaveBeenCalledWith('content');
      expect(mockEq).toHaveBeenCalledWith('id', 1342);
      expect(fetchSpy).not.toHaveBeenCalled();

      const text = await res.text();
      expect(text).toContain('Pride and Prejudice, by Jane Austen');
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
      clientSpy.mockRestore();
    }
  });

  it('safely follows redirects to trusted Gutenberg mirrors', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: new Headers({
            Location: 'https://aleph.gutenberg.org/cache/epub/1342/pg1342.txt',
          }),
        })
      )
      .mockResolvedValueOnce(
        new Response(sampleBookText, {
          status: 200,
          headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }),
        })
      );

    const req = new NextRequest('http://localhost:3000/api/books/content?id=1342');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1][0]).toBe('https://aleph.gutenberg.org/cache/epub/1342/pg1342.txt');
    const text = await res.text();
    expect(text).toContain('Pride and Prejudice');
  });

  it('follows up to 3 trusted redirect hops and skips mirrors that redirect to untrusted origins', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
      // Mirror 1 redirects to an untrusted origin -> immediately skipped
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: new Headers({
            Location: 'https://evil.example.com/cache/epub/1342/pg1342.txt',
          }),
        })
      )
      // Mirror 2 chains two trusted hops (302 -> 307 -> 200)
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: new Headers({
            Location: 'https://gutenberg.pglaf.org/files/1342/1342-0.txt',
          }),
        })
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 307,
          headers: new Headers({
            Location: 'https://aleph.gutenberg.org/cache/epub/1342/pg1342.txt',
          }),
        })
      )
      .mockResolvedValueOnce(
        new Response(sampleBookText, {
          status: 200,
          headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }),
        })
      );

    const req = new NextRequest('http://localhost:3000/api/books/content?id=1342');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    expect(fetchSpy.mock.calls[3][0]).toBe('https://aleph.gutenberg.org/cache/epub/1342/pg1342.txt');
    const text = await res.text();
    expect(text).toContain('Pride and Prejudice');
  });

  describe('6-Tier Project Gutenberg Mirror & Fallback Cascade', () => {
    it('Tier 1: serves directly from aleph.gutenberg.org when available', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(new Response(sampleBookText, { status: 200 }));

      const req = new NextRequest('http://localhost:3000/api/books/content?id=1342');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toBe('https://aleph.gutenberg.org/cache/epub/1342/pg1342.txt');
    });

    it('Tier 2: falls back to gutenberg.pglaf.org when aleph.gutenberg.org returns 503', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(new Response('Service Unavailable', { status: 503 }))
        .mockResolvedValueOnce(new Response(sampleBookText, { status: 200 }));

      const req = new NextRequest('http://localhost:3000/api/books/content?id=1342');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy.mock.calls[0][0]).toBe('https://aleph.gutenberg.org/cache/epub/1342/pg1342.txt');
      expect(fetchSpy.mock.calls[1][0]).toBe('https://gutenberg.pglaf.org/cache/epub/1342/pg1342.txt');
    });

    it('Tier 3: falls back to gutenberg.readingroo.ms when aleph and pglaf mirrors fail', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
        .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
        .mockResolvedValueOnce(new Response(sampleBookText, { status: 200 }));

      const req = new NextRequest('http://localhost:3000/api/books/content?id=1342');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(fetchSpy.mock.calls[2][0]).toBe('https://gutenberg.readingroo.ms/cache/epub/1342/pg1342.txt');
    });

    it('Tier 4: falls back to www.gutenberg.org/cache/epub when all 3 harvest mirrors fail', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
        .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
        .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
        .mockResolvedValueOnce(new Response(sampleBookText, { status: 200 }));

      const req = new NextRequest('http://localhost:3000/api/books/content?id=1342');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(4);
      expect(fetchSpy.mock.calls[3][0]).toBe('https://www.gutenberg.org/cache/epub/1342/pg1342.txt');
    });

    it('Tier 5: falls back to www.gutenberg.org/files/{id}/{id}-0.txt when all /cache/epub endpoints return 404', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
        .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
        .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
        .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
        .mockResolvedValueOnce(new Response(sampleBookText, { status: 200 }));

      const req = new NextRequest('http://localhost:3000/api/books/content?id=1342');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(5);
      expect(fetchSpy.mock.calls[4][0]).toBe('https://www.gutenberg.org/files/1342/1342-0.txt');
    });

    it('Tier 6: falls back to legacy www.gutenberg.org/files/{id}/{id}.txt when all 5 prior tiers fail', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
        .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
        .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
        .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
        .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
        .mockResolvedValueOnce(new Response(sampleBookText, { status: 200 }));

      const req = new NextRequest('http://localhost:3000/api/books/content?id=1342');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(6);
      expect(fetchSpy.mock.calls[5][0]).toBe('https://www.gutenberg.org/files/1342/1342.txt');
    });

    it('resolves relative Location redirect paths against the active mirror origin', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
        .mockResolvedValueOnce(
          new Response(null, {
            status: 302,
            headers: new Headers({
              Location: '/files/1342/1342-0.txt',
            }),
          })
        )
        .mockResolvedValueOnce(new Response(sampleBookText, { status: 200 }));

      const req = new NextRequest('http://localhost:3000/api/books/content?id=1342');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(fetchSpy.mock.calls[1][0]).toBe('https://gutenberg.pglaf.org/cache/epub/1342/pg1342.txt');
      expect(fetchSpy.mock.calls[2][0]).toBe('https://gutenberg.pglaf.org/files/1342/1342-0.txt');
    });

    it('coalesces concurrent in-flight requests for the same bookId into a single upstream mirror fetch', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 20));
        return new Response(sampleBookText, { status: 200 });
      });

      const req1 = new NextRequest('http://localhost:3000/api/books/content?id=1342');
      const req2 = new NextRequest('http://localhost:3000/api/books/content?id=1342');

      const [res1, res2] = await Promise.all([GET(req1), GET(req2)]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(await res1.text()).toContain('Pride and Prejudice');
      expect(await res2.text()).toContain('Pride and Prejudice');

      fetchSpy.mockRestore();
    });

    it('serves subsequent cross-jurisdiction requests from the server-side in-memory LRU cache and evicts oldest entries past capacity', async () => {
      const fetchSpy = vi
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(new Response(sampleBookText, { status: 200 }));

      // First request from US populates server-side LRU cache
      const usReq = new NextRequest('http://localhost:3000/api/books/content?id=1342', {
        headers: { 'x-vercel-ip-country': 'US' },
      });
      const usRes = await GET(usReq);
      expect(usRes.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second request from DE verifies copyright clearance locally via Tier 3 curated fixture and serves text from in-memory LRU
      const deReq = new NextRequest('http://localhost:3000/api/books/content?id=1342', {
        headers: { 'x-vercel-ip-country': 'DE' },
      });
      const deRes = await GET(deReq);
      expect(deRes.status).toBe(200);
      expect(await deRes.text()).toContain('Pride and Prejudice');
      // Still only 1 mirror fetch total: metadata resolves locally without any external API call
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Fill cache past MAX_CACHED_BOOKS (20) to verify LRU eviction of oldest entry
      fetchSpy.mockImplementation(async () => new Response(sampleBookText, { status: 200 }));
      for (let id = 2001; id <= 2021; id++) {
        const fillReq = new NextRequest(`http://localhost:3000/api/books/content?id=${id}`);
        const fillRes = await GET(fillReq);
        expect(fillRes.status).toBe(200);
      }

      fetchSpy.mockRestore();
    });
  });

  describe('Binary Cover Image Streaming (type=cover)', () => {
    const fakeJpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

    it('streams cover image successfully from mirror with Content-Type: image/jpeg and CDN cache headers', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(fakeJpegBytes, {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(fakeJpegBytes.byteLength) },
        })
      );

      const req = new NextRequest('http://localhost:3000/api/books/content?id=1342&type=cover');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('image/jpeg');
      expect(res.headers.get('Cache-Control')).toContain('s-maxage=604800');
      expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      const buffer = await res.arrayBuffer();
      expect(new Uint8Array(buffer)).toEqual(fakeJpegBytes);

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://aleph.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg',
        expect.objectContaining({ redirect: 'manual' })
      );

      fetchSpy.mockRestore();
    });

    it('falls back through mirrors when primary aleph mirror returns 404', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
        .mockResolvedValueOnce(
          new Response(fakeJpegBytes, {
            status: 200,
            headers: { 'Content-Type': 'image/jpeg' },
          })
        );

      const req = new NextRequest('http://localhost:3000/api/books/content?id=1342&type=cover');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy.mock.calls[0][0]).toBe('https://aleph.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg');
      expect(fetchSpy.mock.calls[1][0]).toBe('https://gutenberg.pglaf.org/cache/epub/1342/pg1342.cover.medium.jpg');

      fetchSpy.mockRestore();
    });

    it('safely follows trusted redirect hops when fetching cover image', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(null, {
            status: 302,
            headers: new Headers({
              Location: 'https://gutenberg.pglaf.org/cache/epub/1342/pg1342.cover.medium.jpg',
            }),
          })
        )
        .mockResolvedValueOnce(
          new Response(fakeJpegBytes, {
            status: 200,
            headers: { 'Content-Type': 'image/jpeg' },
          })
        );

      const req = new NextRequest('http://localhost:3000/api/books/content?id=1342&type=cover');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy.mock.calls[1][0]).toBe('https://gutenberg.pglaf.org/cache/epub/1342/pg1342.cover.medium.jpg');

      fetchSpy.mockRestore();
    });

    it('returns 502 when all mirrors fail or return error', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network failure'));

      const req = new NextRequest('http://localhost:3000/api/books/content?id=99999&type=cover');
      const res = await GET(req);

      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error).toMatch(/Failed to fetch cover image/i);

      fetchSpy.mockRestore();
    });

    it('skips oversized cover responses exceeding 2MB threshold', async () => {
      const oversizedBytes = new Uint8Array(2 * 1024 * 1024 + 10);
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(oversizedBytes, {
          status: 200,
          headers: { 'Content-Length': String(oversizedBytes.byteLength) },
        })
      );

      const req = new NextRequest('http://localhost:3000/api/books/content?id=1342&type=cover');
      const res = await GET(req);

      expect(res.status).toBe(502);
      fetchSpy.mockRestore();
    });

    it('skips copyright metadata lookup for type=cover in non-US jurisdictions and emits max-age browser caching headers', async () => {
      const tinyJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(tinyJpeg, {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        })
      );

      const req = new NextRequest('http://localhost:3000/api/books/content?id=863&type=cover', {
        headers: { 'x-vercel-ip-country': 'RO' },
      });
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe(
        'public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000'
      );
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(String(fetchSpy.mock.calls[0][0])).toContain('pg863.cover.medium.jpg');

      fetchSpy.mockRestore();
    });
  });

  describe('Tier 0 LRU Cache-Control headers', () => {
    it('serves warm Tier 0 cached book text with max-age=86400 for browser + edge parity', async () => {
      const { setCachedBookContent } = await import('./metadata-cache');
      setCachedBookContent(1342, sampleBookText, 'supabase');

      const fetchSpy = vi.spyOn(global, 'fetch');
      const req = new NextRequest('http://localhost:3000/api/books/content?id=1342', {
        headers: { 'x-vercel-ip-country': 'US' },
      });
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe(
        'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
      );
      expect(res.headers.get('X-Bookarium-Source')).toBe('supabase');
      expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(fetchSpy).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });
  });

  describe('Stateless OpenGraph Social Reading Card (type=card)', () => {
    it('renders a 1200x630 PNG reading card on the fly with or without a signed ?s= token', async () => {
      const signedToken = encodeReadingCardShareToken({
        bookId: 1342,
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        theme: 'sepia',
        includeProgress: true,
        progress: 64,
        currentSection: 12,
        totalSections: 61,
      });

      const reqWithToken = new NextRequest(
        `http://localhost:3000/api/books/content?id=1342&type=card&s=${signedToken}`
      );
      const resWithToken = await GET(reqWithToken);

      expect(resWithToken.status).toBe(200);
      expect(resWithToken.headers.get('Content-Type')).toContain('image/png');
      expect(resWithToken.headers.get('Cache-Control')).toContain('s-maxage=86400');
      expect(resWithToken.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin');
      expect(resWithToken.headers.get('X-Content-Type-Options')).toBe('nosniff');

      const reqFallback = new NextRequest(
        'http://localhost:3000/api/books/content?id=1342&type=card&s=tampered_token'
      );
      const resFallback = await GET(reqFallback);

      expect(resFallback.status).toBe(200);
      expect(resFallback.headers.get('Content-Type')).toContain('image/png');
    });
  });
});
