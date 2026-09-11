import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { clearBookMetadataCache } from './metadata-cache';
import { isSafeUpstreamUrl, sanitizeUpstreamUrl } from './url-validator';
import { sampleBookText } from '@/mocks/handlers';
import { bookContentRateLimiter } from '@/lib/rate-limiter';

describe('GET /api/books/content', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    bookContentRateLimiter.reset();
    clearBookMetadataCache();
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
    // Mock metadata for Agatha Christie
    const christieMeta = {
      id: 863,
      title: 'The Mysterious Affair at Styles',
      authors: [{ name: 'Christie, Agatha', birth_year: 1890, death_year: 1976 }],
      translators: [],
      copyright: false,
    };

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(christieMeta), { status: 200 })
    );

    const req = new NextRequest('http://localhost:3000/api/books/content?id=863', {
      headers: {
        'x-vercel-ip-country': 'GB',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(451);
    expect(res.headers.get('Vary')).toContain('x-vercel-ip-country');

    const json = await res.json();
    expect(json.country).toBe('GB');
    expect(json.rule).toBe('LIFE_70');
    expect(json.publicDomainYear).toBe(2047);
    expect(json.restrictingDeathYear).toBe(1976);

    fetchSpy.mockRestore();
  });

  it('should return HTTP 451 when book is protected in Mexico (Life + 100)', async () => {
    const gatsbyMeta = {
      id: 64317,
      title: 'The Great Gatsby',
      authors: [{ name: 'Fitzgerald, F. Scott', birth_year: 1896, death_year: 1940 }],
      translators: [],
      copyright: false,
    };

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(gatsbyMeta), { status: 200 })
    );

    const req = new NextRequest('http://localhost:3000/api/books/content?id=64317', {
      headers: {
        'x-vercel-ip-country': 'MX',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(451);
    const json = await res.json();
    expect(json.country).toBe('MX');
    expect(json.rule).toBe('LIFE_100');
    expect(json.publicDomainYear).toBe(2041);

    fetchSpy.mockRestore();
  });

  it('should return HTTP 503 fail-closed when metadata cannot be retrieved for international user', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('Service Unavailable', { status: 503 })
    );

    const req = new NextRequest('http://localhost:3000/api/books/content?id=9999', {
      headers: {
        'x-vercel-ip-country': 'FR',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toContain('Unable to verify copyright clearance');

    fetchSpy.mockRestore();
  });

  it('should fetch and return book text for valid public domain id in US', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => sampleBookText,
    } as any);

    const req = new NextRequest('http://localhost:3000/api/books/content?id=1342');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/plain');
    expect(res.headers.get('Vary')).toContain('x-vercel-ip-country');
    const text = await res.text();
    expect(text).toContain('Pride and Prejudice');
  });

  it('should stream public domain book to GB user when metadata confirms death year <= 1955', async () => {
    const austenMeta = {
      id: 1342,
      title: 'Pride and Prejudice',
      authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
      translators: [],
      copyright: false,
    };

    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(austenMeta), { status: 200 })) // Metadata check
      .mockResolvedValueOnce({
        ok: true,
        text: async () => sampleBookText,
      } as any); // Text stream

    const req = new NextRequest('http://localhost:3000/api/books/content?id=1342', {
      headers: {
        'x-vercel-ip-country': 'GB',
      },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Pride and Prejudice');

    fetchSpy.mockRestore();
  });

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
    expect(calledUrl).toMatch(/^https:\/\/www\.gutenberg\.org\/(cache\/epub|files)\/\d{1,8}\//);
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
});
