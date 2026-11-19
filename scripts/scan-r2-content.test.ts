import { describe, it, expect, vi } from 'vitest';
import zlib from 'zlib';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const scanR2Content = require('./scan-r2-content');

const TEST_R2_ENV = {
  R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
  R2_BUCKET_NAME: 'bookarium-test-bucket',
  R2_ACCESS_KEY_ID: 'mock-r2-access-key',
  R2_SECRET_ACCESS_KEY: 'mock-r2-secret-signing-key',
};

function makeTextResponse(status: number, bodyText: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: () => null,
    },
    text: async () => bodyText,
    arrayBuffer: async () => Buffer.from(bodyText, 'utf8'),
  };
}

function makeGzipResponse(status: number, plainText: string) {
  const gz = zlib.gzipSync(Buffer.from(plainText, 'utf8'));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: () => 'application/gzip',
    },
    arrayBuffer: async () => gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength),
  };
}

function makeRawBufferResponse(status: number, buf: Buffer) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: () => 'application/gzip',
    },
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
}

describe('scripts/scan-r2-content', () => {
  it('parses CLI flags strictly with defaults and rejects unsafe or out-of-range inputs', () => {
    const defaults = scanR2Content.parseScanCliArgs([]);
    expect(defaults).toEqual({
      terms: ['asiafilm'],
      prefix: 'books/',
      ids: [],
      concurrency: 32,
      limit: null,
      maxMatches: 100,
      maxMinutes: 45,
      caseSensitive: false,
      failOnMatch: false,
      dryRun: false,
      json: false,
    });

    const parsed = scanR2Content.parseScanCliArgs([
      '--terms=asiafilm, asiafilms, asiafilm',
      '--prefix=books',
      '--ids=1342,84,1342',
      '--concurrency=16',
      '--limit=250',
      '--max-matches=50',
      '--max-minutes=20',
      '--case-sensitive',
      '--fail-on-match',
      '--dry-run',
      '--json',
    ]);
    expect(parsed).toEqual({
      terms: ['asiafilm', 'asiafilms'],
      prefix: 'books/',
      ids: [1342, 84],
      concurrency: 16,
      limit: 250,
      maxMatches: 50,
      maxMinutes: 20,
      caseSensitive: true,
      failOnMatch: true,
      dryRun: true,
      json: true,
    });

    expect(() => scanR2Content.parseScanCliArgs(['--terms=   '])).toThrow(/At least one non-empty/);
    expect(() => scanR2Content.parseScanCliArgs(['--prefix=covers/'])).toThrow(/Unsupported R2 scan prefix/);
    expect(() => scanR2Content.parseScanCliArgs(['--concurrency=0'])).toThrow(/--concurrency/);
    expect(() => scanR2Content.parseScanCliArgs(['--concurrency=65'])).toThrow(/--concurrency/);
    expect(() => scanR2Content.parseScanCliArgs(['--ids=abc'])).toThrow(/Invalid book ID/);
    expect(() => scanR2Content.parseScanCliArgs(['--max-minutes=200'])).toThrow(/--max-minutes/);
    expect(() => scanR2Content.parseScanCliArgs(['--bogus'])).toThrow(/Unknown CLI flag/);
  });

  it('performs linear literal scanning with sanitized single-line snippets and ReDoS-safe metacharacter handling', () => {
    const sample = 'Chapter 1\n\tVisited http://asiafilm.example|bad\x00link yesterday.\nAsiaFilm again.';
    const insensitive = scanR2Content.scanTextForTerms(sample, ['asiafilm', 'missing']);
    expect(insensitive.matched).toBe(true);
    expect(insensitive.totalHits).toBe(2);
    expect(insensitive.matchedTerms).toEqual(['asiafilm']);
    expect(insensitive.termCounts).toEqual({ asiafilm: 2 });
    expect(insensitive.snippet).not.toContain('\n');
    expect(insensitive.snippet).not.toContain('\x00');
    expect(insensitive.snippet).toContain('asiafilm.example|bad link');

    const sensitive = scanR2Content.scanTextForTerms(sample, ['asiafilm'], { caseSensitive: true });
    expect(sensitive.totalHits).toBe(1);

    const literalRegexChars = scanR2Content.scanTextForTerms('Match literally ([a-z]+) text', ['([a-z]+)']);
    expect(literalRegexChars.matched).toBe(true);
    expect(literalRegexChars.totalHits).toBe(1);
  });

  it('skips cleanly when all R2_* secrets are unset and fails fast on partial R2 configuration', async () => {
    const logger = { log: vi.fn() };
    const fetchSpy = vi.fn();

    const skipped = await scanR2Content.runR2ContentScan({}, { env: {}, logger, fetchFn: fetchSpy });
    expect(skipped.skippedUnconfigured).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('skipping content scan cleanly'));

    await expect(
      scanR2Content.runR2ContentScan(
        {},
        { env: { R2_ACCOUNT_ID: '0123456789abcdef' }, logger, fetchFn: fetchSpy }
      )
    ).rejects.toThrow(/Partial Cloudflare R2 configuration/);
  });

  it('runs --dry-run using ListObjectsV2 only with 0 GetObject Class B reads', async () => {
    const listXml = [
      '<ListBucketResult>',
      '<IsTruncated>false</IsTruncated>',
      '<Contents><Key>books/1342.txt.gz</Key><Size>1024</Size></Contents>',
      '<Contents><Key>books/84.txt.gz</Key><Size>2048</Size></Contents>',
      '<Contents><Key>covers/1342.jpg</Key><Size>512</Size></Contents>',
      '</ListBucketResult>',
    ].join('');
    const fetchMock = vi.fn().mockResolvedValueOnce(makeTextResponse(200, listXml));
    let writtenSummary = '';
    const fsStub = {
      appendFileSync: (_p: string, data: string) => {
        writtenSummary += data;
      },
    };
    const logger = { log: vi.fn() };

    const summary = await scanR2Content.runR2ContentScan(
      { dryRun: true, terms: ['asiafilm'] },
      { env: TEST_R2_ENV, fetchFn: fetchMock, fsImpl: fsStub, stepSummaryPath: 'step-summary.md', logger }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(summary.dryRun).toBe(true);
    expect(summary.queuedCount).toBe(2);
    expect(summary.listApiCalls).toBe(1);
    expect(summary.getApiCalls).toBe(0);
    expect(writtenSummary).toContain('(DRY RUN)');
    expect(writtenSummary).toContain('Queued Objects**: **2**');
  });

  it('scans stored books/*.txt.gz files, formats Step Summary with escaped cells, and handles 404 + corrupt gzip', async () => {
    const listXml = [
      '<ListBucketResult>',
      '<IsTruncated>false</IsTruncated>',
      '<Contents><Key>books/84.txt.gz</Key><Size>100</Size></Contents>',
      '<Contents><Key>books/1342.txt.gz</Key><Size>200</Size></Contents>',
      '<Contents><Key>books/999.txt.gz</Key><Size>50</Size></Contents>',
      '<Contents><Key>books/1000.txt.gz</Key><Size>50</Size></Contents>',
      '</ListBucketResult>',
    ].join('');

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('list-type=2')) {
        return makeTextResponse(200, listXml);
      }
      if (url.includes('/books/84.txt.gz')) {
        return makeGzipResponse(200, 'Clean Frankenstein prose.');
      }
      if (url.includes('/books/1342.txt.gz')) {
        return makeGzipResponse(200, 'Pride and Prejudice | injected asiafilm|mirror string.');
      }
      if (url.includes('/books/999.txt.gz')) {
        return makeTextResponse(404, '');
      }
      if (url.includes('/books/1000.txt.gz')) {
        return makeRawBufferResponse(200, Buffer.from([0x1f, 0x8b, 0x00, 0xff]));
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    let writtenSummary = '';
    const fsStub = {
      appendFileSync: (_p: string, data: string) => {
        writtenSummary += data;
      },
    };
    const logger = { log: vi.fn() };

    const summary = await scanR2Content.runR2ContentScan(
      { terms: ['asiafilm'], concurrency: 4 },
      { env: TEST_R2_ENV, fetchFn: fetchMock, fsImpl: fsStub, stepSummaryPath: 'summary.md', logger }
    );

    expect(summary.queuedCount).toBe(4);
    expect(summary.scannedObjects).toBe(4);
    expect(summary.readableObjects).toBe(2);
    expect(summary.notFoundCount).toBe(1);
    expect(summary.infraFailureCount).toBe(1);
    expect(summary.matchedCount).toBe(1);
    expect(summary.totalHitCount).toBe(1);
    expect(summary.matches[0]).toMatchObject({
      bookId: 1342,
      key: 'books/1342.txt.gz',
      matchedTerms: ['asiafilm'],
      totalHits: 1,
    });
    expect(writtenSummary).toContain('| 1342 | `books/1342.txt.gz` | `asiafilm` | 1 |');
    expect(writtenSummary).toContain('asiafilm\\|mirror');
    expect(writtenSummary).toContain('### Read / Decompression Errors');
    expect(scanR2Content.shouldFailR2ScanRun(summary, { failOnMatch: false })).toBe(false);
    expect(scanR2Content.shouldFailR2ScanRun(summary, { failOnMatch: true })).toBe(true);
  });

  it('supports targeted --ids scans without ListObjectsV2, respects --max-minutes budget, and flags excessive failures', async () => {
    const fetchTargeted = vi
      .fn()
      .mockResolvedValueOnce(makeGzipResponse(200, 'Found AsiaFilm reference here.'))
      .mockResolvedValueOnce(makeGzipResponse(200, 'Normal public domain prose.'));

    const targeted = await scanR2Content.runR2ContentScan(
      { ids: [1342, 84], terms: ['asiafilm'], json: true },
      { env: TEST_R2_ENV, fetchFn: fetchTargeted, stepSummaryPath: '', logger: { log: vi.fn() } }
    );
    expect(targeted.listApiCalls).toBe(0);
    expect(targeted.getApiCalls).toBe(2);
    expect(targeted.matchedCount).toBe(1);
    expect(targeted.matches[0].bookId).toBe(1342);

    let tick = 0;
    const nowFn = () => {
      tick += 1;
      return tick === 1 ? 1000 : 1000 + 61_000;
    };
    const budgeted = await scanR2Content.runR2ContentScan(
      { ids: [1, 2, 3], maxMinutes: 1 },
      { env: TEST_R2_ENV, fetchFn: vi.fn(), nowFn, stepSummaryPath: '', logger: { log: vi.fn() } }
    );
    expect(budgeted.stoppedByBudget).toBe(true);
    expect(budgeted.scannedObjects).toBe(0);

    expect(
      scanR2Content.shouldFailR2ScanRun({
        scannedObjects: 6,
        readableObjects: 2,
        infraFailureCount: 4,
        matchedCount: 0,
      })
    ).toBe(true);
    expect(
      scanR2Content.shouldFailR2ScanRun({
        scannedObjects: 2,
        readableObjects: 0,
        infraFailureCount: 2,
        matchedCount: 0,
      })
    ).toBe(true);
  });
});
