import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  getClientIp,
  createRateLimitErrorResponse,
  buildApiSecurityHeaders,
  hasUnexpectedQueryParams,
  createNoStoreErrorResponse,
  isHttpsRequest,
  isBlockedContentAssetRequest,
  guardContentAssetRequest,
} from './api-utils';

describe('api-utils', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  describe('getClientIp', () => {
    it('prioritizes x-vercel-forwarded-for when present', () => {
      const headers = new Headers();
      headers.set('x-vercel-forwarded-for', '198.51.100.1');
      headers.set('x-forwarded-for', '203.0.113.195, 70.41.3.18');
      headers.set('x-real-ip', '198.51.100.99');

      const ip = getClientIp({ headers });
      expect(ip).toBe('198.51.100.1');
    });

    it('prioritizes cf-connecting-ip when vercel header is missing', () => {
      const headers = new Headers();
      headers.set('cf-connecting-ip', '198.51.100.2');
      headers.set('x-forwarded-for', '203.0.113.195, 70.41.3.18');

      const ip = getClientIp({ headers });
      expect(ip).toBe('198.51.100.2');
    });

    it('prioritizes x-real-ip when cloud provider headers are missing', () => {
      const headers = new Headers();
      headers.set('x-real-ip', '198.51.100.42');
      headers.set('x-forwarded-for', '203.0.113.195, 70.41.3.18');

      const ip = getClientIp({ headers });
      expect(ip).toBe('198.51.100.42');
    });

    it('extracts rightmost edge client IP from x-forwarded-for to prevent client spoofing', () => {
      const headers = new Headers();
      headers.set('x-forwarded-for', '203.0.113.195, 70.41.3.18, 150.172.238.178');

      const ip = getClientIp({ headers });
      expect(ip).toBe('150.172.238.178');
    });

    it('falls back to 127.0.0.1 when no IP headers are present', () => {
      const headers = new Headers();
      const ip = getClientIp({ headers });
      expect(ip).toBe('127.0.0.1');
    });
  });

  describe('createRateLimitErrorResponse', () => {
    it('returns a 429 response with default message and standard headers', async () => {
      const rateLimit = {
        resetMs: 5000,
        limit: 100,
        remaining: 0,
      };

      const res = createRateLimitErrorResponse(rateLimit);
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('5');
      expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');

      const body = await res.json();
      expect(body).toEqual({
        error: 'Too many requests. Please slow down and try again.',
      });
    });

    it('merges custom message and additional body properties', async () => {
      const rateLimit = {
        resetMs: 1200,
        limit: 30,
        remaining: 0,
      };

      const res = createRateLimitErrorResponse(
        rateLimit,
        'Too many translation requests. Please slow down and try again.',
        { results: [], count: 0, latencyMs: 42 }
      );

      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('2'); // Math.ceil(1200 / 1000) = 2

      const body = await res.json();
      expect(body).toEqual({
        error: 'Too many translation requests. Please slow down and try again.',
        results: [],
        count: 0,
        latencyMs: 42,
      });
    });
  });

  describe('buildApiSecurityHeaders & createNoStoreErrorResponse', () => {
    it('emits same-origin and cross-origin CORP policies paired with nosniff', () => {
      expect(buildApiSecurityHeaders()).toEqual({
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'same-origin',
      });
      expect(buildApiSecurityHeaders('cross-origin')).toEqual({
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      });
    });

    it('creates a no-store JSON error response with hardened headers', async () => {
      const res = createNoStoreErrorResponse('Unsupported parameter', 400, { results: [] });
      expect(res.status).toBe(400);
      expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
      expect(await res.json()).toEqual({ error: 'Unsupported parameter', results: [] });
    });
  });

  describe('hasUnexpectedQueryParams', () => {
    const allowed = new Set(['id', 'type']);
    const devOnly = new Set(['country']);

    it('accepts allowlisted params and allows dev-only params outside production', () => {
      vi.stubEnv('NODE_ENV', 'development');
      expect(hasUnexpectedQueryParams(new URLSearchParams('id=1342&type=card&country=GB'), allowed, devOnly)).toBe(false);
    });

    it('rejects unknown params and rejects dev-only params in production', () => {
      vi.stubEnv('NODE_ENV', 'development');
      expect(hasUnexpectedQueryParams(new URLSearchParams('id=1342&foo=bar'), allowed, devOnly)).toBe(true);

      vi.stubEnv('NODE_ENV', 'production');
      expect(hasUnexpectedQueryParams(new URLSearchParams('id=1342&country=GB'), allowed, devOnly)).toBe(true);
      expect(hasUnexpectedQueryParams(new URLSearchParams('id=1342&type=card'), allowed, devOnly)).toBe(false);
    });
  });

  describe('isHttpsRequest', () => {
    it('detects HTTPS from x-forwarded-proto proxy headers or request URLs while allowing HTTP localhost', () => {
      expect(
        isHttpsRequest({
          url: 'http://internal-edge:3000/catalog',
          headers: new Headers({ 'x-forwarded-proto': 'https, http' }),
        })
      ).toBe(true);

      expect(
        isHttpsRequest({
          url: 'https://bookarium.vercel.app/account',
          headers: new Headers(),
        })
      ).toBe(true);

      expect(
        isHttpsRequest({
          url: 'https://bookarium.vercel.app/account',
          headers: new Headers({ 'x-forwarded-proto': 'http' }),
        })
      ).toBe(false);

      expect(
        isHttpsRequest({
          url: 'http://localhost:3000/catalog',
          headers: new Headers(),
        })
      ).toBe(false);
    });
  });

  describe('isBlockedContentAssetRequest & guardContentAssetRequest', () => {
    it('blocks browser deeplink navigations, embed destinations, and cross-site subresource hotlinks', async () => {
      const destinations = ['document', 'iframe', 'frame', 'embed', 'object', 'fencedframe'];
      for (const dest of destinations) {
        expect(
          isBlockedContentAssetRequest({
            url: 'https://bookarium.vercel.app/api/books/content?id=1342&type=cover',
            headers: new Headers({ 'sec-fetch-dest': dest, 'sec-fetch-site': 'same-origin' }),
          })
        ).toBe(true);
      }

      expect(
        isBlockedContentAssetRequest({
          url: 'https://bookarium.vercel.app/api/books/content?id=1342',
          headers: new Headers({ 'sec-fetch-mode': 'navigate' }),
        })
      ).toBe(true);

      const blockedRes = guardContentAssetRequest({
        url: 'https://bookarium.vercel.app/api/books/content?id=1342&type=cover',
        headers: new Headers({ 'sec-fetch-dest': 'image', 'sec-fetch-site': 'cross-site' }),
      });
      expect(blockedRes).not.toBeNull();
      expect(blockedRes?.status).toBe(403);
      expect(blockedRes?.headers.get('Cache-Control')).toBe('no-store, max-age=0');
      expect(blockedRes?.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
      expect(blockedRes?.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(await blockedRes?.json()).toEqual({
        error: 'Direct browser deeplinking or cross-site embedding of book assets is not permitted.',
      });
    });

    it('permits same-origin image/fetch requests, same-site subdomains, type=card social cards, and headerless crawlers', () => {
      expect(
        guardContentAssetRequest({
          url: 'https://bookarium.vercel.app/api/books/content?id=1342&type=cover',
          headers: new Headers({
            'sec-fetch-dest': 'image',
            'sec-fetch-mode': 'no-cors',
            'sec-fetch-site': 'same-origin',
          }),
        })
      ).toBeNull();

      expect(
        guardContentAssetRequest({
          url: 'https://bookarium.vercel.app/api/books/content?id=1342',
          headers: new Headers({
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
          }),
        })
      ).toBeNull();

      expect(
        guardContentAssetRequest({
          url: 'https://bookarium.vercel.app/api/books/content?id=1342&type=cover',
          headers: new Headers({
            'sec-fetch-dest': 'image',
            'sec-fetch-mode': 'no-cors',
            'sec-fetch-site': 'same-site',
          }),
        })
      ).toBeNull();

      expect(
        guardContentAssetRequest({
          url: 'https://bookarium.vercel.app/api/books/content?id=1342&type=card',
          nextUrl: { searchParams: new URLSearchParams('id=1342&type=card') },
          headers: new Headers({
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'cross-site',
          }),
        })
      ).toBeNull();

      expect(
        guardContentAssetRequest({
          url: 'https://bookarium.vercel.app/api/books/content?id=1342&type=cover',
          headers: new Headers(),
        })
      ).toBeNull();
    });

    it('returns false safely on malformed request URLs without throwing', () => {
      expect(
        isBlockedContentAssetRequest({
          url: 'http://[invalid',
          headers: new Headers({ 'sec-fetch-dest': 'document' }),
        })
      ).toBe(false);
    });
  });
});

