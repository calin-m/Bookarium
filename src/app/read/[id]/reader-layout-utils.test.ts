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
  buildReaderSeoMetadataPayload,
} from './reader-layout-utils';
import { resolveBookMetadata } from '@/lib/book-metadata';
import type { GutendexBook } from '@/types/book.types';

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
        setServerMetadataCache(i, { id: i, title: `Book ${i}` } as GutendexBook);
      }
      expect(serverMetadataCache.size).toBe(MAX_SERVER_METADATA_CACHE_ENTRIES);
      expect(serverMetadataCache.has(1)).toBe(false);
      expect(serverMetadataCache.has(2)).toBe(false);
      expect(serverMetadataCache.has(3)).toBe(true);

      // Updating an existing key refreshes its LRU position without growing size
      setServerMetadataCache(3, { id: 3, title: 'Book 3 Updated' } as GutendexBook);
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
      const mockBook = { id: 42, title: 'Cached Hitchhiker' } as GutendexBook;
      serverMetadataCache.set(42, mockBook);
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const result = await fetchBookData(42);
      expect(result).toBe(mockBook);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('fetches upstream book and populates serverMetadataCache when Supabase is unconfigured', async () => {
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      try {
        const mockBook = { id: 84, title: 'Frankenstein' } as GutendexBook;
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [mockBook] }),
        } as Response);

        const result = await fetchBookData(84);
        expect(result).toEqual(mockBook);
        expect(serverMetadataCache.get(84)).toEqual(mockBook);
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
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

    it('degrades gracefully to upstream Gutendex when Supabase query times out or fails', async () => {
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

      const mockUpstreamBook = { id: 2600, title: 'War and Peace' } as GutendexBook;
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [mockUpstreamBook] }),
      } as Response);

      try {
        const result = await fetchBookData(2600);
        expect(result).not.toBeNull();
        expect(result?.title).toBe('War and Peace');
        expect(fetchSpy).toHaveBeenCalled();
        expect(serverMetadataCache.get(2600)?.title).toBe('War and Peace');
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
        clientSpy.mockRestore();
      }
    });

    it('records confirmed missing IDs on 404 or empty upstream results but never on network exceptions', async () => {
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      try {
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as Response);

        const result = await fetchBookData(999999);
        expect(result).toBeNull();
        expect(isConfirmedMissingBook(999999)).toBe(true);

        clearConfirmedNotFoundCache();
        expect(isConfirmedMissingBook(999999)).toBe(false);

        vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network offline'));

        const offlineResult = await fetchBookData(55555);
        expect(offlineResult).toBeNull();
        expect(isConfirmedMissingBook(55555)).toBe(false);
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
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
      expect(seo.description).toContain('Genoa and Lucca');
      expect(seo.description).toContain('War and Peace');
      expect(seo.description).toContain('translated by Louise Maude, Aylmer Maude');
      expect(seo.description).toContain('Historical Fiction');
      expect(seo.keywords).toContain('War and Peace');
      expect(seo.keywords).toContain('Historical Fiction');
      expect(seo.keywords).toContain('Public Domain Books');
      expect(seo.gutenbergUrl).toBe('https://www.gutenberg.org/ebooks/2600');
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
});

