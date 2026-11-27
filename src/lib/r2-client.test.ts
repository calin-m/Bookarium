import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import zlib from 'node:zlib';
import {
  getR2Config,
  isR2Configured,
  isHtmlPayload,
  signR2GetRequest,
  fetchR2CoverBytes,
  fetchR2BookText,
  MAX_R2_COVER_BYTES,
} from './r2-client';

describe('r2-client', () => {
  const validEnv = {
    R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
    R2_BUCKET_NAME: 'bookarium-assets',
    R2_ACCESS_KEY_ID: 'test-access-key-id',
    R2_SECRET_ACCESS_KEY: 'test-secret-access-key-value',
  };

  function stubValidR2Env() {
    for (const [k, v] of Object.entries(validEnv)) {
      vi.stubEnv(k, v);
    }
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('R2_ACCOUNT_ID', '');
    vi.stubEnv('R2_BUCKET_NAME', '');
    vi.stubEnv('R2_ACCESS_KEY_ID', '');
    vi.stubEnv('R2_SECRET_ACCESS_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('validates R2 env configuration and rejects malformed account IDs or bucket names', () => {
    expect(isR2Configured()).toBe(false);
    expect(getR2Config()).toBeNull();

    expect(
      getR2Config({
        ...validEnv,
        R2_ACCOUNT_ID: 'bad/host',
      })
    ).toBeNull();

    expect(
      getR2Config({
        ...validEnv,
        R2_BUCKET_NAME: 'invalid..bucket',
      })
    ).toBeNull();

    stubValidR2Env();
    expect(isR2Configured()).toBe(true);
    expect(getR2Config()).toEqual({
      accountId: validEnv.R2_ACCOUNT_ID,
      bucket: validEnv.R2_BUCKET_NAME,
      accessKeyId: validEnv.R2_ACCESS_KEY_ID,
      secretAccessKey: validEnv.R2_SECRET_ACCESS_KEY,
    });
  });

  it('generates deterministic AWS Signature V4 GET request headers for private R2 paths', () => {
    const config = getR2Config(validEnv)!;
    const fixedDate = new Date('2026-11-18T00:00:00.000Z');
    const signed = signR2GetRequest(config, 'books/1342.txt.gz', fixedDate);

    expect(signed.url).toBe(
      'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/bookarium-assets/books/1342.txt.gz'
    );
    expect(signed.headers['x-amz-date']).toBe('20261118T000000Z');
    expect(signed.headers['x-amz-content-sha256']).toBe('UNSIGNED-PAYLOAD');
    expect(signed.headers.Authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=test-access-key-id\/20261118\/auto\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/
    );
  });

  it('detects HTML error interstitials by content-type or leading markup snippet', () => {
    expect(isHtmlPayload('text/html; charset=utf-8')).toBe(true);
    expect(isHtmlPayload('application/xhtml+xml')).toBe(true);
    expect(isHtmlPayload('image/jpeg', '<!DOCTYPE html><html>error</html>')).toBe(true);
    expect(isHtmlPayload('text/plain', 'Pride and Prejudice by Jane Austen')).toBe(false);
  });

  it('fetches cover bytes cleanly from R2 and fails closed on 404, redirects, HTML, and oversize', async () => {
    expect(await fetchR2CoverBytes(1342)).toEqual({ status: 'unconfigured' });

    stubValidR2Env();
    expect(await fetchR2CoverBytes(0)).toEqual({ status: 'error' });

    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02]);
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(jpegBytes, {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(jpegBytes.byteLength) },
        })
      )
      .mockResolvedValueOnce(new Response('NoSuchKey', { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 302 }))
      .mockResolvedValueOnce(
        new Response('<!doctype html><html>blocked</html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        })
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array(MAX_R2_COVER_BYTES + 8), {
          status: 200,
          headers: { 'Content-Length': String(MAX_R2_COVER_BYTES + 8) },
        })
      );

    const okRes = await fetchR2CoverBytes(1342);
    expect(okRes.status).toBe('ok');
    if (okRes.status === 'ok') {
      expect(new Uint8Array(okRes.bytes)).toEqual(jpegBytes);
    }
    expect(fetchSpy.mock.calls[0][0]).toContain('/bookarium-assets/covers/1342.jpg');
    expect(fetchSpy.mock.calls[0][1]).toEqual(expect.objectContaining({ redirect: 'manual' }));

    expect(await fetchR2CoverBytes(99999)).toEqual({ status: 'not_found' });
    expect(await fetchR2CoverBytes(1342)).toEqual({ status: 'error' });
    expect(await fetchR2CoverBytes(1342)).toEqual({ status: 'error' });
    expect(await fetchR2CoverBytes(1342)).toEqual({ status: 'error' });
  });

  it('fetches and decompresses .txt.gz book payloads while guarding invalid or corrupt bodies', async () => {
    expect(await fetchR2BookText(1342)).toEqual({ status: 'unconfigured' });

    stubValidR2Env();
    const rawBookText = 'Chapter I\n\nIt is a truth universally acknowledged...';
    const gzippedBytes = zlib.gzipSync(Buffer.from(rawBookText, 'utf8'));

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(new Uint8Array(gzippedBytes), {
          status: 200,
          headers: { 'Content-Type': 'application/gzip' },
        })
      )
      .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(new Uint8Array(zlib.gzipSync(Buffer.from('<html>Bad</html>', 'utf8'))), {
          status: 200,
          headers: { 'Content-Type': 'application/gzip' },
        })
      )
      .mockResolvedValueOnce(new Response(new Uint8Array([0x01, 0x02, 0x03]), { status: 200 }))
      .mockRejectedValueOnce(new Error('Network down'));

    expect(await fetchR2BookText(1342)).toEqual({ status: 'ok', text: rawBookText });
    expect(await fetchR2BookText(1342)).toEqual({ status: 'not_found' });
    expect(await fetchR2BookText(1342)).toEqual({ status: 'error' });
    expect(await fetchR2BookText(1342)).toEqual({ status: 'error' });
    expect(await fetchR2BookText(1342)).toEqual({ status: 'error' });
  });

  it('guards pre-aborted signals, empty or oversized streams, and null-body arrayBuffer fallbacks', async () => {
    stubValidR2Env();
    const abortedController = new AbortController();
    abortedController.abort();
    expect(await fetchR2CoverBytes(1342, abortedController.signal)).toEqual({ status: 'error' });

    const oversizedChunk = new Uint8Array(MAX_R2_COVER_BYTES + 16);
    const oversizedStream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.enqueue(oversizedChunk);
        ctrl.close();
      },
    });
    const emptyStream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.close();
      },
    });

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(oversizedStream, { status: 200 }))
      .mockResolvedValueOnce(new Response(emptyStream, { status: 200 }))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: null,
        headers: new Headers({ 'Content-Type': 'image/jpeg' }),
        arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer,
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: null,
        headers: new Headers({ 'Content-Type': 'image/jpeg' }),
        arrayBuffer: async () => new ArrayBuffer(0),
      } as unknown as Response);

    expect(await fetchR2CoverBytes(1342)).toEqual({ status: 'error' });
    expect(await fetchR2CoverBytes(1342)).toEqual({ status: 'error' });
    const bufOk = await fetchR2CoverBytes(1342);
    expect(bufOk.status).toBe('ok');
    expect(await fetchR2CoverBytes(1342)).toEqual({ status: 'error' });

    // Covers RFC3986 special-character signing, invalid text bookId, and HTML-sniffed image payload guard
    const config = getR2Config(validEnv)!;
    const specialSigned = signR2GetRequest(config, "books/a!(test)'*.txt.gz", new Date('2026-11-18T00:00:00.000Z'));
    expect(specialSigned.url).toContain('%21%28test%29%27%2A.txt.gz');
    expect(await fetchR2BookText(0)).toEqual({ status: 'error' });

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('<!DOCTYPE html><html>challenge</html>', {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg' },
      })
    );
    expect(await fetchR2CoverBytes(1342)).toEqual({ status: 'error' });
  });
});
