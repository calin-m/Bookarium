import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const syncR2Assets = require('./sync-r2-assets');

const TEST_R2_ENV = {
  R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
  R2_BUCKET_NAME: 'bookarium-test-bucket',
  R2_ACCESS_KEY_ID: 'mock-r2-access-key',
  R2_SECRET_ACCESS_KEY: 'mock-r2-secret-signing-key',
};

const TEST_R2_CONFIG = syncR2Assets.getR2Config(TEST_R2_ENV);

function makeTextResponse(status: number, bodyText: string, headers: Record<string, string> = {}) {
  const headerMap = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => headerMap.get(String(name).toLowerCase()) ?? null,
    },
    text: async () => bodyText,
    arrayBuffer: async () => Buffer.from(bodyText, 'utf8'),
  };
}

function makeBinaryResponse(status: number, buffer: Buffer, headers: Record<string, string> = {}) {
  const headerMap = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => headerMap.get(String(name).toLowerCase()) ?? null,
    },
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  };
}

describe('sync-r2-assets CLI & SigV4 R2 engine', () => {
  describe('getR2Config & endpoint/URL validators', () => {
    it('validates server-only R2 credentials strictly and rejects malformed identifiers', () => {
      expect(syncR2Assets.isR2Configured(TEST_R2_ENV)).toBe(true);
      expect(TEST_R2_CONFIG).toEqual({
        accountId: '0123456789abcdef0123456789abcdef',
        bucket: 'bookarium-test-bucket',
        accessKeyId: 'mock-r2-access-key',
        secretAccessKey: 'mock-r2-secret-signing-key',
      });

      expect(syncR2Assets.getR2Config({})).toBeNull();
      expect(syncR2Assets.getR2Config({ ...TEST_R2_ENV, R2_ACCOUNT_ID: 'bad_acct' })).toBeNull();
      expect(syncR2Assets.getR2Config({ ...TEST_R2_ENV, R2_BUCKET_NAME: '../bad..bucket' })).toBeNull();
    });

    it('restricts R2 endpoints and PG asset URLs strictly to HTTPS allowlisted hosts', () => {
      expect(
        syncR2Assets.isAllowedR2EndpointUrl(
          'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/bookarium-test-bucket/books/1342.txt.gz'
        )
      ).toBe(true);
      expect(
        syncR2Assets.isAllowedR2EndpointUrl(
          'http://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/bookarium-test-bucket'
        )
      ).toBe(false);
      expect(syncR2Assets.isAllowedR2EndpointUrl('https://evil.example.com/bucket')).toBe(false);

      expect(
        syncR2Assets.isAllowedGutenbergAssetUrl('https://gutenberg.pglaf.org/cache/epub/1342/pg1342.txt')
      ).toBe(true);
      expect(
        syncR2Assets.isAllowedGutenbergAssetUrl('https://aleph.gutenberg.org/1/3/4/1342/1342-0.txt')
      ).toBe(true);
      expect(
        syncR2Assets.isAllowedGutenbergAssetUrl('https://gutenberg.readingroo.ms/cache/epub/1342/pg1342.cover.medium.jpg')
      ).toBe(true);
      expect(
        syncR2Assets.isAllowedGutenbergAssetUrl('https://www.gutenberg.org/cache/epub/1342/pg1342.txt')
      ).toBe(false);
    });
  });

  describe('parseCliArgs & transfer engine detection', () => {
    it('parses flags cleanly and rejects malformed CLI values', () => {
      const parsed = syncR2Assets.parseCliArgs([
        '--dry-run',
        '--limit=500',
        '--ids=1342,84,1342',
        '--cache-file=gutenberg-catalog-cache.json.gz',
        '--source=wsl-rsync',
        '--mirror=aleph',
        '--delay-range=2-4',
        '--max-minutes=25',
        '--books-only',
        '--force',
        '--recheck-missing',
        '--no-prune',
        '--force-prune',
        '--max-prune=100',
      ]);

      expect(parsed).toMatchObject({
        dryRun: true,
        limit: 500,
        ids: [1342, 84],
        cacheFile: 'gutenberg-catalog-cache.json.gz',
        source: 'wsl-rsync',
        mirrors: ['https://aleph.gutenberg.org'],
        delayMin: 2,
        delayMax: 4,
        maxMinutes: 25,
        syncBooks: true,
        syncCovers: false,
        force: true,
        recheckMissing: true,
        pruneWithdrawn: false,
        forcePrune: true,
        maxPrune: 100,
      });

      expect(() => syncR2Assets.parseCliArgs(['--limit=0'])).toThrow(/Invalid --limit/);
      expect(() => syncR2Assets.parseCliArgs(['--source=ftp'])).toThrow(/Unsupported --source/);
      expect(() => syncR2Assets.parseCliArgs(['--mirror=www'])).toThrow(/Unsupported --mirror/);
      expect(() => syncR2Assets.parseCliArgs(['--ids=1342,abc'])).toThrow(/Invalid Gutenberg ID/);
      expect(() => syncR2Assets.parseCliArgs(['--max-minutes=-5'])).toThrow(/Invalid --max-minutes/);
    });

    it('resolves rsync, wsl-rsync, or https transfer engines safely based on OS capabilities', () => {
      expect(syncR2Assets.resolveTransferEngine('https', 'linux')).toBe('https');
      expect(syncR2Assets.resolveTransferEngine('wsl-rsync', 'win32')).toBe('wsl-rsync');
      expect(
        syncR2Assets.resolveTransferEngine('auto', 'linux', () => ({ status: 0 }))
      ).toBe('rsync');
      expect(
        syncR2Assets.resolveTransferEngine('auto', 'win32', () => ({ status: 1 }))
      ).toBe('https');
      expect(
        syncR2Assets.resolveTransferEngine('rsync', 'win32', () => ({ status: 1 }))
      ).toBe('wsl-rsync');
    });
  });

  describe('AWS SigV4 signing, XML pagination, R2 state TTL & fetchBookTextFromR2', () => {
    it('signs canonical ListObjectsV2 query parameters and paginates prefix keys', async () => {
      const signed = syncR2Assets.signR2Request({
        config: TEST_R2_CONFIG,
        method: 'GET',
        key: '',
        queryParams: {
          prefix: 'books/',
          'list-type': '2',
          'max-keys': '1000',
        },
        now: new Date('2026-11-18T10:00:00.000Z'),
      });
      expect(signed.url).toContain('list-type=2&max-keys=1000&prefix=books%2F');
      expect(signed.headers.Authorization).toContain(
        'AWS4-HMAC-SHA256 Credential=mock-r2-access-key/20261118/auto/s3/aws4_request'
      );

      const page1Xml = `<ListBucketResult>
        <IsTruncated>true</IsTruncated>
        <NextContinuationToken>tok&amp;2</NextContinuationToken>
        <Contents><Key>books/1342.txt.gz</Key><Size>120000</Size></Contents>
        <Contents><Key>books/ignore-readme.txt</Key><Size>50</Size></Contents>
      </ListBucketResult>`;
      const page2Xml = `<ListBucketResult>
        <IsTruncated>false</IsTruncated>
        <Contents><Key>books/84.txt.gz</Key><Size>98000</Size></Contents>
      </ListBucketResult>`;

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(makeTextResponse(200, page1Xml))
        .mockResolvedValueOnce(makeTextResponse(200, page2Xml));

      const inv = await syncR2Assets.listR2PrefixIds(
        TEST_R2_CONFIG,
        'books/',
        /^books\/(\d+)\.txt\.gz$/,
        { fetchFn: fetchMock }
      );
      expect(inv.apiCalls).toBe(2);
      expect(inv.keyCount).toBe(3);
      expect(Array.from(inv.ids)).toEqual([1342, 84]);
      expect(fetchMock.mock.calls[1][0]).toContain('continuation-token=tok%262');
    });

    it('fetches and decompresses R2 book text safely and rejects HTML or oversized responses', async () => {
      const sampleText = 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.';
      const gzPayload = zlib.gzipSync(Buffer.from(sampleText, 'utf8'));

      const okFetch = vi
        .fn()
        .mockResolvedValue(makeBinaryResponse(200, gzPayload, { 'content-type': 'application/gzip' }));
      const okRes = await syncR2Assets.fetchBookTextFromR2(1342, {
        env: TEST_R2_ENV,
        fetchFn: okFetch,
      });
      expect(okRes).toEqual({ status: 'ok', text: sampleText });

      const missingRes = await syncR2Assets.fetchBookTextFromR2(999999, {
        env: TEST_R2_ENV,
        fetchFn: vi.fn().mockResolvedValue(makeTextResponse(404, 'Not Found')),
      });
      expect(missingRes).toEqual({ status: 'not_found' });

      const htmlRes = await syncR2Assets.fetchBookTextFromR2(1342, {
        env: TEST_R2_ENV,
        fetchFn: vi
          .fn()
          .mockResolvedValue(makeTextResponse(200, '<!DOCTYPE html><html>Error</html>', { 'content-type': 'text/html' })),
      });
      expect(htmlRes.status).toBe('error');

      const unconf = await syncR2Assets.fetchBookTextFromR2(1342, { env: {} });
      expect(unconf).toEqual({ status: 'unconfigured' });
    });

    it('reads and prunes expired 90-day entries from _meta/r2-sync-state.json.gz', async () => {
      const nowMs = Date.parse('2026-11-18T10:00:00.000Z');
      const freshIso = '2026-11-01T10:00:00.000Z';
      const staleIso = '2025-12-01T10:00:00.000Z';
      const stateGz = zlib.gzipSync(
        Buffer.from(
          JSON.stringify({
            version: 1,
            updatedAt: freshIso,
            missingCovers: { '10': freshIso, '20': staleIso },
            missingTexts: { '30': staleIso },
          }),
          'utf8'
        )
      );

      const loaded = await syncR2Assets.readR2SyncState(TEST_R2_CONFIG, {
        nowMs,
        fetchFn: vi.fn().mockResolvedValue(makeBinaryResponse(200, stateGz)),
      });
      expect(loaded.missingCovers).toEqual({ '10': freshIso });
      expect(loaded.missingTexts).toEqual({});
      expect(loaded.dirty).toBe(true);
    });
  });

  describe('buildR2DeltaPlan priority ordering & copyright/withdrawn safety guards', () => {
    it('prioritizes 27 hero classics then popularity DESC, honors cooldowns, excludes copyrighted uploads, and enforces 50k prune safety floor', () => {
      const books = [
        { id: 100, title: 'Popular Plain', copyright: false, download_count: 9000 },
        { id: 205, title: 'Walden', copyright: false, download_count: 2000 },
        { id: 300, title: 'Copyrighted Title', copyright: true, download_count: 50000 },
        { id: 400, title: 'Cooldown Coverless', copyright: false, download_count: 500 },
      ];

      const plan = syncR2Assets.buildR2DeltaPlan({
        books,
        existingBookIds: new Set([300, 400, 88888]),
        existingCoverIds: new Set([300]),
        syncState: {
          missingCovers: { '400': '2026-11-10T00:00:00.000Z' },
          missingTexts: {},
        },
        options: { force: false, recheckMissing: false },
        isFullCatalog: false,
      });

      // Hero 205 precedes 100 even with lower downloads; copyrighted 300 & already-covered/cooldown 400 skipped from uploadQueue
      expect(plan.uploadQueue.map((item: { id: number }) => item.id)).toEqual([205, 100]);
      // Copyrighted #300 assets queued for deletion, while 88888 withdrawn ID NOT deleted because isFullCatalog=false (<50k guard)
      expect(plan.deleteTargets).toEqual([
        { id: 300, key: 'books/300.txt.gz', reason: 'copyrighted' },
        { id: 300, key: 'covers/300.jpg', reason: 'copyrighted' },
      ]);
    });

    it('permits withdrawn ID deletion cleanly when full >= 50,000 catalog is verified within prune cap', () => {
      const books = Array.from({ length: 50_000 }, (_, i) => ({
        id: i + 1,
        title: `Book #${i + 1}`,
        copyright: false,
        download_count: 10,
      }));
      const plan = syncR2Assets.buildR2DeltaPlan({
        books,
        existingBookIds: new Set([1, 999999]),
        existingCoverIds: new Set([1, 999999]),
        syncState: { missingCovers: {}, missingTexts: {} },
        options: { limit: null },
        isFullCatalog: true,
      });
      expect(plan.deleteTargets).toEqual([
        { id: 999999, key: 'books/999999.txt.gz', reason: 'withdrawn' },
        { id: 999999, key: 'covers/999999.jpg', reason: 'withdrawn' },
      ]);
    });
  });

  describe('runR2AssetSync end-to-end rsync, HTTPS & bounded Markdown reporting', () => {
    it('executes shell-free rsync --files-from batches, compresses texts, uploads R2 assets, records misses, and writes bounded summary tables', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookarium-r2-test-'));
      try {
        const snapshotPath = path.join(tmpDir, 'catalog.json.gz');
        const summaryPath = path.join(tmpDir, 'summary.md');
        const snapPayload = JSON.stringify({
          version: 1,
          books: [
            { id: 1342, title: 'Pride & Prejudice', copyright: false, download_count: 55000 },
            { id: 84, title: 'Frankenstein', copyright: false, download_count: 42000 },
            { id: 901, title: 'Restricted Volume', copyright: true, download_count: 1000 },
          ],
        });
        fs.writeFileSync(snapshotPath, zlib.gzipSync(Buffer.from(snapPayload, 'utf8')));

        const putCalls: string[] = [];
        const deleteCalls: string[] = [];
        const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
          const parsed = new URL(url);
          const method = String(init.method || 'GET').toUpperCase();
          if (method === 'GET' && parsed.searchParams.get('prefix') === 'books/') {
            return makeTextResponse(
              200,
              '<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>books/901.txt.gz</Key><Size>12</Size></Contents></ListBucketResult>'
            );
          }
          if (method === 'GET' && parsed.searchParams.get('prefix') === 'covers/') {
            return makeTextResponse(200, '<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>');
          }
          if (method === 'GET' && parsed.pathname.endsWith('/_meta/r2-sync-state.json.gz')) {
            return makeTextResponse(404, 'Not Found');
          }
          if (method === 'DELETE') {
            deleteCalls.push(parsed.pathname);
            return makeTextResponse(204, '');
          }
          if (method === 'PUT') {
            putCalls.push(parsed.pathname);
            return makeTextResponse(200, '');
          }
          return makeTextResponse(404, 'Unhandled');
        });

        const spawnMock = vi.fn((cmd: string, args: string[], opts: { cwd: string; shell?: boolean }) => {
          expect(opts.shell).toBe(false);
          const proc = new EventEmitter();
          const sourceArg = args[args.length - 2];
          if (sourceArg === syncR2Assets.RSYNC_EPUB_SOURCE) {
            // 1342 has both text and cover; 84 cover is missing (recorded in missingCovers) and falls back to main rsync for text
            fs.mkdirSync(path.join(opts.cwd, '1342'), { recursive: true });
            fs.writeFileSync(path.join(opts.cwd, '1342', 'pg1342.txt'), 'It is a truth universally acknowledged...', 'utf8');
            fs.writeFileSync(path.join(opts.cwd, '1342', 'pg1342.cover.medium.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
          } else if (sourceArg === syncR2Assets.RSYNC_MAIN_SOURCE) {
            fs.mkdirSync(path.join(opts.cwd, '8'), { recursive: true });
            fs.mkdirSync(path.join(opts.cwd, '8', '84'), { recursive: true });
            fs.writeFileSync(path.join(opts.cwd, '8', '84', '84-0.txt'), 'Letter 1\nTo Mrs. Saville, England.', 'utf8');
          }
          queueMicrotask(() => proc.emit('close', sourceArg === syncR2Assets.RSYNC_EPUB_SOURCE ? 23 : 0));
          return proc;
        });

        const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const result = await syncR2Assets.runR2AssetSync(
          { cacheFile: snapshotPath, source: 'rsync' },
          {
            env: TEST_R2_ENV,
            fetchFn: fetchMock,
            spawnFn: spawnMock,
            stepSummaryPath: summaryPath,
            logger,
          }
        );

        expect(result.textsUploaded).toBe(2);
        expect(result.coversUploaded).toBe(1);
        expect(result.deletedCopyrightedCount).toBe(1);
        expect(result.knownMissingCoversCount).toBe(1);
        expect(deleteCalls).toEqual(['/bookarium-test-bucket/books/901.txt.gz']);
        expect(putCalls).toContain('/bookarium-test-bucket/books/1342.txt.gz');
        expect(putCalls).toContain('/bookarium-test-bucket/covers/1342.jpg');
        expect(putCalls).toContain('/bookarium-test-bucket/books/84.txt.gz');
        expect(putCalls).toContain('/bookarium-test-bucket/_meta/r2-sync-state.json.gz');

        const summaryContent = fs.readFileSync(summaryPath, 'utf8');
        expect(summaryContent).toContain('## ☁️ Cloudflare R2 Delta Asset Sync — Run Report');
        expect(summaryContent).toContain('| Books (`.txt.gz`) | 2 | 1 | +2 | 0 | 1 | 0 |');
        expect(summaryContent).toContain('| 1 | 901 | Restricted Volume | 1,000 | 🗑 pruned (copyrighted) | — |');
        expect(summaryContent).toContain('| 2 | 1342 | Pride & Prejudice | 55,000 | ✅ uploaded | ✅ uploaded |');
        expect(summaryContent).toContain('| 3 | 84 | Frankenstein | 42,000 | ✅ uploaded | — |');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('supports PGLAF HTTPS fallback, respects --max-minutes cutoff, caps huge ledgers cleanly, and skips unconfigured runs', async () => {
      const unconfRes = await syncR2Assets.runR2AssetSync({}, { env: {}, logger: { log: vi.fn() } });
      expect(unconfRes.skippedUnconfigured).toBe(true);

      const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
        const parsed = new URL(url);
        const method = String(init.method || 'GET').toUpperCase();
        if (parsed.hostname.endsWith('.r2.cloudflarestorage.com')) {
          if (method === 'GET' && parsed.searchParams.has('prefix')) {
            return makeTextResponse(200, '<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>');
          }
          if (method === 'GET') return makeTextResponse(404, 'Not Found');
          return makeTextResponse(200, '');
        }
        if (url.includes('1342/pg1342.txt')) {
          return makeTextResponse(200, 'Pride and Prejudice full HTTPS body');
        }
        if (url.includes('1342/pg1342.cover.medium.jpg')) {
          return makeBinaryResponse(200, Buffer.from([0xff, 0xd8, 0xff]));
        }
        return makeTextResponse(404, 'Missing');
      });

      const httpsRes = await syncR2Assets.runR2AssetSync(
        { ids: [1342], source: 'https', delayMin: 0, delayMax: 0 },
        { env: TEST_R2_ENV, fetchFn: fetchMock, sleepFn: async () => {}, logger: { log: vi.fn() } }
      );
      expect(httpsRes.textsUploaded).toBe(1);
      expect(httpsRes.coversUploaded).toBe(1);

      const hugeChangedBooks = Array.from({ length: 120 }, (_, i) => ({
        id: i + 1,
        title: `Volume #${i + 1}`,
        downloadCount: 1000 - i,
        textOutcome: '✅ uploaded',
        coverOutcome: '✅ uploaded',
        note: '',
      }));
      const bulkReport = syncR2Assets.formatR2RunReport({
        eligibleBookCount: 78000,
        existingTextsBefore: 1000,
        existingCoversBefore: 900,
        textsUploaded: 120,
        coversUploaded: 120,
        textsDeleted: 0,
        coversDeleted: 0,
        deletedCopyrightedCount: 0,
        deletedWithdrawnCount: 0,
        skippedCopyrightCount: 0,
        knownMissingTextsCount: 0,
        knownMissingCoversCount: 50,
        failedCount: 0,
        r2ApiCalls: 300,
        engine: 'rsync',
        catalogSource: 'gutenberg-catalog-cache.json.gz',
        stoppedByTimeBudget: true,
        elapsedSeconds: 1500.2,
        changedBooks: hugeChangedBooks,
      });
      expect(bulkReport).toContain('_Showing first 50 of 120 changed volumes');
      expect(bulkReport).toContain('time budget cutoff reached; state saved');
    });

    it('decodes ListObjectsV2 XML entities in a single pass without double-unescaping doubly-encoded payloads', () => {
      expect(syncR2Assets.unescapeXmlEntities('a&amp;lt;b&amp;gt;c&amp;quot;d&amp;apos;e&amp;amp;f')).toBe(
        'a&lt;b&gt;c&quot;d&apos;e&amp;f'
      );
      expect(syncR2Assets.unescapeXmlEntities('plain &lt;tag&gt; &quot;ok&quot; &apos;1&apos; &amp; done')).toBe(
        'plain <tag> "ok" \'1\' & done'
      );

      const parsed = syncR2Assets.parseListObjectsV2Xml(`<ListBucketResult>
        <IsTruncated>true</IsTruncated>
        <NextContinuationToken>cursor&amp;lt;next&amp;amp;2</NextContinuationToken>
        <Contents><Key>books/1342.txt.gz</Key><Size>1024</Size></Contents>
        <Contents><Key>_meta/a&amp;lt;b&apos;c.txt</Key><Size>10</Size></Contents>
      </ListBucketResult>`);

      expect(parsed.nextContinuationToken).toBe('cursor&lt;next&amp;2');
      expect(parsed.objects[1].key).toBe("_meta/a&lt;b'c.txt");
    });
  });
});
