import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SupabaseCatalogProvider,
  isSupabaseConfigured,
  mapDatabaseBookToGutendexBook,
  CATALOG_METADATA_COLUMNS,
} from './supabase-provider';
import type { DatabaseBook } from '@/types/database.types';
import type { CatalogQueryOptions } from '@/types/catalog.types';
import { CatalogProviderError } from '@/types/catalog.types';

describe('SupabaseCatalogProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isSupabaseConfigured', () => {
    it('returns true when valid non-placeholder URL and key are set', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://xyzcompany.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.validkey';

      expect(isSupabaseConfigured()).toBe(true);
    });

    it('returns false when NEXT_PUBLIC_SUPABASE_URL contains placeholder', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'validkey123';

      expect(isSupabaseConfigured()).toBe(false);
    });

    it('returns false when NEXT_PUBLIC_SUPABASE_ANON_KEY contains placeholder', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://xyzcompany.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'placeholder-anon-key';

      expect(isSupabaseConfigured()).toBe(false);
    });

    it('returns false when credentials are missing or empty', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      expect(isSupabaseConfigured()).toBe(false);
    });
  });

  describe('mapDatabaseBookToGutendexBook', () => {
    it('correctly maps all fields and defaults nullish values', () => {
      const dbRow: DatabaseBook = {
        id: 1342,
        title: 'Pride and Prejudice',
        authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
        translators: [],
        subjects: ['Courtship -- Fiction', 'Sisters -- Fiction'],
        bookshelves: ['Best Books Ever'],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: { 'text/html': 'https://gutenberg.org/1342.html' },
        download_count: 54321,
        max_author_death_year: 1817,
        min_author_birth_year: 1775,
        content: null,
        search_vector: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const mapped = mapDatabaseBookToGutendexBook(dbRow);

      expect(mapped.id).toBe(1342);
      expect(mapped.title).toBe('Pride and Prejudice');
      expect(mapped.authors).toEqual([{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }]);
      expect(mapped.translators).toEqual([]);
      expect(mapped.subjects).toEqual(['Courtship -- Fiction', 'Sisters -- Fiction']);
      expect(mapped.bookshelves).toEqual(['Best Books Ever']);
      expect(mapped.languages).toEqual(['en']);
      expect(mapped.copyright).toBe(false);
      expect(mapped.media_type).toBe('Text');
      expect(mapped.formats).toEqual({ 'text/html': 'https://gutenberg.org/1342.html' });
      expect(mapped.download_count).toBe(54321);
    });

    it('handles non-array or nullish authors, formats, and download count', () => {
      const dbRow = {
        id: 9999,
        title: 'Unknown Fragment',
        authors: null,
        translators: null,
        subjects: null,
        bookshelves: null,
        languages: null,
        copyright: false,
        media_type: null,
        formats: null,
        download_count: null,
        max_author_death_year: null,
        min_author_birth_year: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      } as unknown as DatabaseBook;

      const mapped = mapDatabaseBookToGutendexBook(dbRow);

      expect(mapped.authors).toEqual([]);
      expect(mapped.translators).toEqual([]);
      expect(mapped.subjects).toEqual([]);
      expect(mapped.bookshelves).toEqual([]);
      expect(mapped.languages).toEqual([]);
      expect(mapped.media_type).toBe('Text');
      expect(mapped.formats).toEqual({});
      expect(mapped.download_count).toBe(0);
    });
  });

  describe('isHealthy', () => {
    it('returns false when Supabase is not configured and no client was injected', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      const provider = new SupabaseCatalogProvider();

      const healthy = await provider.isHealthy();
      expect(healthy).toBe(false);
    });

    it('returns true when client returns count > 0 without error', async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ count: 120, error: null }),
        }),
      };

      const provider = new SupabaseCatalogProvider(mockClient as any);
      const healthy = await provider.isHealthy();

      expect(healthy).toBe(true);
      expect(mockClient.from).toHaveBeenCalledWith('books');
    });

    it('returns false when table has count === 0 (unseeded)', async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ count: 0, error: null }),
        }),
      };

      const provider = new SupabaseCatalogProvider(mockClient as any);
      const healthy = await provider.isHealthy();

      expect(healthy).toBe(false);
    });

    it('returns false when select returns an error or rejects', async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ count: null, error: { message: 'relation does not exist' } }),
        }),
      };

      const provider = new SupabaseCatalogProvider(mockClient as any);
      const healthy = await provider.isHealthy();

      expect(healthy).toBe(false);
    });

    it('caches health check result for 60 seconds without re-querying Supabase', async () => {
      const selectMock = vi.fn().mockResolvedValue({ count: 500, error: null });
      const mockClient = {
        from: vi.fn().mockReturnValue({ select: selectMock }),
      };

      const provider = new SupabaseCatalogProvider(mockClient as any);

      const firstCheck = await provider.isHealthy();
      expect(firstCheck).toBe(true);
      expect(selectMock).toHaveBeenCalledTimes(1);

      // Second consecutive check within TTL window: reuses cache without calling selectMock again
      const secondCheck = await provider.isHealthy();
      expect(secondCheck).toBe(true);
      expect(selectMock).toHaveBeenCalledTimes(1);

      // Reset cache: forces re-query
      provider.resetHealthCache();
      const thirdCheck = await provider.isHealthy();
      expect(thirdCheck).toBe(true);
      expect(selectMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('searchBooks', () => {
    const sampleDbRows: DatabaseBook[] = [
      {
        id: 1342,
        title: 'Pride and Prejudice',
        authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
        translators: [],
        subjects: ['Courtship -- Fiction', 'Sisters -- Fiction'],
        bookshelves: ['Best Books Ever'],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: { 'text/html': 'https://gutenberg.org/1342.html', 'application/epub+zip': 'https://gutenberg.org/1342.epub' },
        download_count: 50000,
        max_author_death_year: 1817,
        min_author_birth_year: 1775,
        content: null,
        search_vector: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 863,
        title: 'The Mysterious Affair at Styles',
        authors: [{ name: 'Christie, Agatha', birth_year: 1890, death_year: 1976 }],
        translators: [],
        subjects: ['Detective and mystery stories'],
        bookshelves: ['Mystery'],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: { 'text/html': 'https://gutenberg.org/863.html' },
        download_count: 30000,
        max_author_death_year: 1976,
        min_author_birth_year: 1890,
        content: null,
        search_vector: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];

    function createMockQueryBuilder(rows: DatabaseBook[], count = rows.length, error: any = null) {
      const builder: any = {
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        textSearch: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        overlaps: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: rows, count, error })),
      };

      const client = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(builder),
        }),
      };

      return { client, builder };
    }

    it('successfully queries books and applies US public domain rules', async () => {
      const { client, builder } = createMockQueryBuilder(sampleDbRows, 2);
      const provider = new SupabaseCatalogProvider(client as any);

      const options: CatalogQueryOptions = {
        search: 'Jane Austen',
        topic: 'Fiction',
        languages: ['en'],
        page: 1,
        limit: 32,
        authorYearStart: 1750,
        authorYearEnd: 1850,
        sort: 'popular',
        country: 'US',
      };

      const result = await provider.searchBooks(options);

      expect(result.source).toBe('supabase');
      expect(result.count).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.clientCountry).toBe('US');
      expect(result.jurisdictionRule).toBe('US_PUBLIC_DOMAIN');
      expect(client.from().select).toHaveBeenCalledWith(CATALOG_METADATA_COLUMNS, { count: 'exact' });
      expect(CATALOG_METADATA_COLUMNS).not.toContain('content');
      expect(builder.eq).toHaveBeenCalledWith('copyright', false);
      expect(builder.textSearch).toHaveBeenCalledWith('search_vector', 'Jane Austen', {
        type: 'websearch',
        config: 'english',
      });
      expect(builder.overlaps).toHaveBeenCalledWith('languages', ['en']);
      expect(builder.gte).toHaveBeenCalledWith('max_author_death_year', 1750);
      expect(builder.lte).toHaveBeenCalledWith('min_author_birth_year', 1850);
      expect(builder.order).toHaveBeenCalledWith('download_count', { ascending: false });
    });

    it('filters out authors protected under Life + 70 when client is in GB', async () => {
      const { client } = createMockQueryBuilder(sampleDbRows, 2);
      const provider = new SupabaseCatalogProvider(client as any);

      const options: CatalogQueryOptions = {
        page: 1,
        limit: 32,
        country: 'GB',
      };

      const result = await provider.searchBooks(options);

      // Christie (1976) should be filtered out under Life + 70 in 2026
      expect(result.jurisdictionRule).toBe('LIFE_70');
      expect(result.totalFiltered).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe('Pride and Prejudice');
      expect(result.count).toBe(1);
    });

    it('generates next and previous pagination links when page bounds allow', async () => {
      const { client } = createMockQueryBuilder(sampleDbRows, 100);
      const provider = new SupabaseCatalogProvider(client as any);

      const options: CatalogQueryOptions = {
        page: 2,
        limit: 32,
        country: 'US',
      };

      const result = await provider.searchBooks(options);

      expect(result.previous).toBe('/api/books?page=1');
      expect(result.next).toBe('/api/books?page=3');
    });

    it('filters results by mimeType if specified', async () => {
      const { client } = createMockQueryBuilder(sampleDbRows, 2);
      const provider = new SupabaseCatalogProvider(client as any);

      const options: CatalogQueryOptions = {
        page: 1,
        limit: 32,
        mimeType: 'application/epub+zip',
        country: 'US',
      };

      const result = await provider.searchBooks(options);

      // Only Pride and Prejudice has application/epub+zip
      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe(1342);
    });

    it('filters by comma-delimited book IDs', async () => {
      const { client, builder } = createMockQueryBuilder([sampleDbRows[0]], 1);
      const provider = new SupabaseCatalogProvider(client as any);

      const options: CatalogQueryOptions = {
        ids: '1342, 863',
        page: 1,
        limit: 32,
        country: 'US',
      };

      const result = await provider.searchBooks(options);
      expect(builder.in).toHaveBeenCalledWith('id', [1342, 863]);
      expect(result.results).toHaveLength(1);
    });

    it('applies ascending and descending sort directions', async () => {
      const { client: clientAsc, builder: builderAsc } = createMockQueryBuilder(sampleDbRows, 2);
      const providerAsc = new SupabaseCatalogProvider(clientAsc as any);
      await providerAsc.searchBooks({ page: 1, limit: 32, sort: 'ascending', country: 'US' });
      expect(builderAsc.order).toHaveBeenCalledWith('id', { ascending: true });

      const { client: clientDesc, builder: builderDesc } = createMockQueryBuilder(sampleDbRows, 2);
      const providerDesc = new SupabaseCatalogProvider(clientDesc as any);
      await providerDesc.searchBooks({ page: 1, limit: 32, sort: 'descending', country: 'US' });
      expect(builderDesc.order).toHaveBeenCalledWith('id', { ascending: false });
    });

    it('throws CatalogProviderError when Supabase returns an error', async () => {
      const { client } = createMockQueryBuilder([], 0, { message: 'Database connection terminated' });
      const provider = new SupabaseCatalogProvider(client as any);

      await expect(
        provider.searchBooks({ page: 1, limit: 32, country: 'US' })
      ).rejects.toThrow(CatalogProviderError);
    });

    it('bypasses copyright filtering when includeRestrictedMetadata is true', async () => {
      // sampleDbRows[1] is Agatha Christie (restricted in GB)
      const { client, builder } = createMockQueryBuilder([sampleDbRows[1]], 1);
      const provider = new SupabaseCatalogProvider(client as any);

      const options: CatalogQueryOptions = {
        ids: '863',
        page: 1,
        limit: 32,
        country: 'GB',
        includeRestrictedMetadata: true,
      };

      const result = await provider.searchBooks(options);
      // B-tree bounds filtering was skipped:
      expect(builder.lte).not.toHaveBeenCalled();
      // Runtime pass did not strip the book:
      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe(863);
    });
  });
});

