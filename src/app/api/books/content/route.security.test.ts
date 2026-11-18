import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import zlib from 'node:zlib';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { clearBookMetadataCache, clearBookContentCache } from './metadata-cache';
import {
  bookContentRateLimiter,
  bookCardRateLimiter,
  bookCoverRateLimiter,
} from '@/lib/rate-limiter';
import { sampleBookText } from '@/mocks/handlers';

function stubR2Credentials() {
  vi.stubEnv('R2_ACCOUNT_ID', '0123456789abcdef0123456789abcdef');
  vi.stubEnv('R2_BUCKET_NAME', 'bookarium-assets');
  vi.stubEnv('R2_ACCESS_KEY_ID', 'test-r2-access-key');
  vi.stubEnv('R2_SECRET_ACCESS_KEY', 'test-r2-secret-key');
}

describe('Security & Vulnerability Abuse Suite: GET /api/books/content', () => {
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

  describe('OWASP SSRF (Server-Side Request Forgery) Defense', () => {
    it('rejects all ?url= query parameters including cloud metadata, loopback, spoofed domains, path traversal, and dangerous URI schemes without calling fetch', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');
      const maliciousUrls = [
        'http://169.254.169.254/latest/meta-data/',
        'https://169.254.169.254/computeMetadata/v1/',
        'http://metadata.google.internal/computeMetadata/v1/',
        'http://localhost:3000',
        'http://127.0.0.1:8080/admin',
        'http://10.0.0.1/secret',
        'http://172.16.0.1/intranet',
        'http://192.168.1.1/router',
        'http://[::1]:8080',
        'https://evil-gutenberg.org/cache/epub/1342/pg1342.txt',
        'https://www.gutenberg.org/cache/epub/1342/pg1342.txt',
        'https://www.gutenberg.org/../../etc/passwd',
        'javascript:alert(1)',
        'file:///etc/passwd',
        'ftp://gutenberg.org/files/1342/1342.txt',
      ];

      for (const url of maliciousUrls) {
        const req = new NextRequest(`http://localhost:3000/api/books/content?url=${encodeURIComponent(url)}`);
        const res = await GET(req);
        expect(res.status).toBe(400);
        expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');
        expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
      }

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('blocks directory traversal and non-numeric ?id= payloads at parameter boundary', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');
      const traversalIds = [
        '1342/../../etc/passwd',
        '1342%2f..%2fsecret',
        '0',
        '-5',
        '999999999',
        'abc',
      ];

      for (const id of traversalIds) {
        const req = new NextRequest(`http://localhost:3000/api/books/content?id=${encodeURIComponent(id)}`);
        const res = await GET(req);
        expect(res.status).toBe(400);
      }

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('Network Call Isolation & R2 Endpoint Integrity', () => {
    it('fails closed with 503 when R2 is unconfigured and never contacts Project Gutenberg mirrors', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');

      const req = new NextRequest('http://localhost:3000/api/books/content?id=1342');
      const res = await GET(req);

      expect(res.status).toBe(503);
      expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('strictly confines outgoing text requests to private Cloudflare R2 S3 endpoints with redirect: manual', async () => {
      stubR2Credentials();
      const gzipped = zlib.gzipSync(Buffer.from(sampleBookText, 'utf8'));
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(new Uint8Array(gzipped), {
          status: 200,
          headers: { 'Content-Type': 'application/gzip' },
        })
      );

      const req = new NextRequest('http://localhost:3000/api/books/content?id=1342');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const calledUrl = String(fetchSpy.mock.calls[0][0]);
      expect(calledUrl).toBe(
        'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/bookarium-assets/books/1342.txt.gz'
      );
      expect(fetchSpy.mock.calls[0][1]).toEqual(expect.objectContaining({ redirect: 'manual' }));
    });
  });

  describe('DoS & Rate Limit Abuse Protection', () => {
    it('protects backend from request flooding by enforcing 429 response', async () => {
      for (let i = 0; i < 30; i++) {
        bookContentRateLimiter.check('198.51.100.42');
      }

      const blockedReq = new NextRequest('http://localhost:3000/api/books/content?id=1342', {
        headers: { 'x-forwarded-for': '198.51.100.42' },
      });
      const blockedRes = await GET(blockedReq);

      expect(blockedRes.status).toBe(429);
      const json = await blockedRes.json();
      expect(json.error).toMatch(/too many requests/i);
    });

    it('isolates ImageResponse CPU flood protection at 20 req/min/IP and blocks arbitrary query param injection', async () => {
      for (let i = 0; i < 20; i++) {
        bookCardRateLimiter.check('198.51.100.77');
      }

      const cardFloodReq = new NextRequest('http://localhost:3000/api/books/content?id=1342&type=card', {
        headers: { 'x-forwarded-for': '198.51.100.77' },
      });
      const cardFloodRes = await GET(cardFloodReq);
      expect(cardFloodRes.status).toBe(429);
      expect(cardFloodRes.headers.get('X-RateLimit-Limit')).toBe('20');
      expect(cardFloodRes.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');

      const paramInjectionReq = new NextRequest(
        'http://localhost:3000/api/books/content?id=1342&callback=alert(1)'
      );
      const paramInjectionRes = await GET(paramInjectionReq);
      expect(paramInjectionRes.status).toBe(400);
      expect(paramInjectionRes.headers.get('Cache-Control')).toBe('no-store, max-age=0');
      expect(paramInjectionRes.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
      expect(paramInjectionRes.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });
  });

  describe('R2 Redirect Rejection, Header Sanitization & Decompression Bomb Protection', () => {
    it('enforces redirect: manual and rejects any 301/302 R2 upstream redirects', async () => {
      stubR2Credentials();
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: new Headers({
            Location: 'http://169.254.169.254/latest/meta-data/',
          }),
        })
      );

      const req = new NextRequest('http://localhost:3000/api/books/content?id=1342');
      const res = await GET(req);

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('.r2.cloudflarestorage.com'),
        expect.objectContaining({ redirect: 'manual' })
      );
      expect(res.status).toBe(502);
    });

    it('strips all upstream server headers and sets explicit sanitized response headers', async () => {
      stubR2Credentials();
      const gzipped = zlib.gzipSync(Buffer.from(sampleBookText, 'utf8'));
      vi.spyOn(global, 'fetch').mockResolvedValueOnce(
        new Response(new Uint8Array(gzipped), {
          status: 200,
          headers: new Headers({
            'Content-Type': 'application/gzip',
            Server: 'Cloudflare',
            'Set-Cookie': 'tracking_session=secret_token',
            'X-Powered-By': 'S3',
          }),
        })
      );

      const req = new NextRequest('http://localhost:3000/api/books/content?id=1342');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Server')).toBeNull();
      expect(res.headers.get('Set-Cookie')).toBeNull();
      expect(res.headers.get('X-Powered-By')).toBeNull();
      expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
      expect(res.headers.get('X-Bookarium-Source')).toBe('r2');
      expect(res.headers.get('Cache-Control')).toBe(
        'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
      );
    });

    it('rejects oversized R2 payloads and gzip bombs exceeding 15MB threshold', async () => {
      stubR2Credentials();
      const gzippedBomb = zlib.gzipSync(Buffer.alloc(16 * 1024 * 1024, 'x'));

      vi.spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response('oversized', {
            status: 200,
            headers: new Headers({
              'Content-Length': String(20 * 1024 * 1024),
            }),
          })
        )
        .mockResolvedValueOnce(
          new Response(new Uint8Array(gzippedBomb), {
            status: 200,
            headers: new Headers({ 'Content-Type': 'application/gzip' }),
          })
        );

      const res1 = await GET(new NextRequest('http://localhost:3000/api/books/content?id=1342'));
      expect(res1.status).toBe(502);
      const json1 = await res1.json();
      expect(json1.error).toMatch(/failed to fetch unabridged text from R2 asset storage/i);

      const res2 = await GET(new NextRequest('http://localhost:3000/api/books/content?id=84'));
      expect(res2.status).toBe(502);
    });
  });
});

