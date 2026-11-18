import { describe, it, expect, vi } from 'vitest';
import { Readable } from 'stream';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const syncGutenbergCatalog = require('./sync-gutenberg-catalog');
const {
  resolveSiteOriginFallback,
  resolveRepositoryOrSiteUrl,
  resolveCatalogUserAgent,
  CATALOG_DIFF_SELECT_COLUMNS,
  GUTENBERG_RDF_FEED_MIRRORS,
  GUTENBERG_CSV_FEED_MIRRORS,
  parseContributors,
  computeLifespanBounds,
  buildStandardFormats,
  normalizeCsvRow,
  resolveFeedMirrors,
  isHtmlContentType,
  isAllowedRdfFeedUrl,
  isAllowedCsvFeedUrl,
  isRdfCopyrightedNotice,
  parseRdfCatalogSignalsStream,
  parseRdfDownloadCountsStream,
  streamRdfMirrorOnce,
  streamGutenbergRdfCatalogSignals,
  streamGutenbergRdfDownloadCounts,
  streamCatalogMirrorOnce,
  streamGutenbergCatalog,
  areStringArraysEqual,
  areContributorArraysEqual,
  hasCatalogMetadataChanged,
  deduplicateBatchById,
  isTransientDatabaseTimeout,
  filterChangedOrNewBooks,
  getDynamicWriteChunkSize,
  resetDynamicWriteChunkSize,
  upsertBatch,
  reconcileWithdrawnCatalogBooks,
  extractCacheableBookRecord,
  computeSha256Hex,
  parseSha256SidecarText,
  isSha256TimingSafeEqual,
  loadCatalogSnapshotCache,
  saveCatalogSnapshotCache,
  appendCatalogStepSummary,
  computeCatalogQuotePoolDiff,
  reconcileBatchWithoutRdfRights,
} = syncGutenbergCatalog;

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

    it('sets maxDeath to null when any author or translator has completely unlisted dates under Berne Art. 7bis joint authorship', () => {
      const authors = [
        { name: 'Known Author', birth_year: 1800, death_year: 1860 },
        { name: 'Unlisted Co-Author', birth_year: null, death_year: null },
      ];
      const bounds = computeLifespanBounds(authors, []);
      expect(bounds.maxDeath).toBeNull();
      expect(bounds.minBirth).toBe(1800);

      const translators = [
        { name: 'Unlisted Translator', birth_year: null, death_year: null },
      ];
      const translatorBounds = computeLifespanBounds([{ name: 'Author', birth_year: 1800, death_year: 1850 }], translators);
      expect(translatorBounds.maxDeath).toBeNull();
    });

    it('uses 100-year longevity heuristic when birth year is known but death year is null', () => {
      const authors = [
        { name: 'Long-Lived Author', birth_year: 1820, death_year: null },
      ];
      const bounds = computeLifespanBounds(authors, []);
      expect(bounds.minBirth).toBe(1820);
      expect(bounds.maxDeath).toBe(1920); // 1820 + 100
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
      expect(CATALOG_DIFF_SELECT_COLUMNS).toContain('download_count');

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

    it('retries in place and adaptively splits .in(id, batchIds) when encountering connection pool timeouts', async () => {
      expect(
        isTransientDatabaseTimeout(new Error('Timed out acquiring connection from connection pool.'))
      ).toBe(true);
      expect(isTransientDatabaseTimeout(new Error('canceling statement due to statement timeout'))).toBe(
        true
      );
      expect(isTransientDatabaseTimeout(new Error('syntax error at or near SELECT'))).toBe(false);

      // 1. Small batch (<= 25): retries in place on the exact same batchIds when pool times out once
      let smallCallCount = 0;
      const smallInMock = vi.fn().mockImplementation(async (_col: string, ids: number[]) => {
        smallCallCount++;
        if (smallCallCount === 1) {
          return {
            data: null,
            error: new Error('Timed out acquiring connection from connection pool.'),
          };
        }
        return {
          data: ids.map((id) => ({ ...baseBook, id, title: `Book ${id}` })),
          error: null,
        };
      });
      const smallSupabase = {
        from: vi.fn(() => ({ select: vi.fn(() => ({ in: smallInMock })) })),
      };
      const smallBatch = [
        { ...baseBook, id: 1, title: 'Book 1' },
        { ...baseBook, id: 2, title: 'Book 2 (Updated)' },
      ];
      const smallRes = await filterChangedOrNewBooks(smallSupabase, smallBatch, false, {
        retries: 3,
        baseDelayMs: 0,
      });
      expect(smallCallCount).toBe(2);
      expect(smallRes.unchangedCount).toBe(1);
      expect(smallRes.updatedCount).toBe(1);
      expect(smallRes.toUpsert.map((b: { id: number }) => b.id)).toEqual([2]);

      // 2. Large batch (> 25): adaptively splits batchIds in half when pool times out
      const queriedIdChunks: number[][] = [];
      const largeInMock = vi.fn().mockImplementation(async (_col: string, ids: number[]) => {
        queriedIdChunks.push(ids);
        if (ids.length > 25) {
          return {
            data: null,
            error: new Error('Timed out acquiring connection from connection pool.'),
          };
        }
        return {
          data: ids.map((id) => ({ ...baseBook, id, title: `Book ${id}` })),
          error: null,
        };
      });
      const largeSupabase = {
        from: vi.fn(() => ({ select: vi.fn(() => ({ in: largeInMock })) })),
      };
      const largeBatch = Array.from({ length: 40 }, (_, i) => ({
        ...baseBook,
        id: i + 1,
        title: i === 39 ? 'Book 40 Revised' : `Book ${i + 1}`,
      }));

      const largeRes = await filterChangedOrNewBooks(largeSupabase, largeBatch, false, {
        retries: 2,
        baseDelayMs: 0,
      });
      expect(queriedIdChunks).toHaveLength(3); // 40 (failed) -> 20 + 20 (succeeded)
      expect(queriedIdChunks[0]).toHaveLength(40);
      expect(queriedIdChunks[1]).toHaveLength(20);
      expect(queriedIdChunks[2]).toHaveLength(20);
      expect(largeRes.unchangedCount).toBe(39);
      expect(largeRes.updatedCount).toBe(1);
      expect(largeRes.toUpsert.map((b: { id: number }) => b.id)).toEqual([40]);
    });

    it('re-checks database state before retrying a timed-out upsertBatch so already-updated books are not re-sent', async () => {
      const upsertedBatches: Array<Array<{ id: number; title: string }>> = [];

      // Simulate: Book 10 and Book 20 are sent in attempt 1, which times out AFTER Book 10 was already committed in DB
      const inMock = vi.fn().mockResolvedValue({
        data: [
          { ...baseBook, id: 10, title: 'Book 10 Updated' }, // Already committed before timeout!
          { ...baseBook, id: 20, title: 'Book 20 Old Title' }, // Still needs update
        ],
        error: null,
      });

      let upsertAttempt = 0;
      const upsertMock = vi.fn().mockImplementation(async (rows: Array<{ id: number; title: string }>) => {
        upsertAttempt++;
        upsertedBatches.push(rows);
        if (upsertAttempt === 1) {
          return { error: new Error('Timed out acquiring connection from connection pool.') };
        }
        return { error: null };
      });

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({ in: inMock })),
          upsert: upsertMock,
        })),
      };

      const batchToWrite = [
        { ...baseBook, id: 10, title: 'Book 10 Updated' },
        { ...baseBook, id: 20, title: 'Book 20 New Title' },
      ];

      await upsertBatch(mockSupabase, batchToWrite, 3, false, { baseDelayMs: 0 });

      expect(upsertedBatches).toHaveLength(2);
      expect(upsertedBatches[0].map((b) => b.id)).toEqual([10, 20]);
      // Second attempt only retries Book 20 because Book 10 was verified as already updated in DB!
      expect(upsertedBatches[1].map((b) => b.id)).toEqual([20]);
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
      expect(res.scannedCount).toBe(5);
      expect(res.remainingCount).toBe(3);
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

    it('retries keyset scan and delete chunks in place when encountering transient connection pool timeouts', async () => {
      const silentLogger = { log: vi.fn(), warn: vi.fn() };
      const activeIds = new Set([100, 200]);

      let scanCalls = 0;
      let deleteCalls = 0;

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            gt: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockImplementation(async () => {
                  scanCalls++;
                  if (scanCalls === 1) {
                    return {
                      data: null,
                      error: new Error('Timed out acquiring connection from connection pool.'),
                    };
                  }
                  return {
                    data: [{ id: 100 }, { id: 78099 }],
                    error: null,
                  };
                }),
              })),
            })),
          })),
          delete: vi.fn(() => ({
            in: vi.fn().mockImplementation(async () => {
              deleteCalls++;
              if (deleteCalls === 1) {
                return { error: new Error('Timed out acquiring connection from connection pool.') };
              }
              return { error: null };
            }),
          })),
        })),
      };

      const res = await reconcileWithdrawnCatalogBooks(mockSupabase, activeIds, {
        minCatalogSize: 2,
        pageSize: 10,
        retries: 3,
        baseDelayMs: 0,
        logger: silentLogger,
      });

      expect(scanCalls).toBe(2);
      expect(deleteCalls).toBe(2);
      expect(res.prunedCount).toBe(1);
      expect(res.prunedIds).toEqual([78099]);
    });
  });

  describe('Unified RDF Download Counts & Rights Stream, Mirror Failover & Single-Batch Diff Integration', () => {
    it('extracts bookId, download_count, and <dcterms:rights> copyrighted IDs from multi-chunk RDF XML streams', async () => {
      const rdfChunks = [
        '<?xml version="1.0" encoding="utf-8"?>\n<rdf:RDF>\n  <pgterms:ebook rdf:about="ebooks/1342">\n',
        '    <dcterms:title>Pride and Prejudice</dcterms:title>\n    <dcterms:rights>Public domain in the USA.</dcterms:rights>\n    <pgterms:downloads rdf:datatype="http://www.w3.org/2001/XMLSchema#integer">55420</pgt',
        'erms:downloads>\n  </pgterms:ebook>\n</rdf:RDF>\n<rdf:RDF>\n  <pgterms:ebook rdf:about="ebooks/90123">\n    <dcterms:rights>\n      Copyrighted. Read the copyright notice inside this book for details.\n    </dcterms:rights>\n    <pgterms:downloads rdf:datatype="http://www.w3.org/2001/XMLSchema#integer">120</pgterms:downloads>\n  </pgterms:ebook>\n</rdf:RDF>',
      ];

      expect(isRdfCopyrightedNotice('Copyrighted. Read the copyright notice inside this book for details.')).toBe(true);
      expect(isRdfCopyrightedNotice('Public domain in the USA.')).toBe(false);
      expect(isRdfCopyrightedNotice('Not copyrighted in any territory.')).toBe(false);
      expect(isRdfCopyrightedNotice('')).toBe(false);

      const signals = await parseRdfCatalogSignalsStream(Readable.from(rdfChunks));
      expect(signals.downloadCounts.get(1342)).toBe(55420);
      expect(signals.downloadCounts.get(90123)).toBe(120);
      expect(signals.downloadCounts.size).toBe(2);
      expect(signals.copyrightedIds.has(90123)).toBe(true);
      expect(signals.copyrightedIds.has(1342)).toBe(false);

      const countsMap = await parseRdfDownloadCountsStream(Readable.from(rdfChunks));
      expect(countsMap.get(1342)).toBe(55420);
      expect(countsMap.get(90123)).toBe(120);
    });

    it('enforces PGLAF-first mirror priority, resolves --feed-source pinning, rejects HTML outage responses, and fails over cleanly', async () => {
      expect(GUTENBERG_RDF_FEED_MIRRORS).toEqual([
        'https://gutenberg.pglaf.org/cache/epub/feeds/rdf-files.tar.bz2',
        'https://aleph.gutenberg.org/cache/epub/feeds/rdf-files.tar.bz2',
      ]);
      expect(resolveFeedMirrors(GUTENBERG_RDF_FEED_MIRRORS, 'auto')).toEqual(GUTENBERG_RDF_FEED_MIRRORS);
      expect(resolveFeedMirrors(GUTENBERG_CSV_FEED_MIRRORS, 'aleph.gutenberg.org')).toEqual([
        'https://aleph.gutenberg.org/cache/epub/feeds/pg_catalog.csv.gz',
      ]);
      expect(resolveFeedMirrors(GUTENBERG_RDF_FEED_MIRRORS, 'gutenberg.pglaf.org')).toEqual([
        'https://gutenberg.pglaf.org/cache/epub/feeds/rdf-files.tar.bz2',
      ]);
      expect(() => resolveFeedMirrors(GUTENBERG_CSV_FEED_MIRRORS, 'www.gutenberg.org')).toThrow(
        /Unsupported --feed-source/
      );
      expect(() => resolveFeedMirrors(GUTENBERG_CSV_FEED_MIRRORS, 'evil.example.com')).toThrow(
        /Unsupported --feed-source/
      );

      expect(isHtmlContentType('text/html; charset=utf-8')).toBe(true);
      expect(isHtmlContentType('application/xhtml+xml')).toBe(true);
      expect(isHtmlContentType('application/x-gzip')).toBe(false);

      expect(isAllowedRdfFeedUrl('https://www.gutenberg.org/cache/epub/feeds/rdf-files.tar.bz2')).toBe(
        false
      );
      expect(isAllowedRdfFeedUrl('https://gutenberg.pglaf.org/cache/epub/feeds/rdf-files.tar.bz2')).toBe(
        true
      );
      expect(isAllowedRdfFeedUrl('https://aleph.gutenberg.org/cache/epub/feeds/rdf-files.tar.bz2')).toBe(
        true
      );
      expect(isAllowedRdfFeedUrl('http://gutenberg.pglaf.org/cache/epub/feeds/rdf-files.tar.bz2')).toBe(
        false
      );
      expect(isAllowedRdfFeedUrl('https://evil.example.com/rdf-files.tar.bz2')).toBe(false);

      const makeHtmlResponseHttpsGet = () => (_url: string, _opts: unknown, cb: (res: Readable) => void) => {
        const res = Readable.from(['<!DOCTYPE html><html>Maintenance</html>']) as Readable & {
          statusCode?: number;
          statusMessage?: string;
          headers?: Record<string, string>;
        };
        res.statusCode = 200;
        res.statusMessage = 'OK';
        res.headers = { 'content-type': 'text/html; charset=utf-8' };
        queueMicrotask(() => cb(res));
        const reqStub = Readable.from([]) as Readable & { setTimeout?: () => void };
        return reqStub;
      };

      await expect(
        streamRdfMirrorOnce(GUTENBERG_RDF_FEED_MIRRORS[0], {
          httpsGet: makeHtmlResponseHttpsGet(),
        })
      ).rejects.toThrow(/HTML outage response/);

      await expect(
        streamCatalogMirrorOnce(vi.fn(), GUTENBERG_CSV_FEED_MIRRORS[0], {
          httpsGet: makeHtmlResponseHttpsGet(),
        })
      ).rejects.toThrow(/HTML outage response/);

      const silentLogger = { log: vi.fn(), warn: vi.fn() };
      const streamMirrorFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Mirror 1 connection reset'))
        .mockResolvedValueOnce({
          downloadCounts: new Map([
            [1342, 55420],
            [90123, 120],
          ]),
          copyrightedIds: new Set([90123]),
        });

      const rdfSignals = await streamGutenbergRdfCatalogSignals({
        mirrors: [
          'https://evil.example.com/ignored.tar.bz2',
          'https://gutenberg.pglaf.org/cache/epub/feeds/rdf-files.tar.bz2',
          'https://aleph.gutenberg.org/cache/epub/feeds/rdf-files.tar.bz2',
        ],
        streamMirrorFn,
        logger: silentLogger,
      });

      expect(streamMirrorFn).toHaveBeenCalledTimes(2);
      expect(rdfSignals.hasRightsData).toBe(true);
      expect(rdfSignals.downloadCounts.get(1342)).toBe(55420);
      expect(rdfSignals.copyrightedIds?.has(90123)).toBe(true);

      const legacyCountsMap = await streamGutenbergRdfDownloadCounts({
        mirrors: [GUTENBERG_RDF_FEED_MIRRORS[0]],
        streamMirrorFn: vi.fn().mockResolvedValueOnce(new Map([[1342, 55420]])),
        logger: silentLogger,
      });
      expect(legacyCountsMap.get(1342)).toBe(55420);
    });

    it('attaches download_count and RDF copyright flags in normalizeCsvRow, preserves cached flags on outage, and detects copyright diffs', () => {
      const sampleRow = [
        '1342',
        'Text',
        '1998-06-01',
        'Pride and Prejudice',
        'en',
        'Austen, Jane, 1775-1817',
        'England -- Fiction',
        'PR',
        'Best Books Ever',
      ];
      const copyrightedRow = [
        '90123',
        'Text',
        '2025-01-01',
        'Donated Copyrighted Work',
        'en',
        'Author, Modern, 1965-',
        'Fiction',
        'PS',
        '',
      ];
      const rdfSignals = {
        downloadCounts: new Map([
          [1342, 55420],
          [90123, 120],
        ]),
        copyrightedIds: new Set([90123]),
      };

      const withSignals = normalizeCsvRow(sampleRow, rdfSignals);
      expect(withSignals.download_count).toBe(55420);
      expect(withSignals.copyright).toBe(false);

      const flaggedCopyrighted = normalizeCsvRow(copyrightedRow, rdfSignals);
      expect(flaggedCopyrighted.download_count).toBe(120);
      expect(flaggedCopyrighted.copyright).toBe(true);

      // Old snapshot cache row with copyright: false upgrades automatically via hasCatalogMetadataChanged
      expect(
        hasCatalogMetadataChanged({ ...flaggedCopyrighted, copyright: false }, flaggedCopyrighted)
      ).toBe(true);

      // On --no-rdf / failed RDF outage, cached copyright: true is preserved rather than wiped to false
      const preservedDuringOutage = normalizeCsvRow(
        copyrightedRow,
        { downloadCounts: new Map(), copyrightedIds: null },
        { id: 90123, copyright: true }
      );
      expect(preservedDuringOutage.copyright).toBe(true);
      expect(preservedDuringOutage).not.toHaveProperty('download_count');

      // Quote pool diff excludes copyrighted volumes from both popular and recent tiers
      const quoteDiff = computeCatalogQuotePoolDiff(
        new Map([
          [1342, extractCacheableBookRecord(withSignals)],
          [90123, extractCacheableBookRecord(flaggedCopyrighted)],
        ])
      );
      expect(quoteDiff.candidatePoolIds).toEqual([1342]);

      const countsMap = new Map([[1342, 55420]]);
      const defaultedZero = normalizeCsvRow(
        ['84', 'Text', '1993-10-01', 'Frankenstein', 'en', 'Shelley, Mary, 1797-1851', '', 'PR', ''],
        countsMap
      );
      expect(defaultedZero.download_count).toBe(0);

      const withoutMap = normalizeCsvRow(sampleRow, null);
      expect(withoutMap).not.toHaveProperty('download_count');

      const existingRow = { ...withSignals, download_count: 54000 };
      expect(hasCatalogMetadataChanged(existingRow, withSignals)).toBe(true);
      expect(hasCatalogMetadataChanged({ ...withSignals, download_count: 55420 }, withSignals)).toBe(
        false
      );
      expect(hasCatalogMetadataChanged(existingRow, withoutMap)).toBe(false);
    });

    it('supports PGLAF-first mirror failover for pg_catalog.csv.gz and sticky dynamic write chunk sizing in upsertBatch', async () => {
      expect(GUTENBERG_CSV_FEED_MIRRORS).toEqual([
        'https://gutenberg.pglaf.org/cache/epub/feeds/pg_catalog.csv.gz',
        'https://aleph.gutenberg.org/cache/epub/feeds/pg_catalog.csv.gz',
      ]);
      expect(isAllowedCsvFeedUrl('https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv.gz')).toBe(
        false
      );
      expect(isAllowedCsvFeedUrl('https://aleph.gutenberg.org/cache/epub/feeds/pg_catalog.csv.gz')).toBe(
        true
      );
      expect(isAllowedCsvFeedUrl('https://evil.example.com/pg_catalog.csv.gz')).toBe(false);

      const silentLogger = { log: vi.fn(), warn: vi.fn() };
      const emittedRows: string[][] = [];
      const streamMirrorFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('CSV mirror 1 timeout'))
        .mockImplementationOnce(async (onRecord: (row: string[]) => Promise<void> | void) => {
          await onRecord(['1342', 'Text', '1998-06-01', 'Pride and Prejudice', 'en', 'Austen, Jane', '', 'PR', '']);
        });

      await streamGutenbergCatalog(
        async (row: string[]) => {
          await new Promise((r) => setTimeout(r, 5));
          emittedRows.push(row);
        },
        {
          mirrors: GUTENBERG_CSV_FEED_MIRRORS,
          streamMirrorFn,
          logger: silentLogger,
        }
      );
      expect(streamMirrorFn).toHaveBeenCalledTimes(2);
      expect(emittedRows).toHaveLength(1);

      // Verify sticky dynamicWriteChunkSize steps down when a statement timeout occurs
      resetDynamicWriteChunkSize(100);
      expect(getDynamicWriteChunkSize()).toBe(100);

      let callNum = 0;
      const chunkLengths: number[] = [];
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
          upsert: vi.fn().mockImplementation(async (rows: Array<{ id: number }>) => {
            callNum++;
            chunkLengths.push(rows.length);
            if (callNum === 1) {
              return { error: new Error('canceling statement due to statement timeout') };
            }
            return { error: null };
          }),
        })),
      };

      const batch80 = Array.from({ length: 80 }, (_, idx) => ({
        id: idx + 1,
        title: `Volume ${idx + 1}`,
      }));

      await upsertBatch(mockSupabase, batch80, 3, false, { baseDelayMs: 0 });
      // 80 failed on attempt 1 -> split into 40 + 40 and sticky dynamicWriteChunkSize stepped down to 40
      expect(chunkLengths).toEqual([80, 40, 40]);
      expect(getDynamicWriteChunkSize()).toBe(40);
      resetDynamicWriteChunkSize(100);
    });
  });

  describe('Permanent Catalog Snapshot Cache & Quote Pool Diff Engine', () => {
    it('saves and loads compressed .json.gz snapshot caches and enforces the minCatalogSize safety floor', () => {
      const tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-catalog-cache-'));
      const cacheFile = path.join(tmpDir, 'gutenberg-catalog-cache.json.gz');
      const silentLogger = { log: vi.fn(), warn: vi.fn() };

      try {
        // Missing file returns empty state safely
        const missing = loadCatalogSnapshotCache(cacheFile, { logger: silentLogger });
        expect(missing.loaded).toBe(false);
        expect(missing.booksById.size).toBe(0);

        const booksById = new Map([
          [
            1342,
            extractCacheableBookRecord({
              id: 1342,
              title: 'Pride and Prejudice',
              authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
              languages: ['en'],
              download_count: 90000,
              copyright: false,
            }),
          ],
          [
            84,
            extractCacheableBookRecord({
              id: 84,
              title: 'Frankenstein',
              authors: [{ name: 'Shelley, Mary', birth_year: 1797, death_year: 1851 }],
              languages: ['en'],
              download_count: 80000,
              copyright: false,
            }),
          ],
        ]);

        // Below safety floor -> refuses to overwrite cache
        const blocked = saveCatalogSnapshotCache(cacheFile, booksById, [1342, 84], {
          minCatalogSize: 50000,
          logger: silentLogger,
        });
        expect(blocked.saved).toBe(false);
        expect(blocked.skippedReason).toBe('below-min-catalog-floor');
        expect(fs.existsSync(cacheFile)).toBe(false);

        // Meets safety floor -> writes compressed .json.gz + .sha256 sidecar and round-trips via loadCatalogSnapshotCache
        const saved = saveCatalogSnapshotCache(cacheFile, booksById, [1342, 84], {
          minCatalogSize: 2,
          logger: silentLogger,
        });
        expect(saved.saved).toBe(true);
        expect(saved.count).toBe(2);
        expect(saved.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(fs.existsSync(cacheFile)).toBe(true);
        expect(fs.existsSync(`${cacheFile}.sha256`)).toBe(true);

        const loaded = loadCatalogSnapshotCache(cacheFile, { logger: silentLogger });
        expect(loaded.loaded).toBe(true);
        expect(loaded.checksumVerified).toBe(true);
        expect(loaded.sha256).toBe(saved.sha256);
        expect(loaded.booksById.size).toBe(2);
        expect(loaded.booksById.get(1342).title).toBe('Pride and Prejudice');
        expect(Array.from(loaded.candidatePoolIds)).toEqual([1342, 84]);

        // Tampered .sha256 sidecar -> fails closed cleanly
        const warnLogger = { log: vi.fn(), warn: vi.fn() };
        const originalSha = fs.readFileSync(`${cacheFile}.sha256`, 'utf8');
        fs.writeFileSync(`${cacheFile}.sha256`, `${'f'.repeat(64)}  gutenberg-catalog-cache.json.gz\n`, 'utf8');
        const tamperedShaResult = loadCatalogSnapshotCache(cacheFile, { logger: warnLogger });
        expect(tamperedShaResult.loaded).toBe(false);
        expect(tamperedShaResult.checksumVerified).toBe(false);
        expect(warnLogger.warn).toHaveBeenCalledWith(expect.stringContaining('SHA-256 verification failed'));

        // Legacy snapshot missing .sha256 -> loads with notice unless requireChecksum: true
        fs.unlinkSync(`${cacheFile}.sha256`);
        const legacyLoaded = loadCatalogSnapshotCache(cacheFile, { logger: warnLogger });
        expect(legacyLoaded.loaded).toBe(true);
        expect(legacyLoaded.checksumVerified).toBe(false);
        const strictMissing = loadCatalogSnapshotCache(cacheFile, {
          requireChecksum: true,
          logger: warnLogger,
        });
        expect(strictMissing.loaded).toBe(false);

        // Restore valid sidecar, then tamper gzip archive payload -> rejects
        fs.writeFileSync(`${cacheFile}.sha256`, originalSha, 'utf8');
        fs.writeFileSync(cacheFile, zlib.gzipSync(Buffer.from('{"books":[{"id":999,"title":"Tampered"}]}')));
        const tamperedArchive = loadCatalogSnapshotCache(cacheFile, { logger: warnLogger });
        expect(tamperedArchive.loaded).toBe(false);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('diffs incoming batches and reconciles withdrawn books 100% in RAM without querying Supabase when cachedBooksById is provided', async () => {
      const selectSpy = vi.fn();
      const deleteInSpy = vi.fn().mockResolvedValue({ error: null });
      const mockSupabase = {
        from: vi.fn(() => ({
          select: selectSpy,
          delete: vi.fn(() => ({
            in: deleteInSpy,
          })),
        })),
      };

      const base1342 = extractCacheableBookRecord({
        id: 1342,
        title: 'Pride and Prejudice',
        authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
        languages: ['en'],
        download_count: 90000,
        copyright: false,
      });
      const base84 = extractCacheableBookRecord({
        id: 84,
        title: 'Frankenstein',
        authors: [{ name: 'Shelley, Mary', birth_year: 1797, death_year: 1851 }],
        languages: ['en'],
        download_count: 80000,
        copyright: false,
      });

      const cachedBooksById = new Map([
        [1342, base1342],
        [84, base84],
        [78050, extractCacheableBookRecord({ id: 78050, title: 'Withdrawn Vol' })],
      ]);

      const incomingBatch = [
        { ...base1342 }, // unchanged
        { ...base84, download_count: 82500 }, // updated download_count
        extractCacheableBookRecord({ id: 2701, title: 'Moby Dick', download_count: 65000 }), // newly inserted
      ];

      const diffRes = await filterChangedOrNewBooks(mockSupabase, incomingBatch, false, {
        cachedBooksById,
      });
      expect(selectSpy).not.toHaveBeenCalled();
      expect(diffRes.unchangedCount).toBe(1);
      expect(diffRes.updatedCount).toBe(1);
      expect(diffRes.insertedCount).toBe(1);
      expect(diffRes.toUpsert.map((b: { id: number }) => b.id)).toEqual([84, 2701]);

      const silentLogger = { log: vi.fn(), warn: vi.fn() };
      const reconcileRes = await reconcileWithdrawnCatalogBooks(
        mockSupabase,
        new Set([1342, 84, 2701]),
        {
          minCatalogSize: 3,
          cachedBookIds: new Set(cachedBooksById.keys()),
          logger: silentLogger,
        }
      );
      expect(selectSpy).not.toHaveBeenCalled();
      expect(reconcileRes.prunedCount).toBe(1);
      expect(reconcileRes.prunedIds).toEqual([78050]);
      expect(deleteInSpy).toHaveBeenCalledWith('id', [78050]);
    });

    it('computes Two-Tier quote pool promotedIds, demotedIds, and candidatePoolIds and writes quote-diff.json', () => {
      const tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-quote-diff-'));
      const diffFile = path.join(tmpDir, 'quote-diff.json');
      try {
        const booksById = new Map([
          [
            1342,
            extractCacheableBookRecord({
              id: 1342,
              title: 'Pride and Prejudice',
              languages: ['en'],
              download_count: 90000,
            }),
          ],
          [
            84,
            extractCacheableBookRecord({
              id: 84,
              title: 'Frankenstein',
              languages: ['en'],
              download_count: 80000,
            }),
          ],
          [
            79001,
            extractCacheableBookRecord({
              id: 79001,
              title: 'Brand New Release',
              languages: ['en'],
              download_count: 10,
            }),
          ],
        ]);

        const previousPool = new Set([1342, 55555]);
        const diff = computeCatalogQuotePoolDiff(booksById, previousPool, {
          popularPool: 2,
          recentPool: 1,
          diffOutputPath: diffFile,
        });

        expect(diff.popularPoolIds).toEqual([1342, 84]);
        expect(diff.recentPoolIds).toEqual([79001]);
        expect(diff.candidatePoolIds).toEqual([1342, 84, 79001]);
        expect(diff.promotedIds).toEqual([84, 79001]);
        expect(diff.demotedIds).toEqual([55555]);
        expect(fs.existsSync(diffFile)).toBe(true);

        const parsedOnDisk = JSON.parse(fs.readFileSync(diffFile, 'utf8'));
        expect(parsedOnDisk.promotedIds).toEqual([84, 79001]);
        expect(parsedOnDisk.demotedIds).toEqual([55555]);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('resolveSiteOriginFallback & resolveCatalogUserAgent', () => {
    it('resolves canonical site origins across NEXT_PUBLIC_SITE_URL and normalized Vercel production vars', () => {
      expect(resolveSiteOriginFallback({})).toBe('https://bookarium.vercel.app');
      expect(
        resolveSiteOriginFallback({
          VERCEL_PROJECT_PRODUCTION_URL: 'bookarium.ro/',
        })
      ).toBe('https://bookarium.ro');
      expect(
        resolveSiteOriginFallback({
          NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: 'cdn.bookarium.ro',
          VERCEL_PROJECT_PRODUCTION_URL: 'ignored.example.com',
        })
      ).toBe('https://cdn.bookarium.ro');
      expect(
        resolveSiteOriginFallback({
          NEXT_PUBLIC_SITE_URL: 'https://primary.bookarium.ro///',
          NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: 'cdn.bookarium.ro',
        })
      ).toBe('https://primary.bookarium.ro');
      expect(
        resolveSiteOriginFallback({
          NEXT_PUBLIC_SITE_URL: 'javascript:alert(1)',
          VERCEL_PROJECT_PRODUCTION_URL: 'http://localhost:3000/',
        })
      ).toBe('http://localhost:3000');
    });

    it('builds Bookarium-Catalog-Sync User-Agent strings from explicit or resolved repository/site URLs', () => {
      expect(
        resolveRepositoryOrSiteUrl({
          VERCEL_GIT_REPO_OWNER: 'reader-org',
          VERCEL_GIT_REPO_SLUG: 'bookarium-mirror',
        })
      ).toBe('https://github.com/reader-org/bookarium-mirror');

      expect(
        resolveCatalogUserAgent({
          BOOKARIUM_REPO_URL: 'https://bookarium.ro',
          GUTENBERG_CONTACT_EMAIL: 'catalog@bookarium.ro',
        })
      ).toBe('Bookarium-Catalog-Sync/1.0 (+https://bookarium.ro; catalog@bookarium.ro)');

      expect(
        resolveCatalogUserAgent({
          NEXT_PUBLIC_GITHUB_REPO: 'https://github.com/example-org/bookarium',
        })
      ).toBe('Bookarium-Catalog-Sync/1.0 (+https://github.com/example-org/bookarium)');

      expect(resolveCatalogUserAgent({})).toMatch(
        /^Bookarium-Catalog-Sync\/1\.0 \(\+https?:\/\/.+\)$/
      );
    });
  });

  describe('Archive Wire SHA-256 Computation, Content-Length Truncation & Step Summary', () => {
    it('computes wire SHA-256 digests on valid CSV streams and rejects Content-Length truncated streams', async () => {
      const csvText =
        'Text#,Type,Issued,Title,Language,Authors,Subjects,LoCC,Bookshelves\n1342,Text,1998-06-01,Pride and Prejudice,en,"Austen, Jane",,,\n';
      const gzPayload = zlib.gzipSync(Buffer.from(csvText, 'utf8'));
      const expectedSha = computeSha256Hex(gzPayload);

      expect(parseSha256SidecarText(`${expectedSha}  gutenberg-catalog-cache.json.gz\n`)).toBe(
        expectedSha
      );
      expect(isSha256TimingSafeEqual(expectedSha, expectedSha)).toBe(true);
      expect(isSha256TimingSafeEqual(expectedSha, '0'.repeat(64))).toBe(false);

      const makeMockCsvHttpsGet = (reportedContentLength: number) =>
        (_url: string, _opts: unknown, cb: (res: Readable) => void) => {
          const res = Readable.from([gzPayload]) as Readable & {
            statusCode?: number;
            statusMessage?: string;
            headers?: Record<string, string>;
          };
          res.statusCode = 200;
          res.statusMessage = 'OK';
          res.headers = {
            'content-type': 'application/x-gzip',
            'content-length': String(reportedContentLength),
          };
          queueMicrotask(() => cb(res));
          return Readable.from([]) as Readable & { setTimeout?: () => void };
        };

      const rows: string[][] = [];
      const streamResult = await streamCatalogMirrorOnce(
        (r: string[]) => rows.push(r),
        GUTENBERG_CSV_FEED_MIRRORS[0],
        { httpsGet: makeMockCsvHttpsGet(gzPayload.length) }
      );
      expect(rows).toHaveLength(1);
      expect(streamResult.archiveSha256).toBe(expectedSha);
      expect(streamResult.downloadedBytes).toBe(gzPayload.length);

      await expect(
        streamCatalogMirrorOnce(vi.fn(), GUTENBERG_CSV_FEED_MIRRORS[0], {
          httpsGet: makeMockCsvHttpsGet(gzPayload.length + 1024),
        })
      ).rejects.toThrow(/Truncated CSV archive stream/);
    });

    it('rejects corrupted RDF archive streams fail-closed when tar exits non-zero or Content-Length mismatches', async () => {
      const invalidBz2 = Buffer.from('not-a-valid-tar-bz2-archive', 'utf8');
      const truncatedHttpsGet = (_url: string, _opts: unknown, cb: (res: Readable) => void) => {
        const res = Readable.from([invalidBz2]) as Readable & {
          statusCode?: number;
          statusMessage?: string;
          headers?: Record<string, string>;
        };
        res.statusCode = 200;
        res.statusMessage = 'OK';
        res.headers = {
          'content-type': 'application/x-bzip2',
          'content-length': String(invalidBz2.length + 512),
        };
        queueMicrotask(() => cb(res));
        return Readable.from([]) as Readable & { setTimeout?: () => void };
      };

      await expect(
        streamRdfMirrorOnce(GUTENBERG_RDF_FEED_MIRRORS[0], { httpsGet: truncatedHttpsGet })
      ).rejects.toThrow(/(?:Truncated RDF archive stream|tar exited with code)/);
    });

    it('appends Markdown digest summary rows to GITHUB_STEP_SUMMARY when configured', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookarium-cat-summary-'));
      const summaryFile = path.join(tmpDir, 'summary.md');
      try {
        expect(appendCatalogStepSummary({}, { stepSummaryPath: '' })).toBe(false);
        expect(
          appendCatalogStepSummary(
            {
              totalParsed: 100,
              totalAccepted: 95,
              totalInserted: 2,
              totalUpdated: 3,
              totalUnchanged: 90,
              csvSha256: 'a'.repeat(64),
              rdfSha256: 'b'.repeat(64),
              restoredCacheSha256: 'c'.repeat(64),
              savedCacheSha256: 'd'.repeat(64),
            },
            { stepSummaryPath: summaryFile }
          )
        ).toBe(true);
        const written = fs.readFileSync(summaryFile, 'utf8');
        expect(written).toContain('Gutenberg Catalog Sync Integrity Summary');
        expect(written).toContain('a'.repeat(64));
        expect(written).toContain('d'.repeat(64));
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('preserves cached and live-DB copyright=true flags and defers brand-new unverified volumes during RDF outages', async () => {
      const cachedBooksById = new Map([
        [1342, { id: 1342, copyright: false }],
        [901, { id: 901, copyright: true }],
      ]);
      const batch = [
        { id: 1342, title: 'Pride and Prejudice', copyright: false },
        { id: 901, title: 'Restricted In Cache', copyright: false },
        { id: 902, title: 'Restricted Only In DB', copyright: false },
        { id: 84, title: 'Public Domain In DB', copyright: false },
        { id: 77777, title: 'Brand New Unverified Book', copyright: false },
      ];

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            in: vi.fn(async (_col: string, ids: number[]) => ({
              data: [
                { id: 902, copyright: true },
                { id: 84, copyright: false },
              ].filter((r) => ids.includes(r.id)),
              error: null,
            })),
          })),
        })),
      };

      const deferredRes = await reconcileBatchWithoutRdfRights({
        batch,
        supabase: mockSupabase,
        cachedBooksById,
        shouldDeferUnverifiedNew: true,
        fetchRowsOptions: { retries: 1, baseDelayMs: 0 },
      });

      expect(deferredRes.deferredIds).toEqual([77777]);
      expect(deferredRes.filteredBatch.map((b: { id: number; copyright: boolean }) => [b.id, b.copyright])).toEqual([
        [1342, false],
        [901, true],
        [902, true],
        [84, false],
      ]);

      const explicitOverrideRes = await reconcileBatchWithoutRdfRights({
        batch,
        supabase: mockSupabase,
        cachedBooksById,
        shouldDeferUnverifiedNew: false,
        fetchRowsOptions: { retries: 1, baseDelayMs: 0 },
      });
      expect(explicitOverrideRes.deferredIds).toEqual([]);
      expect(explicitOverrideRes.filteredBatch).toHaveLength(5);
      expect(explicitOverrideRes.filteredBatch.find((b: { id: number }) => b.id === 902)?.copyright).toBe(true);
    });
  });
});

