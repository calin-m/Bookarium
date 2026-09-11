import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  getCountryFromTimezone,
  resolveClientCountry,
  GEO_COOKIE_NAME,
  DEV_OVERRIDE_COOKIE_NAME,
} from './country-resolver';

describe('country-resolver', () => {
  describe('getCountryFromTimezone', () => {
    it('resolves European capitals to correct ISO country codes', () => {
      expect(getCountryFromTimezone('Europe/Bucharest')).toBe('RO');
      expect(getCountryFromTimezone('Europe/London')).toBe('GB');
      expect(getCountryFromTimezone('Europe/Berlin')).toBe('DE');
      expect(getCountryFromTimezone('Europe/Paris')).toBe('FR');
      expect(getCountryFromTimezone('Europe/Rome')).toBe('IT');
      expect(getCountryFromTimezone('Europe/Madrid')).toBe('ES');
      expect(getCountryFromTimezone('Europe/Warsaw')).toBe('PL');
      expect(getCountryFromTimezone('Europe/Athens')).toBe('GR');
    });

    it('resolves American and Asian timezones', () => {
      expect(getCountryFromTimezone('America/New_York')).toBe('US');
      expect(getCountryFromTimezone('America/Los_Angeles')).toBe('US');
      expect(getCountryFromTimezone('America/Toronto')).toBe('CA');
      expect(getCountryFromTimezone('America/Mexico_City')).toBe('MX');
      expect(getCountryFromTimezone('America/Bogota')).toBe('CO');
      expect(getCountryFromTimezone('Asia/Tokyo')).toBe('JP');
      expect(getCountryFromTimezone('Australia/Sydney')).toBe('AU');
    });

    it('returns null for unmapped, invalid, or empty timezones', () => {
      expect(getCountryFromTimezone('UTC')).toBeNull();
      expect(getCountryFromTimezone('')).toBeNull();
      expect(getCountryFromTimezone(null)).toBeNull();
      expect(getCountryFromTimezone(undefined)).toBeNull();
      expect(getCountryFromTimezone('NonExistent/Timezone')).toBeNull();
    });
  });

  describe('resolveClientCountry - Development Mode', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    it('prioritizes explicit ?country=XX URL query override', () => {
      const req = new NextRequest('http://localhost:3000/api/books?country=mx');
      expect(resolveClientCountry(req)).toBe('MX');
    });

    it('prioritizes searchParams argument if provided explicitly', () => {
      const req = new NextRequest('http://localhost:3000/api/books');
      const params = new URLSearchParams('country=de');
      expect(resolveClientCountry(req, params)).toBe('DE');
    });

    it('respects DEV_COUNTRY environment variable when no query override is present', () => {
      vi.stubEnv('DEV_COUNTRY', 'CO');
      const req = new NextRequest('http://localhost:3000/api/books');
      expect(resolveClientCountry(req)).toBe('CO');
    });

    it('respects dev override cookie when no query param or env var is present', () => {
      const req = new NextRequest('http://localhost:3000/api/books', {
        headers: {
          cookie: `${DEV_OVERRIDE_COOKIE_NAME}=CA`,
        },
      });
      expect(resolveClientCountry(req)).toBe('CA');
    });

    it('infers country from system timezone in development', () => {
      vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
        resolvedOptions: () => ({ timeZone: 'Europe/Bucharest' }),
      } as unknown as Intl.DateTimeFormat);

      const req = new NextRequest('http://localhost:3000/api/books');
      expect(resolveClientCountry(req)).toBe('RO');
    });

    it('falls back to US when timezone is unmapped and no other signals exist', () => {
      vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
        resolvedOptions: () => ({ timeZone: 'Etc/Unknown' }),
      } as unknown as Intl.DateTimeFormat);

      const req = new NextRequest('http://localhost:3000/api/books');
      expect(resolveClientCountry(req)).toBe('US');
    });
  });

  describe('resolveClientCountry - Production Mode', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    it('strictly ignores ?country=XX query override in production', () => {
      const req = new NextRequest('https://bookarium.vercel.app/catalog?country=US', {
        headers: {
          'x-vercel-ip-country': 'RO',
        },
      });
      expect(resolveClientCountry(req)).toBe('RO');
    });

    it('strictly ignores DEV_COUNTRY environment variable in production', () => {
      vi.stubEnv('DEV_COUNTRY', 'US');
      const req = new NextRequest('https://bookarium.vercel.app/catalog', {
        headers: {
          'x-vercel-ip-country': 'FR',
        },
      });
      expect(resolveClientCountry(req)).toBe('FR');
    });

    it('prioritizes x-vercel-ip-country edge header', () => {
      const req = new NextRequest('https://bookarium.vercel.app/catalog', {
        headers: {
          'x-vercel-ip-country': 'GB',
          'cf-ipcountry': 'DE',
          cookie: `${GEO_COOKIE_NAME}=US`,
        },
      });
      expect(resolveClientCountry(req)).toBe('GB');
    });

    it('supports cf-ipcountry header if x-vercel-ip-country is absent', () => {
      const req = new NextRequest('https://bookarium.vercel.app/catalog', {
        headers: {
          'cf-ipcountry': 'DE',
          cookie: `${GEO_COOKIE_NAME}=US`,
        },
      });
      expect(resolveClientCountry(req)).toBe('DE');
    });

    it('supports downstream x-bookarium-country header', () => {
      const req = new NextRequest('https://bookarium.vercel.app/api/books', {
        headers: {
          'x-bookarium-country': 'IT',
        },
      });
      expect(resolveClientCountry(req)).toBe('IT');
    });

    it('falls back to cookie if no edge IP headers exist in production', () => {
      const req = new NextRequest('https://bookarium.vercel.app/catalog', {
        headers: {
          cookie: `${GEO_COOKIE_NAME}=ES`,
        },
      });
      expect(resolveClientCountry(req)).toBe('ES');
    });

    it('defaults to US when zero signals exist in production', () => {
      const req = new NextRequest('https://bookarium.vercel.app/catalog');
      expect(resolveClientCountry(req)).toBe('US');
    });
  });
});

