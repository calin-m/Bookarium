import { describe, it, expect } from 'vitest';
import { getClientIp, createRateLimitErrorResponse } from './api-utils';

describe('api-utils', () => {
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
});

