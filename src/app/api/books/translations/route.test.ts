import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { supabaseCatalogProvider } from '@/lib/catalog/supabase-provider';
import { booksApiRateLimiter } from '@/lib/rate-limiter';

vi.mock('@/lib/catalog/supabase-provider', () => ({
  supabaseCatalogProvider: {
    getBookTranslations: vi.fn(),
  },
}));

vi.mock('@/lib/rate-limiter', () => ({
  booksApiRateLimiter: {
    check: vi.fn(),
  },
}));

describe('GET /api/books/translations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(booksApiRateLimiter.check).mockReturnValue({
      success: true,
      limit: 60,
      remaining: 59,
      resetMs: 60000,
    });
  });

  it('returns 400 with no-store cache when id is missing or invalid', async () => {
    const req1 = new NextRequest('http://localhost:3000/api/books/translations');
    const res1 = await GET(req1);
    expect(res1.status).toBe(400);
    const json1 = await res1.json();
    expect(json1.error).toContain('Valid positive numeric book id is required');
    expect(res1.headers.get('Cache-Control')).toContain('no-store');

    const req2 = new NextRequest('http://localhost:3000/api/books/translations?id=abc');
    const res2 = await GET(req2);
    expect(res2.status).toBe(400);

    const req3 = new NextRequest('http://localhost:3000/api/books/translations?id=-5');
    const res3 = await GET(req3);
    expect(res3.status).toBe(400);
  });

  it('returns 200 with edge caching when translations are retrieved successfully', async () => {
    const mockTranslations = [
      {
        bookId: 1342,
        title: 'Pride and Prejudice',
        languageCode: 'en',
        isOriginal: true,
        isCurrent: true,
      },
      {
        bookId: 43647,
        title: 'Orgueil et Préjugé',
        languageCode: 'fr',
        isOriginal: false,
        isCurrent: false,
      },
    ];

    vi.mocked(supabaseCatalogProvider.getBookTranslations).mockResolvedValue(mockTranslations);

    const req = new NextRequest('http://localhost:3000/api/books/translations?id=1342');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=86400');
    const json = await res.json();
    expect(json.results).toEqual(mockTranslations);
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(booksApiRateLimiter.check).mockReturnValue({
      success: false,
      limit: 60,
      remaining: 0,
      resetMs: 45000,
    });

    const req = new NextRequest('http://localhost:3000/api/books/translations?id=1342');
    const res = await GET(req);

    expect(res.status).toBe(429);
  });

  it('returns 500 with no-store cache when provider throws an unexpected error', async () => {
    vi.mocked(supabaseCatalogProvider.getBookTranslations).mockRejectedValue(
      new Error('Connection terminated')
    );

    const req = new NextRequest('http://localhost:3000/api/books/translations?id=1342');
    const res = await GET(req);

    expect(res.status).toBe(500);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    const json = await res.json();
    expect(json.results).toEqual([]);
  });
});
