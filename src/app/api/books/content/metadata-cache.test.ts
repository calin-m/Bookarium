import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  clearBookMetadataCache,
  resolveBookMetadata,
  setBookMetadataCache,
  getBookMetadataCache,
} from './metadata-cache';

describe('metadata-cache', () => {
  beforeEach(() => {
    clearBookMetadataCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearBookMetadataCache();
    vi.restoreAllMocks();
  });

  it('stores and retrieves cached metadata correctly', () => {
    const mockBook = {
      id: 1234,
      title: 'Sample Book',
      authors: [{ name: 'Author, A.', birth_year: null, death_year: 1940 }],
    };
    setBookMetadataCache(1234, { book: mockBook, expiresAt: Date.now() + 10000 });

    const cached = getBookMetadataCache(1234);
    expect(cached?.book.title).toBe('Sample Book');

    clearBookMetadataCache();
    expect(getBookMetadataCache(1234)).toBeUndefined();
  });

  it('returns cached metadata if not expired without network fetch', async () => {
    const mockBook = {
      id: 999,
      title: 'Cached Title',
      authors: [],
    };
    setBookMetadataCache(999, { book: mockBook, expiresAt: Date.now() + 60000 });

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await resolveBookMetadata(999);

    expect(result).toEqual(mockBook);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches metadata from upstream with trailing slash when not cached and Supabase is unconfigured', async () => {
    const mockUpstreamBook = {
      id: 888,
      title: 'Upstream Book',
      authors: [{ name: 'Writer, W.', birth_year: null, death_year: 1930 }],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockUpstreamBook), { status: 200 })
    );

    const result = await resolveBookMetadata(888);
    expect(result).toEqual(mockUpstreamBook);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/books\/888\/$/),
      expect.any(Object)
    );

    // Should now be cached
    const cached = getBookMetadataCache(888);
    expect(cached?.book.title).toBe('Upstream Book');
  });

  it('resolves metadata directly from Supabase when configured and present', async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://valid-project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key-12345';

    const mockSupabaseBook = {
      id: 1342,
      title: 'Pride and Prejudice',
      authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
      translators: [],
      copyright: false,
    };

    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: mockSupabaseBook, error: null });
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const supabaseClientModule = await import('@/lib/supabase/client');
    const clientSpy = vi.spyOn(supabaseClientModule, 'createClient').mockReturnValue({
      from: mockFrom,
    } as any);

    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    try {
      const result = await resolveBookMetadata(1342);

      expect(result).toEqual(mockSupabaseBook);
      expect(mockFrom).toHaveBeenCalledWith('books');
      expect(mockSelect).toHaveBeenCalledWith('id, title, authors, translators, copyright');
      expect(mockEq).toHaveBeenCalledWith('id', 1342);
      expect(fetchSpy).not.toHaveBeenCalled();

      // Verify cached in memory
      const cached = getBookMetadataCache(1342);
      expect(cached?.book.title).toBe('Pride and Prejudice');
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
      clientSpy.mockRestore();
    }
  });

  it('falls back to upstream Gutendex when Supabase record is not found', async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://valid-project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key-12345';

    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const supabaseClientModule = await import('@/lib/supabase/client');
    const clientSpy = vi.spyOn(supabaseClientModule, 'createClient').mockReturnValue({
      from: mockFrom,
    } as any);

    const mockUpstreamBook = {
      id: 555,
      title: 'Fallback Tome',
      authors: [{ name: 'Ancient, A.', birth_year: 1800, death_year: 1860 }],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockUpstreamBook), { status: 200 })
    );

    try {
      const result = await resolveBookMetadata(555);

      expect(result).toEqual(mockUpstreamBook);
      expect(mockFrom).toHaveBeenCalledWith('books');
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\/books\/555\/$/),
        expect.any(Object)
      );
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
      clientSpy.mockRestore();
    }
  });

  it('returns null when upstream returns error status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404 })
    );

    const result = await resolveBookMetadata(777);
    expect(result).toBeNull();
  });

  it('returns null when network throws an error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network offline'));

    const result = await resolveBookMetadata(666);
    expect(result).toBeNull();
  });
});
