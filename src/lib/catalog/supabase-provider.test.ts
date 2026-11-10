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

      // Strips 1-item bibliographic sentinel spreads while preserving genuine quote spreads
      const sentinelOnlyRow = {
        ...dbRow,
        quotes: [
          {
            chapterLabel: 'Archival Edition • Vol. #1342',
            openingLine: '“Pride and Prejudice — preserved in the Project Gutenberg Literary Archive.”',
            quoteExcerpt: '“Unabridged public domain edition by Austen, Jane (Vol. #1342).”',
            commentary: 'Bibliographic sentinel record for Vol. #1342.',
          },
        ],
      } as unknown as DatabaseBook;
      expect(mapDatabaseBookToGutendexBook(sentinelOnlyRow).quotes).toBeUndefined();
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

    it('returns true when client returns count > 0 without error and passes estimated head count with abortSignal', async () => {
      const abortSignalMock = vi.fn().mockResolvedValue({ count: 120, error: null });
      const selectMock = vi.fn().mockReturnValue({
        abortSignal: abortSignalMock,
      });
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: selectMock,
        }),
      };

      const provider = new SupabaseCatalogProvider(mockClient as any);
      const healthy = await provider.isHealthy();

      expect(healthy).toBe(true);
      expect(mockClient.from).toHaveBeenCalledWith('books');
      expect(selectMock).toHaveBeenCalledWith('id', { count: 'estimated', head: true });
      expect(abortSignalMock).toHaveBeenCalledTimes(1);
      expect(abortSignalMock).toHaveBeenCalledWith(expect.any(AbortSignal));
    });

    it('returns false when table has count === 0 (unseeded)', async () => {
      const selectMock = vi.fn().mockResolvedValue({ count: 0, error: null });
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: selectMock,
        }),
      };

      const provider = new SupabaseCatalogProvider(mockClient as any);
      const healthy = await provider.isHealthy();

      expect(healthy).toBe(false);
      expect(selectMock).toHaveBeenCalledWith('id', { count: 'estimated', head: true });
    });

    it('returns false when select returns an error or rejects', async () => {
      const selectMock = vi
        .fn()
        .mockResolvedValueOnce({ count: null, error: { message: 'relation does not exist' } })
        .mockRejectedValueOnce(new Error('Network socket hang up'));
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: selectMock,
        }),
      };

      const provider = new SupabaseCatalogProvider(mockClient as any);
      const healthyError = await provider.isHealthy();
      expect(healthyError).toBe(false);

      provider.resetHealthCache();
      const healthyRejected = await provider.isHealthy();
      expect(healthyRejected).toBe(false);
      expect(selectMock).toHaveBeenCalledTimes(2);
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
        neq: vi.fn().mockReturnThis(),
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
      expect(client.from().select).toHaveBeenCalledWith(CATALOG_METADATA_COLUMNS, { count: 'estimated' });
      expect(CATALOG_METADATA_COLUMNS).toContain('quotes');
      expect(CATALOG_METADATA_COLUMNS).not.toContain('content');
      expect(builder.eq).toHaveBeenCalledWith('copyright', false);
      expect(builder.textSearch).toHaveBeenCalledWith('search_vector', 'Jane Austen Fiction', {
        type: 'websearch',
        config: 'english',
      });
      expect(builder.overlaps).toHaveBeenCalledWith('languages', ['en']);
      expect(builder.gte).toHaveBeenCalledWith('max_author_death_year', 1750);
      expect(builder.lte).toHaveBeenCalledWith('min_author_birth_year', 1850);
      expect(builder.order).toHaveBeenCalledWith('download_count', { ascending: false });
      expect(builder.order).not.toHaveBeenCalledWith('id', { ascending: true });
      expect(builder.range).toHaveBeenCalledWith(0, 31);
    });

    it('queries books using GIN search_vector when only topic is provided', async () => {
      const { client, builder } = createMockQueryBuilder(sampleDbRows, 2);
      const provider = new SupabaseCatalogProvider(client as any);

      const options: CatalogQueryOptions = {
        topic: 'philosophy',
        page: 1,
        limit: 32,
        country: 'US',
      };

      const result = await provider.searchBooks(options);

      expect(result.source).toBe('supabase');
      expect(builder.textSearch).toHaveBeenCalledWith('search_vector', 'philosophy', {
        type: 'plain',
        config: 'english',
      });
    });

    it('queries books using GIN search_vector with OR union when multiple topics are provided', async () => {
      const { client, builder } = createMockQueryBuilder(sampleDbRows, 2);
      const provider = new SupabaseCatalogProvider(client as any);

      const options: CatalogQueryOptions = {
        topic: 'philosophy,science',
        page: 1,
        limit: 32,
        country: 'US',
      };

      const result = await provider.searchBooks(options);

      expect(result.source).toBe('supabase');
      expect(builder.textSearch).toHaveBeenCalledWith('search_vector', 'philosophy or science', {
        type: 'websearch',
        config: 'english',
      });
    });

    it('filters out authors protected under Life + 70 when client is in GB and applies SQL B-Tree cutoff', async () => {
      const { client, builder } = createMockQueryBuilder(sampleDbRows, 2);
      const provider = new SupabaseCatalogProvider(client as any);
      const currentYear = new Date().getFullYear();

      const options: CatalogQueryOptions = {
        page: 1,
        limit: 32,
        country: 'GB',
      };

      const result = await provider.searchBooks(options);

      // Christie (1976) should be filtered out under Life + 70
      expect(result.jurisdictionRule).toBe('LIFE_70');
      expect(builder.lte).toHaveBeenCalledWith('max_author_death_year', currentYear - 70 - 1);
      expect(result.totalFiltered).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe('Pride and Prejudice');
      expect(result.count).toBe(1);
    });

    it('applies SQL B-Tree cutoff bounds for Life + 80 (CO) and Life + 100 (MX) jurisdictions', async () => {
      const currentYear = new Date().getFullYear();

      const { client: clientCo, builder: builderCo } = createMockQueryBuilder(sampleDbRows, 2);
      const providerCo = new SupabaseCatalogProvider(clientCo as any);
      const resultCo = await providerCo.searchBooks({ page: 1, limit: 32, country: 'CO' });
      expect(resultCo.jurisdictionRule).toBe('LIFE_80');
      expect(builderCo.lte).toHaveBeenCalledWith('max_author_death_year', currentYear - 80 - 1);
      expect(resultCo.results).toHaveLength(1);

      const { client: clientMx, builder: builderMx } = createMockQueryBuilder(sampleDbRows, 2);
      const providerMx = new SupabaseCatalogProvider(clientMx as any);
      const resultMx = await providerMx.searchBooks({ page: 1, limit: 32, country: 'MX' });
      expect(resultMx.jurisdictionRule).toBe('LIFE_100');
      expect(builderMx.lte).toHaveBeenCalledWith('max_author_death_year', currentYear - 100 - 1);
      expect(resultMx.results).toHaveLength(1);
    });

    it('generates next and previous pagination links and passes exact range bounds', async () => {
      const { client, builder } = createMockQueryBuilder(sampleDbRows, 100);
      const provider = new SupabaseCatalogProvider(client as any);

      const options: CatalogQueryOptions = {
        page: 2,
        limit: 32,
        country: 'US',
      };

      const result = await provider.searchBooks(options);

      expect(builder.range).toHaveBeenCalledWith(32, 63);
      expect(result.previous).toBe('/api/books?page=1');
      expect(result.next).toBe('/api/books?page=3');

      // Clamps excessive limit > 100 to 100 (range 0..99)
      const { client: clientClamp, builder: builderClamp } = createMockQueryBuilder(sampleDbRows, 250);
      const providerClamp = new SupabaseCatalogProvider(clientClamp as any);
      await providerClamp.searchBooks({ page: 1, limit: 250, country: 'US' });
      expect(builderClamp.range).toHaveBeenCalledWith(0, 99);
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

    it('filters results by multiple mimeTypes if specified', async () => {
      const { client } = createMockQueryBuilder(sampleDbRows, 2);
      const provider = new SupabaseCatalogProvider(client as any);

      const options: CatalogQueryOptions = {
        page: 1,
        limit: 32,
        mimeType: 'application/epub+zip,text/html',
        country: 'US',
      };

      const result = await provider.searchBooks(options);

      // Both Pride and Prejudice and Christie have text/html or epub
      expect(result.results).toHaveLength(2);
    });

    it('matches plain text formats across charset variations (e.g. text/plain; charset=us-ascii vs utf-8)', async () => {
      const rowsWithUtf8Plain: DatabaseBook[] = [
        {
          ...sampleDbRows[0],
          formats: { 'text/plain; charset=utf-8': 'https://gutenberg.org/1342.txt' },
        },
      ];
      const { client } = createMockQueryBuilder(rowsWithUtf8Plain, 1);
      const provider = new SupabaseCatalogProvider(client as any);

      const result = await provider.searchBooks({
        page: 1,
        limit: 32,
        mimeType: 'text/plain; charset=us-ascii',
        country: 'US',
      });

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

    it('filters by non-empty quotes JSONB column and excludes sentinel-only or quoteless rows when hasQuotes is true', async () => {
      const quotedRow: DatabaseBook = {
        ...sampleDbRows[0],
        quotes: [
          {
            chapterLabel: 'Chapter I',
            openingLine: 'It is a truth universally acknowledged...',
            quoteExcerpt: 'I declare after all there is no enjoyment like reading!',
          },
        ],
      };
      const sentinelOnlyRow: DatabaseBook = {
        ...sampleDbRows[0],
        id: 1400,
        title: 'Great Expectations',
        quotes: [
          {
            chapterLabel: 'Archival Edition • Vol. #1400',
            openingLine: 'Great Expectations — preserved in the Project Gutenberg Literary Archive.',
            quoteExcerpt: 'Unabridged public domain edition (Vol. #1400).',
            commentary: 'Bibliographic sentinel record for Vol. #1400.',
          },
        ],
      };
      const quotelessRow: DatabaseBook = {
        ...sampleDbRows[0],
        id: 98,
        title: 'A Tale of Two Cities',
      };

      const { client, builder } = createMockQueryBuilder(
        [quotedRow, sentinelOnlyRow, quotelessRow],
        3
      );
      const provider = new SupabaseCatalogProvider(client as any);

      const result = await provider.searchBooks({
        page: 1,
        limit: 32,
        country: 'US',
        hasQuotes: true,
      });

      expect(builder.neq).toHaveBeenCalledWith('quotes', '[]');
      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe(1342);
      expect(result.results[0].quotes).toHaveLength(1);
      expect(result.results[0].quotes?.[0].chapterLabel).toBe('Chapter I');
      expect(result.count).toBe(1);
    });

    it('automatically backfills deficit when runtime copyright filtering withholds books from an initial full batch', async () => {
      const validRow1: DatabaseBook = { ...sampleDbRows[0], id: 101, title: 'Book 101' };
      const validRow2: DatabaseBook = { ...sampleDbRows[0], id: 102, title: 'Book 102' };
      const restrictedRow1: DatabaseBook = { ...sampleDbRows[1], id: 103, title: 'Book 103' }; // Agatha Christie (d. 1976)
      const restrictedRow2: DatabaseBook = { ...sampleDbRows[1], id: 104, title: 'Book 104' }; // Agatha Christie (d. 1976)
      const backfillRow1: DatabaseBook = { ...sampleDbRows[0], id: 105, title: 'Book 105' };
      const backfillRow2: DatabaseBook = { ...sampleDbRows[0], id: 106, title: 'Book 106' };

      const initialBatch = [validRow1, restrictedRow1, validRow2, restrictedRow2]; // 4 rows, 2 valid under LIFE_70
      const backfillBatch = [backfillRow1, backfillRow2]; // 2 valid rows

      let callCount = 0;
      const builder: any = {
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        textSearch: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        overlaps: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => {
          callCount++;
          if (callCount === 1) {
            resolve({ data: initialBatch, count: 10, error: null });
          } else {
            resolve({ data: backfillBatch, count: 10, error: null });
          }
        }),
      };

      const client = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(builder),
        }),
      };

      const provider = new SupabaseCatalogProvider(client as any);
      const result = await provider.searchBooks({
        page: 1,
        limit: 4,
        country: 'GB', // LIFE_70
      });

      expect(result.results).toHaveLength(4);
      expect(result.results.map((b) => b.id)).toEqual([101, 102, 105, 106]);
      expect(callCount).toBe(2);
      expect(builder.range).toHaveBeenNthCalledWith(1, 0, 3);
      expect(builder.range).toHaveBeenNthCalledWith(2, 4, 11);
    });
  });

  describe('getBookTranslations', () => {
    it('returns empty array for invalid bookId', async () => {
      const provider = new SupabaseCatalogProvider({} as any);
      expect(await provider.getBookTranslations(0)).toEqual([]);
      expect(await provider.getBookTranslations(-5)).toEqual([]);
    });

    it('returns translations when cluster exists, verifies query args, and sorts by isCurrent -> isOriginal -> download_count DESC', async () => {
      const translationsEqMock = vi.fn().mockResolvedValue({
        data: [{ work_id: 'Q170583' }],
        error: null,
      });
      const translationsInMock = vi.fn().mockResolvedValue({
        data: [
          { book_id: 50001, language: 'de', is_original: false },
          { book_id: 43647, language: 'fr', is_original: false },
          { book_id: 60002, language: 'es', is_original: false },
          { book_id: 1342, language: 'en', is_original: true },
        ],
        error: null,
      });
      const translationsSelectMock = vi.fn().mockReturnValue({
        eq: translationsEqMock,
        in: translationsInMock,
      });

      const booksInMock = vi.fn().mockResolvedValue({
        data: [
          { id: 50001, title: 'Stolz und Vorurteil', download_count: 800 },
          { id: 43647, title: 'Orgueil et Préjugé', download_count: 1200 },
          { id: 60002, title: 'Orgullo y Prejuicio', download_count: 3500 },
          { id: 1342, title: 'Pride and Prejudice', download_count: 50000 },
        ],
        error: null,
      });
      const booksSelectMock = vi.fn().mockReturnValue({
        in: booksInMock,
      });

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'book_translations') {
            return {
              select: translationsSelectMock,
            };
          }
          if (table === 'books') {
            return {
              select: booksSelectMock,
            };
          }
          return {};
        }),
      };

      const provider = new SupabaseCatalogProvider(mockSupabase as any);
      // Query for French edition 43647 (isCurrent: true, isOriginal: false)
      const results = await provider.getBookTranslations(43647);

      expect(translationsSelectMock).toHaveBeenNthCalledWith(1, 'work_id');
      expect(translationsEqMock).toHaveBeenCalledWith('book_id', 43647);
      expect(translationsSelectMock).toHaveBeenNthCalledWith(2, 'book_id, language, is_original');
      expect(translationsInMock).toHaveBeenCalledWith('work_id', ['Q170583']);
      expect(booksSelectMock).toHaveBeenCalledWith(
        'id, title, download_count, copyright, authors, translators'
      );
      expect(booksInMock).toHaveBeenCalledWith('id', [50001, 43647, 60002, 1342]);

      // Sorted order: 1) Current (43647), 2) Original (1342), 3) Higher download_count (60002: 3500), 4) Lower download_count (50001: 800)
      expect(results).toHaveLength(4);
      expect(results.map((r) => r.bookId)).toEqual([43647, 1342, 60002, 50001]);
      expect(results[0].isCurrent).toBe(true);
      expect(results[0].isOriginal).toBe(false);
      expect(results[0].languageCode).toBe('fr');
      expect(results[1].isCurrent).toBe(false);
      expect(results[1].isOriginal).toBe(true);
      expect(results[1].languageCode).toBe('en');
    });

    it('gracefully returns empty array on database error', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockRejectedValue(new Error('DB Timeout')),
          }),
        }),
      };

      const provider = new SupabaseCatalogProvider(mockSupabase as any);
      const results = await provider.getBookTranslations(1342);
      expect(results).toEqual([]);
    });

    it('filters out translation editions that are copyrighted or restricted in the caller jurisdiction', async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'book_translations') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ work_id: 'Q170583' }],
                  error: null,
                }),
                in: vi.fn().mockResolvedValue({
                  data: [
                    { book_id: 1342, language: 'en', is_original: true },
                    { book_id: 43647, language: 'fr', is_original: false },
                  ],
                  error: null,
                }),
              }),
            };
          }
          if (table === 'books') {
            return {
              select: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 1342,
                      title: 'Pride and Prejudice',
                      download_count: 50000,
                      copyright: false,
                      authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
                      translators: [],
                    },
                    {
                      id: 43647,
                      title: 'Orgueil et Préjugé (Modern Translation)',
                      download_count: 1200,
                      copyright: false,
                      authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
                      translators: [{ name: 'Modern Translator', birth_year: 1920, death_year: 1995 }],
                    },
                  ],
                  error: null,
                }),
              }),
            };
          }
          return {};
        }),
      };

      const provider = new SupabaseCatalogProvider(mockSupabase as any);
      // In GB (Life + 70), a translator who died in 1995 is protected until 2066
      const gbResults = await provider.getBookTranslations(1342, 'GB');
      expect(gbResults).toHaveLength(1);
      expect(gbResults[0].bookId).toBe(1342);
    });

    it('maps optional quotes JSONB array in mapDatabaseBookToGutendexBook when present', async () => {
      const { mapDatabaseBookToGutendexBook } = await import('./supabase-provider');
      const mappedWithQuotes = mapDatabaseBookToGutendexBook({
        id: 1342,
        title: 'Pride and Prejudice',
        authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
        translators: [],
        subjects: ['Classic'],
        bookshelves: [],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: {},
        download_count: 1000,
        max_author_death_year: 1817,
        min_author_birth_year: 1775,
        quotes: [
          {
            chapterLabel: 'Chapter I',
            openingLine: 'It is a truth universally acknowledged...',
            quoteExcerpt: 'I declare after all there is no enjoyment like reading!',
          },
        ],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      });

      expect(mappedWithQuotes.quotes).toHaveLength(1);
      expect(mappedWithQuotes.quotes?.[0].chapterLabel).toBe('Chapter I');
    });
  });
});

