import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { bookCardRateLimiter } from '@/lib/rate-limiter';
import { encodeReadingCardShareToken } from '@/lib/reading-card-export';
import * as metadataCache from '@/app/api/books/content/metadata-cache';

describe('GET /og/books/[file] crawler-accessible OpenGraph card handler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    bookCardRateLimiter.reset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders 1200x630 PNG social card cleanly for valid .png IDs and verified ?s= share tokens', async () => {
    const signedToken = encodeReadingCardShareToken({
      bookId: 1342,
      title: 'Pride and Prejudice',
      author: 'Jane Austen',
      theme: 'dark',
      includeProgress: true,
      progress: 40,
      currentSection: 10,
      totalSections: 61,
    });

    const res = await GET(
      new NextRequest(`http://localhost:3000/og/books/1342.png?s=${signedToken}`),
      { params: Promise.resolve({ file: '1342.png' }) }
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('image/png');
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=86400');
    expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('rejects invalid extensions, disallowed query parameters, restricted works (451), and rate-limit excess', async () => {
    const badFile = await GET(
      new NextRequest('http://localhost:3000/og/books/not-a-book.png'),
      { params: Promise.resolve({ file: 'not-a-book.png' }) }
    );
    expect(badFile.status).toBe(400);
    expect(badFile.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    expect(badFile.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');

    const badParam = await GET(
      new NextRequest('http://localhost:3000/og/books/1342.png?type=text'),
      { params: Promise.resolve({ file: '1342.png' }) }
    );
    expect(badParam.status).toBe(400);

    vi.spyOn(metadataCache, 'resolveBookMetadata').mockResolvedValueOnce({
      id: 7777,
      title: 'Protected Contemporary Volume',
      authors: [{ name: 'Writer, Modern', birth_year: 1950, death_year: 2015 }],
      copyright: true,
    });
    const res451 = await GET(
      new NextRequest('http://localhost:3000/og/books/7777.png'),
      { params: Promise.resolve({ file: '7777.png' }) }
    );
    expect(res451.status).toBe(451);

    vi.spyOn(bookCardRateLimiter, 'check').mockReturnValueOnce({
      success: false,
      limit: 20,
      remaining: 0,
      resetMs: 2000,
    });
    const res429 = await GET(
      new NextRequest('http://localhost:3000/og/books/1342.png'),
      { params: Promise.resolve({ file: '1342.png' }) }
    );
    expect(res429.status).toBe(429);
  });
});
