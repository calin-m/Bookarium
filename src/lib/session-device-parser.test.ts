import { describe, it, expect } from 'vitest';
import {
  parseSessionDevice,
  formatSessionIpAddress,
  formatSessionTimestamp,
} from './session-device-parser';

describe('session-device-parser', () => {
  describe('parseSessionDevice', () => {
    it('identifies desktop browsers and platforms accurately', () => {
      expect(
        parseSessionDevice(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
        )
      ).toEqual({
        browser: 'Chrome',
        os: 'Windows',
        deviceType: 'desktop',
        label: 'Chrome on Windows',
      });

      expect(
        parseSessionDevice(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0'
        )
      ).toEqual({
        browser: 'Edge',
        os: 'Windows',
        deviceType: 'desktop',
        label: 'Edge on Windows',
      });

      expect(
        parseSessionDevice(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
        )
      ).toEqual({
        browser: 'Safari',
        os: 'macOS',
        deviceType: 'desktop',
        label: 'Safari on macOS',
      });

      expect(
        parseSessionDevice(
          'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0'
        )
      ).toEqual({
        browser: 'Firefox',
        os: 'Linux',
        deviceType: 'desktop',
        label: 'Firefox on Linux',
      });
    });

    it('identifies mobile and tablet user agents and handles empty strings gracefully', () => {
      expect(
        parseSessionDevice(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
        )
      ).toEqual({
        browser: 'Safari',
        os: 'iOS',
        deviceType: 'mobile',
        label: 'Safari on iOS',
      });

      expect(
        parseSessionDevice(
          'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
        )
      ).toEqual({
        browser: 'Safari',
        os: 'iPadOS',
        deviceType: 'tablet',
        label: 'Safari on iPadOS',
      });

      expect(
        parseSessionDevice(
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
        )
      ).toEqual({
        browser: 'Chrome',
        os: 'Android',
        deviceType: 'mobile',
        label: 'Chrome on Android',
      });

      expect(
        parseSessionDevice(
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 EdgA/130.0.0.0'
        )
      ).toEqual({
        browser: 'Edge',
        os: 'Android',
        deviceType: 'mobile',
        label: 'Edge on Android',
      });

      expect(
        parseSessionDevice(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Vivaldi/6.9'
        )
      ).toEqual({
        browser: 'Vivaldi',
        os: 'Windows',
        deviceType: 'desktop',
        label: 'Vivaldi on Windows',
      });

      expect(
        parseSessionDevice(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 DuckDuckGo/7 Safari/605.1.15'
        )
      ).toEqual({
        browser: 'DuckDuckGo',
        os: 'macOS',
        deviceType: 'desktop',
        label: 'DuckDuckGo on macOS',
      });

      expect(parseSessionDevice(null)).toEqual({
        browser: 'Browser session',
        os: 'Unknown OS',
        deviceType: 'unknown',
        label: 'Browser session',
      });
    });
  });

  describe('formatSessionIpAddress', () => {
    it('masks public IPv4, IPv4-mapped IPv6, and already-masked IPv4 inputs idempotently', () => {
      expect(formatSessionIpAddress('203.0.113.42')).toBe('203.0.113.x');
      expect(formatSessionIpAddress('203.0.113.42/32')).toBe('203.0.113.x');
      expect(formatSessionIpAddress('::ffff:203.0.113.42')).toBe('203.0.113.x');
      expect(formatSessionIpAddress('203.0.113.x')).toBe('203.0.113.x');
    });

    it('masks IPv6 addresses to /48 prefix and preserves already-masked IPv6 values', () => {
      expect(formatSessionIpAddress('2001:0db8:85a3::8a2e:0370:7334')).toBe('2001:db8:85a3::x');
      expect(formatSessionIpAddress('2001:db8:85a3::1/128')).toBe('2001:db8:85a3::x');
      expect(formatSessionIpAddress('fe80::1')).toBe('fe80::x');
      expect(formatSessionIpAddress('2001:db8:85a3::x')).toBe('2001:db8:85a3::x');
    });

    it('labels loopback addresses locally and returns null for empty or invalid values', () => {
      expect(formatSessionIpAddress('127.0.0.1')).toBe('127.0.0.1 (Localhost)');
      expect(formatSessionIpAddress('::ffff:127.0.0.1/128')).toBe('127.0.0.1 (Localhost)');
      expect(formatSessionIpAddress('::1')).toBe('::1 (Localhost)');
      expect(formatSessionIpAddress(null)).toBeNull();
      expect(formatSessionIpAddress('')).toBeNull();
      expect(formatSessionIpAddress('not-an-ip')).toBeNull();
    });
  });

  describe('formatSessionTimestamp', () => {
    it('formats valid ISO timestamps and falls back to Unknown for invalid dates', () => {
      const formatted = formatSessionTimestamp('2026-11-14T10:30:00.000Z');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('Nov');
      expect(formatSessionTimestamp(null)).toBe('Unknown');
      expect(formatSessionTimestamp('invalid-date')).toBe('Unknown');
    });
  });
});
