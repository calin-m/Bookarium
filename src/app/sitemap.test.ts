import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import sitemap, { FEATURED_CLASSIC_BOOK_IDS, SITEMAP_TOP_BOOKS_LIMIT, revalidate } from './sitemap';
import { SITE_CONFIG } from '@/config/site-config';
import { FEATURED_HERO_BOOKS } from '@/config/featured-books';

describe('sitemap() route handler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('configures 24h ISR revalidation and exposes synchronous curated classics when Supabase is unconfigured', async () => {
    expect(revalidate).toBe(86400);
    expect(SITEMAP_TOP_BOOKS_LIMIT).toBe(5000);

    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const entries = await sitemap();

    const rootEntry = entries.find((e) => e.url === SITE_CONFIG.SITE_URL);
    expect(rootEntry).toBeDefined();
    expect(rootEntry?.priority).toBe(1.0);
    expect(rootEntry?.changeFrequency).toBe('daily');

    const privacyEntry = entries.find((e) => e.url === `${SITE_CONFIG.SITE_URL}/privacy`);
    expect(privacyEntry).toBeDefined();
    expect(privacyEntry?.priority).toBe(0.5);

    const copyrightEntry = entries.find((e) => e.url === `${SITE_CONFIG.SITE_URL}/copyright`);
    expect(copyrightEntry).toBeDefined();
    expect(copyrightEntry?.priority).toBe(0.5);

    for (const id of FEATURED_CLASSIC_BOOK_IDS) {
      const bookEntry = entries.find((e) => e.url === `${SITE_CONFIG.SITE_URL}/read/${id}`);
      expect(bookEntry).toBeDefined();
      expect(bookEntry?.priority).toBe(0.9);
      expect(bookEntry?.changeFrequency).toBe('weekly');
    }

    for (const heroBook of FEATURED_HERO_BOOKS) {
      const matches = entries.filter((e) => e.url === `${SITE_CONFIG.SITE_URL}/read/${heroBook.id}`);
      expect(matches).toHaveLength(1);
    }
  });

  it('paginates up to Top 5,000 public-domain Supabase books without duplicates and falls back safely on errors', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://valid-project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'valid-anon-key-12345');

    const firstBatch = Array.from({ length: 1000 }, (_, i) => ({
      id: 200000 + i,
      updated_at: '2026-11-20T00:00:00.000Z',
    }));
    const secondBatch = [
      { id: 1342, updated_at: '2026-11-20T00:00:00.000Z' }, // Curated duplicate -> deduplicated
      { id: 300001, updated_at: 'invalid-date' },
      { id: 300002, updated_at: null },
    ];

    const mockAbortSignal = vi
      .fn()
      .mockResolvedValueOnce({ data: firstBatch, error: null })
      .mockResolvedValueOnce({ data: secondBatch, error: null });
    const mockRange = vi.fn().mockReturnValue({ abortSignal: mockAbortSignal });
    const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const supabaseClientModule = await import('@/lib/supabase/client');
    vi.spyOn(supabaseClientModule, 'createClient').mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof supabaseClientModule.createClient>);

    const entries = await sitemap();

    expect(mockFrom).toHaveBeenCalledWith('books');
    expect(mockEq).toHaveBeenCalledWith('copyright', false);
    expect(mockOrder).toHaveBeenCalledWith('download_count', { ascending: false });
    expect(mockRange).toHaveBeenNthCalledWith(1, 0, 999);
    expect(mockRange).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(entries.find((e) => e.url === `${SITE_CONFIG.SITE_URL}/read/200000`)?.priority).toBe(0.8);
    expect(entries.find((e) => e.url === `${SITE_CONFIG.SITE_URL}/read/300001`)?.lastModified).toBeInstanceOf(Date);
    expect(entries.filter((e) => e.url === `${SITE_CONFIG.SITE_URL}/read/1342`)).toHaveLength(1);

    // DB error fallback returns curated entries cleanly
    const mockFailAbort = vi.fn().mockResolvedValue({ data: null, error: { message: 'timeout' } });
    vi.spyOn(supabaseClientModule, 'createClient').mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockReturnValue({ abortSignal: mockFailAbort }),
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof supabaseClientModule.createClient>);

    const fallbackEntries = await sitemap();
    expect(fallbackEntries.length).toBeGreaterThan(FEATURED_CLASSIC_BOOK_IDS.length);
    for (const entry of fallbackEntries) {
      expect(entry.url).toMatch(/^https?:\/\//);
      expect(entry.lastModified).toBeInstanceOf(Date);
    }
  });
});
