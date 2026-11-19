import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const r2Sigv4 = require('./r2-sigv4');

const TEST_R2_ENV = {
  R2_ACCOUNT_ID: '0123456789ABCDEF0123456789ABCDEF',
  R2_BUCKET_NAME: 'bookarium-test-bucket',
  R2_ACCESS_KEY_ID: 'mock-r2-access-key',
  R2_SECRET_ACCESS_KEY: 'mock-r2-secret-signing-key',
};

const TEST_R2_CONFIG = r2Sigv4.getR2Config(TEST_R2_ENV);

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

describe('scripts/lib/r2-sigv4', () => {
  it('validates R2 credentials strictly (all-unset skip, partial fail-fast, lowercase normalization)', () => {
    expect(r2Sigv4.assertValidR2ConfigIfPresent({})).toBeNull();
    expect(r2Sigv4.isR2Configured({})).toBe(false);
    expect(r2Sigv4.isR2Configured(TEST_R2_ENV)).toBe(true);
    expect(TEST_R2_CONFIG).toEqual({
      accountId: '0123456789abcdef0123456789abcdef',
      bucket: 'bookarium-test-bucket',
      accessKeyId: 'mock-r2-access-key',
      secretAccessKey: 'mock-r2-secret-signing-key',
    });

    expect(() =>
      r2Sigv4.assertValidR2ConfigIfPresent({
        R2_ACCOUNT_ID: '0123456789abcdef',
      })
    ).toThrow(/Partial Cloudflare R2 configuration/);

    expect(() =>
      r2Sigv4.assertValidR2ConfigIfPresent({
        ...TEST_R2_ENV,
        R2_BUCKET_NAME: 'Invalid_Upper_Bucket',
      })
    ).toThrow(/Invalid R2_ACCOUNT_ID.*or R2_BUCKET_NAME/);

    expect(r2Sigv4.loadEnv(os.tmpdir())).toBeTypeOf('object');
  });

  it('enforces strict Cloudflare R2 HTTPS endpoint allowlist and deterministic AWS SigV4 signatures', () => {
    expect(
      r2Sigv4.isAllowedR2EndpointUrl('https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/bucket')
    ).toBe(true);
    expect(
      r2Sigv4.isAllowedR2EndpointUrl('http://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/bucket')
    ).toBe(false);
    expect(
      r2Sigv4.isAllowedR2EndpointUrl('https://user:pass@0123456789abcdef.r2.cloudflarestorage.com/bucket')
    ).toBe(false);
    expect(
      r2Sigv4.isAllowedR2EndpointUrl('https://0123456789abcdef.r2.cloudflarestorage.com:8443/bucket')
    ).toBe(false);
    expect(r2Sigv4.isAllowedR2EndpointUrl('https://evil.example.com/bucket')).toBe(false);

    const signed = r2Sigv4.signR2Request({
      config: TEST_R2_CONFIG,
      method: 'GET',
      key: 'books/1342.txt.gz',
      queryParams: {
        prefix: 'books/',
        'list-type': '2',
      },
      now: new Date('2026-11-19T00:00:00.000Z'),
    });

    expect(signed.url).toBe(
      'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/bookarium-test-bucket/books/1342.txt.gz?list-type=2&prefix=books%2F'
    );
    expect(signed.headers.Authorization).toContain(
      'AWS4-HMAC-SHA256 Credential=mock-r2-access-key/20261119/auto/s3/aws4_request'
    );
    expect(signed.headers['x-amz-date']).toBe('20261119T000000Z');
  });

  it('unescapes XML entities in one CWE-116 safe pass and paginates ListObjectsV2 prefix keys & IDs', async () => {
    expect(r2Sigv4.unescapeXmlEntities('a&amp;lt;b&gt;&quot;c&apos;')).toBe('a&lt;b>"c\'');

    const page1Xml = [
      '<ListBucketResult>',
      '<IsTruncated>true</IsTruncated>',
      '<NextContinuationToken>tok&amp;1</NextContinuationToken>',
      '<Contents><Key>books/1342.txt.gz</Key><Size>1200</Size></Contents>',
      '<Contents><Key>books/readme.md</Key><Size>200</Size></Contents>',
      '</ListBucketResult>',
    ].join('');
    const page2Xml = [
      '<ListBucketResult>',
      '<IsTruncated>false</IsTruncated>',
      '<Contents><Key>books/84.txt.gz</Key><Size>2500</Size></Contents>',
      '</ListBucketResult>',
    ].join('');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeTextResponse(200, page1Xml))
      .mockResolvedValueOnce(makeTextResponse(200, page2Xml));

    const filtered = await r2Sigv4.listR2PrefixKeys(TEST_R2_CONFIG, 'books/', {
      fetchFn: fetchMock,
      filterFn: (obj: { key: string }) => obj.key.endsWith('.txt.gz'),
    });
    expect(filtered.apiCalls).toBe(2);
    expect(filtered.keyCount).toBe(3);
    expect(filtered.objects).toEqual([
      { key: 'books/1342.txt.gz', size: 1200 },
      { key: 'books/84.txt.gz', size: 2500 },
    ]);
    expect(fetchMock.mock.calls[1][0]).toContain('continuation-token=tok%261');

    const pageSnapshots: Array<{ page: number; apiCalls: number; matchedCount: number }> = [];
    const limited = await r2Sigv4.listR2PrefixKeys(TEST_R2_CONFIG, 'books/', {
      fetchFn: vi.fn().mockResolvedValueOnce(makeTextResponse(200, page1Xml)),
      filterFn: (obj: { key: string }) => obj.key.endsWith('.txt.gz'),
      maxMatched: 1,
      onPage: (info: { page: number; apiCalls: number; matchedCount: number }) => {
        pageSnapshots.push({ page: info.page, apiCalls: info.apiCalls, matchedCount: info.matchedCount });
      },
    });
    expect(limited.apiCalls).toBe(1);
    expect(limited.objects).toHaveLength(1);
    expect(limited.truncatedByLimit).toBe(true);
    expect(pageSnapshots).toEqual([{ page: 1, apiCalls: 1, matchedCount: 1 }]);

    const fullPages: number[] = [];
    const idResult = await r2Sigv4.listR2PrefixIds(TEST_R2_CONFIG, 'books/', /^books\/(\d+)\.txt\.gz$/, {
      fetchFn: vi
        .fn()
        .mockResolvedValueOnce(makeTextResponse(200, page1Xml))
        .mockResolvedValueOnce(makeTextResponse(200, page2Xml)),
      onPage: ({ page }: { page: number }) => fullPages.push(page),
    });
    expect(idResult.ids).toEqual(new Set([1342, 84]));
    expect(fullPages).toEqual([1, 2]);
  });

  it('fetches gzipped R2 book text safely with manual redirects, retries, size caps, and optional HTML checks', async () => {
    const htmlInjected = zlib.gzipSync(Buffer.from('<html>bad asiafilm spam</html>', 'utf8'));
    const plainGzip = zlib.gzipSync(Buffer.from('Call me Ishmael.', 'utf8'));

    const strictHtmlRes = await r2Sigv4.fetchBookTextFromR2(2701, {
      env: TEST_R2_ENV,
      fetchFn: vi.fn().mockResolvedValueOnce(makeBinaryResponse(200, htmlInjected)),
    });
    expect(strictHtmlRes).toEqual({
      status: 'error',
      error: 'Rejected HTML content inside R2 archive',
    });

    const scanHtmlRes = await r2Sigv4.fetchR2GzippedText(TEST_R2_CONFIG, 'books/2701.txt.gz', {
      rejectHtmlBody: false,
      fetchFn: vi.fn().mockResolvedValueOnce(makeBinaryResponse(200, htmlInjected)),
    });
    expect(scanHtmlRes.status).toBe('ok');
    expect(scanHtmlRes.text).toContain('asiafilm');

    const redirectRes = await r2Sigv4.fetchR2GzippedText(TEST_R2_CONFIG, 'books/2701.txt.gz', {
      fetchFn: vi.fn().mockResolvedValueOnce(makeTextResponse(302, '')),
    });
    expect(redirectRes.status).toBe('error');
    expect(redirectRes.error).toContain('redirect');

    const notFoundRes = await r2Sigv4.fetchBookTextFromR2(999999, {
      env: TEST_R2_ENV,
      fetchFn: vi.fn().mockResolvedValueOnce(makeTextResponse(404, '')),
    });
    expect(notFoundRes).toEqual({ status: 'not_found' });

    const oversizedRes = await r2Sigv4.fetchR2GzippedText(TEST_R2_CONFIG, 'books/1.txt.gz', {
      maxBytes: 4,
      fetchFn: vi.fn().mockResolvedValueOnce(makeBinaryResponse(200, plainGzip)),
    });
    expect(oversizedRes.status).toBe('error');
    expect(oversizedRes.error).toContain('Empty or oversized');

    const retryFetch = vi
      .fn()
      .mockResolvedValueOnce(makeTextResponse(503, 'busy'))
      .mockResolvedValueOnce(makeBinaryResponse(200, plainGzip));
    const retried = await r2Sigv4.fetchR2WithTimeout({
      url: 'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/bookarium-test-bucket/books/2701.txt.gz',
      fetchFn: retryFetch,
      retryDelayMs: 0,
      sleepFn: async () => {},
    });
    expect(retryFetch).toHaveBeenCalledTimes(2);
    expect(retried.response.status).toBe(200);
  });

  it('escapes Markdown cells, appends Step Summary files, and executes bounded concurrency pools', async () => {
    expect(r2Sigv4.escapeMarkdownCell('a|b\\c\nnext')).toBe('a\\|b\\\\c next');

    const tmpFile = path.join(os.tmpdir(), `r2-summary-${Date.now()}.md`);
    expect(r2Sigv4.appendStepSummary(tmpFile, 'Hello R2\n')).toBe(true);
    expect(fs.readFileSync(tmpFile, 'utf8')).toBe('Hello R2\n');
    fs.unlinkSync(tmpFile);

    const activeSamples: number[] = [];
    let running = 0;
    const tasks = Array.from({ length: 6 }, (_unused, idx) => async () => {
      running++;
      activeSamples.push(running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return idx;
    });
    await r2Sigv4.runWithConcurrency(tasks, 2);
    expect(Math.max(...activeSamples)).toBeLessThanOrEqual(2);
  });
});
