import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, isSafeUpstreamUrl, sanitizeUpstreamUrl } from './route';
import { bookContentRateLimiter } from '@/lib/rate-limiter';
import { sampleBookText } from '@/mocks/handlers';

describe('Security & Vulnerability Abuse Suite: GET /api/books/content', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    bookContentRateLimiter.reset();
  });

  describe('OWASP SSRF (Server-Side Request Forgery) Defense', () => {
    it('blocks AWS and GCP cloud metadata IP endpoints', async () => {
      const cloudMetadataUrls = [
        'http://169.254.169.254/latest/meta-data/',
        'https://169.254.169.254/computeMetadata/v1/',
        'http://metadata.google.internal/computeMetadata/v1/',
        'http://169.254.169.254/openstack',
      ];

      for (const url of cloudMetadataUrls) {
        expect(isSafeUpstreamUrl(url)).toBe(false);
        expect(sanitizeUpstreamUrl(url)).toBeNull();

        const req = new NextRequest(`http://localhost:3000/api/books/content?url=${encodeURIComponent(url)}`);
        const res = await GET(req);
        expect(res.status).toBe(400);
      }
    });

    it('blocks loopback and private RFC 1918 IPv4/IPv6 addresses', async () => {
      const privateNetworkUrls = [
        'http://localhost:3000',
        'http://127.0.0.1:8080/admin',
        'http://10.0.0.1/secret',
        'http://172.16.0.1/intranet',
        'http://192.168.1.1/router',
        'http://0.0.0.0:80',
        'http://[::1]:8080',
      ];

      for (const url of privateNetworkUrls) {
        expect(isSafeUpstreamUrl(url)).toBe(false);
        expect(sanitizeUpstreamUrl(url)).toBeNull();

        const req = new NextRequest(`http://localhost:3000/api/books/content?url=${encodeURIComponent(url)}`);
        const res = await GET(req);
        expect(res.status).toBe(400);
      }
    });

    it('blocks domain spoofing and subdomains targeting gutenberg.org', () => {
      const spoofedUrls = [
        'https://evil-gutenberg.org/cache/epub/1342/pg1342.txt',
        'https://gutenberg.org.attacker.com/cache/epub/1342/pg1342.txt',
        'https://fake-www.gutenberg.org/1342',
        'https://attacker.com?redirect=gutenberg.org',
        'https://user:pass@gutenberg.org/cache/1342',
      ];

      for (const url of spoofedUrls) {
        expect(isSafeUpstreamUrl(url)).toBe(false);
        expect(sanitizeUpstreamUrl(url)).toBeNull();
      }
    });
  });

  describe('OWASP Path Traversal Defense', () => {
    it('blocks directory traversal attempts in query parameters and paths', () => {
      const traversalUrls = [
        'https://www.gutenberg.org/../../etc/passwd',
        'https://gutenberg.org/cache/epub/1342/../../../secret.env',
        'https://www.gutenberg.org/..%2f..%2fetc/passwd',
        'https://www.gutenberg.org/cache/epub/1342/..\\..\\windows\\system32',
      ];

      for (const url of traversalUrls) {
        expect(isSafeUpstreamUrl(url)).toBe(false);
        expect(sanitizeUpstreamUrl(url)).toBeNull();
      }
    });
  });

  describe('Dangerous URI Schemes & Protocol-Relative Evasion', () => {
    it('blocks non-HTTP/HTTPS protocols', () => {
      const dangerousSchemes = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
        'ftp://gutenberg.org/files/1342/1342.txt',
        '//www.gutenberg.org/cache/epub/1342/pg1342.txt',
      ];

      for (const uri of dangerousSchemes) {
        expect(isSafeUpstreamUrl(uri)).toBe(false);
        expect(sanitizeUpstreamUrl(uri)).toBeNull();
      }
    });
  });

  describe('Network Call Isolation & Destination Integrity', () => {
    it('ensures global.fetch is never triggered for unauthenticated/malicious inputs', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');

      const attackPayloads = [
        'http://169.254.169.254/latest/meta-data/',
        'https://evil.attacker.com/payload',
        'http://localhost:54321',
      ];

      for (const payload of attackPayloads) {
        const req = new NextRequest(`http://localhost:3000/api/books/content?url=${encodeURIComponent(payload)}`);
        const res = await GET(req);
        expect(res.status).toBe(400);
      }

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('strictly confines legitimate outgoing requests to approved Gutenberg CDN endpoints', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: async () => sampleBookText,
      } as any);

      const req = new NextRequest('http://localhost:3000/api/books/content?id=1342');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalled();
      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toBe('https://www.gutenberg.org/cache/epub/1342/pg1342.txt');
    });
  });

  describe('DoS & Rate Limit Abuse Protection', () => {
    it('protects backend from request flooding by enforcing 429 response', async () => {
      // Consume rate limit allowance
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
  });
});

