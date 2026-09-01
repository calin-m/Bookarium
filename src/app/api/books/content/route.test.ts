import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, isSafeUpstreamUrl } from './route';
import { sampleBookText } from '@/mocks/handlers';
import { bookContentRateLimiter } from '@/lib/rate-limiter';

describe('GET /api/books/content', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    bookContentRateLimiter.reset();
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
    const json = await res.json();
    expect(json.error).toMatch(/missing/i);
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

  it('should validate official Gutenberg upstream URLs as safe', () => {
    expect(isSafeUpstreamUrl('https://www.gutenberg.org/cache/epub/1342/pg1342.txt')).toBe(true);
    expect(isSafeUpstreamUrl('https://gutenberg.org/files/1342/1342-0.txt')).toBe(true);
  });

  it('should fetch and return book text for valid id', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => sampleBookText,
    } as any);

    const req = new NextRequest('http://localhost:3000/api/books/content?id=1342');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/plain');
    const text = await res.text();
    expect(text).toContain('Pride and Prejudice');
  });

  it('should return 502 if upstream fails or times out', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Connection aborted'));

    const req = new NextRequest('http://localhost:3000/api/books/content?id=99999');
    const res = await GET(req);

    expect(res.status).toBe(502);
  });
});


