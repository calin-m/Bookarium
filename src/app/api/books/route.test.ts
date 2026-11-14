import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { booksApiRateLimiter } from '@/lib/rate-limiter';

describe('GET /api/books route handler', () => {
  beforeEach(() => {
    booksApiRateLimiter.reset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('should reject unsupported query params and production ?country= overrides with 400 no-store and same-origin CORP', async () => {
    const unknownReq = new NextRequest('http://localhost:3000/api/books?search=Austen&foo=bar');
    const unknownRes = await GET(unknownReq);

    expect(unknownRes.status).toBe(400);
    expect(unknownRes.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    expect(unknownRes.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(unknownRes.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');

    vi.stubEnv('NODE_ENV', 'production');
    const prodCountryReq = new NextRequest('http://localhost:3000/api/books?search=Austen&country=GB');
    const prodCountryRes = await GET(prodCountryReq);
    expect(prodCountryRes.status).toBe(400);
    expect(prodCountryRes.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    vi.unstubAllEnvs();
  });

  it('should return 429 when client exceeds max request rate limit', async () => {
    vi.spyOn(booksApiRateLimiter, 'check').mockReturnValueOnce({
      success: false,
      limit: 60,
      remaining: 0,
      resetMs: 45000,
    });

    const blockedReq = new NextRequest('http://localhost:3000/api/books?search=Jane');
    const blockedRes = await GET(blockedReq);
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    expect(blockedRes.headers.get('X-Content-Type-Options')).toBe('nosniff');
    const json = await blockedRes.json();
    expect(json.error).toMatch(/too many requests/i);
    expect(blockedRes.headers.get('Retry-After')).toBe('45');
    expect(blockedRes.headers.get('X-RateLimit-Limit')).toBe('60');
    expect(blockedRes.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('serves deterministic curated archive cache with no-store when Supabase is unconfigured', async () => {
    const req = new NextRequest('http://localhost:3000/api/books?search=Jane+Austen');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    const json = await res.json();
    expect(json.results).toBeDefined();
    expect(Array.isArray(json.results)).toBe(true);
    expect(json.results.some((b: { id: number }) => b.id === 1342)).toBe(true);
    expect(json.count).toBeGreaterThanOrEqual(1);
    expect(json.source).toBe('cache');
    expect(json.latencyMs).toBeDefined();
    expect(json.clientCountry).toBe('US');
    expect(json.jurisdictionRule).toBe('US_PUBLIC_DOMAIN');
    expect(res.headers.get('Vary')).toBe(
      'x-vercel-ip-country, cf-ipcountry, x-bookarium-country, Accept-Encoding'
    );
  });

  it('forwards Life+70 and Life+100 jurisdiction headers and dev ?country= overrides cleanly', async () => {
    const gbReq = new NextRequest('http://localhost:3000/api/books?ids=1342,64317', {
      headers: {
        'x-vercel-ip-country': 'GB',
      },
    });
    const gbRes = await GET(gbReq);
    expect(gbRes.status).toBe(200);
    const gbJson = await gbRes.json();
    expect(gbJson.clientCountry).toBe('GB');
    expect(gbJson.jurisdictionRule).toBe('LIFE_70');
    expect(gbJson.source).toBe('cache');

    const mxReq = new NextRequest('http://localhost:3000/api/books?ids=1342,64317', {
      headers: {
        'cf-ipcountry': 'MX',
      },
    });
    const mxRes = await GET(mxReq);
    expect(mxRes.status).toBe(200);
    const mxJson = await mxRes.json();
    expect(mxJson.clientCountry).toBe('MX');
    expect(mxJson.jurisdictionRule).toBe('LIFE_100');
    expect(mxJson.totalFiltered).toBeGreaterThanOrEqual(1);
    expect(mxJson.results).toHaveLength(1);
    expect(mxJson.results[0].id).toBe(1342);

    vi.stubEnv('NODE_ENV', 'development');
    const devOverrideReq = new NextRequest(
      'http://localhost:3000/api/books?ids=64317&country=MX'
    );
    const devOverrideRes = await GET(devOverrideReq);
    expect(devOverrideRes.status).toBe(200);
    const devJson = await devOverrideRes.json();
    expect(devJson.clientCountry).toBe('MX');
    expect(devJson.jurisdictionRule).toBe('LIFE_100');
    expect(devJson.results).toEqual([]);
    vi.unstubAllEnvs();
  });

  it('passes topic, language, page, era, sort, mime_type, and normalized search parameters to catalog provider', async () => {
    const { supabaseCatalogProvider } = await import('@/lib/catalog/supabase-provider');
    const isHealthySpy = vi.spyOn(supabaseCatalogProvider, 'isHealthy').mockResolvedValueOnce(true);
    const searchBooksSpy = vi.spyOn(supabaseCatalogProvider, 'searchBooks').mockResolvedValueOnce({
      count: 1,
      next: null,
      previous: '/api/books?page=1',
      results: [],
      source: 'supabase',
      latencyMs: 8,
      clientCountry: 'US',
      jurisdictionRule: 'US_PUBLIC_DOMAIN',
    });

    const req = new NextRequest(
      'http://localhost:3000/api/books?search=Charles%20%20%20Dickens&topic=Philosophy&languages=en&page=2&author_year_start=1800&author_year_end=1900&sort=popular&mime_type=text/html'
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('max-age=300');
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=86400');
    expect(searchBooksSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'Charles Dickens',
        topic: 'Philosophy',
        languages: ['en'],
        page: 2,
        authorYearStart: 1800,
        authorYearEnd: 1900,
        sort: 'popular',
        mimeType: 'text/html',
      })
    );

    isHealthySpy.mockRestore();
    searchBooksSpy.mockRestore();
  });

  it('should query Supabase directly when configured and return source supabase without falling back on error', async () => {
    const supabaseProviderModule = await import('@/lib/catalog/supabase-provider');
    const { CatalogProviderError } = await import('@/types/catalog.types');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example-project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key-valid');

    // Configured Supabase bypasses negative isHealthy latch so stale failure caches cannot split users
    const isHealthySpy = vi
      .spyOn(supabaseProviderModule.supabaseCatalogProvider, 'isHealthy')
      .mockResolvedValue(false);
    const searchBooksSpy = vi
      .spyOn(supabaseProviderModule.supabaseCatalogProvider, 'searchBooks')
      .mockResolvedValueOnce({
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: 1342,
            title: 'Pride and Prejudice',
            authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
            translators: [],
            subjects: ['Courtship -- Fiction'],
            bookshelves: [],
            languages: ['en'],
            copyright: false,
            media_type: 'Text',
            formats: {},
            download_count: 50000,
          },
        ],
        source: 'supabase',
        latencyMs: 12,
        clientCountry: 'US',
        jurisdictionRule: 'US_PUBLIC_DOMAIN',
      });

    const req = new NextRequest('http://localhost:3000/api/books?search=Pride');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('max-age=300');
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=86400');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    const json = await res.json();
    expect(json.source).toBe('supabase');
    expect(json.results).toHaveLength(1);
    expect(json.results[0].title).toBe('Pride and Prejudice');

    // When configured Supabase throws CatalogProviderError or unexpected error, fails closed with no-store (never falls back to partial cache)
    searchBooksSpy.mockRejectedValueOnce(
      new CatalogProviderError('Supabase Catalog query error: connection reset', 503, 'supabase')
    );
    const errRes = await GET(new NextRequest('http://localhost:3000/api/books?search=Pride'));
    expect(errRes.status).toBe(503);
    expect(errRes.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    const errJson = await errRes.json();
    expect(errJson.error).toBe('Catalog database temporarily unavailable. Please try again.');
    expect(errJson.results).toEqual([]);

    searchBooksSpy.mockRejectedValueOnce(new Error('Unexpected runtime error'));
    const fallbackErrRes = await GET(new NextRequest('http://localhost:3000/api/books?page=1'));
    expect(fallbackErrRes.status).toBe(503);
    expect(fallbackErrRes.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    const fallbackErrJson = await fallbackErrRes.json();
    expect(fallbackErrJson.error).toBe('Catalog database temporarily unavailable. Please try again.');

    isHealthySpy.mockRestore();
    searchBooksSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it('should return 503 with no-store when pool=quotes and Supabase is unavailable', async () => {
    const { supabaseCatalogProvider } = await import('@/lib/catalog/supabase-provider');
    const isHealthySpy = vi.spyOn(supabaseCatalogProvider, 'isHealthy').mockResolvedValueOnce(false);

    const req = new NextRequest('http://localhost:3000/api/books?pool=quotes');
    const res = await GET(req);

    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    const json = await res.json();
    expect(json.error).toBe('Quote pool unavailable from database');
    expect(json.results).toEqual([]);

    isHealthySpy.mockRestore();
  });

  it('should apply 12h global Edge cache for pool=quotes and 7d global Edge cache for jurisdiction-independent quote/ID lookups', async () => {
    const { supabaseCatalogProvider } = await import('@/lib/catalog/supabase-provider');
    const isHealthySpy = vi.spyOn(supabaseCatalogProvider, 'isHealthy').mockResolvedValue(true);
    const searchBooksSpy = vi.spyOn(supabaseCatalogProvider, 'searchBooks').mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [],
      source: 'supabase',
      latencyMs: 5,
      clientCountry: 'US',
      jurisdictionRule: 'US_PUBLIC_DOMAIN',
    });

    const poolReq = new NextRequest('http://localhost:3000/api/books?pool=quotes');
    const poolRes = await GET(poolReq);
    expect(poolRes.status).toBe(200);
    expect(poolRes.headers.get('Cache-Control')).toBe(
      'public, max-age=3600, s-maxage=43200, stale-while-revalidate=604800'
    );
    expect(poolRes.headers.get('Vary')).toBe('Accept-Encoding');

    const quoteIdReq = new NextRequest(
      'http://localhost:3000/api/books?ids=1342&has_quotes=true&include_restricted_metadata=true'
    );
    const quoteIdRes = await GET(quoteIdReq);
    expect(quoteIdRes.status).toBe(200);
    expect(quoteIdRes.headers.get('Cache-Control')).toBe(
      'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000'
    );
    expect(quoteIdRes.headers.get('Vary')).toBe('Accept-Encoding');

    isHealthySpy.mockRestore();
    searchBooksSpy.mockRestore();
  });
});
