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
  it('resolves PGLAF mirror URLs, uses canonical repository User-Agent, and never targets www.gutenberg.org', () => {
    expect(quotesSync.USER_AGENT).toMatch(
      /^Bookarium-PublicDomain-Reader\/1\.0 \(\+https?:\/\/.+\)$/
    );
    expect(quotesSync.buildDescriptiveUserAgent('Bookarium-Sync', '2.0')).toMatch(
      /^Bookarium-Sync\/2\.0 \(\+https?:\/\/.+\)$/
    );
    expect(quotesSync.DEFAULT_POPULAR_POOL_SIZE).toBe(500);
    expect(quotesSync.DEFAULT_RECENT_POOL_SIZE).toBe(64);
    expect(quotesSync.resolveSelectedMirrors('pglaf,aleph')).toEqual([
      'https://gutenberg.pglaf.org',
      'https://aleph.gutenberg.org',
    ]);
    expect(quotesSync.resolveSelectedMirrors('invalid')).toEqual([
      'https://gutenberg.pglaf.org',
    ]);

    const singleMirrorUrls = quotesSync.buildSingleMirrorCandidateUrls(
      1342,
      'https://gutenberg.pglaf.org/'
    );
    expect(singleMirrorUrls).toEqual([
      'https://gutenberg.pglaf.org/1/3/4/1342/1342-0.txt',
      'https://gutenberg.pglaf.org/1/3/4/1342/1342.txt',
      'https://gutenberg.pglaf.org/1/3/4/1342/1342-8.txt',
    ]);

    const urls = quotesSync.buildMirrorCandidateUrls(1342);
    expect(urls.length).toBeGreaterThanOrEqual(6);
    expect(urls[0]).toBe('https://gutenberg.pglaf.org/1/3/4/1342/1342-0.txt');
    for (const url of urls) {
      expect(new URL(url).hostname).not.toBe('www.gutenberg.org');
    }

    expect(quotesSync.buildGutenbergPathDir(8)).toBe('0/8');
    expect(quotesSync.buildGutenbergPathDir(84)).toBe('8/84');
    expect(quotesSync.buildGutenbergPathDir(64317)).toBe('6/4/3/1/64317');
  });

  it('parses CLI arguments including --delay-range, --mirrors, --schedule-gate, --popular-pool, and --recent-pool', () => {
    const parsed = quotesSync.parseCliArgs([
      '--dry-run',
      '--force',
      '--schedule-gate',
      '--limit=10',
      '--delay-range=7.5-15.5',
      '--target-count=15',
      '--popular-pool=500',
      '--recent-pool=64',
      '--mirrors=pglaf,readingroo',
      '--ids=1342,84',
    ]);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.force).toBe(true);
    expect(parsed.scheduleGate).toBe(true);
    expect(parsed.limit).toBe(10);
    expect(parsed.minDelaySec).toBe(7.5);
    expect(parsed.maxDelaySec).toBe(15.5);
    expect(parsed.targetCount).toBe(15);
    expect(parsed.popularPool).toBe(500);
    expect(parsed.recentPool).toBe(64);
    expect(parsed.mirrors).toEqual([
      'https://gutenberg.pglaf.org',
      'https://gutenberg.readingroo.ms',
    ]);
    expect(parsed.ids).toEqual([1342, 84]);

    const defaultParsed = quotesSync.parseCliArgs([]);
    expect(defaultParsed.limit).toBe(50);
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
            data: [{ id: 1342, title: 'Pride and Prejudice', quotes: [] }],
            error: null,
          }),
        })),
      })),
    };
    const connectedIds = await quotesSync.fetchCandidateBooksFromSupabase(connectedByIdSupabase, {
      ids: [1342, 999999],
      limit: 10,
    });
    expect(connectedIds).toHaveLength(1);
    expect(connectedIds[0].id).toBe(1342);
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

  it('fetches book text from single mirror or across PGLAF mirrors with failover and classifies mirror-level errors', async () => {
    expect(quotesSync.isAllowedPglafMirrorUrl('https://gutenberg.pglaf.org/1/3/4/1342/1342-0.txt')).toBe(true);
    expect(quotesSync.isAllowedPglafMirrorUrl('https://www.gutenberg.org/files/1342/1342-0.txt')).toBe(false);
    expect(quotesSync.isAllowedPglafMirrorUrl('http://gutenberg.pglaf.org/1/3/4/1342/1342-0.txt')).toBe(false);

    const blockedMirrorRes = await quotesSync.fetchBookTextFromSingleMirror(
      1342,
      'https://www.gutenberg.org',
      vi.fn()
    );
    expect(blockedMirrorRes.ok).toBe(false);
    expect(blockedMirrorRes.status).toBe(403);

    const redirectBlockFetch = vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://www.gutenberg.org/files/1342/1342-0.txt',
      text: async () => SAMPLE_GUTENBERG_BOOK,
    });
    const redirectBlocked = await quotesSync.fetchBookTextFromSingleMirror(
      1342,
      'https://aleph.gutenberg.org',
      redirectBlockFetch
    );
    expect(redirectBlocked.ok).toBe(false);
    expect(redirectBlocked.status).toBe(403);

    const oversizedFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => String(quotesSync.MAX_BOOK_TEXT_BYTES + 1024) },
      text: async () => SAMPLE_GUTENBERG_BOOK,
    });
    const oversizedRes = await quotesSync.fetchBookTextFromSingleMirror(
      1342,
      'https://aleph.gutenberg.org',
      oversizedFetch
    );
    expect(oversizedRes.ok).toBe(false);
    expect(oversizedRes.status).toBe(413);

    const rateLimitFetch = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    const single429 = await quotesSync.fetchBookTextFromSingleMirror(
      1342,
      'https://aleph.gutenberg.org',
      rateLimitFetch
    );
    expect(single429.ok).toBe(false);
    expect(single429.isMirrorLevelError).toBe(true);
    expect(single429.status).toBe(429);

    const notFoundFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const single404 = await quotesSync.fetchBookTextFromSingleMirror(
      1342,
      'https://aleph.gutenberg.org',
      notFoundFetch
    );
    expect(single404.ok).toBe(false);
    expect(single404.isMirrorLevelError).toBe(false);
    expect(single404.status).toBe(404);

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('Mirror 1 timeout'))
      .mockResolvedValueOnce({
        ok: true,
        text: async () => SAMPLE_GUTENBERG_BOOK,
      });

    const result = await quotesSync.fetchBookTextFromMirrors(1342, fetchMock);
    expect(result.text).toContain('truth universally acknowledged');
    expect(new URL(result.mirrorUrl).hostname).toBe('aleph.gutenberg.org');

    const failFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(quotesSync.fetchBookTextFromMirrors(1342, failFetch)).rejects.toThrow(
      /Failed to fetch plain text/
    );
  });

  it('queries public.books by download_count DESC and executes runFeaturedQuotesSync across per-mirror workers, cooldowns, and sentinel fallbacks', async () => {
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
    ).rejects.toThrow(/Missing NEXT_PUBLIC_SUPABASE_URL/);

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

    // Simulate aleph returning 429 twice (triggering cooldown + worker halt), while pglaf & readingroo succeed
    // and volume 99999 returning 404 (triggering sentinel spread persistence)
    const fetchMock = vi.fn(async (url: string) => {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname === 'aleph.gutenberg.org') {
        return { ok: false, status: 429 };
      }
      if (parsedUrl.pathname.includes('/99999')) {
        return { ok: false, status: 404 };
      }
      return {
        ok: true,
        status: 200,
        text: async () => SAMPLE_GUTENBERG_BOOK,
      };
    });
    const sleepMock = vi.fn().mockResolvedValue(undefined);
    const silentLogger = { log: vi.fn(), error: vi.fn() };

    const summary = await quotesSync.runFeaturedQuotesSync(
      {
        limit: 6,
        minDelaySec: 8,
        maxDelaySec: 16,
        mirrorCooldownMs: 30000,
        mirrors: ['pglaf', 'aleph', 'readingroo'],
      },
      {
        supabaseClient: mockSupabase,
        fetchFn: fetchMock,
        sleepFn: sleepMock,
        logger: silentLogger,
        writeSeedFile: false,
      }
    );

    expect(summary.processed).toBe(5);
    expect(summary.skippedExisting).toBe(0); // 1342 already filtered out of Two-Tier candidate pool (>=10 quotes)
    expect(summary.fromSupabaseContent).toBe(1); // 84 extracted from books.content
    expect(summary.fromMirrors).toBe(3); // 2701, 64317, 11 downloaded across healthy mirrors
    expect(summary.sentinelMarked).toBe(1); // 99999 marked with 1-item sentinel spread after 404
    expect(summary.updated).toBe(4); // 84, 2701, 64317, 11 updated with multi-quote spreads
    expect(summary.mirrorBreakdown['https://aleph.gutenberg.org']).toBeUndefined();
    expect(
      (summary.mirrorBreakdown['https://gutenberg.pglaf.org'] || 0) +
        (summary.mirrorBreakdown['https://gutenberg.readingroo.ms'] || 0)
    ).toBe(3);
    expect(sleepMock).toHaveBeenCalledWith(30000); // Mirror cooldown sleep triggered on first 429
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
        order: vi.fn((col: string) => ({
          limit: vi.fn().mockResolvedValue({
            data: col === 'download_count' ? popularRows : recentRows,
            error: null,
          }),
        })),
      })),
      update: vi.fn(() => ({ eq: updateEqMock, in: pruneInMock })),
    })),
  };
  return { client, updateEqMock, pruneInMock };
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
        mirrorBreakdown: { 'https://gutenberg.pglaf.org': 1 },
        progress,
        books: [
          { order: 3, id: 99999, title: 'Gutenberg Volume #99999', tier: 'outside', source: 'none', outcome: 'not-found', quoteCount: 0, existingQuoteCount: 0 },
          { order: 1, id: 84, title: 'Frankenstein | Or\nThe Modern Prometheus', tier: 'top', source: 'https://gutenberg.pglaf.org', outcome: 'updated', quoteCount: 14, existingQuoteCount: 6 },
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
    expect(report).toContain('Mirrors: gutenberg.pglaf.org 1');
    expect(report).toContain(
      '| 1 | Top | 84 | Frankenstein \\| Or The Modern Prometheus | gutenberg.pglaf.org | ✅ Saved | 6 → 14 |'
    );
    expect(report).toContain('| 2 | Top | 1342 | Pride and Prejudice | Database | ⏭️ Already has quotes | 14 |');
    expect(report).toContain('| 3 | Outside pools | 99999 | Gutenberg Volume #99999 | — | ❓ Not in catalog | — |');
    // Ledger rows are ordered by batch position, not by completion order
    expect(report.indexOf('| 1 | Top | 84 |')).toBeLessThan(report.indexOf('| 3 | Outside pools |'));

    const noProgress = quotesSync.formatRunReport(
      { pruned: 0, mirrorBreakdown: {}, progress: null, books: [] },
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
        mirrorBreakdown: { 'https://gutenberg.pglaf.org': 2 },
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
    expect(consoleSummary).toContain('Mirrors:        gutenberg.pglaf.org (2)');
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
      { limit: 3, minDelaySec: 8, maxDelaySec: 8, mirrors: ['pglaf'] },
      {
        env: {},
        supabaseClient: client,
        fetchFn: vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: async () => SAMPLE_GUTENBERG_BOOK,
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
        l.includes('[Top 3/3 · Pool: 4/4 (100.0%)] #4 "Book 4": 2 quotes saved (source: gutenberg.pglaf.org · waited 8.0s).')
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
      const summary = await quotesSync.runFeaturedQuotesSync(
        { ids: [1342, 84, 999999], limit: 10 },
        {
          env: {},
          supabaseClient: client,
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
        source: 'supabase-content',
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
        { env: {}, supabaseClient: client, logger, writeSeedFile: false }
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
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('falls back to Manual labels when the tier pool scan fails, and fails books left queued after all mirrors halt', async () => {
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

    // Single mirror rate-limits every request: first two books fail, worker halts, third is left queued
    const books = [
      catalogRow({ id: 2701, title: 'Moby Dick' }),
      catalogRow({ id: 11, title: 'Alice in Wonderland' }),
      catalogRow({ id: 98, title: 'A Tale of Two Cities' }),
    ];
    const { client } = createCatalogSupabase(books, books, []);
    const logger = { log: vi.fn(), error: vi.fn() };
    const summary = await quotesSync.runFeaturedQuotesSync(
      { ids: [2701, 11, 98], limit: 10, mirrors: ['pglaf'], mirrorCooldownMs: 0 },
      {
        env: {},
        supabaseClient: client,
        fetchFn: vi.fn().mockResolvedValue({ ok: false, status: 429 }),
        sleepFn: vi.fn().mockResolvedValue(undefined),
        logger,
        writeSeedFile: false,
      }
    );

    expect(summary.failed).toBe(3);
    const notes = (summary.books as LedgerEntry[]).map((b) => `${b.id}:${b.outcome}:${b.note}`);
    expect(notes).toEqual(
      expect.arrayContaining([
        '2701:failed:enabled mirrors unavailable',
        '11:failed:enabled mirrors unavailable',
        '98:failed:all enabled mirrors halted',
      ])
    );
    expect(summary.books.every((b: LedgerEntry) => b.tier === 'top')).toBe(true);
    expect(summary.report).toContain('Failed: 3');
  });
});
