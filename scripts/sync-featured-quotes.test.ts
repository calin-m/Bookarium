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
  it('resolves PGLAF mirror URLs and never targets www.gutenberg.org', () => {
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

  it('parses CLI arguments including --delay-range, --mirrors, and --schedule-gate', () => {
    const parsed = quotesSync.parseCliArgs([
      '--dry-run',
      '--force',
      '--schedule-gate',
      '--limit=10',
      '--delay-range=7.5-15.5',
      '--target-count=15',
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
    expect(parsed.mirrors).toEqual([
      'https://gutenberg.pglaf.org',
      'https://gutenberg.readingroo.ms',
    ]);
    expect(parsed.ids).toEqual([1342, 84]);
  });

  it('computes randomized float delays and 6.0h–12.0h float schedule windows', async () => {
    expect(quotesSync.computeRandomDelayMs(8, 16, () => 0)).toBe(8000);
    expect(quotesSync.computeRandomDelayMs(8, 16, () => 0.5)).toBe(12000);
    expect(quotesSync.computeRandomDelayMs(8, 16, () => 1)).toBe(16000);

    const windowMs = quotesSync.computeScheduleWindowMs('2026-11-01T12:00:00.000Z', 6, 12);
    expect(windowMs).toBeGreaterThanOrEqual(6 * 3600 * 1000);
    expect(windowMs).toBeLessThanOrEqual(12 * 3600 * 1000);

    const mockScheduleSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          neq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { updated_at: '2026-11-01T12:00:00.000Z' },
                }),
              })),
            })),
          })),
        })),
      })),
    };

    const gateEarly = await quotesSync.evaluateScheduleGate(
      mockScheduleSupabase,
      { scheduleGate: true, minIntervalHours: 6, maxIntervalHours: 12 },
      Date.parse('2026-11-01T14:00:00.000Z') // Only 2h elapsed (< 6h min)
    );
    expect(gateEarly.allowed).toBe(false);
    expect(gateEarly.elapsedHours).toBe(2);

    const gateReady = await quotesSync.evaluateScheduleGate(
      mockScheduleSupabase,
      { scheduleGate: true, minIntervalHours: 6, maxIntervalHours: 12 },
      Date.parse('2026-11-02T02:00:00.000Z') // 14h elapsed (> 12h max)
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
      { id: 1342, title: 'Pride and Prejudice', quotes: existingTenQuotes, content: null },
      { id: 84, title: 'Frankenstein', quotes: [], content: SAMPLE_GUTENBERG_BOOK },
      { id: 2701, title: 'Moby Dick', quotes: [], content: null },
      { id: 64317, title: 'The Great Gatsby', quotes: [], content: null },
      { id: 11, title: 'Alice in Wonderland', quotes: [], content: null },
      { id: 99999, title: 'Short Pamphlet', quotes: [], content: 'Too short to extract quotes from body' },
    ];

    const updateEqMock = vi.fn().mockResolvedValue({ error: null });

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              contains: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn().mockResolvedValue({ data: candidateRows, error: null }),
                    })),
                  })),
                })),
              })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: updateEqMock,
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

    expect(summary.processed).toBe(6);
    expect(summary.skippedExisting).toBe(1); // 1342 skipped (>=10 quotes)
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
