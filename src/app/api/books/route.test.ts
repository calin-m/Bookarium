import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { booksApiRateLimiter } from '@/lib/rate-limiter';

describe('GET /api/books route handler', () => {
  beforeEach(() => {
    booksApiRateLimiter.reset();
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
    const json = await blockedRes.json();
    expect(json.error).toMatch(/too many requests/i);
    expect(blockedRes.headers.get('Retry-After')).toBe('45');
    expect(blockedRes.headers.get('X-RateLimit-Limit')).toBe('60');
    expect(blockedRes.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('should fetch and return public domain books JSON with zero copyright and latencyMs', async () => {
    const req = new NextRequest('http://localhost:3000/api/books?search=Jane+Austen');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toBeDefined();
    expect(Array.isArray(json.results)).toBe(true);
    expect(json.count).toBeDefined();
    expect(json.source).toBe('upstream');
    expect(json.latencyMs).toBeDefined();
    expect(json.clientCountry).toBe('US');
    expect(json.jurisdictionRule).toBe('US_PUBLIC_DOMAIN');
    expect(res.headers.get('Vary')).toContain('x-vercel-ip-country');
  });

  it('should forward copyright=false to upstream Gutendex API', async () => {
    let capturedUrl = '';
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementationOnce(async (input) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify({ count: 1, results: [] }), { status: 200 });
    });

    const req = new NextRequest('http://localhost:3000/api/books?search=Austen');
    await GET(req);

    expect(capturedUrl).toContain('copyright=false');
    fetchSpy.mockRestore();
  });

  it('should filter out authors who died within Life + 70 when requested from GB', async () => {
    const mockResults = [
      {
        id: 1342,
        title: 'Pride and Prejudice',
        authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
        translators: [],
        copyright: false,
      },
      {
        id: 863,
        title: 'The Mysterious Affair at Styles',
        authors: [{ name: 'Christie, Agatha', birth_year: 1890, death_year: 1976 }],
        translators: [],
        copyright: false,
      },
    ];

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ count: 2, results: mockResults }), { status: 200 })
    );

    const req = new NextRequest('http://localhost:3000/api/books?search=detective', {
      headers: {
        'x-vercel-ip-country': 'GB',
      },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.clientCountry).toBe('GB');
    expect(json.jurisdictionRule).toBe('LIFE_70');
    expect(json.totalFiltered).toBe(1);
    expect(json.results).toHaveLength(1);
    expect(json.results[0].title).toBe('Pride and Prejudice');

    fetchSpy.mockRestore();
  });

  it('should filter out protected authors in local development via ?country=GB query parameter without headers', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const mockResults = [
      {
        id: 1342,
        title: 'Pride and Prejudice',
        authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
        translators: [],
        copyright: false,
      },
      {
        id: 863,
        title: 'The Mysterious Affair at Styles',
        authors: [{ name: 'Christie, Agatha', birth_year: 1890, death_year: 1976 }],
        translators: [],
        copyright: false,
      },
    ];

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ count: 2, results: mockResults }), { status: 200 })
    );

    const req = new NextRequest('http://localhost:3000/api/books?search=detective&country=GB');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.clientCountry).toBe('GB');
    expect(json.jurisdictionRule).toBe('LIFE_70');
    expect(json.totalFiltered).toBe(1);
    expect(json.results).toHaveLength(1);
    expect(json.results[0].title).toBe('Pride and Prejudice');

    fetchSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it('should filter out authors who died within Life + 100 when requested from Mexico (MX)', async () => {
    const mockResults = [
      {
        id: 1342,
        title: 'Pride and Prejudice',
        authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
        translators: [],
        copyright: false,
      },
      {
        id: 64317,
        title: 'The Great Gatsby',
        authors: [{ name: 'Fitzgerald, F. Scott', birth_year: 1896, death_year: 1940 }],
        translators: [],
        copyright: false,
      },
    ];

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ count: 2, results: mockResults }), { status: 200 })
    );

    const req = new NextRequest('http://localhost:3000/api/books?search=gatsby', {
      headers: {
        'x-vercel-ip-country': 'MX',
      },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.clientCountry).toBe('MX');
    expect(json.jurisdictionRule).toBe('LIFE_100');
    expect(json.totalFiltered).toBe(1);
    expect(json.results).toHaveLength(1);
    expect(json.results[0].title).toBe('Pride and Prejudice');

    fetchSpy.mockRestore();
  });

  it('should pass topic, language, page, era, sort, and mime_type query parameters', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/books?topic=Philosophy&languages=en&page=2&author_year_start=1800&author_year_end=1900&sort=popular&mime_type=text/html'
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toBeDefined();
  });

  it('should ignore single-character search queries to protect upstream API', async () => {
    let capturedUrl = '';
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementationOnce(async (input) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify({ count: 10, results: [] }), { status: 200 });
    });

    const req = new NextRequest('http://localhost:3000/api/books?search=a');
    await GET(req);

    expect(capturedUrl).not.toContain('search=');
    fetchSpy.mockRestore();
  });

  it('should normalize whitespace in search queries when passing to upstream API', async () => {
    let capturedUrl = '';
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementationOnce(async (input) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify({ count: 10, results: [] }), { status: 200 });
    });

    const req = new NextRequest('http://localhost:3000/api/books?search=Charles%20%20%20Dickens');
    await GET(req);

    expect(capturedUrl).toContain('search=Charles+Dickens');
    fetchSpy.mockRestore();
  });

  it('should return error response when upstream API returns an error status', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Invalid query parameter' }), {
        status: 400,
        statusText: 'Bad Request',
      })
    );

    const req = new NextRequest('http://localhost:3000/api/books?page=999999');
    const res = await GET(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Upstream Gutenberg API error');
    expect(json.results).toHaveLength(0);
    fetchSpy.mockRestore();
  });

  it('should return 502 status code when network connection fails', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network connection failed'));

    const req = new NextRequest('http://localhost:3000/api/books?page=1');
    const res = await GET(req);

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toContain('Unable to connect to Gutenberg API');
    expect(json.results).toHaveLength(0);
    fetchSpy.mockRestore();
  });

  it('should return 504 status code when upstream API times out via AbortError', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValueOnce(abortError);

    const req = new NextRequest('http://localhost:3000/api/books?page=1');
    const res = await GET(req);

    expect(res.status).toBe(504);
    const json = await res.json();
    expect(json.error).toContain('Gutenberg API request timed out');
    expect(json.results).toHaveLength(0);
    fetchSpy.mockRestore();
  });

  it('should return 502 status code when upstream API returns invalid non-JSON body', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('<html>Error</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    );
    const req = new NextRequest('http://localhost:3000/api/books?search=Test');
    const res = await GET(req);

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toContain('Invalid JSON response');
    expect(json.results).toHaveLength(0);
    fetchSpy.mockRestore();
  });

  it('should query Supabase provider first when healthy and return source supabase', async () => {
    const { supabaseCatalogProvider } = await import('@/lib/catalog/supabase-provider');
    const isHealthySpy = vi.spyOn(supabaseCatalogProvider, 'isHealthy').mockResolvedValueOnce(true);
    const searchBooksSpy = vi.spyOn(supabaseCatalogProvider, 'searchBooks').mockResolvedValueOnce({
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
    const json = await res.json();
    expect(json.source).toBe('supabase');
    expect(json.results).toHaveLength(1);
    expect(json.results[0].title).toBe('Pride and Prejudice');

    isHealthySpy.mockRestore();
    searchBooksSpy.mockRestore();
  });

  it('should gracefully degrade to upstream Gutendex when Supabase provider throws an error', async () => {
    const { supabaseCatalogProvider } = await import('@/lib/catalog/supabase-provider');
    const isHealthySpy = vi.spyOn(supabaseCatalogProvider, 'isHealthy').mockResolvedValueOnce(true);
    const searchBooksSpy = vi.spyOn(supabaseCatalogProvider, 'searchBooks').mockRejectedValueOnce(
      new Error('Supabase database connection timeout')
    );

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        count: 1,
        results: [
          {
            id: 1342,
            title: 'Pride and Prejudice',
            authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
            translators: [],
            copyright: false,
          },
        ],
      }), { status: 200 })
    );

    const req = new NextRequest('http://localhost:3000/api/books?search=Pride');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.source).toBe('upstream');
    expect(json.results).toHaveLength(1);
    expect(json.results[0].title).toBe('Pride and Prejudice');

    isHealthySpy.mockRestore();
    searchBooksSpy.mockRestore();
    fetchSpy.mockRestore();
  });
});
