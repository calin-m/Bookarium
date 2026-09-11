import { describe, it, expect, vi, beforeEach } from 'vitest';
import { headers } from 'next/headers';
import {
  serverMetadataCache,
  clearServerMetadataCache,
  isClientSideNavigation,
  fetchBookData,
} from './reader-layout-utils';
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
    it('clears all cached items from serverMetadataCache', () => {
      serverMetadataCache.set(123, { id: 123, title: 'Sample Book' } as GutendexBook);
      expect(serverMetadataCache.size).toBe(1);
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
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
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
        expect(fetchSpy).not.toHaveBeenCalled();

        // Verify cached in memory
        expect(serverMetadataCache.get(1342)?.title).toBe('Pride and Prejudice');
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
        clientSpy.mockRestore();
      }
    });

    it('returns null on upstream fetch error or 404', async () => {
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      try {
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as Response);

        const result = await fetchBookData(999999);
        expect(result).toBeNull();
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      }
    });

    it('returns null on network failure / exception', async () => {
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      try {
        vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network offline'));

        const result = await fetchBookData(55555);
        expect(result).toBeNull();
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      }
    });
  });
});

