import { describe, it, expect, vi } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  CATALOG_DIFF_SELECT_COLUMNS,
  parseContributors,
  computeLifespanBounds,
  buildStandardFormats,
  normalizeCsvRow,
  areStringArraysEqual,
  areContributorArraysEqual,
  hasCatalogMetadataChanged,
  deduplicateBatchById,
  filterChangedOrNewBooks,
  upsertBatch,
  reconcileWithdrawnCatalogBooks,
  fetchPopularCountsFromGutendex,
  syncPopularDownloadCounts,
} = require('./sync-gutenberg-catalog');

describe('sync-gutenberg-catalog parser', () => {
  describe('parseContributors', () => {
    it('parses empty or missing strings safely', () => {
      expect(parseContributors('')).toEqual({ authors: [], translators: [] });
      expect(parseContributors(null)).toEqual({ authors: [], translators: [] });
      expect(parseContributors(undefined)).toEqual({ authors: [], translators: [] });
    });

    it('parses single author with standard birth and death years', () => {
      const res = parseContributors('Austen, Jane, 1775-1817');
      expect(res.authors).toEqual([
        {
          name: 'Austen, Jane',
          birth_year: 1775,
          death_year: 1817,
        },
      ]);
      expect(res.translators).toEqual([]);
    });

    it('parses multiple authors separated by semicolons', () => {
      const res = parseContributors('Marx, Karl, 1818-1883; Engels, Friedrich, 1820-1895');
      expect(res.authors).toHaveLength(2);
      expect(res.authors[0]).toEqual({
        name: 'Marx, Karl',
        birth_year: 1818,
        death_year: 1883,
      });
      expect(res.authors[1]).toEqual({
        name: 'Engels, Friedrich',
        birth_year: 1820,
        death_year: 1895,
      });
    });

    it('correctly categorizes translators based on role annotations', () => {
      const res = parseContributors(
        'Tolstoy, Leo, graf, 1828-1910; Maude, Aylmer, 1858-1938 [Translator]; Maude, Louise, 1855-1939 [Translator]'
      );
      expect(res.authors).toEqual([
        {
          name: 'Tolstoy, Leo, graf',
          birth_year: 1828,
          death_year: 1910,
        },
      ]);
      expect(res.translators).toEqual([
        {
          name: 'Maude, Aylmer',
          birth_year: 1858,
          death_year: 1938,
        },
        {
          name: 'Maude, Louise',
          birth_year: 1855,
          death_year: 1939,
        },
      ]);
    });

    it('correctly ignores illustrators and visual contributors from authors array', () => {
      const res = parseContributors(
        'Tracy, Louis, 1863-1928; McFall, J. V. [Illustrator]; Parsons, A. W. [Illustrator]'
      );
      expect(res.authors).toEqual([
        {
          name: 'Tracy, Louis',
          birth_year: 1863,
          death_year: 1928,
        },
      ]);
      expect(res.translators).toEqual([]);
    });

    it('handles BCE year dates correctly', () => {
      const res = parseContributors('Plato, 428? BCE-348? BCE');
      expect(res.authors).toEqual([
        {
          name: 'Plato',
          birth_year: -428,
          death_year: -348,
        },
      ]);
    });

    it('handles death-only notation', () => {
      const res = parseContributors('Shakespeare, William, d. 1616');
      expect(res.authors).toEqual([
        {
          name: 'Shakespeare, William',
          birth_year: null,
          death_year: 1616,
        },
      ]);
    });

    it('handles birth-only notation with b., born, or trailing hyphen', () => {
      const res1 = parseContributors('Smith, John, b. 1850');
      expect(res1.authors).toEqual([
        {
          name: 'Smith, John',
          birth_year: 1850,
          death_year: null,
        },
      ]);

      const res2 = parseContributors('Doe, Jane, 1860-');
      expect(res2.authors).toEqual([
        {
          name: 'Doe, Jane',
          birth_year: 1860,
          death_year: null,
        },
      ]);
    });

    it('safely parses authors with single-letter initials without mistaking them for birth years', () => {
      const res1 = parseContributors('Wortham, B. Hale [Translator]');
      expect(res1.translators).toEqual([
        {
          name: 'Wortham, B. Hale',
          birth_year: null,
          death_year: null,
        },
      ]);

      const res2 = parseContributors('Barker, B. (Benjamin); Jones, B. W.');
      expect(res2.authors).toEqual([
        {
          name: 'Barker, B. (Benjamin)',
          birth_year: null,
          death_year: null,
        },
        {
          name: 'Jones, B. W.',
          birth_year: null,
          death_year: null,
        },
      ]);
    });

    it('handles authors without any lifespan dates', () => {
      const res = parseContributors('United States');
      expect(res.authors).toEqual([
        {
          name: 'United States',
          birth_year: null,
          death_year: null,
        },
      ]);
    });
  });

  describe('computeLifespanBounds', () => {
    it('returns nulls for empty inputs', () => {
      expect(computeLifespanBounds([], [])).toEqual({ maxDeath: null, minBirth: null });
    });

    it('calculates min birth and max death spanning authors and translators', () => {
      const authors = [
        { name: 'Author A', birth_year: 1800, death_year: 1860 },
        { name: 'Author B', birth_year: 1810, death_year: 1880 },
      ];
      const translators = [
        { name: 'Translator C', birth_year: 1850, death_year: 1920 },
      ];

      const bounds = computeLifespanBounds(authors, translators);
      expect(bounds.minBirth).toBe(1800);
      expect(bounds.maxDeath).toBe(1920);
    });
  });

  describe('buildStandardFormats', () => {
    it('constructs deterministic Gutenberg mirror endpoints for book id', () => {
      const formats = buildStandardFormats(1342);
      expect(formats['text/plain; charset=utf-8']).toBe('https://www.gutenberg.org/ebooks/1342.txt.utf-8');
      expect(formats['application/epub+zip']).toBe('https://www.gutenberg.org/ebooks/1342.epub3.images');
      expect(formats['image/jpeg']).toBe('https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg');
      expect(formats['text/html']).toBe('https://www.gutenberg.org/ebooks/1342.html.images');
    });
  });

  describe('normalizeCsvRow', () => {
    it('returns null for malformed or non-text rows', () => {
      expect(normalizeCsvRow([])).toBeNull();
      expect(normalizeCsvRow(['invalid', 'Text', '2020-01-01', 'Test'])).toBeNull();
      expect(normalizeCsvRow(['100', 'Sound', '2020-01-01', 'Audiobook'])).toBeNull();
    });

    it('normalizes valid Gutenberg CSV row into complete Book schema object', () => {
      const row = [
        '1342',
        'Text',
        '1998-06-01',
        'Pride and Prejudice',
        'en',
        'Austen, Jane, 1775-1817',
        'England -- Fiction; Young women -- Fiction; Love stories',
        'PR',
        'Best Books Ever; Harvard Classics',
      ];

      const book = normalizeCsvRow(row);
      expect(book).not.toBeNull();
      expect(book.id).toBe(1342);
      expect(book.title).toBe('Pride and Prejudice');
      expect(book.languages).toEqual(['en']);
      expect(book.authors).toEqual([
        { name: 'Austen, Jane', birth_year: 1775, death_year: 1817 },
      ]);
      expect(book.subjects).toEqual([
        'England -- Fiction',
        'Young women -- Fiction',
        'Love stories',
      ]);
      expect(book.bookshelves).toEqual(['Best Books Ever', 'Harvard Classics']);
      expect(book.copyright).toBe(false);
      expect(book.media_type).toBe('Text');
      expect(book.max_author_death_year).toBe(1817);
      expect(book.min_author_birth_year).toBe(1775);
      expect(book.formats['text/plain; charset=utf-8']).toBeDefined();
    });

    it('normalizes multi-line and whitespace title strings cleanly', () => {
      const row = [
        '4',
        'Text',
        '1973-11-01',
        'Lincoln\'s Gettysburg Address\nGiven November 19, 1863 on the battlefield',
        'en',
        'Lincoln, Abraham, 1809-1865',
        'Consecration of cemeteries',
        'E456',
        'US Civil War',
      ];

      const book = normalizeCsvRow(row);
      expect(book.title).toBe('Lincoln\'s Gettysburg Address Given November 19, 1863 on the battlefield');
    });
  });

  describe('upsertBatch', () => {
    it('successfully upserts a batch when Supabase returns no error', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      const mockSupabase = {
        from: () => ({ upsert: upsertMock }),
      };

      const testBatch = [{ id: 1, title: 'Book 1' }, { id: 2, title: 'Book 2' }];
      await upsertBatch(mockSupabase, testBatch, 1);

      expect(upsertMock).toHaveBeenCalledWith(testBatch, {
        onConflict: 'id',
        ignoreDuplicates: true,
      });

      // Explicit overwrite mode
      await upsertBatch(mockSupabase, testBatch, 1, false);
      expect(upsertMock).toHaveBeenLastCalledWith(testBatch, {
        onConflict: 'id',
        ignoreDuplicates: false,
      });
    });

    it('adaptively splits the batch in half when encountering statement timeout', async () => {
      const calls: any[][] = [];
      const mockSupabase = {
        from: () => ({
          upsert: vi.fn().mockImplementation((batch: any[]) => {
            calls.push(batch);
            if (batch.length > 25) {
              return Promise.resolve({ error: new Error('canceling statement due to statement timeout') });
            }
            return Promise.resolve({ error: null });
          }),
        }),
      };

      // 40 items: fails first (>25), then splits into 20 and 20 (both <= 25, so succeed)
      const testBatch = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, title: `Book ${i + 1}` }));
      await upsertBatch(mockSupabase, testBatch, 1);

      expect(calls.length).toBe(3); // 1 failed (40) + 2 succeeded (20 + 20)
      expect(calls[0].length).toBe(40);
      expect(calls[1].length).toBe(20);
      expect(calls[2].length).toBe(20);
    });
  });

  describe('syncPopularDownloadCounts', () => {
    it('fetches popular download counts from Gutendex and updates matching public.books rows', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          next: null,
          results: [
            { id: 1342, download_count: 55420 },
            { id: 84, download_count: 85210 },
          ],
        }),
      });

      const entries = await fetchPopularCountsFromGutendex(2, fetchMock);
      expect(entries).toEqual([
        { id: 1342, download_count: 55420 },
        { id: 84, download_count: 85210 },
      ]);

      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn(() => ({ eq: eqMock }));
      const mockSupabase = {
        from: vi.fn(() => ({ update: updateMock })),
      };
      const silentLogger = { log: vi.fn(), warn: vi.fn() };

      const res = await syncPopularDownloadCounts(mockSupabase, {
        pages: 1,
        fetchFn: fetchMock,
        logger: silentLogger,
      });
      expect(res.updatedCount).toBe(2);
      expect(res.demotedCount).toBe(0);
      expect(updateMock).toHaveBeenCalledWith({ download_count: 55420 });
      expect(eqMock).toHaveBeenCalledWith('id', 1342);
    });

    it('steps down cooled-off books in the top 1000 when entries reach minEntriesForDemote', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          next: null,
          results: [
            { id: 101, download_count: 1000 },
            { id: 102, download_count: 800 },
          ],
        }),
      });

      const updatedIds: number[] = [];
      const demotedChunks: number[][] = [];
      let demotedCountValue: number | null = null;

      // Existing top rows in Supabase:
      // - 101 (in fetched set, count 1000)
      // - 102 (in fetched set, count 800)
      // - 1342 (PROTECTED HERO classic, count 950 - must NEVER be demoted!)
      // - 555 (cooled-off book, count 850 >= minFetchedCount 800 -> must demote to 799)
      // - 666 (cooled-off book, count 750 < minFetchedCount 800 -> untouched)
      const topRows = [
        { id: 101, download_count: 1000 },
        { id: 1342, download_count: 950 },
        { id: 555, download_count: 850 },
        { id: 102, download_count: 800 },
        { id: 666, download_count: 750 },
      ];

      const orderMock = vi.fn(() => ({
        limit: vi.fn().mockResolvedValue({ data: topRows, error: null }),
      }));
      const selectMock = vi.fn(() => ({
        order: orderMock,
      }));

      const inMock = vi.fn().mockImplementation(async (_col: string, ids: number[]) => {
        demotedChunks.push(ids);
        return { error: null };
      });

      const eqMock = vi.fn().mockImplementation(async (_col: string, id: number) => {
        updatedIds.push(id);
        return { error: null };
      });

      const updateMock = vi.fn((payload: { download_count: number }) => {
        if (payload.download_count < 800) {
          demotedCountValue = payload.download_count;
        }
        return {
          eq: eqMock,
          in: inMock,
        };
      });

      const mockSupabase = {
        from: vi.fn(() => ({
          select: selectMock,
          update: updateMock,
        })),
      };
      const silentLogger = { log: vi.fn(), warn: vi.fn() };

      const res = await syncPopularDownloadCounts(mockSupabase, {
        pages: 1,
        fetchFn: fetchMock,
        minEntriesForDemote: 2, // Trigger demotion logic on test set of 2 entries
        logger: silentLogger,
      });

      expect(res.updatedCount).toBe(2);
      expect(res.demotedCount).toBe(1);
      expect(updatedIds).toEqual([101, 102]);
      expect(demotedCountValue).toBe(799); // minFetchedCount (800) - 1
      expect(demotedChunks).toEqual([[555]]);
      expect(orderMock).toHaveBeenCalledWith('download_count', { ascending: false });
    });

    it('gracefully handles network failures from Gutendex without throwing', async () => {
      const failFetch = vi.fn().mockRejectedValue(new Error('Gutendex unreachable'));
      const silentLogger = { log: vi.fn(), warn: vi.fn() };
      const mockSupabase = { from: vi.fn() };

      const res = await syncPopularDownloadCounts(mockSupabase, {
        pages: 1,
        fetchFn: failFetch,
        logger: silentLogger,
      });
      expect(res.updatedCount).toBe(0);
      expect(silentLogger.warn).toHaveBeenCalled();
    });
  });

  describe('Exact-Diff Catalog Metadata Comparison (hasCatalogMetadataChanged & filterChangedOrNewBooks)', () => {
    const baseBook = {
      id: 1342,
      title: 'Pride and Prejudice',
      authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
      translators: [],
      subjects: ['England -- Fiction', 'Love stories'],
      bookshelves: ['Best Books Ever'],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: buildStandardFormats(1342),
      max_author_death_year: 1817,
      min_author_birth_year: 1775,
    };

    it('ignores JSONB key-order differences when all catalog fields match byte-for-byte', () => {
      const existingFromPostgres = {
        id: 1342,
        title: 'Pride and Prejudice',
        // PostgreSQL JSONB returns keys sorted alphabetically
        authors: [{ birth_year: 1775, death_year: 1817, name: 'Austen, Jane' }],
        translators: [],
        subjects: ['England -- Fiction', 'Love stories'],
        bookshelves: ['Best Books Ever'],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        max_author_death_year: 1817,
        min_author_birth_year: 1775,
      };

      expect(areStringArraysEqual(['en'], ['en'])).toBe(true);
      expect(areContributorArraysEqual(existingFromPostgres.authors, baseBook.authors)).toBe(true);
      expect(hasCatalogMetadataChanged(existingFromPostgres, baseBook)).toBe(false);
    });

    it('detects even a single-character, single-space, or lifespan year change across any catalog field', () => {
      // Single character / space change in title
      expect(
        hasCatalogMetadataChanged(baseBook, { ...baseBook, title: 'Pride and  Prejudice' })
      ).toBe(true);

      // Author lifespan year added or corrected
      expect(
        hasCatalogMetadataChanged(
          {
            ...baseBook,
            authors: [{ name: 'Austen, Jane', birth_year: null, death_year: null }],
            max_author_death_year: null,
            min_author_birth_year: null,
          },
          baseBook
        )
      ).toBe(true);

      // Single space change inside a subject or bookshelf string
      expect(
        hasCatalogMetadataChanged(baseBook, {
          ...baseBook,
          subjects: ['England -- Fiction', 'Love  stories'],
        })
      ).toBe(true);

      // Translator or language change
      expect(
        hasCatalogMetadataChanged(baseBook, {
          ...baseBook,
          translators: [{ name: 'Maude, Aylmer', birth_year: 1858, death_year: 1938 }],
        })
      ).toBe(true);
      expect(
        hasCatalogMetadataChanged(baseBook, {
          ...baseBook,
          languages: ['en', 'fr'],
        })
      ).toBe(true);
    });

    it('deduplicates duplicate book IDs within a batch and filters out unchanged rows while preserving quotes isolation', async () => {
      const duplicateBatch = [
        { ...baseBook, id: 1342, title: 'Old Duplicate Row' },
        { ...baseBook, id: 1342, title: 'Pride and Prejudice' }, // Unchanged vs DB
        { ...baseBook, id: 84, title: 'Frankenstein; Or, The Modern Prometheus (Revised)' }, // Changed title vs DB
        { ...baseBook, id: 78001, title: 'Brand New Release' }, // New book not in DB
      ];

      expect(deduplicateBatchById(duplicateBatch)).toHaveLength(3);
      expect(CATALOG_DIFF_SELECT_COLUMNS).not.toContain('quotes');
      expect(CATALOG_DIFF_SELECT_COLUMNS).not.toContain('download_count');

      const inMock = vi.fn().mockResolvedValue({
        data: [
          { ...baseBook, id: 1342, title: 'Pride and Prejudice' },
          { ...baseBook, id: 84, title: 'Frankenstein; Or, The Modern Prometheus' },
        ],
        error: null,
      });
      const selectMock = vi.fn(() => ({ in: inMock }));
      const mockSupabase = {
        from: vi.fn(() => ({ select: selectMock })),
      };

      const result = await filterChangedOrNewBooks(mockSupabase, duplicateBatch, false);
      expect(selectMock).toHaveBeenCalledWith(CATALOG_DIFF_SELECT_COLUMNS);
      expect(inMock).toHaveBeenCalledWith('id', [1342, 84, 78001]);
      expect(result.insertedCount).toBe(1);
      expect(result.updatedCount).toBe(1);
      expect(result.unchangedCount).toBe(1);
      expect(result.toUpsert.map((b: { id: number }) => b.id)).toEqual([84, 78001]);
      for (const row of result.toUpsert) {
        expect(row).not.toHaveProperty('quotes');
      }

      // Force overwrite mode (--update-existing) returns all deduplicated rows
      const forced = await filterChangedOrNewBooks(mockSupabase, duplicateBatch, true);
      expect(forced.toUpsert).toHaveLength(3);
      expect(forced.updatedCount).toBe(3);
    });
  });

  describe('Withdrawn-Book Reconciliation & Pruning (reconcileWithdrawnCatalogBooks)', () => {
    it('skips pruning if activeCatalogIds is below the safety floor', async () => {
      const silentLogger = { log: vi.fn(), warn: vi.fn() };
      const mockSupabase = { from: vi.fn() };
      const smallSet = new Set([1, 2, 3]);

      const res = await reconcileWithdrawnCatalogBooks(mockSupabase, smallSet, {
        minCatalogSize: 50000,
        logger: silentLogger,
      });

      expect(res.prunedCount).toBe(0);
      expect(res.skippedReason).toBe('below-min-catalog-floor');
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('scans public.books via keyset pagination, protects Hero classics, and deletes withdrawn book IDs', async () => {
      const silentLogger = { log: vi.fn(), warn: vi.fn() };
      const activeIds = new Set([100, 200, 300]);
      const deletedChunks: number[][] = [];

      // DB has: 100 (active), 200 (active), 1342 (protected hero classic), 78050 (withdrawn), 78051 (withdrawn)
      const dbPages = [
        [{ id: 100 }, { id: 200 }, { id: 1342 }],
        [{ id: 78050 }, { id: 78051 }],
      ];
      let pageCall = 0;

      const gtSpy = vi.fn((_col: string, _val: number) => ({
        order: orderSpy,
      }));
      const orderSpy = vi.fn((_col: string, _opts: { ascending: boolean }) => ({
        limit: vi.fn().mockImplementation(async () => ({
          data: dbPages[pageCall++] || [],
          error: null,
        })),
      }));
      const deleteInSpy = vi.fn().mockImplementation(async (_col: string, ids: number[]) => {
        deletedChunks.push(ids);
        return { error: null };
      });

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            gt: gtSpy,
          })),
          delete: vi.fn(() => ({
            in: deleteInSpy,
          })),
        })),
      };

      const res = await reconcileWithdrawnCatalogBooks(mockSupabase, activeIds, {
        minCatalogSize: 3,
        pageSize: 3,
        deleteChunkSize: 1,
        logger: silentLogger,
      });

      expect(gtSpy).toHaveBeenCalledWith('id', 0);
      expect(gtSpy).toHaveBeenCalledWith('id', 1342);
      expect(orderSpy).toHaveBeenCalledWith('id', { ascending: true });
      expect(deleteInSpy).toHaveBeenCalledWith('id', [78050]);
      expect(deleteInSpy).toHaveBeenCalledWith('id', [78051]);
      expect(res.prunedCount).toBe(2);
      expect(res.prunedIds).toEqual([78050, 78051]);
      expect(deletedChunks).toEqual([[78050], [78051]]);
    });

    it('triggers the maxPrunePerRun safety circuit breaker when candidate removals exceed cap', async () => {
      const silentLogger = { log: vi.fn(), warn: vi.fn() };
      const activeIds = new Set([100, 200, 300]);
      const deleteMock = vi.fn();

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            gt: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: [{ id: 78001 }, { id: 78002 }, { id: 78003 }],
                  error: null,
                }),
              })),
            })),
          })),
          delete: deleteMock,
        })),
      };

      const res = await reconcileWithdrawnCatalogBooks(mockSupabase, activeIds, {
        minCatalogSize: 3,
        maxPrunePerRun: 2,
        pageSize: 10,
        logger: silentLogger,
      });

      expect(res.prunedCount).toBe(0);
      expect(res.skippedReason).toBe('exceeded-max-prune-cap');
      expect(deleteMock).not.toHaveBeenCalled();
    });
  });
});

