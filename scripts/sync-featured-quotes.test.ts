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
  it('defines 25 unique classic books and strictly PGLAF mirror URLs (never www.gutenberg.org)', () => {
    expect(quotesSync.CURATED_QUOTE_BOOKS).toHaveLength(25);
    const uniqueIds = new Set(quotesSync.CURATED_QUOTE_BOOKS.map((b: { id: number }) => b.id));
    expect(uniqueIds.size).toBe(25);

    const singleMirrorUrls = quotesSync.buildSingleMirrorCandidateUrls(
      1342,
      'https://aleph.gutenberg.org/'
    );
    expect(singleMirrorUrls).toEqual([
      'https://aleph.gutenberg.org/1/3/4/1342/1342-0.txt',
      'https://aleph.gutenberg.org/1/3/4/1342/1342.txt',
      'https://aleph.gutenberg.org/1/3/4/1342/1342-8.txt',
    ]);

    const urls = quotesSync.buildMirrorCandidateUrls(1342);
    expect(urls.length).toBeGreaterThanOrEqual(6);
    expect(urls[0]).toBe('https://aleph.gutenberg.org/1/3/4/1342/1342-0.txt');
    for (const url of urls) {
      expect(url).not.toContain('www.gutenberg.org');
    }

    expect(quotesSync.buildGutenbergPathDir(8)).toBe('0/8');
    expect(quotesSync.buildGutenbergPathDir(84)).toBe('8/84');
    expect(quotesSync.buildGutenbergPathDir(64317)).toBe('6/4/3/1/64317');
  });

  it('parses CLI arguments and normalizes min/max float delays', () => {
    const parsed = quotesSync.parseCliArgs([
      '--dry-run',
      '--force',
      '--limit=10',
      '--min-delay=12',
      '--max-delay=8',
      '--target-count=15',
      '--ids=1342,84',
    ]);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.force).toBe(true);
    expect(parsed.limit).toBe(10);
    expect(parsed.minDelaySec).toBe(12);
    expect(parsed.maxDelaySec).toBe(12);
    expect(parsed.targetCount).toBe(15);
    expect(parsed.ids).toEqual([1342, 84]);
  });

  it('computes randomized float delays between [8.0s, 16.0s] in milliseconds', () => {
    expect(quotesSync.computeRandomDelayMs(8, 16, () => 0)).toBe(8000);
    expect(quotesSync.computeRandomDelayMs(8, 16, () => 0.5)).toBe(12000);
    expect(quotesSync.computeRandomDelayMs(8, 16, () => 1)).toBe(16000);
  });

  it('extracts multi-quote spreads, wraps quotes cleanly, and merges upsert-only without duplicates', () => {
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
    expect(result.mirrorUrl).toContain('gutenberg.pglaf.org');

    const failFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(quotesSync.fetchBookTextFromMirrors(1342, failFetch)).rejects.toThrow(
      /Failed to fetch plain text/
    );
  });

  it('loads environment variables from temp directory and executes runFeaturedQuotesSync across 3 per-mirror workers, cooldowns, and DB paths', async () => {
    const tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-quotes-env-'));
    try {
      fs.writeFileSync(path.join(tmpDir, '.env'), 'TEST_QUOTE_ENV="loaded_val"\n# comment\n', 'utf8');
      const loaded = quotesSync.loadEnv(tmpDir);
      expect(loaded.TEST_QUOTE_ENV).toBe('loaded_val');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    // Missing credentials without dryRun should throw
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

    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const insertMock = vi.fn().mockResolvedValue({ error: null });

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn((_col: string, id: number) => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data:
                id === 1342
                  ? { id: 1342, quotes: existingTenQuotes, content: null }
                  : id === 84
                    ? { id: 84, quotes: [], content: SAMPLE_GUTENBERG_BOOK }
                    : id === 2701
                      ? { id: 2701, quotes: [], content: null }
                      : null,
            }),
          })),
        })),
        update: vi.fn(() => ({
          eq: updateEqMock,
        })),
        insert: insertMock,
      })),
    };

    // Simulate aleph returning 429 twice (triggering cooldown + worker halt), while pglaf & readingroo succeed
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('aleph.gutenberg.org')) {
        return { ok: false, status: 429 };
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
        ids: [1342, 84, 2701, 64317, 11, 174],
        minDelaySec: 8,
        maxDelaySec: 16,
        mirrorCooldownMs: 30000,
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
    expect(summary.fromMirrors).toBe(4); // 2701, 64317, 11, 174 downloaded across healthy mirrors
    expect(summary.updated).toBe(5); // 84 & 2701 updated, 64317, 11, 174 inserted
    expect(summary.mirrorBreakdown['https://aleph.gutenberg.org']).toBeUndefined();
    expect(
      (summary.mirrorBreakdown['https://gutenberg.pglaf.org'] || 0) +
        (summary.mirrorBreakdown['https://gutenberg.readingroo.ms'] || 0)
    ).toBe(4);
    expect(sleepMock).toHaveBeenCalledWith(30000); // Mirror cooldown sleep triggered on first 429
    expect(updateEqMock).toHaveBeenCalledTimes(2);
    expect(insertMock).toHaveBeenCalledTimes(3);
  });
});

