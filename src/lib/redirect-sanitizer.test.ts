import { describe, it, expect } from 'vitest';
import {
  sanitizeRedirectPath,
  resolveCanonicalAuthOrigin,
  buildAuthRedirectUrl,
  resolveCanonicalShareOrigin,
  buildBookShareUrl,
} from './redirect-sanitizer';

describe('sanitizeRedirectPath', () => {
  it('returns default root slash for null, undefined, or empty path', () => {
    expect(sanitizeRedirectPath(null)).toBe('/');
    expect(sanitizeRedirectPath('')).toBe('/');
    expect(sanitizeRedirectPath('   ')).toBe('/');
  });

  it('allows safe absolute paths starting with a single slash', () => {
    expect(sanitizeRedirectPath('/account')).toBe('/account');
    expect(sanitizeRedirectPath('/bookshelf?sort=recent')).toBe('/bookshelf?sort=recent');
    expect(sanitizeRedirectPath('/')).toBe('/');
  });

  it('blocks open redirect protocol-relative double slashes and backslashes', () => {
    expect(sanitizeRedirectPath('//evil.com')).toBe('/');
    expect(sanitizeRedirectPath('/\\evil.com')).toBe('/');
    expect(sanitizeRedirectPath('\\evil.com')).toBe('/');
    expect(sanitizeRedirectPath('https://evil.com')).toBe('/');
  });
});

describe('resolveCanonicalAuthOrigin', () => {
  it('preserves localhost and 127.0.0.1 origins for local development', () => {
    expect(resolveCanonicalAuthOrigin('http://localhost:3000')).toBe('http://localhost:3000');
    expect(resolveCanonicalAuthOrigin('http://127.0.0.1:3005')).toBe('http://127.0.0.1:3005');
  });

  it('normalizes Vercel preview deployment origins to the canonical production site URL', () => {
    expect(
      resolveCanonicalAuthOrigin(
        'https://bookarium-git-master-calins-projects.vercel.app',
        'https://bookarium.vercel.app/'
      )
    ).toBe('https://bookarium.vercel.app');
    expect(
      resolveCanonicalAuthOrigin(
        'https://bookarium-8f9a1b2c.vercel.app',
        'https://bookarium.vercel.app'
      )
    ).toBe('https://bookarium.vercel.app');
  });

  it('returns canonical fallback when currentOrigin is undefined or malformed', () => {
    expect(resolveCanonicalAuthOrigin(undefined, 'https://bookarium.vercel.app')).toBe(
      'https://bookarium.vercel.app'
    );
    expect(resolveCanonicalAuthOrigin('not-a-valid-url', 'https://bookarium.vercel.app')).toBe(
      'https://bookarium.vercel.app'
    );
  });
});

describe('buildAuthRedirectUrl', () => {
  it('builds a sanitized redirect URL using the canonical origin', () => {
    expect(
      buildAuthRedirectUrl(
        '/auth/callback',
        'https://bookarium-preview-123.vercel.app',
        'https://bookarium.vercel.app'
      )
    ).toBe('https://bookarium.vercel.app/auth/callback');

    expect(
      buildAuthRedirectUrl(
        '/account',
        'http://localhost:3000',
        'https://bookarium.vercel.app'
      )
    ).toBe('http://localhost:3000/account');
  });

  it('sanitizes unsafe redirect paths back to root on canonical origin', () => {
    expect(
      buildAuthRedirectUrl(
        '//malicious.example.com',
        'https://bookarium.vercel.app',
        'https://bookarium.vercel.app'
      )
    ).toBe('https://bookarium.vercel.app/');
  });
});

describe('resolveCanonicalShareOrigin and buildBookShareUrl', () => {
  it('dynamically preserves production https origins and localhost origins', () => {
    expect(
      resolveCanonicalShareOrigin('https://bookarium.vercel.app', 'https://bookarium.vercel.app')
    ).toBe('https://bookarium.vercel.app');
    expect(
      resolveCanonicalShareOrigin('https://books.example.org', 'https://bookarium.vercel.app')
    ).toBe('https://books.example.org');
    expect(
      resolveCanonicalShareOrigin('http://localhost:3000', 'https://bookarium.vercel.app')
    ).toBe('http://localhost:3000');
  });

  it('normalizes ephemeral Vercel preview URLs and rejects untrusted protocols', () => {
    expect(
      resolveCanonicalShareOrigin(
        'https://bookarium-git-feat-calins-projects.vercel.app',
        'https://bookarium.vercel.app'
      )
    ).toBe('https://bookarium.vercel.app');
    expect(
      resolveCanonicalShareOrigin('javascript:alert(1)', 'https://bookarium.vercel.app')
    ).toBe('https://bookarium.vercel.app');
    expect(
      resolveCanonicalShareOrigin('http://insecure.example.com', 'https://bookarium.vercel.app')
    ).toBe('https://bookarium.vercel.app');
  });

  it('builds a valid book share URL and falls back to root on invalid book IDs', () => {
    expect(
      buildBookShareUrl(1342, 'https://bookarium.vercel.app', 'https://bookarium.vercel.app')
    ).toBe('https://bookarium.vercel.app/read/1342');
    expect(
      buildBookShareUrl('84', 'http://localhost:3000', 'https://bookarium.vercel.app')
    ).toBe('http://localhost:3000/read/84');
    expect(
      buildBookShareUrl('invalid-id', 'https://bookarium.vercel.app', 'https://bookarium.vercel.app')
    ).toBe('https://bookarium.vercel.app/');
  });
});



