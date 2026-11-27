import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { bookCoverRateLimiter } from '@/lib/rate-limiter';

describe('GET /covers/[file] crawler-accessible R2 JPEG cover handler', () => {
  const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

  function stubR2Env() {
    vi.stubEnv('R2_ACCOUNT_ID', '0123456789abcdef0123456789abcdef');
    vi.stubEnv('R2_BUCKET_NAME', 'bookarium-assets');
    vi.stubEnv('R2_ACCESS_KEY_ID', 'test-key');
    vi.stubEnv('R2_SECRET_ACCESS_KEY', 'test-secret');
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    bookCoverRateLimiter.reset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects browser document navigations and cross-site subresource hotlinks with 403 no-store while allowing headerless crawlers', async () => {
    stubR2Env();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(fakeJpeg, {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(fakeJpeg.byteLength) },
      })
    );

    const navBlocked = await GET(
      new NextRequest('http://localhost:3000/covers/1342.jpg', {
        headers: { 'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate' },
      }),
      { params: Promise.resolve({ file: '1342.jpg' }) }
    );
    expect(navBlocked.status).toBe(403);
    expect(navBlocked.headers.get('Cache-Control')).toBe('no-store, max-age=0');

    const hotlinkBlocked = await GET(
      new NextRequest('http://localhost:3000/covers/1342.jpg', {
        headers: { 'sec-fetch-dest': 'image', 'sec-fetch-site': 'cross-site' },
      }),
      { params: Promise.resolve({ file: '1342.jpg' }) }
    );
    expect(hotlinkBlocked.status).toBe(403);
    expect(hotlinkBlocked.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    expect(fetchSpy).not.toHaveBeenCalled();

    const botRes = await GET(
      new NextRequest('http://localhost:3000/covers/1342.jpg', {
        headers: { 'user-agent': 'Googlebot-Image/1.0' },
      }),
      { params: Promise.resolve({ file: '1342.jpg' }) }
    );
    expect(botRes.status).toBe(200);
    expect(botRes.headers.get('Content-Type')).toBe('image/jpeg');
    expect(botRes.headers.get('Cache-Control')).toBe(
      'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=2592000'
    );
    expect(botRes.headers.get('Vercel-Cache-Tag')).toBe('covers');
    expect(botRes.headers.get('Vary')).toBe('Accept-Encoding');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('enforces valid .jpg numeric pattern, disallowed query params, and rate limiting', async () => {
    const badExt = await GET(
      new NextRequest('http://localhost:3000/covers/1342.png'),
      { params: Promise.resolve({ file: '1342.png' }) }
    );
    expect(badExt.status).toBe(400);

    const badParam = await GET(
      new NextRequest('http://localhost:3000/covers/1342.jpg?url=https://evil.example'),
      { params: Promise.resolve({ file: '1342.jpg' }) }
    );
    expect(badParam.status).toBe(400);

    vi.spyOn(bookCoverRateLimiter, 'check').mockReturnValueOnce({
      success: false,
      limit: 60,
      remaining: 0,
      resetMs: 5000,
    });
    const limited = await GET(
      new NextRequest('http://localhost:3000/covers/1342.jpg'),
      { params: Promise.resolve({ file: '1342.jpg' }) }
    );
    expect(limited.status).toBe(429);
  });

  it('returns 404 no-store when R2 is unconfigured or cover object is absent', async () => {
    const resUnconfigured = await GET(
      new NextRequest('http://localhost:3000/covers/1342.jpg'),
      { params: Promise.resolve({ file: '1342.jpg' }) }
    );
    expect(resUnconfigured.status).toBe(404);
    expect(resUnconfigured.headers.get('Cache-Control')).toBe('no-store, max-age=0');
  });
});
