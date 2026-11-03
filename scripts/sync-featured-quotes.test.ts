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
    expect(quotesSync.USER_AGENT).toBe(
      'Bookarium-PublicDomain-Reader/1.0 (+https://github.com/calin-m/Bookarium)'
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
  });

  it('blends Two-Tier candidates (20 Popular + 5 Recent) with overlap deduplication and automatic backfill, and prunes out-of-window quotes', async () => {
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
