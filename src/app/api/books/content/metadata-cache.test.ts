import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MAX_METADATA_CACHE_ENTRIES,
  clearBookMetadataCache,
  clearBookContentCache,
  resolveBookMetadata,
  setBookMetadataCache,
  getBookMetadataCache,
  getCachedBookContent,
  setCachedBookContent,
} from './metadata-cache';

describe('metadata-cache', () => {
  beforeEach(() => {
    clearBookMetadataCache();
    vi.restoreAllMocks();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    clearBookMetadataCache();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
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
    const mockAbortSignal = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEq = vi.fn().mockReturnValue({ abortSignal: mockAbortSignal });
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
      expect(mockAbortSignal).toHaveBeenCalled();
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

  it('degrades gracefully to upstream Gutendex when Supabase query times out', async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://valid-project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key-12345';

    const mockAbortSignal = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockRejectedValue(new Error('TimeoutError: The operation was aborted due to timeout')),
    });
    const mockEq = vi.fn().mockReturnValue({ abortSignal: mockAbortSignal });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    const supabaseClientModule = await import('@/lib/supabase/client');
    const clientSpy = vi.spyOn(supabaseClientModule, 'createClient').mockReturnValue({
      from: mockFrom,
    } as any);

    const mockUpstreamBook = {
      id: 2600,
      title: 'War and Peace',
      authors: [{ name: 'Tolstoy, Leo', birth_year: 1828, death_year: 1910 }],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockUpstreamBook), { status: 200 })
    );

    try {
      const result = await resolveBookMetadata(2600);
      expect(result).toEqual(mockUpstreamBook);
      expect(fetchSpy).toHaveBeenCalled();
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

  it('enriches missing lifespans and falls back to FEATURED_HERO_BOOKS for curated classics', async () => {
    // 1. Upstream returns book 1727 (Homer) with null birth/death years -> enriched from FEATURED_HERO_BOOKS
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 1727,
          title: 'The Odyssey',
          authors: [{ name: 'Homer', birth_year: null, death_year: null }],
        }),
        { status: 200 }
      )
    );

    const enriched = await resolveBookMetadata(1727);
    expect(enriched?.authors).toEqual([
      { name: 'Homer', birth_year: -800, death_year: -750 },
    ]);

    clearBookMetadataCache();

    // 2. Upstream fails for featured classic 1342 -> falls back to FEATURED_HERO_BOOKS
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Gutendex down'));
    const fallback = await resolveBookMetadata(1342);
    expect(fallback?.id).toBe(1342);
    expect(fallback?.authors).toEqual([
      { name: 'Jane Austen', birth_year: 1775, death_year: 1817 },
    ]);
  });

  it('stores, refreshes, expires, and caps bookContentLruCache entries', () => {
    setCachedBookContent(1342, '', 'gutenberg-mirror');
    expect(getCachedBookContent(1342)).toBeUndefined();

    setCachedBookContent(1342, 'A'.repeat(1_850_000), 'gutenberg-mirror');
    expect(getCachedBookContent(1342)).toBeUndefined();

    setCachedBookContent(1342, 'Pride and Prejudice text', 'supabase');
    setCachedBookContent(1342, 'Pride and Prejudice updated text', 'gutenberg-mirror');
    expect(getCachedBookContent(1342)?.text).toBe('Pride and Prejudice updated text');

    clearBookContentCache();
    expect(getCachedBookContent(1342)).toBeUndefined();
  });

  it('caps bookMetadataCache at MAX_METADATA_CACHE_ENTRIES and evicts expired entries on lookup', async () => {
    const expiresAt = Date.now() + 60_000;
    for (let id = 1; id <= MAX_METADATA_CACHE_ENTRIES + 2; id++) {
      setBookMetadataCache(id, {
        book: { id, title: `Volume ${id}`, authors: [] },
        expiresAt,
      });
    }
    expect(getBookMetadataCache(1)).toBeUndefined();
    expect(getBookMetadataCache(2)).toBeUndefined();
    expect(getBookMetadataCache(3)?.book.title).toBe('Volume 3');

    // Refreshing existing key preserves entry
    setBookMetadataCache(3, {
      book: { id: 3, title: 'Volume 3 Refreshed', authors: [] },
      expiresAt,
    });
    expect(getBookMetadataCache(3)?.book.title).toBe('Volume 3 Refreshed');

    // Expired entry is evicted on resolveBookMetadata and re-fetched from upstream
    setBookMetadataCache(7777, {
      book: { id: 7777, title: 'Stale Volume', authors: [] },
      expiresAt: Date.now() - 1000,
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 7777, title: 'Fresh Volume', authors: [] }), { status: 200 })
    );
    const resolved = await resolveBookMetadata(7777);
    expect(resolved?.title).toBe('Fresh Volume');
  });

  it('anchors metadata and content LRU caches on globalThis to survive Next.js HMR reloads', () => {
    const globalState = globalThis as typeof globalThis & {
      __bookariumMetadataCache?: Map<number, unknown>;
      __bookariumContentLruCache?: Map<number, unknown>;
    };

    setBookMetadataCache(4321, {
      book: { id: 4321, title: 'Global Persistent Title', authors: [] },
      expiresAt: Date.now() + 60_000,
    });
    setCachedBookContent(4321, 'Persistent chapter text', 'supabase');

    expect(globalState.__bookariumMetadataCache?.has(4321)).toBe(true);
    expect(globalState.__bookariumContentLruCache?.has(4321)).toBe(true);
  });
});
