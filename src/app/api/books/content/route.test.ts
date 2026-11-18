import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import zlib from 'node:zlib';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { SITE_CONFIG } from '@/config/site-config';
import { clearBookMetadataCache, clearBookContentCache } from './metadata-cache';
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
    vi.stubEnv('R2_ACCOUNT_ID', '');
    vi.stubEnv('R2_BUCKET_NAME', '');
    vi.stubEnv('R2_ACCESS_KEY_ID', '');
    vi.stubEnv('R2_SECRET_ACCESS_KEY', '');
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

  it('should reject ?url= proxy attempts and non-numeric book IDs cleanly with 400 no-store', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const maliciousRequests = [
      'http://localhost:3000/api/books/content?url=http://169.254.169.254/latest/meta-data/',
      'http://localhost:3000/api/books/content?url=https://www.gutenberg.org/cache/epub/1342/pg1342.txt',
      'http://localhost:3000/api/books/content?id=1342/../../etc/passwd',
      'http://localhost:3000/api/books/content?id=0',
    ];

    for (const rawUrl of maliciousRequests) {
      const res = await GET(new NextRequest(rawUrl));
      expect(res.status).toBe(400);
      expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    }

    expect(fetchSpy).not.toHaveBeenCalled();
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

  it('should return HTTP 451 for US requests when catalog metadata flags copyright: true', async () => {
    const copyrightedMeta = {
      id: 90123,
      title: 'Copyrighted Modern Contribution',
      authors: [{ name: 'Modern Author', birth_year: 1960, death_year: null }],
      translators: [],
      copyright: true,
    };

    const { clientSpy, mockFrom, mockSelect, mockEq } = await mockSupabaseBookQuery(copyrightedMeta);
    const fetchSpy = vi.spyOn(global, 'fetch');

    try {
      const textReq = new NextRequest('http://localhost:3000/api/books/content?id=90123', {
        headers: {
          'x-vercel-ip-country': 'US',
        },
      });
      const textRes = await GET(textReq);

      expect(textRes.status).toBe(451);
      expect(mockFrom).toHaveBeenCalledWith('books');
      expect(mockSelect).toHaveBeenCalledWith('id, title, authors, translators, copyright');
      expect(mockEq).toHaveBeenCalledWith('id', 90123);
      expect(fetchSpy).not.toHaveBeenCalled();

      const textJson = await textRes.json();
      expect(textJson.country).toBe('US');
      expect(textJson.rule).toBe('US_PUBLIC_DOMAIN');

      const cardReq = new NextRequest('http://localhost:3000/api/books/content?id=90123&type=card', {
        headers: {
          'x-vercel-ip-country': 'US',
        },
      });
      const cardRes = await GET(cardReq);
      expect(cardRes.status).toBe(451);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      clientSpy.mockRestore();
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

  function stubR2Credentials() {
    vi.stubEnv('R2_ACCOUNT_ID', '0123456789abcdef0123456789abcdef');
    vi.stubEnv('R2_BUCKET_NAME', 'bookarium-assets');
    vi.stubEnv('R2_ACCESS_KEY_ID', 'test-r2-access-key');
    vi.stubEnv('R2_SECRET_ACCESS_KEY', 'test-r2-secret-key');
  }

  it('should return HTTP 503 without external Gutenberg fallback when R2 is unconfigured', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    const req = new NextRequest('http://localhost:3000/api/books/content?id=1342', {
      headers: {
        'x-vercel-ip-country': 'US',
      },
    });
    const res = await GET(req);

    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    expect(fetchSpy).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.error).toMatch(/Cloudflare R2 asset storage is not configured/i);
  });

  it('should fetch and return book text from private R2 for valid public domain id in US', async () => {
    stubR2Credentials();
    const gzipped = zlib.gzipSync(Buffer.from(sampleBookText, 'utf8'));
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(new Uint8Array(gzipped), {
        status: 200,
        headers: { 'Content-Type': 'application/gzip' },
      })
    );

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
    expect(res.headers.get('X-Bookarium-Source')).toBe('r2');
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/bookarium-assets/books/1342.txt.gz');
    const text = await res.text();
    expect(text).toContain('Pride and Prejudice');
  }, 15000);

  it('should stream public domain book from R2 to GB user when metadata confirms death year <= 1955', async () => {
    // Book 1342 resolves Jane Austen lifespan (death_year: 1817) via Tier 3 FEATURED_HERO_BOOKS; only R2 object is fetched
    stubR2Credentials();
    const gzipped = zlib.gzipSync(Buffer.from(sampleBookText, 'utf8'));
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(new Uint8Array(gzipped), {
        status: 200,
        headers: { 'Content-Type': 'application/gzip' },
      })
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
      expect(String(fetchSpy.mock.calls[0][0])).toContain('/bookarium-assets/books/1342.txt.gz');
      const text = await res.text();
      expect(text).toContain('Pride and Prejudice');
    } finally {
      fetchSpy.mockRestore();
    }
  }, 15000);

  it('should return 502 if R2 storage requests fail or time out', async () => {
    stubR2Credentials();
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Connection aborted'));

    const req = new NextRequest('http://localhost:3000/api/books/content?id=99999');
    const res = await GET(req);

    expect(res.status).toBe(502);
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

  describe('Cloudflare R2 Text Coalescing, In-Memory LRU & Failure Handling (Zero PG Fallback)', () => {
    it('coalesces concurrent in-flight requests for the same bookId into a single R2 fetch', async () => {
      stubR2Credentials();
      const gzipped = zlib.gzipSync(Buffer.from(sampleBookText, 'utf8'));
      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 20));
        return new Response(new Uint8Array(gzipped), {
          status: 200,
          headers: { 'Content-Type': 'application/gzip' },
        });
      });

      const req1 = new NextRequest('http://localhost:3000/api/books/content?id=1342');
      const req2 = new NextRequest('http://localhost:3000/api/books/content?id=1342');

      const [res1, res2] = await Promise.all([GET(req1), GET(req2)]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(String(fetchSpy.mock.calls[0][0])).toContain('/bookarium-assets/books/1342.txt.gz');
      expect(await res1.text()).toContain('Pride and Prejudice');
      expect(await res2.text()).toContain('Pride and Prejudice');

      fetchSpy.mockRestore();
    });

    it('serves subsequent cross-jurisdiction requests from the server-side in-memory LRU cache and evicts oldest entries past capacity', async () => {
      stubR2Credentials();
      const gzipped = zlib.gzipSync(Buffer.from(sampleBookText, 'utf8'));
      const fetchSpy = vi
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(new Uint8Array(gzipped), {
            status: 200,
            headers: { 'Content-Type': 'application/gzip' },
          })
        );

      // First request from US populates server-side LRU cache from R2
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
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Fill cache past MAX_CACHED_BOOKS (20) to verify LRU eviction of oldest entry
      fetchSpy.mockImplementation(async () =>
        new Response(new Uint8Array(gzipped), {
          status: 200,
          headers: { 'Content-Type': 'application/gzip' },
        })
      );
      for (let id = 2001; id <= 2021; id++) {
        const fillReq = new NextRequest(`http://localhost:3000/api/books/content?id=${id}`);
        const fillRes = await GET(fillReq);
        expect(fillRes.status).toBe(200);
      }

      const callsAfterEvict = fetchSpy.mock.calls.length;
      const reFetchRes = await GET(new NextRequest('http://localhost:3000/api/books/content?id=1342'));
      expect(reFetchRes.status).toBe(200);
      expect(fetchSpy.mock.calls.length).toBe(callsAfterEvict + 1);

      fetchSpy.mockRestore();
    });

    it('degrades cleanly from Tier 1 Supabase abortSignal timeout to Tier 1.5 Cloudflare R2 without contacting Gutenberg', async () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://valid-project.supabase.co');
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'valid-anon-key-12345');
      stubR2Credentials();

      const mockMaybeSingle = vi
        .fn()
        .mockRejectedValue(new DOMException('Signal timed out', 'TimeoutError'));
      const mockAbortSignal = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockEq = vi.fn().mockReturnValue({ abortSignal: mockAbortSignal });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      const supabaseClientModule = await import('@/lib/supabase/client');
      const clientSpy = vi.spyOn(supabaseClientModule, 'createClient').mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof supabaseClientModule.createClient>);

      const gzipped = zlib.gzipSync(Buffer.from(sampleBookText, 'utf8'));
      const fetchSpy = vi
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(new Uint8Array(gzipped), {
            status: 200,
            headers: { 'Content-Type': 'application/gzip' },
          })
        );

      try {
        const req = new NextRequest('http://localhost:3000/api/books/content?id=1342');
        const res = await GET(req);
        expect(res.status).toBe(200);
        expect(res.headers.get('X-Bookarium-Source')).toBe('r2');
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(String(fetchSpy.mock.calls[0][0])).not.toContain('gutenberg');
        expect(await res.text()).toContain('Pride and Prejudice');
      } finally {
        clientSpy.mockRestore();
        fetchSpy.mockRestore();
      }
    });

    it('rejects R2 HTML outage pages and oversized gzip payloads fail-closed with 502', async () => {
      stubR2Credentials();
      const oversizedPayload = zlib.gzipSync(Buffer.alloc(15 * 1024 * 1024 + 64, 'a'));

      const fetchSpy = vi
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response('<!DOCTYPE html><html><body>R2 Edge Outage</body></html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        )
        .mockResolvedValueOnce(
          new Response(new Uint8Array(oversizedPayload), {
            status: 200,
            headers: { 'Content-Type': 'application/gzip' },
          })
        );

      try {
        const htmlRes = await GET(new NextRequest('http://localhost:3000/api/books/content?id=1342'));
        expect(htmlRes.status).toBe(502);

        const bigRes = await GET(new NextRequest('http://localhost:3000/api/books/content?id=84'));
        expect(bigRes.status).toBe(502);
        expect(fetchSpy).toHaveBeenCalledTimes(2);
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });

  describe('Binary Cover Image Streaming (type=cover — Strict R2 Only)', () => {
    const fakeJpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

    function stubR2Env() {
      vi.stubEnv('R2_ACCOUNT_ID', '0123456789abcdef0123456789abcdef');
      vi.stubEnv('R2_BUCKET_NAME', 'bookarium-assets');
      vi.stubEnv('R2_ACCESS_KEY_ID', 'test-r2-access-key');
      vi.stubEnv('R2_SECRET_ACCESS_KEY', 'test-r2-secret-key');
    }

    it('streams cover image strictly from private R2 with Content-Type: image/jpeg and 7d cache headers', async () => {
      stubR2Env();
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
      expect(res.headers.get('Vercel-Cache-Tag')).toBe('covers');
      expect(res.headers.get('Vary')).toBe('Accept-Encoding');
      expect(res.headers.get('X-Bookarium-Source')).toBe('r2');
      expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      const buffer = await res.arrayBuffer();
      expect(new Uint8Array(buffer)).toEqual(fakeJpegBytes);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/bookarium-assets/covers/1342.jpg',
        expect.objectContaining({ redirect: 'manual' })
      );
    });

    it('returns 404 without falling back to Project Gutenberg when cover is missing in R2 or R2 is unconfigured', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');

      const unconfiguredReq = new NextRequest('http://localhost:3000/api/books/content?id=1342&type=cover');
      const unconfiguredRes = await GET(unconfiguredReq);
      expect(unconfiguredRes.status).toBe(404);
      expect(unconfiguredRes.headers.get('Vercel-Cache-Tag')).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();

      stubR2Env();
      fetchSpy.mockResolvedValueOnce(new Response('NoSuchKey', { status: 404 }));

      const missingReq = new NextRequest('http://localhost:3000/api/books/content?id=99999&type=cover');
      const missingRes = await GET(missingReq);
      expect(missingRes.status).toBe(404);
      expect(missingRes.headers.get('Vercel-Cache-Tag')).toBeNull();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(String(fetchSpy.mock.calls[0][0])).not.toContain('gutenberg');
    });

    it('returns 502 without Gutenberg fallback when R2 storage errors, redirects, exceeds 2MB, or serves HTML', async () => {
      stubR2Env();
      const oversizedBytes = new Uint8Array(2 * 1024 * 1024 + 10);
      const fetchSpy = vi
        .spyOn(global, 'fetch')
        .mockRejectedValueOnce(new Error('Network failure'))
        .mockResolvedValueOnce(
          new Response(null, { status: 302, headers: { Location: 'https://evil.example/cover.jpg' } })
        )
        .mockResolvedValueOnce(
          new Response(oversizedBytes, {
            status: 200,
            headers: { 'Content-Length': String(oversizedBytes.byteLength) },
          })
        )
        .mockResolvedValueOnce(
          new Response('<!DOCTYPE html><html><body>Maintenance</body></html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        );

      for (let i = 0; i < 4; i++) {
        const res = await GET(new NextRequest('http://localhost:3000/api/books/content?id=1342&type=cover'));
        expect(res.status).toBe(502);
        expect(res.headers.get('Vercel-Cache-Tag')).toBeNull();
      }

      expect(fetchSpy).toHaveBeenCalledTimes(4);
    });

    it('skips copyright metadata lookup for type=cover in non-US jurisdictions and streams R2 cover with browser caching', async () => {
      stubR2Env();
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
      expect(String(fetchSpy.mock.calls[0][0])).toContain('/covers/863.jpg');
    });
  });

  describe('Cloudflare R2 Gzipped Book Text Mode (R2 Configured -> Zero PG Fallback)', () => {
    function stubR2Env() {
      vi.stubEnv('R2_ACCOUNT_ID', '0123456789abcdef0123456789abcdef');
      vi.stubEnv('R2_BUCKET_NAME', 'bookarium-assets');
      vi.stubEnv('R2_ACCESS_KEY_ID', 'test-r2-access-key');
      vi.stubEnv('R2_SECRET_ACCESS_KEY', 'test-r2-secret-key');
    }

    it('fetches and gunzips books/<id>.txt.gz from private R2 and serves cached Tier 0 hits with X-Bookarium-Source: r2', async () => {
      stubR2Env();
      const gzipped = zlib.gzipSync(Buffer.from(sampleBookText, 'utf8'));
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(new Uint8Array(gzipped), {
          status: 200,
          headers: { 'Content-Type': 'application/gzip' },
        })
      );

      const firstRes = await GET(new NextRequest('http://localhost:3000/api/books/content?id=1342'));
      expect(firstRes.status).toBe(200);
      expect(firstRes.headers.get('X-Bookarium-Source')).toBe('r2');
      expect(firstRes.headers.get('Vercel-Cache-Tag')).toBe('book-content');
      expect(await firstRes.text()).toBe(sampleBookText);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(String(fetchSpy.mock.calls[0][0])).toContain('/bookarium-assets/books/1342.txt.gz');

      // Second read hits Tier 0 LRU without external fetch while preserving source and cache tag headers
      const cachedRes = await GET(new NextRequest('http://localhost:3000/api/books/content?id=1342'));
      expect(cachedRes.status).toBe(200);
      expect(cachedRes.headers.get('X-Bookarium-Source')).toBe('r2');
      expect(cachedRes.headers.get('Vercel-Cache-Tag')).toBe('book-content');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('returns 404 on R2 NoSuchKey and 502 on R2 error without falling back to Project Gutenberg mirrors', async () => {
      stubR2Env();
      const fetchSpy = vi
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(new Response('NoSuchKey', { status: 404 }))
        .mockResolvedValueOnce(new Response('Internal Error', { status: 500 }));

      const res404 = await GET(new NextRequest('http://localhost:3000/api/books/content?id=1342'));
      expect(res404.status).toBe(404);
      expect(res404.headers.get('Vercel-Cache-Tag')).toBeNull();

      const res502 = await GET(new NextRequest('http://localhost:3000/api/books/content?id=84'));
      expect(res502.status).toBe(502);
      expect(res502.headers.get('Vercel-Cache-Tag')).toBeNull();
      expect(fetchSpy).toHaveBeenCalledTimes(2);
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
      expect(res.headers.get('Vercel-Cache-Tag')).toBe('book-content');
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
      expect(resWithToken.headers.get('Vercel-Cache-Tag')).toBeNull();
      expect(resWithToken.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin');
      expect(resWithToken.headers.get('X-Content-Type-Options')).toBe('nosniff');

      const reqFallback = new NextRequest(
        'http://localhost:3000/api/books/content?id=1342&type=card&s=tampered_token'
      );
      const resFallback = await GET(reqFallback);

      expect(resFallback.status).toBe(200);
      expect(resFallback.headers.get('Content-Type')).toContain('image/png');
    });

    it('renders the canonical SITE_CONFIG.SITE_HOST domain footer in the type=card OpenGraph JSX tree', async () => {
      await mockSupabaseBookQuery({
        id: 1342,
        title: 'Pride and Prejudice',
        authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
        translators: [],
        copyright: false,
      });

      const originalHost = SITE_CONFIG.SITE_HOST;
      const createElementSpy = vi.spyOn(React, 'createElement');

      try {
        Object.assign(SITE_CONFIG, { SITE_HOST: 'books.custom-domain.test' });
        const req = new NextRequest(
          'http://localhost:3000/api/books/content?id=1342&type=card'
        );
        const res = await GET(req);

        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toContain('image/png');
        const emittedChildren = createElementSpy.mock.calls.flatMap((args) => args.slice(2));
        expect(emittedChildren).toContain('books.custom-domain.test/read/1342');
      } finally {
        createElementSpy.mockRestore();
        Object.assign(SITE_CONFIG, { SITE_HOST: originalHost });
      }
    });
  });

  describe('Defense-in-Depth Browser Fetch Metadata Anti-Deeplink Guard', () => {
    it('rejects browser document navigations and cross-site subresources with 403 no-store without burning rate limits or contacting R2', async () => {
      vi.stubEnv('R2_ACCOUNT_ID', '0123456789abcdef0123456789abcdef');
      vi.stubEnv('R2_BUCKET_NAME', 'bookarium-assets');
      vi.stubEnv('R2_ACCESS_KEY_ID', 'r2-key');
      vi.stubEnv('R2_SECRET_ACCESS_KEY', 'r2-secret');

      const fetchSpy = vi.spyOn(global, 'fetch');
      const rateCheckSpy = vi.spyOn(bookCoverRateLimiter, 'check');

      const navReq = new NextRequest('http://localhost:3000/api/books/content?id=1342&type=cover', {
        headers: {
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-site': 'none',
        },
      });
      const navRes = await GET(navReq);
      expect(navRes.status).toBe(403);
      expect(navRes.headers.get('Cache-Control')).toBe('no-store, max-age=0');
      expect(navRes.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
      expect(navRes.headers.get('Vercel-Cache-Tag')).toBeNull();
      expect(await navRes.json()).toEqual({
        error: 'Direct browser deeplinking or cross-site embedding of book assets is not permitted.',
      });

      const crossSiteTextReq = new NextRequest('http://localhost:3000/api/books/content?id=1342', {
        headers: {
          'sec-fetch-dest': 'iframe',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-site': 'cross-site',
        },
      });
      const crossSiteTextRes = await GET(crossSiteTextReq);
      expect(crossSiteTextRes.status).toBe(403);
      expect(rateCheckSpy).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('keeps same-origin reader/cover fetches and cross-site type=card OG previews functional', async () => {
      const { setCachedBookContent } = await import('./metadata-cache');
      setCachedBookContent(1342, sampleBookText, 'r2');

      const sameOriginReaderReq = new NextRequest('http://localhost:3000/api/books/content?id=1342', {
        headers: {
          'x-vercel-ip-country': 'US',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
        },
      });
      const readerRes = await GET(sameOriginReaderReq);
      expect(readerRes.status).toBe(200);
      expect(readerRes.headers.get('Vercel-Cache-Tag')).toBe('book-content');

      const crossSiteCardReq = new NextRequest('http://localhost:3000/api/books/content?id=1342&type=card', {
        headers: {
          'sec-fetch-dest': 'image',
          'sec-fetch-site': 'cross-site',
        },
      });
      const cardRes = await GET(crossSiteCardReq);
      expect(cardRes.status).toBe(200);
      expect(cardRes.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin');
    });
  });
});
