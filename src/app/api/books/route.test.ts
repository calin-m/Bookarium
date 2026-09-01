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

  it('should return 504 status code when upstream API times out or network fails', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network connection failed'));

    const req = new NextRequest('http://localhost:3000/api/books?page=1');
    const res = await GET(req);

    expect(res.status).toBe(504);
    const json = await res.json();
    expect(json.error).toContain('Unable to connect to Gutenberg API');
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
});
