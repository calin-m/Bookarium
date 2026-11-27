import { describe, it, expect, vi, beforeEach } from 'vitest';
import { headers } from 'next/headers';
import {
  MAX_SERVER_METADATA_CACHE_ENTRIES,
  serverMetadataCache,
  setServerMetadataCache,
  clearServerMetadataCache,
  isConfirmedMissingBook,
  clearConfirmedNotFoundCache,
  isClientSideNavigation,
  fetchBookData,
  checkBookCoverAvailable,
  buildReaderSeoMetadataPayload,
  MAX_SERP_DESCRIPTION_LENGTH,
} from './reader-layout-utils';
import { resolveBookMetadata } from '@/lib/book-metadata';
import type { CatalogBook } from '@/types/book.types';

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

describe('reader-layout-utils', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearServerMetadataCache();
    vi.mocked(headers).mockResolvedValue(new Headers());
  });

  describe('clearServerMetadataCache', () => {
    it('clears all cached items from serverMetadataCache and enforces LRU eviction at MAX_SERVER_METADATA_CACHE_ENTRIES', () => {
      for (let i = 1; i <= MAX_SERVER_METADATA_CACHE_ENTRIES + 2; i++) {
        setServerMetadataCache(i, { id: i, title: `Book ${i}` } as CatalogBook);
      }
      expect(serverMetadataCache.size).toBe(MAX_SERVER_METADATA_CACHE_ENTRIES);
      expect(serverMetadataCache.has(1)).toBe(false);
      expect(serverMetadataCache.has(2)).toBe(false);
      expect(serverMetadataCache.has(3)).toBe(true);

      // Updating an existing key refreshes its LRU position without growing size
      setServerMetadataCache(3, { id: 3, title: 'Book 3 Updated' } as CatalogBook);
      expect(serverMetadataCache.get(3)?.title).toBe('Book 3 Updated');

      clearServerMetadataCache();
      expect(serverMetadataCache.size).toBe(0);
    });
  });

  describe('isClientSideNavigation', () => {
    it('returns true when rsc header is 1', async () => {
      vi.mocked(headers).mockResolvedValue(new Headers({ rsc: '1' }));
      expect(await isClientSideNavigation()).toBe(true);
    });

    it('returns true when next-router-state-tree is present', async () => {
      vi.mocked(headers).mockResolvedValue(new Headers({ 'next-router-state-tree': '[]' }));
      expect(await isClientSideNavigation()).toBe(true);
    });

    it('returns true when next-router-prefetch is present', async () => {
      vi.mocked(headers).mockResolvedValue(new Headers({ 'next-router-prefetch': '1' }));
      expect(await isClientSideNavigation()).toBe(true);
    });

    it('returns true when accept header includes text/x-component', async () => {
      vi.mocked(headers).mockResolvedValue(new Headers({ accept: 'text/x-component' }));
      expect(await isClientSideNavigation()).toBe(true);
    });

    it('returns false for standard SSR page loads', async () => {
      vi.mocked(headers).mockResolvedValue(new Headers({ accept: 'text/html' }));
      expect(await isClientSideNavigation()).toBe(false);
    });

    it('returns false when headers() throws', async () => {
      vi.mocked(headers).mockRejectedValue(new Error('Outside request context'));
      expect(await isClientSideNavigation()).toBe(false);
    });
  });

  describe('fetchBookData', () => {
    it('returns null for non-numeric or falsy book IDs', async () => {
      expect(await fetchBookData(0)).toBeNull();
      expect(await fetchBookData(NaN)).toBeNull();
    });

    it('returns cached book immediately if present in serverMetadataCache', async () => {
      const mockBook = { id: 42, title: 'Cached Hitchhiker' } as CatalogBook;
      serverMetadataCache.set(42, mockBook);
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const result = await fetchBookData(42);
      expect(result).toBe(mockBook);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('resolves bundled featured book and populates serverMetadataCache without HTTP requests when Supabase is unconfigured', async () => {
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      try {
        const result = await fetchBookData(84);
        expect(result?.id).toBe(84);
        expect(result?.title).toBe('Frankenstein');
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(serverMetadataCache.get(84)).toEqual(result);
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
        fetchSpy.mockRestore();
      }
    });

    it('resolves book directly from Supabase catalog when configured', async () => {
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://valid-project.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key-12345';

      const mockDbRow = {
        id: 1342,
        title: 'Pride and Prejudice',
        authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
        translators: [],
        subjects: ['Classic Literature'],
        bookshelves: ['Best Books Ever'],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: { 'text/html': 'https://gutenberg.org/1342.html' },
        download_count: 50000,
      };

      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: mockDbRow, error: null });
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
        const result = await fetchBookData(1342);
        expect(result).not.toBeNull();
        expect(result?.title).toBe('Pride and Prejudice');
        expect(mockFrom).toHaveBeenCalledWith('books');
        expect(mockEq).toHaveBeenCalledWith('id', 1342);
        expect(mockAbortSignal).toHaveBeenCalled();
        expect(fetchSpy).not.toHaveBeenCalled();

        // Verify cached in memory
        expect(serverMetadataCache.get(1342)?.title).toBe('Pride and Prejudice');
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
        clientSpy.mockRestore();
      }
    });

    it('degrades gracefully to bundled FEATURED_HERO_BOOKS when Supabase query times out or fails', async () => {
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

      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      try {
        const result = await fetchBookData(2600);
        expect(result).not.toBeNull();
        expect(result?.title).toBe('War and Peace');
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(serverMetadataCache.get(2600)?.title).toBe('War and Peace');
        expect(isConfirmedMissingBook(2600)).toBe(false);
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
        clientSpy.mockRestore();
      }
    });

    it('records confirmed missing IDs only when configured Supabase cleanly returns not-found (not on timeouts or unconfigured env)', async () => {
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // 1. Unconfigured Supabase returns null without marking confirmed-missing
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      expect(await fetchBookData(888888)).toBeNull();
      expect(isConfirmedMissingBook(888888)).toBe(false);

      // 2. Configured Supabase returning { data: null, error: null } marks confirmed missing
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://valid-project.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key-12345';

      const mockSuccessMissing = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      const mockErrorLookup = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'Transient read error' } }),
      });

      const supabaseClientModule = await import('@/lib/supabase/client');
      const clientSpy = vi
        .spyOn(supabaseClientModule, 'createClient')
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ abortSignal: mockSuccessMissing }) }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ abortSignal: mockErrorLookup }) }),
          }),
        } as any);

      try {
        const result = await fetchBookData(999999);
        expect(result).toBeNull();
        expect(isConfirmedMissingBook(999999)).toBe(true);

        clearConfirmedNotFoundCache();
        expect(isConfirmedMissingBook(999999)).toBe(false);

        const erroredResult = await fetchBookData(55555);
        expect(erroredResult).toBeNull();
        expect(isConfirmedMissingBook(55555)).toBe(false);
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
        clientSpy.mockRestore();
      }
    });
  });

  describe('buildReaderSeoMetadataPayload', () => {
    it('normalizes tags, lifespan contributors, formats, featured opening hooks, and Gutenberg URL without duplicates', () => {
      const meta = resolveBookMetadata({
        id: 2600,
        booksData: {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 2600,
              title: 'War and Peace',
              authors: [
                { name: 'Tolstoy, Leo, graf', birth_year: 1828, death_year: 1910 },
                { name: 'Coauthor, Second', birth_year: 1830, death_year: 1900 },
              ],
              translators: [
                { name: 'Maude, Louise', birth_year: 1855, death_year: 1939 },
                { name: 'Maude, Aylmer', birth_year: 1858, death_year: 1938 },
              ],
              subjects: [
                'Historical fiction',
                'War stories',
                'Russia -- History -- Fiction',
              ],
              bookshelves: [
                'Best Books Ever Listings',
                'Category: Historical Fiction',
              ],
              languages: ['en'],
              copyright: false,
              media_type: 'Text',
              formats: {
                'application/epub+zip': 'https://www.gutenberg.org/ebooks/2600.epub3.images',
                'text/html; charset=utf-8': 'https://www.gutenberg.org/files/2600/2600-h/2600-h.htm',
                'text/plain; charset=utf-8': 'https://www.gutenberg.org/files/2600/2600-0.txt',
              },
              download_count: 12000,
            },
          ],
        },
      });

      const seo = buildReaderSeoMetadataPayload(meta, 2600, {
        'application/epub+zip': 'https://www.gutenberg.org/ebooks/2600.epub3.images',
        'text/html; charset=utf-8': 'https://www.gutenberg.org/files/2600/2600-h/2600-h.htm',
        'text/plain; charset=utf-8': 'https://www.gutenberg.org/files/2600/2600-0.txt',
      });

      expect(seo.authorNames).toEqual(['graf Leo Tolstoy', 'Second Coauthor']);
      expect(seo.authorsMeta).toEqual([
        { name: 'graf Leo Tolstoy', birthDate: '1828', deathDate: '1910' },
        { name: 'Second Coauthor', birthDate: '1830', deathDate: '1900' },
      ]);
      expect(seo.translatorsMeta).toEqual([
        { name: 'Louise Maude', birthDate: '1855', deathDate: '1939' },
        { name: 'Aylmer Maude', birthDate: '1858', deathDate: '1938' },
      ]);
      expect(seo.availableFormats).toEqual([
        'application/epub+zip',
        'text/html',
        'text/plain',
      ]);
      expect(seo.translatorNames).toEqual(['Louise Maude', 'Aylmer Maude']);
      expect(seo.genres).toContain('Historical Fiction');
      expect(seo.genres).toContain('War Stories');
      expect(seo.genres).toContain('Historical');
      expect(seo.genres).not.toContain('Best Books Ever Listings');
      expect(seo.description.length).toBeLessThanOrEqual(MAX_SERP_DESCRIPTION_LENGTH);
      expect(seo.description).toContain('War and Peace');
      expect(seo.ogDescription).toContain('Genoa and Lucca');
      expect(seo.ogDescription).toContain('War and Peace');
      expect(seo.ogDescription).toContain('translated by Louise Maude, Aylmer Maude');
      expect(seo.ogDescription).toContain('Historical Fiction');
      expect(seo.openingHook).toContain('Genoa and Lucca');
      expect(seo.isUsRestricted).toBe(false);
      expect(seo.keywords).toContain('War and Peace');
      expect(seo.keywords).toContain('Historical Fiction');
      expect(seo.keywords).toContain('Public Domain Books');
      expect(seo.gutenbergUrl).toBe('https://www.gutenberg.org/ebooks/2600');
    });

    it('extracts DB quote0 opening excerpts, handles non-English languages, and flags US copyright restriction', () => {
      const restrictedFrenchBook: CatalogBook = {
        id: 88801,
        title: 'Les Misérables',
        authors: [{ name: 'Hugo, Victor', birth_year: 1802, death_year: 1885 }],
        translators: [],
        subjects: ['Historical fiction'],
        bookshelves: [],
        languages: ['fr'],
        copyright: true,
        media_type: 'Text',
        formats: {},
        download_count: 1500,
        quotes: [
          {
            chapterLabel: 'Livre I',
            openingLine: 'En 1815, M. Charles-François-Bienvenu Myriel était évêque de Digne.',
            quoteExcerpt: 'Aimer ou avoir aimé, cela suffit.',
          },
        ],
      };
      const meta = resolveBookMetadata({
        id: 88801,
        booksData: { count: 1, next: null, previous: null, results: [restrictedFrenchBook] },
      });
      const seo = buildReaderSeoMetadataPayload(meta, 88801, undefined, restrictedFrenchBook);

      expect(seo.openingHook).toContain('1815');
      expect(seo.description.length).toBeLessThanOrEqual(MAX_SERP_DESCRIPTION_LENGTH);
      expect(seo.ogDescription).toContain('(French)');
      expect(seo.isUsRestricted).toBe(true);
    });

    it('falls back safely when subjects, bookshelves, formats, and authentic authors are absent', () => {
      const meta = resolveBookMetadata({ id: 999999 });
      const seo = buildReaderSeoMetadataPayload(meta, 999999);

      expect(seo.authorNames).toEqual([]);
      expect(seo.authorsMeta).toEqual([]);
      expect(seo.translatorNames).toEqual([]);
      expect(seo.translatorsMeta).toEqual([]);
      expect(seo.availableFormats).toEqual([]);
      expect(seo.genres).toEqual(['Classics']);
      expect(seo.description).toContain('Gutenberg Volume #999999');
      expect(seo.keywords).toContain('Classics');
      expect(seo.gutenbergUrl).toBe('https://www.gutenberg.org/ebooks/999999');
    });
  });

  it('anchors serverMetadataCache and confirmedNotFoundIds on globalThis', () => {
    setServerMetadataCache(1342, { id: 1342, title: 'Pride and Prejudice' } as CatalogBook);
    const g = globalThis as typeof globalThis & {
      __bookariumServerMetadataCache?: Map<number, CatalogBook>;
      __bookariumConfirmedNotFoundIds?: Set<number>;
    };
    expect(g.__bookariumServerMetadataCache).toBe(serverMetadataCache);
    expect(g.__bookariumConfirmedNotFoundIds).toBeInstanceOf(Set);
    clearServerMetadataCache();
    expect(g.__bookariumServerMetadataCache?.size).toBe(0);
    clearConfirmedNotFoundCache();
    expect(g.__bookariumConfirmedNotFoundIds?.size).toBe(0);

    // Covers application/x-mobipocket-ebook extraction and confirmedNotFoundIds cleanup
    const customMeta = resolveBookMetadata({ id: 77 });
    const customSeo = buildReaderSeoMetadataPayload(customMeta, 77, {
      'application/x-mobipocket-ebook': 'https://example.com/book.mobi',
      'text/plain; charset=utf-8': 'https://example.com/book.txt',
    });
    expect(customSeo.availableFormats).toEqual(['application/x-mobipocket-ebook', 'text/plain']);
  });

  describe('checkBookCoverAvailable', () => {
    it('returns false when R2 is unconfigured and maps HEAD probe statuses safely', async () => {
      vi.unstubAllEnvs();
      expect(await checkBookCoverAvailable(1342)).toBe(false);
      expect(await checkBookCoverAvailable(0)).toBe(false);

      vi.stubEnv('R2_ACCOUNT_ID', '0123456789abcdef0123456789abcdef');
      vi.stubEnv('R2_BUCKET_NAME', 'bookarium-assets');
      vi.stubEnv('R2_ACCESS_KEY_ID', 'test-key');
      vi.stubEnv('R2_SECRET_ACCESS_KEY', 'test-secret');

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(null, { status: 200, headers: { 'Content-Type': 'image/jpeg' } }))
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockRejectedValueOnce(new Error('R2 timeout'));

      expect(await checkBookCoverAvailable(1342)).toBe(true);
      expect(await checkBookCoverAvailable(99999)).toBe(false);
      expect(await checkBookCoverAvailable(1234)).toBe(false);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      vi.unstubAllEnvs();
    });
  });
});

