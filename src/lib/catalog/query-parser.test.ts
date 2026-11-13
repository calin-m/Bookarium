import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  parseCatalogQuery,
  DEFAULT_QUOTE_POOL_LIMIT,
  MAX_CATALOG_PAGE,
  MAX_SEARCH_LENGTH,
  MAX_TOPIC_LENGTH,
  MAX_IDS_BATCH,
  MAX_LANGUAGES,
} from './query-parser';
import { GEO_COOKIE_NAME } from '@/proxy';

describe('parseCatalogQuery', () => {
  it('defaults to safe base values when no query parameters are provided', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const req = new NextRequest('http://localhost:3000/api/books');
    const options = parseCatalogQuery(req);

    expect(options.page).toBe(1);
    expect(options.limit).toBe(32);
    expect(options.country).toBe('US');
    expect(options.search).toBeUndefined();
    expect(options.topic).toBeUndefined();
    expect(options.languages).toBeUndefined();
    expect(options.sort).toBe('');
    vi.unstubAllEnvs();
  });

  it('normalizes whitespace in search query and trims input', () => {
    const req = new NextRequest('http://localhost:3000/api/books?search=Jane%20%20%20Austen%20%20');
    const options = parseCatalogQuery(req);

    expect(options.search).toBe('Jane Austen');
  });

  it('drops single-character search queries to protect upstream API', () => {
    const req = new NextRequest('http://localhost:3000/api/books?search=a');
    const options = parseCatalogQuery(req);

    expect(options.search).toBeUndefined();
  });

  it('parses valid numeric page and limit while defaulting invalid values', () => {
    const validReq = new NextRequest('http://localhost:3000/api/books?page=4&limit=16');
    const validOptions = parseCatalogQuery(validReq);
    expect(validOptions.page).toBe(4);
    expect(validOptions.limit).toBe(16);

    const invalidReq = new NextRequest('http://localhost:3000/api/books?page=-1&limit=9999');
    const invalidOptions = parseCatalogQuery(invalidReq);
    expect(invalidOptions.page).toBe(1);
    expect(invalidOptions.limit).toBe(32);

    const cappedPageReq = new NextRequest('http://localhost:3000/api/books?page=999999');
    expect(parseCatalogQuery(cappedPageReq).page).toBe(MAX_CATALOG_PAGE);
  });

  it('truncates long search/topic queries, bounds language & id arrays, and validates mime_type and era ranges', () => {
    const longQuery = 'a'.repeat(MAX_SEARCH_LENGTH + 50);
    const longTopic = 'b'.repeat(MAX_TOPIC_LENGTH + 40);
    const excessiveIds = Array.from({ length: MAX_IDS_BATCH + 25 }, (_, i) => i + 1).join(',');
    const req = new NextRequest(
      `http://localhost:3000/api/books?search=${longQuery}&topic=${longTopic}&languages=EN,fr,de,es,it,la,zz_bad&ids=${excessiveIds},1,abc,0&mime_type=${encodeURIComponent('text/plain; charset=utf-8')}&author_year_start=-9999&author_year_end=9999`
    );
    const options = parseCatalogQuery(req);

    expect(options.search?.length).toBe(MAX_SEARCH_LENGTH);
    expect(options.topic?.length).toBe(MAX_TOPIC_LENGTH);
    expect(options.languages).toEqual(['en', 'fr', 'de', 'es', 'it']);
    expect(options.languages).toHaveLength(MAX_LANGUAGES);
    expect(options.ids?.split(',')).toHaveLength(MAX_IDS_BATCH);
    expect(options.mimeType).toBe('text/plain; charset=utf-8');
    expect(options.authorYearStart).toBeUndefined();
    expect(options.authorYearEnd).toBeUndefined();

    const badMimeReq = new NextRequest(
      'http://localhost:3000/api/books?mime_type=not-a-valid-mime<script>'
    );
    expect(parseCatalogQuery(badMimeReq).mimeType).toBeUndefined();
  });

  it('parses author year bounds, sort directions, and mime_type', () => {
    const req = new NextRequest(
      'http://localhost:3000/api/books?author_year_start=1800&author_year_end=1900&sort=popular&mime_type=text/html&ids=1342,863'
    );
    const options = parseCatalogQuery(req);

    expect(options.authorYearStart).toBe(1800);
    expect(options.authorYearEnd).toBe(1900);
    expect(options.sort).toBe('popular');
    expect(options.mimeType).toBe('text/html');
    expect(options.ids).toBe('1342,863');
  });

  it('parses include_restricted_metadata and has_quotes flags', () => {
    const req = new NextRequest(
      'http://localhost:3000/api/books?ids=31635&include_restricted_metadata=true&has_quotes=true'
    );
    const options = parseCatalogQuery(req);

    expect(options.ids).toBe('31635');
    expect(options.includeRestrictedMetadata).toBe(true);
    expect(options.hasQuotes).toBe(true);
  });

  it('automatically expands default limit up to 100 when ids batch exceeds 32 items and limit is omitted', () => {
    const fortyIds = Array.from({ length: 40 }, (_, idx) => idx + 1).join(',');
    const req = new NextRequest(`http://localhost:3000/api/books?ids=${fortyIds}`);
    const options = parseCatalogQuery(req);

    expect(options.limit).toBe(40);
  });

  it('parses comma-separated languages into string array', () => {
    const req = new NextRequest('http://localhost:3000/api/books?languages=en,fr,de');
    const options = parseCatalogQuery(req);

    expect(options.languages).toEqual(['en', 'fr', 'de']);
  });

  it('parses pool=quotes parameter with 48 default and strict DEFAULT_QUOTE_POOL_LIMIT ceiling', () => {
    // 1. Explicit pool=quotes with omitted limit defaults to DEFAULT_QUOTE_POOL_LIMIT (48)
    const req1 = new NextRequest('http://localhost:3000/api/books?pool=quotes');
    const options1 = parseCatalogQuery(req1);
    expect(options1.pool).toBe('quotes');
    expect(options1.limit).toBe(DEFAULT_QUOTE_POOL_LIMIT);

    // 2. Custom valid limit within [1, DEFAULT_QUOTE_POOL_LIMIT]
    const req2 = new NextRequest('http://localhost:3000/api/books?pool=quotes&limit=24');
    const options2 = parseCatalogQuery(req2);
    expect(options2.pool).toBe('quotes');
    expect(options2.limit).toBe(24);
    expect(DEFAULT_QUOTE_POOL_LIMIT).toBe(48);

    // 3. Requests above DEFAULT_QUOTE_POOL_LIMIT (48) fall back to DEFAULT_QUOTE_POOL_LIMIT (48)
    const req3 = new NextRequest('http://localhost:3000/api/books?pool=quotes&limit=250');
    const options3 = parseCatalogQuery(req3);
    expect(options3.pool).toBe('quotes');
    expect(options3.limit).toBe(DEFAULT_QUOTE_POOL_LIMIT);

    const req4 = new NextRequest('http://localhost:3000/api/books?pool=quotes&limit=9999');
    const options4 = parseCatalogQuery(req4);
    expect(options4.pool).toBe('quotes');
    expect(options4.limit).toBe(DEFAULT_QUOTE_POOL_LIMIT);

    // 4. Invalid or unrecognized pool values are ignored
    const req5 = new NextRequest('http://localhost:3000/api/books?pool=invalid&limit=50');
    const options5 = parseCatalogQuery(req5);
    expect(options5.pool).toBeUndefined();
    expect(options5.limit).toBe(50);
  });

  it('resolves country code through the priority cascade', () => {
    // 1. Development query parameter
    vi.stubEnv('NODE_ENV', 'development');
    const devReq = new NextRequest('http://localhost:3000/api/books?country=de');
    expect(parseCatalogQuery(devReq).country).toBe('DE');
    vi.unstubAllEnvs();

    // 2. Vercel IP header
    const vercelReq = new NextRequest('http://localhost:3000/api/books', {
      headers: { 'x-vercel-ip-country': 'FR' },
    });
    expect(parseCatalogQuery(vercelReq).country).toBe('FR');

    // 3. Edge proxy custom header
    const proxyReq = new NextRequest('http://localhost:3000/api/books', {
      headers: { 'x-bookarium-country': 'IT' },
    });
    expect(parseCatalogQuery(proxyReq).country).toBe('IT');

    // 4. Cookie fallback
    const cookieReq = new NextRequest('http://localhost:3000/api/books', {
      headers: { cookie: `${GEO_COOKIE_NAME}=GB` },
    });
    expect(parseCatalogQuery(cookieReq).country).toBe('GB');

    // 5. Default fallback in production
    vi.stubEnv('NODE_ENV', 'production');
    const defaultReq = new NextRequest('http://localhost:3000/api/books');
    expect(parseCatalogQuery(defaultReq).country).toBe('US');
    vi.unstubAllEnvs();

    // 6. System timezone fallback in development
    vi.stubEnv('NODE_ENV', 'development');
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Europe/Bucharest' }),
    } as unknown as Intl.DateTimeFormat);
    const tzReq = new NextRequest('http://localhost:3000/api/books');
    expect(parseCatalogQuery(tzReq).country).toBe('RO');
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
});

