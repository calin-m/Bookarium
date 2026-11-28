import { describe, it, expect, vi } from 'vitest';
import path from 'path';
import fs from 'fs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const quotesSync = require('./sync-featured-quotes.js');

const SAMPLE_GUTENBERG_BOOK = [
  'The Project Gutenberg eBook of Pride and Prejudice, by Jane Austen',
  '*** START OF THE PROJECT GUTENBERG EBOOK PRIDE AND PREJUDICE ***',
  '',
  'Chapter 1',
  '',
  'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families.',
  '',
  '“My dear Mr. Bennet,” said his lady to him one day, “have you heard that Netherfield Park is let at last?” Mr. Bennet replied that he had not, and his wife insisted that he visit the new arrival immediately.',
  '',
  '“Why, my dear, you must know, Mrs. Long says that Netherfield is taken by a young man of large fortune from the north of England; that he came down on Monday in a chaise and four to see the place.”',
  '',
  '“Is he married or single?” “Oh! Single, my dear, to be sure! A single man of large fortune; four or five thousand a year. What a fine thing for our girls!”',
  '',
  '“Design! Nonsense, how can you talk so! But it is very likely that he may fall in love with one of them, and therefore you must visit him as soon as he comes.”',
  '',
  '“I see no occasion for that. You and the girls may go, or you may send them by themselves, which perhaps will be still better, for as you are as handsome as any of them, Mr. Bingley might like you the best of the party.”',
  '',
  '“My dear, you flatter me. I certainly have had my share of beauty, but I do not pretend to be anything extraordinary now. When a woman has five grown-up daughters, she ought to give over thinking of her own beauty.”',
  '',
  '“In such cases, a woman has not often much beauty to think of.” “But, my dear, you must indeed go and see Mr. Bingley when he comes into the neighbourhood.”',
  '',
  '*** END OF THE PROJECT GUTENBERG EBOOK PRIDE AND PREJUDICE ***',
].join('\n');

describe('sync-featured-quotes pipeline', () => {
  it('enforces Cloudflare R2-only text source normalization and core pool defaults', () => {
    expect(Array.from(quotesSync.QUOTE_TEXT_SOURCES)).toEqual(['auto', 'r2']);
    expect(quotesSync.normalizeQuoteTextSource('')).toBe('r2');
    expect(quotesSync.normalizeQuoteTextSource('auto')).toBe('r2');
    expect(quotesSync.normalizeQuoteTextSource('r2')).toBe('r2');
    expect(quotesSync.normalizeQuoteTextSource('r2-only')).toBe('r2');
    expect(() => quotesSync.normalizeQuoteTextSource('mirrors')).toThrow(
      /mirror HTTP scraping is retired/i
    );
    expect(() => quotesSync.normalizeQuoteTextSource('https')).toThrow(
      /mirror HTTP scraping is retired/i
    );
    expect(() => quotesSync.normalizeQuoteTextSource('https-mirrors')).toThrow(
      /mirror HTTP scraping is retired/i
    );
    expect(() => quotesSync.normalizeQuoteTextSource('unexpected')).toThrow(
      /Unsupported --source/
    );
    expect(quotesSync.DEFAULT_POPULAR_POOL_SIZE).toBe(500);
    expect(quotesSync.DEFAULT_RECENT_POOL_SIZE).toBe(64);
    expect(quotesSync.DEFAULT_MAX_PRUNE_PER_RUN).toBe(2000);
    expect(quotesSync.MAX_BOOK_TEXT_BYTES).toBe(15 * 1024 * 1024);
  });

  it('parses CLI arguments and rejects retired mirror/delay flags cleanly', () => {
    const parsed = quotesSync.parseCliArgs([
      '--dry-run',
      '--force',
      '--schedule-gate',
      '--limit=10',
      '--target-count=15',
      '--popular-pool=500',
      '--recent-pool=64',
      '--max-prune=1500',
      '--source=r2',
      '--ids=1342,84',
    ]);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.force).toBe(true);
    expect(parsed.scheduleGate).toBe(true);
    expect(parsed.limit).toBe(10);
    expect(parsed.targetCount).toBe(15);
    expect(parsed.popularPool).toBe(500);
    expect(parsed.recentPool).toBe(64);
    expect(parsed.maxPrunePerRun).toBe(1500);
    expect(parsed.source).toBe('r2');
    expect(parsed.ids).toEqual([1342, 84]);

    expect(() => quotesSync.parseCliArgs(['--delay-range=7.5-15.5'])).toThrow(
      /mirror HTTP fallback is retired/i
    );
    expect(() => quotesSync.parseCliArgs(['--mirrors=pglaf,aleph'])).toThrow(
      /mirror HTTP fallback is retired/i
    );
    expect(() => quotesSync.parseCliArgs(['--min-delay=4'])).toThrow(
      /mirror HTTP fallback is retired/i
    );
    expect(() => quotesSync.parseCliArgs(['--source=mirrors'])).toThrow(
      /mirror HTTP scraping is retired/i
    );

    const defaultParsed = quotesSync.parseCliArgs([]);
    expect(defaultParsed.limit).toBe(50);
    expect(defaultParsed.source).toBe('r2');
  });

  it('blends Two-Tier candidates (40 Popular + 10 Recent default, or custom 20 + 5) with overlap deduplication and automatic backfill, and prunes out-of-window quotes', async () => {
    // Default limit (50 books: 40 Popular + 10 Recent) test:
    const fiftyPopular = Array.from({ length: 60 }, (_, idx) => ({
      id: idx + 1,
      title: `Popular Book ${idx + 1}`,
      quotes: [],
    }));
    const twentyRecent = Array.from({ length: 20 }, (_, idx) => ({
      id: 5000 + idx,
      title: `Recent Book ${5000 + idx}`,
      quotes: [],
    }));
    const defaultBatch = quotesSync.blendTwoTierCandidates(fiftyPopular, twentyRecent);
    expect(defaultBatch.candidates).toHaveLength(50);
    expect(defaultBatch.candidates.filter((b: { id: number }) => b.id < 1000)).toHaveLength(40);
    expect(defaultBatch.candidates.filter((b: { id: number }) => b.id >= 5000)).toHaveLength(10);

    const popularRows = Array.from({ length: 30 }, (_, idx) => ({
      id: idx + 1,
      title: `Popular Book ${idx + 1}`,
      quotes: idx < 5 ? [{ openingLine: 'Already quoted' }] : [],
    }));
    const recentRows = [
      { id: 6, title: 'Popular Book 6 (Overlap)', quotes: [] },
      ...Array.from({ length: 10 }, (_, idx) => ({
        id: 1000 + idx,
        title: `Recent Book ${1000 + idx}`,
        quotes: [],
      })),
    ];

    const blended = quotesSync.blendTwoTierCandidates(popularRows, recentRows, {
      limit: 25,
      force: false,
    });
    expect(blended.candidates).toHaveLength(25);
    const popularSelected = blended.candidates.filter((b: { id: number }) => b.id < 100);
    const recentSelected = blended.candidates.filter((b: { id: number }) => b.id >= 1000);
    expect(popularSelected).toHaveLength(20);
    expect(recentSelected).toHaveLength(5);

    // Backfill test: when only 2 unpopulated recent books remain, Popular backfills the remaining 23 slots
    const scarceRecent = [
      { id: 2001, title: 'New Release 1', quotes: [] },
      { id: 2002, title: 'New Release 2', quotes: [] },
    ];
    const backfilled = quotesSync.blendTwoTierCandidates(popularRows, scarceRecent, {
      limit: 25,
      force: false,
    });
    expect(backfilled.candidates).toHaveLength(25);
    expect(backfilled.candidates.filter((b: { id: number }) => b.id >= 2000)).toHaveLength(2);
    expect(backfilled.candidates.filter((b: { id: number }) => b.id < 100)).toHaveLength(23);

    // Priority Hero Book IDs sorting test: ensures PRIORITY_HERO_BOOK_IDS (e.g. 205 Walden) sort ahead of higher download_count non-Hero books
    expect(quotesSync.PRIORITY_HERO_BOOK_IDS).toHaveLength(27);
    const mixedPriorityRows = [
      { id: 90001, title: 'Non-Hero High Downloads', download_count: 90000, quotes: [] },
      { id: 205, title: 'Walden', download_count: 15000, quotes: [] },
      { id: 1342, title: 'Pride and Prejudice', download_count: 80000, quotes: [] },
    ];
    const heroPrioritized = quotesSync.blendTwoTierCandidates(mixedPriorityRows, [], {
      limit: 2,
      force: false,
    });
    expect(heroPrioritized.candidates.map((b: { id: number }) => b.id)).toEqual([1342, 205]);

    // Post-batch Dual-Window (Top 500 Popular + Rolling 64 Most Recent) 1-for-1 sliding window prune test:
    // - Protects popularPoolIds (1)
    // - Prunes demoted Popular book (#400 < minRecentHorizonId 78000) even when Recent has space
    // - Sorts quoted Recent IDs (>= 78000) by id DESC (78004, 78003, 78002, 78001),
    //   keeps newest recentPool=2 (78004, 78003), and prunes oldest 2 (78002, 78001)
    const pruneInMock = vi.fn().mockResolvedValue({ error: null });
    const mockPruneSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          neq: vi.fn().mockResolvedValue({
            data: [
              { id: 1 },
              { id: 400 },
              { id: 78001 },
              { id: 78002 },
              { id: 78003 },
              { id: 78004 },
            ],
            error: null,
          }),
        })),
        update: vi.fn(() => ({
          in: pruneInMock,
        })),
      })),
    };
    const popularPoolIds = new Set([1]);
    const pruneRes = await quotesSync.pruneOutOfWindowBookQuotes(
      mockPruneSupabase,
      popularPoolIds,
      { dryRun: false, recentPool: 2, minRecentHorizonId: 78000 },
      { log: vi.fn() }
    );
    expect(pruneRes.prunedCount).toBe(3);
    expect(pruneInMock).toHaveBeenCalledWith('id', [400, 78002, 78001]);

    // Failsafe: empty popularPoolIds aborts pruning to prevent accidental mass wipes
    const emptyPoolPrune = await quotesSync.pruneOutOfWindowBookQuotes(
      mockPruneSupabase,
      new Set(),
      { dryRun: false, recentPool: 2, minRecentHorizonId: 78000 },
      { log: vi.fn() }
    );
    expect(emptyPoolPrune.prunedCount).toBe(0);

    // Failsafe: maxPrunePerRun caps the number of books pruned in a single run
    const cappedPrune = await quotesSync.pruneOutOfWindowBookQuotes(
      mockPruneSupabase,
      popularPoolIds,
      { dryRun: false, recentPool: 2, minRecentHorizonId: 78000, maxPrunePerRun: 2 },
      { log: vi.fn() }
    );
    expect(cappedPrune.prunedCount).toBe(2);
    expect(cappedPrune.prunedIds).toEqual([400, 78002]);

    // Primary-Key-Scoped fetchQuotedBookIds (.in('id', chunk).neq('quotes', '[]'))
    const scopedNeqMock = vi.fn().mockResolvedValue({
      data: [{ id: 1342 }],
      error: null,
    });
    const scopedInMock = vi.fn(() => ({ neq: scopedNeqMock }));
    const scopedQuotedSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: scopedInMock,
        })),
      })),
    };
    const scopedSet = await quotesSync.fetchQuotedBookIds(scopedQuotedSupabase, [1342, 84]);
    expect(Array.from(scopedSet)).toEqual([1342]);
    expect(scopedInMock).toHaveBeenCalledWith('id', [1342, 84]);
    expect(scopedNeqMock).toHaveBeenCalledWith('quotes', '[]');

    // Failsafe: fetchQuotedBookIds throws when Supabase returns a query error
    const errorQuotedSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          neq: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Supabase timeout on idx_books_with_quotes_popular' },
          }),
        })),
      })),
    };
    await expect(quotesSync.fetchQuotedBookIds(errorQuotedSupabase)).rejects.toThrow(
      /Supabase timeout/
    );

    // Strict public.books existence guard for manual --ids when Supabase is connected vs offline --dry-run
    const offlineIds = await quotesSync.fetchCandidateBooksFromSupabase(null, {
      ids: [1342, 999999],
      limit: 10,
    });
    expect(offlineIds).toHaveLength(2);

    const connectedByIdSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({
            data: [
              { id: 1342, title: 'Pride and Prejudice', copyright: false, quotes: [] },
              { id: 90123, title: 'Copyrighted Title', copyright: true, quotes: [] },
            ],
            error: null,
          }),
        })),
      })),
    };
    const manualOptions: Record<string, unknown> = {
      ids: [1342, 90123, 999999],
      limit: 10,
    };
    const connectedIds = await quotesSync.fetchCandidateBooksFromSupabase(
      connectedByIdSupabase,
      manualOptions
    );
    expect(connectedIds).toHaveLength(1);
    expect(connectedIds[0].id).toBe(1342);
    expect(manualOptions._skippedCopyrightIds).toEqual([90123]);
  });

  it('computes randomized float delays and 1.0h–2.0h float schedule windows', async () => {
    expect(quotesSync.computeRandomDelayMs(8, 16, () => 0)).toBe(8000);
    expect(quotesSync.computeRandomDelayMs(8, 16, () => 0.5)).toBe(12000);
    expect(quotesSync.computeRandomDelayMs(8, 16, () => 1)).toBe(16000);

    const windowMs = quotesSync.computeScheduleWindowMs('2026-11-01T12:00:00.000Z');
    expect(windowMs).toBeGreaterThanOrEqual(1 * 3600 * 1000);
    expect(windowMs).toBeLessThanOrEqual(2 * 3600 * 1000);

    const mockScheduleSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          neq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({
                data: [{ updated_at: '2026-11-01T12:00:00.000Z' }],
              }),
            })),
          })),
        })),
      })),
    };

    const gateEarly = await quotesSync.evaluateScheduleGate(
      mockScheduleSupabase,
      { scheduleGate: true, minIntervalHours: 1, maxIntervalHours: 2 },
      Date.parse('2026-11-01T12:30:00.000Z') // Only 0.5h elapsed (< 1h min)
    );
    expect(gateEarly.allowed).toBe(false);
    expect(gateEarly.elapsedHours).toBe(0.5);

    const gateReady = await quotesSync.evaluateScheduleGate(
      mockScheduleSupabase,
      { scheduleGate: true, minIntervalHours: 1, maxIntervalHours: 2 },
      Date.parse('2026-11-01T14:30:00.000Z') // 2.5h elapsed (> 2h max)
    );
    expect(gateReady.allowed).toBe(true);
  });

  it('extracts multi-quote spreads, builds sentinel spreads, and merges upsert-only without duplicates', () => {
    expect(quotesSync.stripBoilerplateAndSplitParagraphs(null)).toEqual([]);
    expect(quotesSync.wrapCleanQuote('')).toBe('');
    expect(quotesSync.wrapCleanQuote('A'.repeat(300), 50).endsWith('…”')).toBe(true);
    // Ends cleanly at a sentence boundary in the upper 45% of the budget
    const sentenceTruncated = quotesSync.wrapCleanQuote(
      'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood.',
      160
    );
    expect(sentenceTruncated).toBe(
      '“It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.”'
    );
    // Falls back to whole-word space boundary without slicing words in half
    const wordTruncated = quotesSync.wrapCleanQuote(
      'Extraordinary circumstances surrounding the mysterious philosophical investigation continued unabated through the winter months without pause or punctuation',
      90
    );
    expect(wordTruncated.endsWith('…”')).toBe(true);
    expect(wordTruncated).not.toContain('unab…');

    const spreads = quotesSync.extractBookQuoteSpreads(
      SAMPLE_GUTENBERG_BOOK,
      { id: 1342, title: 'Pride and Prejudice' },
      12
    );
    expect(spreads.length).toBeGreaterThanOrEqual(1);
    expect(spreads[0].openingLine).toContain('truth universally acknowledged');
    expect(spreads[0].quoteExcerpt.length).toBeGreaterThan(20);

    const sentinel = quotesSync.buildSentinelQuoteSpread({
      id: 99999,
      title: 'Index Volume',
      authors: [{ name: 'Compiler' }],
    });
    expect(sentinel.commentary).toContain('Bibliographic sentinel record');

    const existing = [
      {
        chapterLabel: 'Passage I • Pride and Prejudice',
        openingLine: spreads[0].openingLine,
        quoteExcerpt: spreads[0].quoteExcerpt,
      },
    ];
    const extra = [
      spreads[0],
      {
        chapterLabel: 'Passage II • Pride and Prejudice',
        openingLine: '“I declare after all there is no enjoyment like reading!”',
        quoteExcerpt: '“Till this moment I never knew myself.”',
      },
    ];

    const merged = quotesSync.mergeDistinctQuoteSpreads(existing, extra, 16);
    expect(merged).toHaveLength(2);

    const sql = quotesSync.buildSqlQuoteSeedStatement(1342, merged);
    expect(sql).toContain('UPDATE public.books SET quotes =');
    expect(sql).toContain('WHERE id = 1342;');
  });

  it('fails fast on unconfigured R2 credentials and rejects retired PG mirror source modes', async () => {
    await expect(
      quotesSync.runFeaturedQuotesSync(
        { source: 'mirrors', ids: [1342], dryRun: true },
        { env: {}, logger: { log: vi.fn(), error: vi.fn() }, writeSeedFile: false }
      )
    ).rejects.toThrow(/mirror HTTP scraping is retired/i);

    await expect(
      quotesSync.runFeaturedQuotesSync(
        { ids: [1342], dryRun: true },
        { env: { R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef' }, logger: { log: vi.fn(), error: vi.fn() }, writeSeedFile: false }
      )
    ).rejects.toThrow(/Partial Cloudflare R2 configuration|requires R2_ACCOUNT_ID/i);

    await expect(
      quotesSync.runFeaturedQuotesSync(
        { dryRun: false },
        {
          env: {
            R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
            R2_BUCKET_NAME: 'bookarium-test-bucket',
            R2_ACCESS_KEY_ID: 'mock-r2-access-key',
            R2_SECRET_ACCESS_KEY: 'mock-r2-secret-signing-key',
            NEXT_PUBLIC_SUPABASE_URL: '',
            SUPABASE_SERVICE_ROLE_KEY: '',
          },
        }
      )
    ).rejects.toThrow(/Missing NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('queries public.books by download_count DESC and executes runFeaturedQuotesSync strictly against Cloudflare R2 with sentinel fallback', async () => {
    const tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-quotes-env-'));
    try {
      fs.writeFileSync(path.join(tmpDir, '.env'), 'TEST_QUOTE_ENV="loaded_val"\n# comment\n', 'utf8');
      const loaded = quotesSync.loadEnv(tmpDir);
      expect(loaded.TEST_QUOTE_ENV).toBe('loaded_val');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    await expect(
      quotesSync.runFeaturedQuotesSync(
        { dryRun: false },
        { env: { NEXT_PUBLIC_SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' } }
      )
    ).rejects.toThrow(/requires R2_ACCOUNT_ID/);

    const existingTenQuotes = Array.from({ length: 10 }, (_, idx) => ({
      chapterLabel: `Ch ${idx + 1}`,
      openingLine: `Opening ${idx + 1}`,
      quoteExcerpt: `Excerpt ${idx + 1}`,
    }));

    const candidateRows = [
      {
        id: 1342,
        title: 'Pride and Prejudice',
        copyright: false,
        media_type: 'Text',
        languages: ['en'],
        download_count: 50000,
        quotes: existingTenQuotes,
        content: null,
      },
      {
        id: 84,
        title: 'Frankenstein',
        copyright: false,
        media_type: 'Text',
        languages: ['en'],
        download_count: 45000,
        quotes: [],
        content: SAMPLE_GUTENBERG_BOOK,
      },
      {
        id: 2701,
        title: 'Moby Dick',
        copyright: false,
        media_type: 'Text',
        languages: ['en'],
        download_count: 40000,
        quotes: [],
        content: null,
      },
      {
        id: 64317,
        title: 'The Great Gatsby',
        copyright: false,
        media_type: 'Text',
        languages: ['en'],
        download_count: 35000,
        quotes: [],
        content: null,
      },
      {
        id: 11,
        title: 'Alice in Wonderland',
        copyright: false,
        media_type: 'Text',
        languages: ['en'],
        download_count: 30000,
        quotes: [],
        content: null,
      },
      {
        id: 99999,
        title: 'Short Pamphlet',
        copyright: false,
        media_type: 'Text',
        languages: ['en'],
        download_count: 25000,
        quotes: [],
        content: 'Too short to extract quotes from body',
      },
    ];

    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const updateInMock = vi.fn().mockResolvedValue({ error: null });

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          neq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({ data: [{ id: 1342 }], error: null }),
            })),
          })),
          order: vi.fn((col: string) => ({
            limit: vi
              .fn()
              .mockResolvedValue({
                data: col === 'download_count' ? candidateRows : [],
                error: null,
              }),
          })),
          in: vi.fn().mockResolvedValue({ data: candidateRows, error: null }),
        })),
        update: vi.fn(() => ({
          eq: updateEqMock,
          in: updateInMock,
        })),
      })),
    };

    const silentLogger = { log: vi.fn(), error: vi.fn() };
    const fetchBookFromR2Mock = vi.fn(async (bookId: number) => {
      if (bookId === 99999) {
        return {
          status: 'ok',
          text: 'Short plain catalog preface without dialogue or extractable spreads. '.repeat(12),
        };
      }
      return { status: 'ok', text: SAMPLE_GUTENBERG_BOOK };
    });

    const summary = await quotesSync.runFeaturedQuotesSync(
      {
        limit: 6,
      },
      {
        env: {},
        supabaseClient: mockSupabase,
        fetchBookFromR2: fetchBookFromR2Mock,
        sleepFn: vi.fn().mockResolvedValue(undefined),
        logger: silentLogger,
        writeSeedFile: false,
      }
    );

    expect(summary.processed).toBe(5);
    expect(summary.skippedExisting).toBe(0); // 1342 already filtered out of Two-Tier candidate pool (>=10 quotes)
    expect(summary.fromR2).toBe(5); // 84, 2701, 64317, 11, 99999 served from Cloudflare R2
    expect(summary.r2Missing).toBe(0);
    expect(summary.sentinelMarked).toBe(1); // 99999 marked with 1-item sentinel spread when extractable spreads == 0
    expect(summary.updated).toBe(4); // 84, 2701, 64317, 11 updated with multi-quote spreads
    expect(updateEqMock).toHaveBeenCalledTimes(5); // 4 updated + 1 sentinel
  });
});

type CatalogRow = {
  id: number;
  title: string;
  copyright?: boolean;
  media_type?: string;
  languages?: string[];
  download_count?: number;
  quotes: Array<Record<string, string>>;
  content: string | null;
};

type LedgerEntry = {
  order: number;
  id: number;
  title: string;
  tier: string;
  source: string;
  outcome: string;
  quoteCount: number;
  existingQuoteCount: number;
  note?: string;
};

const makeQuotes = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, idx) => ({
    chapterLabel: `${prefix} ${idx + 1}`,
    openingLine: `${prefix} opening line number ${idx + 1}`,
    quoteExcerpt: `${prefix} excerpt number ${idx + 1}`,
  }));

const catalogRow = (overrides: Partial<CatalogRow> & { id: number; title: string }): CatalogRow => ({
  copyright: false,
  media_type: 'Text',
  languages: ['en'],
  download_count: 1000,
  quotes: [],
  content: null,
  ...overrides,
});

/**
 * In-memory `public.books` mock supporting the exact PostgREST chains used by the sync script:
 * `.select().in()` (awaitable, with chained `.neq('quotes', '[]')`), `.select().order().limit()`,
 * and `.update().eq()` / `.update().in()`.
 */
function createCatalogSupabase(allRows: CatalogRow[], popularRows: CatalogRow[], recentRows: CatalogRow[]) {
  const updateEqMock = vi.fn().mockResolvedValue({ error: null });
  const pruneInMock = vi.fn().mockResolvedValue({ error: null });
  const orderMock = vi.fn((col: string) => ({
    limit: vi.fn().mockResolvedValue({
      data: col === 'download_count' ? popularRows : recentRows,
      error: null,
    }),
  }));
  const rowsFor = (ids: number[]) => allRows.filter((r) => ids.includes(r.id));

  const client = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn((_col: string, ids: number[]) => ({
          then: (
            resolve: (v: { data: CatalogRow[]; error: null }) => unknown,
            reject?: (e: unknown) => unknown
          ) => Promise.resolve({ data: rowsFor(ids), error: null }).then(resolve, reject),
          neq: vi.fn(() =>
            Promise.resolve({
              data: rowsFor(ids).filter((r) => r.quotes.length > 0).map((r) => ({ id: r.id })),
              error: null,
            })
          ),
        })),
        order: orderMock,
      })),
      update: vi.fn(() => ({ eq: updateEqMock, in: pruneInMock })),
    })),
  };
  return { client, updateEqMock, pruneInMock, orderMock };
}

describe('sync-featured-quotes run report: tier progress & per-book ledger', () => {
  it('tags every blended candidate with its tier, including both backfill directions', () => {
    const popularRows = Array.from({ length: 30 }, (_, idx) => ({
      id: idx + 1,
      title: `Popular ${idx + 1}`,
      quotes: idx < 5 ? [{ openingLine: 'Already quoted' }] : [],
    }));
    const recentRows = [
      { id: 6, title: 'Popular 6 (Overlap)', quotes: [] },
      ...Array.from({ length: 10 }, (_, idx) => ({ id: 1000 + idx, title: `Recent ${idx}`, quotes: [] })),
    ];

    const blended = quotesSync.blendTwoTierCandidates(popularRows, recentRows, { limit: 25 });
    expect(blended.candidateTiers.size).toBe(25);
    for (const cand of blended.candidates as Array<{ id: number }>) {
      expect(blended.candidateTiers.get(cand.id)).toBe(cand.id >= 1000 ? 'recent' : 'top');
    }
    // Overlapping book #6 is queued from the Top pool, so it is labelled Top
    expect(blended.candidateTiers.get(6)).toBe('top');

    // Popular backfills scarce Recent: backfilled Popular books stay Top
    const scarceRecent = [
      { id: 2001, title: 'New 1', quotes: [] },
      { id: 2002, title: 'New 2', quotes: [] },
    ];
    const popularBackfill = quotesSync.blendTwoTierCandidates(popularRows, scarceRecent, { limit: 25 });
    const backfillTiers = Array.from(popularBackfill.candidateTiers.values());
    expect(backfillTiers.filter((t) => t === 'top')).toHaveLength(23);
    expect(backfillTiers.filter((t) => t === 'recent')).toHaveLength(2);

    // Recent backfills scarce Popular: backfilled Recent books stay Recent
    const scarcePopular = [
      { id: 1, title: 'Top 1', quotes: [] },
      { id: 2, title: 'Top 2', quotes: [] },
    ];
    const recentBackfill = quotesSync.blendTwoTierCandidates(scarcePopular, recentRows.slice(1), {
      limit: 10,
    });
    expect(recentBackfill.candidates).toHaveLength(10);
    expect(recentBackfill.candidateTiers.get(1)).toBe('top');
    expect(recentBackfill.candidateTiers.get(2)).toBe('top');
    expect(Array.from(recentBackfill.candidateTiers.values()).filter((t) => t === 'recent')).toHaveLength(8);
  });

  it('computes zero-query tier progress, counting overlapping books once under Top, with ETA', () => {
    const progress = quotesSync.computeTierProgress({
      popularPoolIds: new Set([1, 2, 3, 4]),
      recentPoolIds: new Set([4, 5, 6]),
      quotedIds: new Set([1, 5]),
      newlyQuotedIds: new Set([2, 6]),
      limit: 25,
    });
    expect(progress.top).toEqual({
      pool: 4,
      doneBefore: 1,
      doneNow: 2,
      addedThisRun: 1,
      remaining: 2,
      percent: 50,
    });
    expect(progress.recent).toEqual({
      pool: 2,
      doneBefore: 1,
      doneNow: 2,
      addedThisRun: 1,
      remaining: 0,
      percent: 100,
    });
    expect(progress.total.pool).toBe(6);
    expect(progress.total.remaining).toBe(2);
    expect(progress.total.percent).toBe(66.7);
    expect(progress.etaRuns).toBe(1);
    expect(progress.etaHours).toBe(1.5);

    const slowBatch = quotesSync.computeTierProgress({
      popularPoolIds: new Set([1, 2, 3]),
      recentPoolIds: new Set(),
      quotedIds: new Set([1]),
      newlyQuotedIds: new Set(),
      limit: 1,
    });
    expect(slowBatch.etaRuns).toBe(2);
    expect(slowBatch.etaHours).toBe(3);
    expect(slowBatch.recent.pool).toBe(0);
    expect(slowBatch.recent.percent).toBe(100);

    const full = quotesSync.computeTierProgress({
      popularPoolIds: new Set([1, 2]),
      recentPoolIds: new Set([3]),
      quotedIds: new Set([1, 2, 3]),
      newlyQuotedIds: new Set(),
    });
    expect(full.total.remaining).toBe(0);
    expect(full.total.percent).toBe(100);
    expect(full.etaRuns).toBe(0);
  });

  it('formats the Markdown run report with progress, totals, escaped titles and tier labels', () => {
    const progress = quotesSync.computeTierProgress({
      popularPoolIds: new Set([1342, 84, 2701, 11]),
      recentPoolIds: new Set([75012]),
      quotedIds: new Set([1342]),
      newlyQuotedIds: new Set([84]),
      limit: 25,
    });
    const report = quotesSync.formatRunReport(
      {
        pruned: 2,
        fromR2: 1,
        progress,
        books: [
          { order: 3, id: 99999, title: 'Gutenberg Volume #99999', tier: 'outside', source: 'none', outcome: 'not-found', quoteCount: 0, existingQuoteCount: 0 },
          { order: 1, id: 84, title: 'Frankenstein | Or\nThe Modern Prometheus', tier: 'top', source: 'r2', outcome: 'updated', quoteCount: 14, existingQuoteCount: 6 },
          { order: 2, id: 1342, title: 'Pride and Prejudice', tier: 'top', source: 'stored', outcome: 'already-quoted', quoteCount: 14, existingQuoteCount: 14 },
        ],
      },
      { dryRun: true }
    );

    expect(report).toContain('_Dry run: no database writes were made._');
    expect(report).toContain('| Top Popular | 4 | 2 (+1) | 2 | 50% |');
    expect(report).toContain('| Rolling Recent | 1 | 0 | 1 | 0% |');
    expect(report).toContain('Estimated completion: ~1 more run(s)');
    expect(report).toContain('Saved: 1 · Refreshed: 0 · No quotes (placeholder): 0 · Already quoted: 1 · Not found: 1 · Failed: 0 · Pruned: 2');
    expect(report).toContain('Cloudflare R2 1');
    expect(report).toContain(
      '| 1 | Top | 84 | Frankenstein \\| Or The Modern Prometheus | Cloudflare R2 | ✅ Saved | 6 → 14 |'
    );
    expect(report).toContain('| 2 | Top | 1342 | Pride and Prejudice | Database | ⏭️ Already has quotes | 14 |');
    expect(report).toContain('| 3 | Outside pools | 99999 | Gutenberg Volume #99999 | — | ❓ Not in catalog | — |');
    // Ledger rows are ordered by batch position, not by completion order
    expect(report.indexOf('| 1 | Top | 84 |')).toBeLessThan(report.indexOf('| 3 | Outside pools |'));

    const noProgress = quotesSync.formatRunReport(
      { pruned: 0, progress: null, books: [] },
      { tierResolutionError: 'pool scan timeout' }
    );
    expect(noProgress).toContain('_Tier progress unavailable (pool scan failed: pool scan timeout)._');
    expect(noProgress).toContain('_No books processed in this run._');

    // Backslashes are escaped before pipes so a trailing "\" can never un-escape a cell delimiter
    const backslashTitle = quotesSync.formatRunReport({
      books: [
        { order: 1, id: 7, title: 'Path C:\\ | Notes', tier: 'top', source: 'none', outcome: 'failed', quoteCount: 0, existingQuoteCount: 0 },
      ],
    });
    expect(backslashTitle).toContain('| 1 | Top | 7 | Path C:\\\\ \\| Notes | — | ❌ Failed | — |');

    const fullPools = quotesSync.formatRunReport({
      books: [],
      progress: quotesSync.computeTierProgress({
        popularPoolIds: new Set([1]),
        recentPoolIds: new Set([2]),
        quotedIds: new Set([1, 2]),
      }),
    });
    expect(fullPools).toContain('✅ Both pools are fully ingested.');
  });

  it('formats initial pool status banner with progress percentages and deficit backfill notes', () => {
    const banner = quotesSync.formatInitialPoolBanner({
      topPoolSize: 500,
      topDone: 125,
      recentPoolSize: 64,
      recentDone: 64,
      batchTopCount: 25,
      batchRecentCount: 0,
      totalBatchCount: 25,
    });
    expect(banner).toContain('📚 Bookarium Featured Quotes Sync');
    expect(banner).toContain('📊 Two-Tier Pool Status (Pre-Batch):');
    expect(banner).toContain('• Top Popular:    125/500 ingested (375 remaining · 25.0%)');
    expect(banner).toContain('• Rolling Recent: 64/64 ingested (0 remaining · 100.0%)');
    expect(banner).toContain('• This Batch:     25 candidate(s) (25 Top · 0 Recent)');
    expect(banner).toContain(
      'Note: Rolling Recent pool is fully ingested (100%); batch slots backfilled by Top Popular.'
    );

    const partialBanner = quotesSync.formatInitialPoolBanner({
      topPoolSize: 500,
      topDone: 200,
      recentPoolSize: 64,
      recentDone: 50,
      batchTopCount: 20,
      batchRecentCount: 5,
      totalBatchCount: 25,
    });
    expect(partialBanner).toContain('• Top Popular:    200/500 ingested (300 remaining · 40.0%)');
    expect(partialBanner).toContain('• Rolling Recent: 50/64 ingested (14 remaining · 78.1%)');
    expect(partialBanner).not.toContain('Note: Rolling Recent pool is fully ingested');

    const consoleSummary = quotesSync.formatConsoleSummary(
      {
        pruned: 3,
        fromR2: 2,
        books: [
          { outcome: 'updated' },
          { outcome: 'refreshed' },
          { outcome: 'no-quotes' },
        ],
        progress: quotesSync.computeTierProgress({
          popularPoolIds: new Set([1, 2, 3, 4]),
          recentPoolIds: new Set([5, 6]),
          quotedIds: new Set([1]),
          newlyQuotedIds: new Set([2, 5]),
          limit: 2,
        }),
      },
      { dryRun: true }
    );
    expect(consoleSummary).toContain('✔ Featured Quotes Sync Complete (DRY RUN)!');
    expect(consoleSummary).toContain('1 saved · 1 refreshed · 1 placeholder · 0 skipped · 0 failed · 3 pruned');
    expect(consoleSummary).toContain('From R2:        2 book(s) (0 external requests)');
    expect(consoleSummary).toContain('Top Popular:    2/4 ingested (2 remaining · 50.0% · +1 this run)');
    expect(consoleSummary).toContain('Rolling Recent: 1/2 ingested (1 remaining · 50.0% · +1 this run)');
    expect(consoleSummary).toContain('Total Pool:     3/6 ingested (3 remaining · 50.0% · ~2 run(s) left)');

    const completedSummary = quotesSync.formatConsoleSummary({
      books: [],
      progress: quotesSync.computeTierProgress({
        popularPoolIds: new Set([1]),
        recentPoolIds: new Set([2]),
        quotedIds: new Set([1, 2]),
      }),
    });
    expect(completedSummary).toContain('100% complete');
  });

  it('logs the initial pool banner and formats single-line dual-progress per-book logs without duplicate worker lines', async () => {
    const popularRows = [
      catalogRow({ id: 1, title: 'Book 1', quotes: makeQuotes(10, 'One') }),
      catalogRow({ id: 2, title: 'Book 2', quotes: [], content: SAMPLE_GUTENBERG_BOOK }),
      catalogRow({ id: 3, title: 'Book 3', quotes: [], content: null }),
      catalogRow({ id: 4, title: 'Book 4', quotes: [], content: null }),
    ];
    const recentRows = [
      catalogRow({ id: 100, title: 'Recent 100', quotes: makeQuotes(5, 'Recent') }),
    ];
    const { client } = createCatalogSupabase(
      [...popularRows, ...recentRows],
      popularRows,
      recentRows
    );
    const logger = { log: vi.fn(), error: vi.fn() };
    await quotesSync.runFeaturedQuotesSync(
      { limit: 3 },
      {
        env: {},
        supabaseClient: client,
        fetchBookFromR2: vi.fn().mockResolvedValue({
          status: 'ok',
          text: SAMPLE_GUTENBERG_BOOK,
        }),
        sleepFn: vi.fn().mockResolvedValue(undefined),
        rng: () => 0,
        logger,
        writeSeedFile: false,
      }
    );

    const logLines = logger.log.mock.calls.map((c) => String(c[0]));
    expect(logLines.some((l) => l.includes('📊 Two-Tier Pool Status (Pre-Batch):'))).toBe(true);
    expect(
      logLines.some((l) =>
        l.includes(
          'Note: Rolling Recent pool is fully ingested (100%); batch slots backfilled by Top Popular.'
        )
      )
    ).toBe(true);
    expect(logLines.some((l) => l.includes('[Top 1/3 · Pool: 2/4 (50.0%)] #2 "Book 2"'))).toBe(true);
    expect(
      logLines.some((l) =>
        l.includes('[Top 3/3 · Pool: 4/4 (100.0%)] #4 "Book 4": 2 quotes saved (source: Cloudflare R2).')
      )
    ).toBe(true);
    expect(logLines.some((l) => l.includes('[Supabase Content]'))).toBe(false);
    expect(logLines.some((l) => l.includes('Downloaded #'))).toBe(false);
    expect(logLines.some((l) => l.includes('Sleeping '))).toBe(false);
    expect(logLines.some((l) => l.includes('✔ Featured Quotes Sync Complete!'))).toBe(true);
  });

  it('appends the report to the GitHub step summary best-effort without ever throwing', () => {
    const tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-quotes-summary-'));
    try {
      const summaryFile = path.join(tmpDir, 'step-summary.md');
      expect(quotesSync.writeStepSummary(summaryFile, '## Report A', { error: vi.fn() })).toBe(true);
      expect(quotesSync.writeStepSummary(summaryFile, '## Report B', { error: vi.fn() })).toBe(true);
      expect(fs.readFileSync(summaryFile, 'utf8')).toBe('## Report A\n## Report B\n');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    expect(quotesSync.writeStepSummary(undefined, '## Report', { error: vi.fn() })).toBe(false);

    const failingLogger = { error: vi.fn() };
    const failingFs = {
      appendFileSync: vi.fn(() => {
        throw new Error('EACCES: permission denied');
      }),
    };
    expect(quotesSync.writeStepSummary('/locked/summary.md', '## Report', failingLogger, failingFs)).toBe(false);
    expect(failingLogger.error).toHaveBeenCalledWith(
      '[Run Report] Could not write GitHub step summary: EACCES: permission denied'
    );
  });

  it('reports manual --ids books with real tiers: already-quoted, topped-up, not-found and force-refreshed, without pruning', async () => {
    const pride = catalogRow({ id: 1342, title: 'Pride and Prejudice', download_count: 90000, quotes: makeQuotes(14, 'Pride') });
    const frankenstein = catalogRow({ id: 84, title: 'Frankenstein', download_count: 80000, quotes: makeQuotes(6, 'Frank'), content: SAMPLE_GUTENBERG_BOOK });
    const moby = catalogRow({ id: 2701, title: 'Moby Dick', download_count: 70000 });
    const newRelease = catalogRow({ id: 75012, title: 'A New Release', download_count: 5, quotes: makeQuotes(12, 'New'), content: SAMPLE_GUTENBERG_BOOK });
    const newerRelease = catalogRow({ id: 76000, title: 'A Newer Release', download_count: 1 });
    const allRows = [pride, frankenstein, moby, newRelease, newerRelease];
    const { client, updateEqMock, pruneInMock } = createCatalogSupabase(
      allRows,
      [pride, frankenstein, moby],
      [newerRelease, newRelease]
    );

    const tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-quotes-manual-'));
    const summaryFile = path.join(tmpDir, 'step-summary.md');
    const logger = { log: vi.fn(), error: vi.fn() };
    try {
      const fetchBookFromR2 = vi.fn().mockResolvedValue({
        status: 'ok',
        text: SAMPLE_GUTENBERG_BOOK,
      });
      const summary = await quotesSync.runFeaturedQuotesSync(
        { ids: [1342, 84, 999999], limit: 10 },
        {
          env: {},
          supabaseClient: client,
          fetchBookFromR2,
          logger,
          writeSeedFile: false,
          stepSummaryPath: summaryFile,
        }
      );

      const byId = new Map((summary.books as LedgerEntry[]).map((b) => [b.id, b]));
      expect(byId.get(1342)).toMatchObject({
        tier: 'top',
        outcome: 'already-quoted',
        source: 'stored',
        existingQuoteCount: 14,
      });
      expect(byId.get(84)).toMatchObject({
        tier: 'top',
        outcome: 'updated',
        source: 'r2',
        existingQuoteCount: 6,
      });
      expect(byId.get(84)!.quoteCount).toBeGreaterThan(6);
      expect(byId.get(999999)).toMatchObject({ tier: 'outside', outcome: 'not-found' });

      const logLines = logger.log.mock.calls.map((call) => String(call[0]));
      expect(logLines).toContain(
        '[Top 1/2] #1342 "Pride and Prejudice": already has 14 quotes (stored), skipped.'
      );
      expect(logLines.some((l) => l.startsWith('[Top 2/2] #84 "Frankenstein": topped up 6 → '))).toBe(true);
      expect(logLines).toContain('[Not Found] #999999 is not in public.books — skipped.');

      // Progress is derived from the read-only pool scan; manual runs never prune
      expect(summary.progress.top).toMatchObject({ pool: 3, doneNow: 2, remaining: 1 });
      expect(summary.progress.recent).toMatchObject({ pool: 2, doneNow: 1, remaining: 1 });
      expect(pruneInMock).not.toHaveBeenCalled();
      expect(updateEqMock).toHaveBeenCalledTimes(1); // only #84 written

      const stepSummary = fs.readFileSync(summaryFile, 'utf8');
      expect(stepSummary).toContain('## 📚 Featured Quotes Sync — Run Report');
      expect(stepSummary).toContain('| 1 | Top | 1342 | Pride and Prejudice | Database | ⏭️ Already has quotes | 14 |');
      expect(stepSummary).toContain('| 3 | Outside pools | 999999 |');

      // Force refresh of a Recent-tier book is reported as Refreshed with before → after counts
      logger.log.mockClear();
      const forced = await quotesSync.runFeaturedQuotesSync(
        { ids: [75012], limit: 10, force: true },
        { env: {}, supabaseClient: client, fetchBookFromR2, logger, writeSeedFile: false }
      );
      expect(forced.books[0]).toMatchObject({
        id: 75012,
        tier: 'recent',
        outcome: 'refreshed',
        existingQuoteCount: 12,
      });
      expect(forced.books[0].quoteCount).toBeGreaterThan(12);
      const forcedLines = logger.log.mock.calls.map((call) => String(call[0]));
      expect(forcedLines.some((l) => l.startsWith('[Recent 1/1] #75012 "A New Release": refreshed 12 → '))).toBe(true);
      expect(forced.report).toContain('🔄 Refreshed');
      expect(pruneInMock).not.toHaveBeenCalled();

      // Copyrighted book targeted manually via --ids is skipped and reported cleanly without mirror downloads
      const copyrightedRow = catalogRow({
        id: 90123,
        title: 'Copyrighted Modern Donation',
        copyright: true,
        download_count: 500,
      });
      const copyrightedEnv = createCatalogSupabase([...allRows, copyrightedRow], [pride, frankenstein, moby], [newerRelease, newRelease]);
      logger.log.mockClear();
      const skippedSummary = await quotesSync.runFeaturedQuotesSync(
        { ids: [90123], limit: 10 },
        {
          env: {},
          supabaseClient: copyrightedEnv.client,
          fetchBookFromR2: vi.fn(),
          logger,
          writeSeedFile: false,
        }
      );
      expect(skippedSummary.processed).toBe(0);
      expect(skippedSummary.books[0]).toMatchObject({ id: 90123, outcome: 'copyrighted' });
      expect(skippedSummary.report).toContain('🚫 Copyrighted (skipped)');
      expect(logger.log.mock.calls.map((c) => String(c[0]))).toContain(
        '[Copyrighted] #90123 "Copyrighted Modern Donation" is flagged as copyrighted — skipped.'
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('falls back to Manual labels when the tier pool scan fails, and records failed outcomes when R2 reads throw', async () => {
    // Pool scan failure is recorded but never blocks a manual run
    const scanFailOptions: Record<string, unknown> = { ids: [1342], limit: 10 };
    const noOrderSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({ data: [{ id: 1342, title: 'Pride and Prejudice', quotes: [] }], error: null }),
        })),
      })),
    };
    const rows = await quotesSync.fetchCandidateBooksFromSupabase(noOrderSupabase, scanFailOptions);
    expect(rows).toHaveLength(1);
    expect(scanFailOptions._manualRun).toBe(true);
    expect(typeof scanFailOptions._tierResolutionError).toBe('string');
    expect(scanFailOptions._candidateTiers).toBeUndefined();

    // Transient R2 read failures mark books as failed without external HTTP fallbacks
    const books = [
      catalogRow({ id: 2701, title: 'Moby Dick' }),
      catalogRow({ id: 11, title: 'Alice in Wonderland' }),
      catalogRow({ id: 98, title: 'A Tale of Two Cities' }),
    ];
    const { client } = createCatalogSupabase(books, books, []);
    const logger = { log: vi.fn(), error: vi.fn() };
    const summary = await quotesSync.runFeaturedQuotesSync(
      { ids: [2701, 11, 98], limit: 10 },
      {
        env: {},
        supabaseClient: client,
        fetchBookFromR2: vi.fn().mockRejectedValue(new Error('R2 read timeout')),
        sleepFn: vi.fn().mockResolvedValue(undefined),
        logger,
        writeSeedFile: false,
      }
    );

    expect(summary.failed).toBe(3);
    const notes = (summary.books as LedgerEntry[]).map((b) => `${b.id}:${b.outcome}:${b.note}`);
    expect(notes).toEqual(
      expect.arrayContaining([
        '2701:failed:R2 read timeout',
        '11:failed:R2 read timeout',
        '98:failed:R2 read timeout',
      ])
    );
    expect(summary.books.every((b: LedgerEntry) => b.tier === 'top')).toBe(true);
    expect(summary.report).toContain('Failed: 3');
  });

  it('consumes --diff-file (quote-diff.json) without scanning the database pool, prioritizes promotedIds, and prunes demotedIds', async () => {
    const parsedArgs = quotesSync.parseCliArgs(['--diff-file=quote-diff.json', '--limit=25']);
    expect(parsedArgs.diffFile).toBe('quote-diff.json');
    expect(quotesSync.loadQuoteDiffFile('/non-existent-quote-diff.json')).toBeNull();

    const tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-quotes-diff-'));
    const diffPath = path.join(tmpDir, 'quote-diff.json');
    try {
      const pride = catalogRow({
        id: 1342,
        title: 'Pride and Prejudice',
        download_count: 90000,
        quotes: makeQuotes(14, 'Pride'),
      });
      const moby = catalogRow({
        id: 2001,
        title: 'Classic Volume A',
        download_count: 85000,
        quotes: [],
        content: SAMPLE_GUTENBERG_BOOK,
      });
      const newlyPromoted = catalogRow({
        id: 2002,
        title: 'Newly Promoted Volume B',
        download_count: 70000,
        quotes: [],
        content: SAMPLE_GUTENBERG_BOOK,
      });
      const recentRelease = catalogRow({
        id: 79001,
        title: 'Recent Release',
        download_count: 10,
        quotes: makeQuotes(12, 'Recent'),
      });
      const demotedHighVolume = catalogRow({
        id: 55555,
        title: 'Demoted Popular Cushion',
        download_count: 100,
        quotes: makeQuotes(10, 'Demoted High'),
      });
      const demotedLowVolume = catalogRow({
        id: 55554,
        title: 'Demoted Low Volume',
        download_count: 25,
        quotes: makeQuotes(10, 'Demoted Low'),
      });

      fs.writeFileSync(
        diffPath,
        JSON.stringify({
          candidatePoolIds: [1342, 2001, 2002, 79001],
          popularPoolIds: [1342, 2001, 2002],
          recentPoolIds: [79001],
          promotedIds: [2002],
          demotedIds: [55555, 55554],
          minRecentHorizonId: 74000,
          popularData: [
            { id: 1342, title: 'Pride and Prejudice', download_count: 90000, languages: ['en'] },
            { id: 2001, title: 'Classic Volume A', download_count: 85000, languages: ['en'] },
            { id: 2002, title: 'Newly Promoted Volume B', download_count: 70000, languages: ['en'] },
          ],
          recentData: [
            { id: 79001, title: 'Recent Release', download_count: 10, languages: ['en'] },
          ],
        }),
        'utf8'
      );

      const allRows = [pride, moby, newlyPromoted, recentRelease, demotedHighVolume, demotedLowVolume];
      const { client, orderMock, pruneInMock } = createCatalogSupabase(allRows, [], []);
      const logger = { log: vi.fn(), error: vi.fn() };

      const summary = await quotesSync.runFeaturedQuotesSync(
        { diffFile: diffPath, limit: 1 },
        {
          env: {},
          supabaseClient: client,
          fetchBookFromR2: vi.fn().mockResolvedValue({
            status: 'ok',
            text: SAMPLE_GUTENBERG_BOOK,
          }),
          logger,
          writeSeedFile: false,
        }
      );

      // Zero scanTwoTierPools ORDER BY queries executed!
      expect(orderMock).not.toHaveBeenCalled();
      // Newly promoted #2002 was prioritized ahead of #2001 even though #2001 had a higher download_count
      expect(summary.updated).toBe(1);
      expect(summary.books[0].id).toBe(2002);
      // Option A preserves higher-download #55555 as the 1-for-1 backfill cushion for unquoted #2001,
      // and immediately prunes least-popular #55554 while reporting it in Tier Progress & Books Processed
      expect(summary.pruned).toBe(1);
      expect(pruneInMock).toHaveBeenCalledWith('id', [55554]);
      expect(summary.pruneStats).toMatchObject({
        eligible: 1,
        purged: 1,
        remaining: 0,
        deferred: 1,
      });
      expect(summary.report).toContain('| Out-of-Window (Pruned) | 1 | 1 purged (1 deferred) | 0 | 100% |');
      expect(summary.report).toContain('🧹 Pruned — left Top Popular pool');
      expect(summary.report).toContain('Demoted Low Volume');
      const consoleLines = logger.log.mock.calls.map((c) => String(c[0]));
      expect(
        consoleLines.some((l) => l.includes('[Prune 1/1 · Demoted Popular] #55554 "Demoted Low Volume": quotes cleared.'))
      ).toBe(true);
      expect(
        consoleLines.some((l) => l.includes('• Purge Status:   1/1 purged (0 remaining · 100.0% · 1 backfill-deferred)'))
      ).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('discovers 100% of out-of-window quoted books via partial index pagination, applies Option-A cushion & drain, and yields past 500 prunes', async () => {
    // 1. fetchAllQuotedBookIds paginates across pages (up to 1000/page) and maps downloadCounts
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      id: i + 1,
      download_count: 5000 - i,
    }));
    const page2 = [
      { id: 1001, download_count: 15 },
      { id: 88001, download_count: 3 },
    ];
    const rangeMock = vi
      .fn()
      .mockResolvedValueOnce({ data: page1, error: null })
      .mockResolvedValueOnce({ data: page2, error: null });
    const paginatedSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          neq: vi.fn(() => ({ range: rangeMock })),
        })),
      })),
    };
    const fullScan = await quotesSync.fetchAllQuotedBookIds(paginatedSupabase);
    expect(fullScan).not.toBeNull();
    expect(fullScan.ids.size).toBe(1002);
    expect(fullScan.downloadCounts.get(1001)).toBe(15);
    expect(rangeMock).toHaveBeenCalledTimes(2);
    expect(rangeMock).toHaveBeenNthCalledWith(1, 0, 999);
    expect(rangeMock).toHaveBeenNthCalledWith(2, 1000, 1999);

    // 2. computeOutOfWindowPrunePlan Option A:
    //    - popularPoolIds has 3 slots, 2 quoted (#1, #2) -> deficit = 1
    //    - demoted candidates: #30 (dl 900), #20 (dl 200), #10 (dl 50)
    //    - recentPool cap = 2, quoted recent: #78004, #78003, #78002
    //    -> retains #30 as 1-for-1 cushion, prunes least-popular #10, #20 + cycled recent #78002
    const planWithDeficit = quotesSync.computeOutOfWindowPrunePlan({
      currentQuotedIds: new Set([1, 2, 10, 20, 30, 78002, 78003, 78004]),
      popularPoolIds: new Set([1, 2, 3]),
      recentPoolIds: new Set([78003, 78004]),
      minRecentHorizonId: 78000,
      recentCap: 2,
      downloadCounts: new Map([
        [10, 50],
        [20, 200],
        [30, 900],
      ]),
    });
    expect(planWithDeficit.deferredPopularIds).toEqual([30]);
    expect(planWithDeficit.stalePopularIds).toEqual([10, 20]);
    expect(planWithDeficit.staleRecentIds).toEqual([78002]);
    expect(planWithDeficit.staleIds).toEqual([10, 20, 78002]);
    expect(planWithDeficit.deferredCount).toBe(1);

    // Once Top Popular reaches 3/3 (deficit = 0), cushion #30 drains cleanly too
    const planDrained = quotesSync.computeOutOfWindowPrunePlan({
      currentQuotedIds: new Set([1, 2, 3, 30, 78003, 78004]),
      popularPoolIds: new Set([1, 2, 3]),
      recentPoolIds: new Set([78003, 78004]),
      minRecentHorizonId: 78000,
      recentCap: 2,
      downloadCounts: new Map([[30, 900]]),
    });
    expect(planDrained.deferredCount).toBe(0);
    expect(planDrained.staleIds).toEqual([30]);

    // 3. Cold-start / high-volume prune (> 500 IDs) triggers 50ms inter-chunk yield past chunk #20
    const bulkIds = Array.from({ length: 525 }, (_, i) => i + 100);
    const bulkRows = [
      { id: 1, download_count: 99999 },
      ...bulkIds.map((id) => ({ id, download_count: id })),
    ];
    const updateInMock = vi.fn().mockResolvedValue({ error: null });
    const sleepMock = vi.fn().mockResolvedValue(undefined);
    const bulkSupabase = {
      from: vi.fn(() => ({
        select: vi.fn((cols: string) => {
          if (cols.includes('title')) {
            return {
              in: vi.fn((_c: string, ids: number[]) =>
                Promise.resolve({
                  data: ids.map((id) => ({ id, title: `Volume ${id}`, download_count: id })),
                  error: null,
                })
              ),
            };
          }
          return {
            neq: vi.fn(() => Promise.resolve({ data: bulkRows, error: null })),
          };
        }),
        update: vi.fn(() => ({ in: updateInMock })),
      })),
    };
    const bulkLogger = { log: vi.fn() };
    const bulkPrune = await quotesSync.pruneOutOfWindowBookQuotes(
      bulkSupabase,
      new Set([1]),
      { minRecentHorizonId: 90000, recentPool: 64, sleepFn: sleepMock },
      bulkLogger
    );
    expect(bulkPrune.prunedCount).toBe(525);
    expect(bulkPrune.eligibleCount).toBe(525);
    expect(bulkPrune.remainingBacklogCount).toBe(0);
    expect(updateInMock).toHaveBeenCalledTimes(21); // 525 / 25 chunks
    expect(sleepMock).toHaveBeenCalledTimes(1); // chunk #21 yields once past 500
    expect(sleepMock).toHaveBeenCalledWith(50);

    // 4. Full runFeaturedQuotesSync cold-start discovery catches out-of-window book #44444 + cycled recent #75001
    const top1 = catalogRow({ id: 1, title: 'Top Canon 1', download_count: 90000, quotes: makeQuotes(12, 'Top1') });
    const rec2 = catalogRow({ id: 75003, title: 'Newest Recent 2', download_count: 10, quotes: makeQuotes(12, 'Rec2') });
    const rec1 = catalogRow({ id: 75002, title: 'Newer Recent 1', download_count: 10, quotes: makeQuotes(12, 'Rec1') });
    const coldStartQuotedRows = [
      { id: 1, title: 'Top Canon 1', download_count: 90000 },
      { id: 44444, title: 'Historical Demoted Classic', download_count: 120 },
      { id: 75003, title: 'Newest Recent 2', download_count: 10 },
      { id: 75002, title: 'Newer Recent 1', download_count: 10 },
      { id: 75001, title: 'Aged Recent Volume', download_count: 5 },
    ];
    const coldPruneInMock = vi.fn().mockResolvedValue({ error: null });
    const coldStartSupabase = {
      from: vi.fn(() => ({
        select: vi.fn((cols: string) => {
          if (cols === 'id, download_count') {
            return {
              neq: vi.fn(() => Promise.resolve({ data: coldStartQuotedRows, error: null })),
            };
          }
          if (cols.includes('title, download_count') && !cols.includes('authors')) {
            return {
              in: vi.fn((_c: string, ids: number[]) =>
                Promise.resolve({
                  data: coldStartQuotedRows.filter((r) => ids.includes(r.id)),
                  error: null,
                })
              ),
            };
          }
          return {
            order: vi.fn((col: string) => ({
              limit: vi.fn().mockResolvedValue({
                data: col === 'download_count' ? [top1] : [rec2, rec1],
                error: null,
              }),
            })),
            in: vi.fn((_c: string, ids: number[]) =>
              Promise.resolve({
                data: [top1, rec2, rec1].filter((r) => ids.includes(r.id)),
                error: null,
              })
            ),
          };
        }),
        update: vi.fn(() => ({ in: coldPruneInMock })),
      })),
    };
    const coldLogger = { log: vi.fn(), error: vi.fn() };
    const coldSummary = await quotesSync.runFeaturedQuotesSync(
      { popularPool: 1, recentPool: 2, limit: 10 },
      {
        env: {},
        supabaseClient: coldStartSupabase,
        fetchBookFromR2: vi.fn(),
        logger: coldLogger,
        writeSeedFile: false,
      }
    );
    expect(coldSummary.pruned).toBe(2);
    expect(coldPruneInMock).toHaveBeenCalledWith('id', [44444, 75001]);
    expect(coldSummary.pruneStats).toMatchObject({
      eligible: 2,
      purged: 2,
      remaining: 0,
      deferred: 0,
    });
    expect(coldSummary.report).toContain('| Out-of-Window (Pruned) | 2 | 2 purged | 0 | 100% |');
    expect(coldSummary.report).toContain(
      '| 1 | Demoted Popular | 44444 | Historical Demoted Classic | Database | 🧹 Pruned — left Top Popular pool | — |'
    );
    expect(coldSummary.report).toContain(
      '| 2 | Cycled Recent | 75001 | Aged Recent Volume | Database | 🧹 Pruned — aged past Rolling Recent cap | — |'
    );
    const coldLogs = coldLogger.log.mock.calls.map((c) => String(c[0]));
    expect(coldLogs.some((l) => l.includes('• Out-of-Window:  2 quoted book(s)'))).toBe(true);
    expect(
      coldLogs.some((l) => l.includes('[Prune 2/2 · Cycled Recent] #75001 "Aged Recent Volume": quotes cleared.'))
    ).toBe(true);
  });

  it('reads books/<id>.txt.gz strictly from private R2 and records non-sentinel r2-miss without touching PG mirrors', async () => {
    const sampleBookText = Array.from(
      { length: 22 },
      (_, i) =>
        `Chapter ${i + 1}\n\n"A genuine classic passage number ${i + 1} that illuminates the quiet resilience of human curiosity across generations." — Narrative Reflection\n\nOrdinary filler paragraph describing a quiet street lamp glowing through the November fog outside the library window.`
    ).join('\n\n');

    const updateEqMock = vi.fn(async () => ({ error: null }));
    const r2Supabase = {
      from: vi.fn((table: string) => {
        expect(table).toBe('books');
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [
                {
                  id: 1342,
                  title: 'Pride and Prejudice',
                  authors: [{ name: 'Austen, Jane' }],
                  translators: [],
                  subjects: ['Fiction'],
                  languages: ['en'],
                  copyright: false,
                  quotes: [],
                  content: null,
                  download_count: 55000,
                },
                {
                  id: 84,
                  title: 'Frankenstein',
                  authors: [{ name: 'Shelley, Mary' }],
                  translators: [],
                  subjects: ['Gothic'],
                  languages: ['en'],
                  copyright: false,
                  quotes: [],
                  content: null,
                  download_count: 42000,
                },
              ],
              error: null,
            })),
            eq: vi.fn(() => ({
              not: vi.fn(async () => ({ data: [], error: null })),
            })),
          })),
          update: vi.fn(() => ({ eq: updateEqMock })),
        };
      }),
    };

    const fetchBookFromR2Mock = vi.fn(async (bookId: number) => {
      if (bookId === 1342) {
        return { status: 'ok', text: sampleBookText };
      }
      return { status: 'not_found' };
    });

    const summary = await quotesSync.runFeaturedQuotesSync(
      { ids: [1342, 84], limit: 2, targetCount: 10 },
      {
        env: {},
        supabaseClient: r2Supabase,
        fetchBookFromR2: fetchBookFromR2Mock,
        sleepFn: async () => {},
        logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
        writeSeedFile: false,
      }
    );

    expect(quotesSync.describeQuoteSource('r2')).toBe('Cloudflare R2');
    expect(fetchBookFromR2Mock).toHaveBeenCalledTimes(2);
    // 1342 came straight from R2; 84 recorded cleanly as r2-miss without external HTTP requests
    expect(summary.fromR2).toBe(1);
    expect(summary.r2Missing).toBe(1);
    expect(summary.sentinelMarked).toBe(0);
    expect(summary.updated).toBe(1);
    expect(summary.report).toContain('Cloudflare R2 1');
    expect(summary.books.find((b: { id: number }) => b.id === 1342)?.source).toBe('r2');
    expect(summary.books.find((b: { id: number }) => b.id === 84)?.outcome).toBe('r2-miss');
  });

  it('supports --source=auto|r2, rejects --mirrors/--source=mirrors, displays startup Text Source telemetry, and records non-sentinel r2-miss handling', async () => {
    expect(quotesSync.normalizeQuoteTextSource('r2-only')).toBe('r2');
    expect(quotesSync.normalizeQuoteTextSource('auto')).toBe('r2');
    expect(() => quotesSync.normalizeQuoteTextSource('https-mirrors')).toThrow(
      /mirror HTTP scraping is retired/i
    );
    expect(() => quotesSync.parseCliArgs(['--help', '--mirrors=none'])).toThrow(
      /mirror HTTP fallback is retired/i
    );

    const parsedR2 = quotesSync.parseCliArgs(['--help', '--source=r2']);
    expect(parsedR2.help).toBe(true);
    expect(parsedR2.source).toBe('r2');

    const usageLogs: string[] = [];
    quotesSync.printUsageGuide({ log: (msg: string) => usageLogs.push(msg) });
    expect(usageLogs.join('\n')).toContain('--source=MODE');

    expect(quotesSync.formatTextSourceDescription()).toBe(
      'r2 — Cloudflare R2 only (0s delay, zero external mirror requests)'
    );

    const bannerWithSource = quotesSync.formatInitialPoolBanner({
      topPoolSize: 500,
      topDone: 400,
      recentPoolSize: 64,
      recentDone: 64,
      batchTopCount: 10,
      batchRecentCount: 0,
      totalBatchCount: 10,
      textSource: 'r2',
    });
    expect(bannerWithSource).toContain(
      '• Text Source:    r2 — Cloudflare R2 only (0s delay, zero external mirror requests)'
    );

    // 1) Fail fast when source=r2 and R2_* is unconfigured
    await expect(
      quotesSync.runFeaturedQuotesSync(
        { source: 'r2', ids: [1342], dryRun: true },
        {
          env: {},
          logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
          writeSeedFile: false,
        }
      )
    ).rejects.toThrow(/requires R2_ACCOUNT_ID/);

    // 2) Reject oversize (>15 MB) R2 payload cleanly while extracting normal R2 hits and skipping R2 misses
    const sampleBookText = Array.from(
      { length: 14 },
      (_, i) =>
        `Chapter ${i + 1}\n\n"A clear literary insight number ${i + 1} that endures across quiet centuries of reading and reflection." — Narrative Voice\n\nFiller prose sentence detailing a lantern on a misty harbor pier.`
    ).join('\n\n');
    const persistedUpdates: Array<{ id: number; quotes: unknown[] }> = [];
    const buildTestSupabase = () => ({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(async () => ({
            data: [
              {
                id: 1342,
                title: 'Pride and Prejudice',
                authors: [{ name: 'Austen, Jane' }],
                translators: [],
                subjects: ['Fiction'],
                languages: ['en'],
                copyright: false,
                quotes: [],
                content: null,
                download_count: 55000,
              },
              {
                id: 84,
                title: 'Frankenstein',
                authors: [{ name: 'Shelley, Mary' }],
                translators: [],
                subjects: ['Gothic'],
                languages: ['en'],
                copyright: false,
                quotes: [],
                content: null,
                download_count: 42000,
              },
            ],
            error: null,
          })),
          eq: vi.fn(() => ({
            not: vi.fn(async () => ({ data: [], error: null })),
          })),
        })),
        update: vi.fn((payload: { quotes: unknown[] }) => ({
          eq: vi.fn(async (_col: string, id: number) => {
            persistedUpdates.push({ id, quotes: payload.quotes });
            return { error: null };
          }),
        })),
      })),
    });

    const r2FetchMock = vi.fn(async (bookId: number) =>
      bookId === 1342 ? { status: 'ok', text: sampleBookText } : { status: 'not_found' }
    );
    const logs: string[] = [];

    const r2OnlySummary = await quotesSync.runFeaturedQuotesSync(
      { source: 'r2', ids: [1342, 84], limit: 2, targetCount: 10 },
      {
        env: {},
        supabaseClient: buildTestSupabase(),
        fetchBookFromR2: r2FetchMock,
        sleepFn: async () => {},
        logger: { log: (m: string) => logs.push(m), error: vi.fn(), warn: vi.fn() },
        writeSeedFile: false,
      }
    );

    expect(r2OnlySummary.fromR2).toBe(1);
    expect(r2OnlySummary.r2Missing).toBe(1);
    expect(r2OnlySummary.sentinelMarked).toBe(0);
    expect(r2OnlySummary.updated).toBe(1);
    expect(persistedUpdates.map((u) => u.id)).toEqual([1342]);
    expect(r2OnlySummary.books.find((b: { id: number }) => b.id === 84)?.outcome).toBe('r2-miss');
    expect(r2OnlySummary.report).toContain('**Text Source**: `r2 — Cloudflare R2 only');
    expect(r2OnlySummary.report).toContain('R2 miss (skipped): 1');
    expect(logs.join('\n')).toContain('1 r2-miss');

    // 3) Reject retired mirrors mode cleanly
    await expect(
      quotesSync.runFeaturedQuotesSync(
        { source: 'mirrors', ids: [1342], limit: 1 },
        {
          env: {},
          supabaseClient: buildTestSupabase(),
          fetchBookFromR2: r2FetchMock,
          logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
          writeSeedFile: false,
        }
      )
    ).rejects.toThrow(/mirror HTTP scraping is retired/i);
  });

  it('evaluates infrastructure failure thresholds strictly via shouldFailFeaturedQuotesRun', () => {
    expect(quotesSync.shouldFailFeaturedQuotesRun({ updated: 10, failed: 0, books: [] })).toBe(false);
    expect(
      quotesSync.shouldFailFeaturedQuotesRun({
        updated: 24,
        failed: 1,
        books: [...Array.from({ length: 24 }, () => ({ outcome: 'updated' })), { outcome: 'error' }],
      })
    ).toBe(false);

    expect(
      quotesSync.shouldFailFeaturedQuotesRun({
        updated: 0,
        failed: 1,
        books: [{ outcome: 'error' }],
      })
    ).toBe(true);

    expect(
      quotesSync.shouldFailFeaturedQuotesRun({
        updated: 2,
        failed: 4,
        books: [
          { outcome: 'updated' },
          { outcome: 'updated' },
          { outcome: 'error' },
          { outcome: 'error' },
          { outcome: 'error' },
          { outcome: 'error' },
        ],
      })
    ).toBe(true);

    expect(
      quotesSync.shouldFailFeaturedQuotesRun({
        updated: 2,
        failed: 2,
        books: [
          { outcome: 'updated' },
          { outcome: 'updated' },
          { outcome: 'error' },
          { outcome: 'error' },
        ],
      })
    ).toBe(false);
  });

  it('condenses routine saves into CI heartbeats above progressThreshold while keeping exceptions visible', async () => {
    const denseProse = Array.from(
      { length: 14 },
      (_, i) =>
        `Chapter ${i + 1}\n\n"A clear literary insight number ${i + 1} that endures across quiet centuries of reading and reflection." — Narrative Voice\n\nFiller prose sentence detailing a lantern on a misty harbor pier.`
    ).join('\n\n');
    const booksRows = [
      { id: 1342, title: 'Pride and Prejudice', authors: [{ name: 'Austen, Jane' }], translators: [], subjects: ['Fiction'], languages: ['en'], copyright: false, quotes: [], content: null, download_count: 55000 },
      { id: 84, title: 'Frankenstein', authors: [{ name: 'Shelley, Mary' }], translators: [], subjects: ['Gothic'], languages: ['en'], copyright: false, quotes: [], content: null, download_count: 42000 },
      { id: 2701, title: 'Moby-Dick', authors: [{ name: 'Melville, Herman' }], translators: [], subjects: ['Adventure'], languages: ['en'], copyright: false, quotes: [], content: null, download_count: 35000 },
      { id: 98, title: 'A Tale of Two Cities', authors: [{ name: 'Dickens, Charles' }], translators: [], subjects: ['Fiction'], languages: ['en'], copyright: false, quotes: [], content: null, download_count: 31000 },
    ];
    const logs: string[] = [];
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table !== 'books') return {};
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: booksRows, error: null })),
            eq: vi.fn(() => ({
              not: vi.fn(async () => ({ data: [], error: null })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
          })),
        };
      }),
    };

    const r2Fetch = vi.fn(async (id: number) =>
      id === 98 ? { status: 'not_found' } : { status: 'ok', text: denseProse }
    );

    const summary = await quotesSync.runFeaturedQuotesSync(
      { source: 'r2', ids: [1342, 84, 2701, 98], limit: 4, targetCount: 10 },
      {
        env: { GITHUB_ACTIONS: 'true' },
        supabaseClient: mockClient,
        fetchBookFromR2: r2Fetch,
        sleepFn: async () => {},
        progressThreshold: 2,
        progressOptions: { ciMinTotalForPercent: 1, ciPercentStep: 50 },
        logger: { log: (m: string) => logs.push(m), error: (m: string) => logs.push(m), warn: vi.fn() },
        writeSeedFile: false,
      }
    );

    expect(summary.updated).toBe(3);
    expect(summary.r2Missing).toBe(1);
    const output = logs.join('\n');
    expect(output).toContain('50.0% | 2 / 4');
    expect(output).toContain('100.0% | 4 / 4');
    expect(output).not.toContain('quotes saved (source: Cloudflare R2)');
  });
});
