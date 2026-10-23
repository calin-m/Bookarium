import { describe, it, expect } from 'vitest';
import { sanitizeRedirectPath } from './redirect-sanitizer';

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

