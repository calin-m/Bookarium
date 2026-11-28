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

    it('restricts R2 endpoints strictly to HTTPS allowlisted hosts', () => {
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
    });
  });

  describe('parseCliArgs & transfer engine detection', () => {
    it('parses flags cleanly and rejects malformed or retired HTTPS CLI values', () => {
      const parsed = syncR2Assets.parseCliArgs([
        '--dry-run',
        '--limit=500',
        '--ids=1342,84,1342',
        '--cache-file=gutenberg-catalog-cache.json.gz',
        '--source=wsl-rsync',
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
      expect(() => syncR2Assets.parseCliArgs(['--source=https'])).toThrow(/Unsupported --source/);
      expect(() => syncR2Assets.parseCliArgs(['--mirror=aleph'])).toThrow(/Bulk HTTPS mirror transfers are retired/);
      expect(() => syncR2Assets.parseCliArgs(['--delay-range=2-4'])).toThrow(/Bulk HTTPS mirror transfers are retired/);
      expect(() => syncR2Assets.parseCliArgs(['--ids=1342,abc'])).toThrow(/Invalid Gutenberg ID/);
      expect(() => syncR2Assets.parseCliArgs(['--max-minutes=-5'])).toThrow(/Invalid --max-minutes/);
    });

    it('resolves rsync or wsl-rsync transfer engines safely and rejects retired https mode', () => {
      expect(() => syncR2Assets.resolveTransferEngine('https', 'linux')).toThrow(
        /Bulk HTTPS asset sync has been retired/
      );
      expect(syncR2Assets.resolveTransferEngine('wsl-rsync', 'win32')).toBe('wsl-rsync');
      expect(
        syncR2Assets.resolveTransferEngine('auto', 'linux', () => ({ status: 0 }))
      ).toBe('rsync');
      expect(() =>
        syncR2Assets.resolveTransferEngine('auto', 'win32', () => ({ status: 1 }))
      ).toThrow(/rsync \(or Windows WSL rsync\) is required/);
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

    it('rejects retired HTTPS fallback mode, requires rsync/wsl-rsync binaries, caps huge ledgers cleanly, and skips unconfigured runs', async () => {
      const unconfRes = await syncR2Assets.runR2AssetSync({}, { env: {}, logger: { log: vi.fn() } });
      expect(unconfRes.skippedUnconfigured).toBe(true);

      const emptyR2Fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
        const parsed = new URL(url);
        const method = String(init.method || 'GET').toUpperCase();
        if (parsed.hostname.endsWith('.r2.cloudflarestorage.com')) {
          if (method === 'GET' && parsed.searchParams.has('prefix')) {
            return makeTextResponse(200, '<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>');
          }
          if (method === 'GET') return makeTextResponse(404, 'Not Found');
          return makeTextResponse(200, '');
        }
        return makeTextResponse(404, 'Not Found');
      });

      await expect(
        syncR2Assets.runR2AssetSync(
          { ids: [1342], source: 'https' },
          { env: TEST_R2_ENV, fetchFn: emptyR2Fetch, logger: { log: vi.fn() } }
        )
      ).rejects.toThrow(/Bulk HTTPS asset sync has been retired/);

      await expect(
        syncR2Assets.runR2AssetSync(
          { ids: [1342], source: 'auto' },
          {
            env: TEST_R2_ENV,
            fetchFn: emptyR2Fetch,
            platform: 'win32',
            spawnSyncFn: () => ({ status: 1 }),
            logger: { log: vi.fn() },
          }
        )
      ).rejects.toThrow(/rsync \(or Windows WSL rsync\) is required/);

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

    it('enforces strict partial/invalid R2 config validation, preserves remote sync state across read failures & races, and handles budgets, concurrency, purge tags, and failure ratios', async () => {
      // 1) All 4 R2_* unset skips cleanly; partial or malformed throws fast
      expect(syncR2Assets.assertValidR2ConfigIfPresent({})).toBeNull();
      expect(() =>
        syncR2Assets.assertValidR2ConfigIfPresent({ R2_ACCOUNT_ID: TEST_R2_ENV.R2_ACCOUNT_ID })
      ).toThrow(/Partial Cloudflare R2 configuration/);
      expect(() =>
        syncR2Assets.assertValidR2ConfigIfPresent({
          ...TEST_R2_ENV,
          R2_BUCKET_NAME: 'Uppercase_Bucket',
        })
      ).toThrow(/Invalid R2_ACCOUNT_ID/);

      await expect(
        syncR2Assets.runR2AssetSync(
          {},
          { env: { R2_ACCOUNT_ID: TEST_R2_ENV.R2_ACCOUNT_ID }, logger: { log: vi.fn() } }
        )
      ).rejects.toThrow(/Partial Cloudflare R2 configuration/);

      // 2) readR2SyncState marks HTTP 500 as readFailed and refuses to overwrite remote state
      const nowMs = Date.parse('2026-11-18T12:00:00.000Z');
      const errorReadState = await syncR2Assets.readR2SyncState(TEST_R2_CONFIG, {
        fetchFn: vi.fn(async () => makeTextResponse(500, 'Upstream error')),
        nowMs,
      });
      expect(errorReadState.readFailed).toBe(true);

      const skippedWrite = await syncR2Assets.writeR2SyncState(TEST_R2_CONFIG, errorReadState, {
        fetchFn: vi.fn(),
        nowMs,
      });
      expect(skippedWrite.skippedReadFailed).toBe(true);

      // 3) mergeR2SyncStates keeps concurrent remote keys while omitting locally cleared uploads
      const merged = syncR2Assets.mergeR2SyncStates(
        {
          missingCovers: { '10': '2026-11-18T10:00:00.000Z', '20': '2026-11-18T10:00:00.000Z' },
          missingTexts: { '30': '2026-11-18T10:00:00.000Z' },
        },
        {
          missingCovers: { '20': '2026-11-18T11:00:00.000Z', '40': '2026-11-18T11:00:00.000Z' },
          missingTexts: {},
        },
        { covers: new Set(['20']), texts: new Set() },
        { nowMs, recheckDays: 90 }
      );
      expect(merged.missingCovers).toEqual({
        '10': '2026-11-18T10:00:00.000Z',
        '40': '2026-11-18T11:00:00.000Z',
      });
      expect(merged.missingTexts).toEqual({ '30': '2026-11-18T10:00:00.000Z' });

      // 4) isRsyncTransportError rejects transport glitches on exit 23 & runRsyncCommandWithRetry recovers
      expect(
        syncR2Assets.isRsyncTransportError(
          'rsync warning: some files vanished before they could be transferred (code 23)'
        )
      ).toBe(false);
      expect(syncR2Assets.isRsyncTransportError('rsync: connection unexpectedly closed (0 bytes received so far)')).toBe(true);
      expect(syncR2Assets.isRsyncTransportError('rsync error: error in rsync protocol data stream')).toBe(true);

      let rsyncAttempt = 0;
      const retrySpawnMock = vi.fn((_cmd: string, _args: string[], _opts: { cwd: string }) => {
        rsyncAttempt++;
        const proc = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
        proc.stderr = new EventEmitter();
        queueMicrotask(() => {
          if (rsyncAttempt === 1) {
            proc.stderr.emit('data', Buffer.from('rsync: read error: Connection reset by peer\n'));
            proc.emit('close', 23);
          } else {
            proc.emit('close', 0);
          }
        });
        return proc;
      });
      const retryRes = await syncR2Assets.runRsyncCommandWithRetry(
        { manifestFile: 'manifest.txt', cwd: process.cwd(), spawnFn: retrySpawnMock },
        { maxRetries: 2, baseDelayMs: 0 }
      );
      expect(rsyncAttempt).toBe(2);
      expect(retryRes.exitCode).toBe(0);

      // 4b) try ... finally flushes missing-asset state even if a later batch throws
      let tick = 0;
      const batchThrowPuts: string[] = [];
      let spawnBatchCall = 0;
      const abortOnSecondBatchSpawn = vi.fn((_cmd: string, _args: string[], opts: { cwd: string }) => {
        spawnBatchCall++;
        const proc = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
        proc.stderr = new EventEmitter();
        queueMicrotask(() => {
          if (spawnBatchCall === 1) {
            fs.mkdirSync(path.join(opts.cwd, '1342'), { recursive: true });
            fs.writeFileSync(path.join(opts.cwd, '1342', 'pg1342.txt'), 'Pride body', 'utf8');
            // 1342 cover intentionally missing -> dirties syncState
            proc.emit('close', 23);
          } else {
            proc.stderr.emit('data', Buffer.from('rsync: read error: Connection reset by peer\n'));
            proc.emit('close', 12);
          }
        });
        return proc;
      });
      const batchAbortFetch = vi.fn(async (url: string, init: RequestInit = {}) => {
        const parsed = new URL(url);
        const method = String(init.method || 'GET').toUpperCase();
        if (method === 'GET' && parsed.searchParams.has('prefix')) {
          return makeTextResponse(200, '<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>');
        }
        if (method === 'GET') return makeTextResponse(404, 'Not Found');
        if (method === 'PUT') {
          batchThrowPuts.push(parsed.pathname);
          return makeTextResponse(200, '');
        }
        return makeTextResponse(404, 'Unhandled');
      });

      await expect(
        syncR2Assets.runR2AssetSync(
          { ids: [1342, 84], source: 'rsync', maxMinutes: 10 },
          {
            env: TEST_R2_ENV,
            fetchFn: batchAbortFetch,
            spawnFn: abortOnSecondBatchSpawn,
            rsyncBatchSize: 1,
            rsyncRetries: 0,
            rsyncRetryDelayMs: 0,
            nowFn: () => {
              tick += 1000;
              return 1_700_000_000_000 + tick;
            },
            logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
          }
        )
      ).rejects.toThrow(/exited with code 12/);
      expect(batchThrowPuts).toContain('/bookarium-test-bucket/books/1342.txt.gz');
      expect(batchThrowPuts).toContain('/bookarium-test-bucket/_meta/r2-sync-state.json.gz');

      // 5) runWithConcurrency bounds worker parallelism & parseCliArgs validates new flags
      let activeWorkers = 0;
      let peakWorkers = 0;
      const tasks = Array.from({ length: 10 }, () => async () => {
        activeWorkers++;
        peakWorkers = Math.max(peakWorkers, activeWorkers);
        await new Promise((r) => setTimeout(r, 5));
        activeWorkers--;
      });
      await syncR2Assets.runWithConcurrency(tasks, 3);
      expect(peakWorkers).toBeLessThanOrEqual(3);

      const parsedArgs = syncR2Assets.parseCliArgs([
        '--catalog-source=supabase',
        '--concurrency=4',
        '--purge-tags-file=out-tags.txt',
      ]);
      expect(parsedArgs.catalogSource).toBe('supabase');
      expect(parsedArgs.concurrency).toBe(4);
      expect(parsedArgs.purgeTagsFile).toBe('out-tags.txt');
      expect(() => syncR2Assets.parseCliArgs(['--concurrency=99'])).toThrow(/Invalid --concurrency/);
      expect(() => syncR2Assets.parseCliArgs(['--catalog-source=invalid'])).toThrow(/Unsupported --catalog-source/);

      // 6) --force overwrite emits purge tags file, preserves remote state even on readFailed, and enforces failure-ratio exit rules
      const tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-r2-hardening-'));
      try {
        const purgeFile = path.join(tmpDir, 'r2-tags.txt');
        const forceFetch = vi.fn(async (url: string, init: RequestInit = {}) => {
          const parsed = new URL(url);
          const method = String(init.method || 'GET').toUpperCase();
          if (parsed.hostname.endsWith('.r2.cloudflarestorage.com')) {
            if (method === 'GET' && parsed.searchParams.get('prefix') === 'books/') {
              return makeTextResponse(
                200,
                '<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>books/1342.txt.gz</Key><Size>100</Size></Contents></ListBucketResult>'
              );
            }
            if (method === 'GET' && parsed.searchParams.get('prefix') === 'covers/') {
              return makeTextResponse(200, '<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>');
            }
            if (method === 'GET') {
              return makeTextResponse(503, 'Service Unavailable');
            }
            return makeTextResponse(200, '');
          }
          if (url.includes('1342/pg1342.txt')) {
            return makeTextResponse(200, 'Updated full text content');
          }
          return makeTextResponse(404, 'Not Found');
        });

        const warnSpy = vi.fn();
        const mockSupabase = {
          from: () => ({
            select: () => ({
              gt: (_col: string, cursorId: number) => ({
                order: () => ({
                  limit: async () => ({
                    data:
                      cursorId === 0
                        ? [
                            {
                              id: 1342,
                              title: 'Pride and Prejudice',
                              copyright: false,
                              media_type: 'Text',
                              download_count: 55000,
                            },
                          ]
                        : [],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };

        const forceSpawnMock = vi.fn((_cmd: string, args: string[], opts: { cwd: string }) => {
          const proc = new EventEmitter();
          const sourceArg = args[args.length - 2];
          if (sourceArg === syncR2Assets.RSYNC_EPUB_SOURCE) {
            fs.mkdirSync(path.join(opts.cwd, '1342'), { recursive: true });
            fs.writeFileSync(path.join(opts.cwd, '1342', 'pg1342.txt'), 'Updated full text content', 'utf8');
          }
          queueMicrotask(() => proc.emit('close', 0));
          return proc;
        });

        const forceLogs: string[] = [];
        const forceSummary = await syncR2Assets.runR2AssetSync(
          {
            catalogSource: 'supabase',
            force: true,
            source: 'rsync',
            purgeTagsFile: purgeFile,
          },
          {
            env: { ...TEST_R2_ENV, GITHUB_ACTIONS: 'true' },
            supabase: mockSupabase,
            fetchFn: forceFetch,
            spawnFn: forceSpawnMock,
            sleepFn: async () => {},
            progressOptions: { ciMinTotalForPercent: 1, ciPercentStep: 50 },
            logger: { log: (m: string) => forceLogs.push(m), warn: warnSpy, error: vi.fn() },
          }
        );

        expect(forceSummary.catalogSource).toBe('supabase');
        expect(forceSummary.textsUploaded).toBe(1);
        expect(forceSummary.purgeTags).toEqual(['book-content']);
        expect(fs.readFileSync(purgeFile, 'utf8')).toBe('book-content');
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to read existing _meta/r2-sync-state.json.gz'));
        expect(forceLogs.some((line) => line.includes('+1 texts'))).toBe(true);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }

      expect(
        syncR2Assets.shouldFailR2SyncRun({
          skippedUnconfigured: false,
          failedCount: 2,
          textsUploaded: 0,
          coversUploaded: 0,
          textsDeleted: 0,
          coversDeleted: 0,
        })
      ).toBe(true);
      expect(
        syncR2Assets.shouldFailR2SyncRun({
          skippedUnconfigured: false,
          failedCount: 5,
          textsUploaded: 4,
          coversUploaded: 0,
          textsDeleted: 0,
          coversDeleted: 0,
        })
      ).toBe(true);
      expect(
        syncR2Assets.shouldFailR2SyncRun({
          skippedUnconfigured: false,
          failedCount: 1,
          textsUploaded: 9,
          coversUploaded: 0,
          textsDeleted: 0,
          coversDeleted: 0,
        })
      ).toBe(false);
    });

    it('supports --rsync-host ordering (auto/aleph -> ibiblio and ibiblio -> aleph) with automatic multi-host rsync failover', async () => {
      const parsedDefault = syncR2Assets.parseCliArgs([]);
      expect(parsedDefault.rsyncHost).toBe('auto');

      const parsedIbiblio = syncR2Assets.parseCliArgs(['--rsync-host=ibiblio', '--source=rsync']);
      expect(parsedIbiblio.rsyncHost).toBe('ibiblio');
      expect(() => syncR2Assets.parseCliArgs(['--rsync-host=ftp'])).toThrow(/Unsupported --rsync-host/);

      expect(syncR2Assets.resolveRsyncHostOrder('auto')).toEqual([
        'aleph.gutenberg.org',
        'rsync.ibiblio.org',
      ]);
      expect(syncR2Assets.resolveRsyncHostOrder('aleph')).toEqual([
        'aleph.gutenberg.org',
        'rsync.ibiblio.org',
      ]);
      expect(syncR2Assets.resolveRsyncHostOrder('ibiblio')).toEqual([
        'rsync.ibiblio.org',
        'aleph.gutenberg.org',
      ]);
      expect(() => syncR2Assets.resolveRsyncHostOrder('invalid')).toThrow(/Unsupported --rsync-host/);

      expect(
        syncR2Assets.buildRsyncSourcesForOrder(
          syncR2Assets.resolveRsyncHostOrder('ibiblio'),
          'gutenberg-epub'
        )
      ).toEqual([syncR2Assets.RSYNC_IBIBLIO_EPUB_SOURCE, syncR2Assets.RSYNC_EPUB_SOURCE]);

      const retrySources: string[] = [];
      const retryNotices: Array<{ attempt: number; prevSource: string; nextSource: string }> = [];
      const failoverSpawn = vi.fn((_cmd: string, args: string[]) => {
        const proc = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
        proc.stderr = new EventEmitter();
        const remoteSource = args[args.length - 2];
        retrySources.push(remoteSource);
        queueMicrotask(() => {
          if (remoteSource === syncR2Assets.RSYNC_IBIBLIO_MAIN_SOURCE) {
            proc.stderr.emit('data', Buffer.from('rsync: failed to connect to rsync.ibiblio.org\n'));
            proc.emit('close', 10);
          } else {
            proc.emit('close', 0);
          }
        });
        return proc;
      });

      const reversedRes = await syncR2Assets.runRsyncCommandWithRetry(
        {
          manifestFile: 'manifest-main.txt',
          remoteSources: syncR2Assets.buildRsyncSourcesForOrder(
            syncR2Assets.resolveRsyncHostOrder('ibiblio'),
            'gutenberg'
          ),
          cwd: os.tmpdir(),
          spawnFn: failoverSpawn,
        },
        {
          maxRetries: 2,
          baseDelayMs: 0,
          onRetry: (info: { attempt: number; prevSource: string; nextSource: string }) => {
            retryNotices.push({
              attempt: info.attempt,
              prevSource: info.prevSource,
              nextSource: info.nextSource,
            });
          },
        }
      );

      expect(retrySources).toEqual([
        syncR2Assets.RSYNC_IBIBLIO_MAIN_SOURCE,
        syncR2Assets.RSYNC_MAIN_SOURCE,
      ]);
      expect(retryNotices).toEqual([
        {
          attempt: 1,
          prevSource: syncR2Assets.RSYNC_IBIBLIO_MAIN_SOURCE,
          nextSource: syncR2Assets.RSYNC_MAIN_SOURCE,
        },
      ]);
      expect(reversedRes).toMatchObject({
        exitCode: 0,
        remoteSource: syncR2Assets.RSYNC_MAIN_SOURCE,
        host: 'aleph.gutenberg.org',
      });

      const uploadedKeys: string[] = [];
      const syncSpawnSources: string[] = [];
      const syncLogger = { log: vi.fn(), warn: vi.fn() };
      const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          uploadedKeys.push(new URL(url).pathname);
          return makeTextResponse(200, '');
        }
        if (url.includes('list-type=2')) {
          return makeTextResponse(
            200,
            '<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>'
          );
        }
        return makeTextResponse(404, '');
      });
      const syncSpawn = vi.fn((_cmd: string, args: string[], spawnOpts: { cwd: string }) => {
        const proc = new EventEmitter() as EventEmitter & { stderr: EventEmitter };
        proc.stderr = new EventEmitter();
        const remoteSource = args[args.length - 2];
        syncSpawnSources.push(remoteSource);
        queueMicrotask(() => {
          if (remoteSource === syncR2Assets.RSYNC_EPUB_SOURCE) {
            proc.stderr.emit('data', Buffer.from('rsync: read error: Connection reset by peer\n'));
            proc.emit('close', 23);
            return;
          }
          const bookDir = path.join(spawnOpts.cwd, '1342');
          fs.mkdirSync(bookDir, { recursive: true });
          fs.writeFileSync(path.join(bookDir, 'pg1342.txt'), 'Pride and Prejudice public domain text.', 'utf8');
          fs.writeFileSync(path.join(bookDir, 'pg1342.cover.medium.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
          proc.emit('close', 0);
        });
        return proc;
      });

      const runSummary = await syncR2Assets.runR2AssetSync(
        {
          ids: [1342],
          source: 'rsync',
          rsyncHost: 'auto',
          maxMinutes: 10,
        },
        {
          env: TEST_R2_ENV,
          r2Config: TEST_R2_CONFIG,
          engine: 'rsync',
          fetchFn: mockFetch,
          spawnFn: syncSpawn,
          rsyncBatchSize: 5,
          rsyncRetries: 2,
          rsyncRetryDelayMs: 0,
          sleepFn: async () => {},
          logger: syncLogger,
        }
      );

      expect(syncSpawnSources).toEqual([
        syncR2Assets.RSYNC_EPUB_SOURCE,
        syncR2Assets.RSYNC_IBIBLIO_EPUB_SOURCE,
      ]);
      expect(runSummary.textsUploaded).toBe(1);
      expect(runSummary.coversUploaded).toBe(1);
      expect(runSummary.failedCount).toBe(0);
      expect(runSummary.rsyncHost).toBe('auto');
      expect(runSummary.rsyncHostOrder).toEqual(['aleph.gutenberg.org', 'rsync.ibiblio.org']);
      expect(runSummary.rsyncHostsUsed).toEqual(['rsync.ibiblio.org']);
      expect(uploadedKeys.some((k) => k.endsWith('/books/1342.txt.gz'))).toBe(true);
      expect(uploadedKeys.some((k) => k.endsWith('/covers/1342.jpg'))).toBe(true);
      expect(syncLogger.log.mock.calls.flat().join('\n')).toContain('switching to rsync.ibiblio.org');
      expect(runSummary.report).toContain('rsync Host Order / Used');
      expect(runSummary.report).toContain('aleph.gutenberg.org -> rsync.ibiblio.org');
    });
  });
});
