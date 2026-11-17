import { describe, it, expect } from 'vitest';
import { isSafeUpstreamUrl, sanitizeUpstreamUrl } from './url-validator';

describe('url-validator', () => {
  describe('isSafeUpstreamUrl', () => {
    it('accepts legitimate Project Gutenberg URLs', () => {
      expect(isSafeUpstreamUrl('https://www.gutenberg.org/cache/epub/1342/pg1342.txt')).toBe(true);
      expect(isSafeUpstreamUrl('https://gutenberg.org/files/1342/1342-0.txt')).toBe(true);
      expect(isSafeUpstreamUrl('https://gutenberg.pglaf.org/cache/epub/1342/pg1342.txt')).toBe(true);
      expect(isSafeUpstreamUrl('/cache/epub/1342/pg1342.txt', 'https://aleph.gutenberg.org')).toBe(true);
      expect(isSafeUpstreamUrl('http://www.gutenberg.org/cache/epub/84/pg84.txt')).toBe(true);
    });

    it('rejects foreign and untrusted domains', () => {
      expect(isSafeUpstreamUrl('https://evil.com/pg1342.txt')).toBe(false);
      expect(isSafeUpstreamUrl('https://gutenberg.org.attacker.com/evil.txt')).toBe(false);
      expect(isSafeUpstreamUrl('https://sub.gutenberg.org/test.txt')).toBe(false);
    });

    it('rejects path traversal attempts', () => {
      expect(isSafeUpstreamUrl('https://www.gutenberg.org/../../etc/passwd')).toBe(false);
      expect(isSafeUpstreamUrl('https://gutenberg.org/cache/epub/1342/../../../secret')).toBe(false);
    });

    it('rejects credentials in URLs', () => {
      expect(isSafeUpstreamUrl('https://user:pass@www.gutenberg.org/cache/epub/1342/pg1342.txt')).toBe(false);
    });

    it('rejects local and private network addresses', () => {
      expect(isSafeUpstreamUrl('http://localhost:3000')).toBe(false);
      expect(isSafeUpstreamUrl('http://127.0.0.1/test')).toBe(false);
      expect(isSafeUpstreamUrl('http://192.168.1.1/test')).toBe(false);
      expect(isSafeUpstreamUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
    });

    it('handles malformed URLs safely without throwing', () => {
      expect(isSafeUpstreamUrl('not-a-valid-url')).toBe(false);
      expect(isSafeUpstreamUrl('')).toBe(false);
    });
  });

  describe('sanitizeUpstreamUrl', () => {
    it('sanitizes standard Gutenberg URLs to canonical cache paths', () => {
      expect(sanitizeUpstreamUrl('https://www.gutenberg.org/cache/epub/1342/pg1342.txt')).toBe(
        'https://www.gutenberg.org/cache/epub/1342/pg1342.txt'
      );
    });

    it('preserves files-0 and files paths for older legacy Gutenberg mirrors', () => {
      expect(sanitizeUpstreamUrl('https://gutenberg.org/files/1342/1342-0.txt')).toBe(
        'https://gutenberg.org/files/1342/1342-0.txt'
      );
      expect(sanitizeUpstreamUrl('https://gutenberg.org/files/1342/1342.txt')).toBe(
        'https://gutenberg.org/files/1342/1342.txt'
      );
      expect(sanitizeUpstreamUrl('https://aleph.gutenberg.org/epub/pg64317.txt')).toBe(
        'https://www.gutenberg.org/cache/epub/64317/pg64317.txt'
      );
    });

    it('rejects custom ports, unsupported schemes, credential userinfo, and unsafe path characters', () => {
      expect(isSafeUpstreamUrl('https://www.gutenberg.org:8443/cache/epub/1342/pg1342.txt')).toBe(false);
      expect(isSafeUpstreamUrl('ftp://www.gutenberg.org/cache/epub/1342/pg1342.txt')).toBe(false);
      expect(isSafeUpstreamUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeUpstreamUrl('data:text/plain,hello')).toBe(false);
      expect(isSafeUpstreamUrl('file:///etc/passwd')).toBe(false);
      expect(isSafeUpstreamUrl('https://www.gutenberg.org@evil.com/cache/epub/1342/pg1342.txt')).toBe(false);
      expect(isSafeUpstreamUrl('https://www.gutenberg.org/cache/epub/1342/pg$1342.txt')).toBe(false);
      expect(sanitizeUpstreamUrl('https://www.gutenberg.org/cache/epub/1342/pg1342.txt?token=1')).toBe(
        'https://www.gutenberg.org/cache/epub/1342/pg1342.txt'
      );
      expect(sanitizeUpstreamUrl('https://www.gutenberg.org:8443/cache/epub/1342/pg1342.txt')).toBeNull();
      expect(sanitizeUpstreamUrl('https://www.gutenberg.org@evil.com/cache/epub/1342/pg1342.txt')).toBeNull();
    });

    it('returns null for unsafe or invalid URLs', () => {
      expect(sanitizeUpstreamUrl('https://evil.com/1342.txt')).toBeNull();
      expect(sanitizeUpstreamUrl('https://www.gutenberg.org/no-id-here/')).toBeNull();
    });
  });
});

