/**
 * @module src/lib/r2-client
 * @scope Server-only Cloudflare R2 S3-compatible AWS SigV4 fetch, HEAD existence check, and gzip decompression client for private book texts (`books/<id>.txt.gz`) and cover artwork (`covers/<id>.jpg`).
 * @invariant Never expose `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, or `R2_SECRET_ACCESS_KEY` to client bundles, validate `accountId` and `bucket` identifiers before URL construction, enforce `redirect: 'manual'` on all outbound R2 requests, and bound streamed cover payloads (`MAX_R2_COVER_BYTES`) and gzip decompression output (`MAX_R2_BOOK_BYTES`).
 * @invariant Return explicit `'unconfigured'` status when `R2_*` credentials are absent so local unconfigured environments fail closed predictably (`404`/`503`) without unhandled configuration errors or Project Gutenberg fallbacks.
 * @rationale Using built-in `node:crypto` AWS Signature V4 signing and bounded `node:zlib` `gunzip` keeps R2 reads completely dependency-free, fast on serverless Node runtimes, and resilient against decompression bombs or open redirects.
 * @adr ADR-016, ADR-082
 */

import crypto from 'node:crypto';
import zlib from 'node:zlib';

export const MAX_R2_BOOK_BYTES = 15 * 1024 * 1024;
export const MAX_R2_COVER_BYTES = 2 * 1024 * 1024;
export const R2_DEFAULT_TIMEOUT_MS = 10_000;

const R2_ACCOUNT_ID_REGEX = /^[a-z0-9]{16,64}$/i;
const R2_BUCKET_NAME_REGEX = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const EMPTY_PAYLOAD_SHA256 = 'UNSIGNED-PAYLOAD';

export interface R2ClientConfig {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export type R2CoverFetchResult =
  | { status: 'ok'; bytes: ArrayBuffer; contentType: string }
  | { status: 'not_found' }
  | { status: 'unconfigured' }
  | { status: 'error' };

export type R2BookTextFetchResult =
  | { status: 'ok'; text: string }
  | { status: 'not_found' }
  | { status: 'unconfigured' }
  | { status: 'error' };

export function isHtmlPayload(contentType: string | null | undefined, bodySnippet?: string): boolean {
  const normalizedType = (contentType || '').trim().toLowerCase();
  if (normalizedType.includes('text/html') || normalizedType.includes('application/xhtml+xml')) {
    return true;
  }
  if (!bodySnippet) return false;
  const trimmed = bodySnippet.trimStart().toLowerCase();
  return (
    trimmed.startsWith('<p>the document has moved') ||
    trimmed.startsWith('<!doctype html') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<head')
  );
}

export function getR2Config(env: Record<string, string | undefined> = process.env): R2ClientConfig | null {
  const accountId = (env.R2_ACCOUNT_ID || '').trim();
  const bucket = (env.R2_BUCKET_NAME || '').trim();
  const accessKeyId = (env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (env.R2_SECRET_ACCESS_KEY || '').trim();

  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  if (
    !R2_ACCOUNT_ID_REGEX.test(accountId) ||
    !R2_BUCKET_NAME_REGEX.test(bucket) ||
    bucket.includes('..')
  ) {
    return null;
  }

  return {
    accountId: accountId.toLowerCase(),
    bucket,
    accessKeyId,
    secretAccessKey,
  };
}

export function isR2Configured(env: Record<string, string | undefined> = process.env): boolean {
  return getR2Config(env) !== null;
}

function encodeRfc3986Segment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function hmacSha256(key: string | Buffer, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function signR2MethodRequest(
  method: 'GET' | 'HEAD',
  config: R2ClientConfig,
  objectKey: string,
  now: Date = new Date()
): { url: string; headers: Record<string, string> } {
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const normalizedKey = objectKey.replace(/^\/+/, '');
  const encodedKey = normalizedKey.split('/').map(encodeRfc3986Segment).join('/');
  const canonicalUri = `/${encodeRfc3986Segment(config.bucket)}/${encodedKey}`;

  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${EMPTY_PAYLOAD_SHA256}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    method,
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    EMPTY_PAYLOAD_SHA256,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmacSha256(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, 'auto');
  const kService = hmacSha256(kRegion, 's3');
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: new URL(canonicalUri, `https://${host}`).toString(),
    headers: {
      'x-amz-date': amzDate,
      'x-amz-content-sha256': EMPTY_PAYLOAD_SHA256,
      Authorization: authorization,
    },
  };
}

export function signR2GetRequest(
  config: R2ClientConfig,
  objectKey: string,
  now: Date = new Date()
): { url: string; headers: Record<string, string> } {
  return signR2MethodRequest('GET', config, objectKey, now);
}

export function signR2HeadRequest(
  config: R2ClientConfig,
  objectKey: string,
  now: Date = new Date()
): { url: string; headers: Record<string, string> } {
  return signR2MethodRequest('HEAD', config, objectKey, now);
}

async function readBoundedArrayBuffer(
  response: Response,
  maxBytes: number,
  controller: AbortController
): Promise<ArrayBuffer | null> {
  const contentLengthHeader = response.headers?.get('content-length');
  if (contentLengthHeader) {
    const declaredLength = parseInt(contentLengthHeader, 10);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      return null;
    }
  }

  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          controller.abort();
          return null;
        }
        chunks.push(value);
      }
    }

    if (totalBytes === 0) return null;

    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return merged.buffer;
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0 || buffer.byteLength > maxBytes) {
    return null;
  }
  return buffer;
}

function gunzipBounded(compressed: Buffer, maxOutputLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zlib.gunzip(compressed, { maxOutputLength }, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
}

async function fetchSignedR2Object(
  objectKey: string,
  maxBytes: number,
  externalSignal?: AbortSignal
): Promise<
  | { status: 'ok'; bytes: ArrayBuffer; contentType: string }
  | { status: 'not_found' }
  | { status: 'unconfigured' }
  | { status: 'error' }
> {
  const config = getR2Config();
  if (!config) {
    return { status: 'unconfigured' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), R2_DEFAULT_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId);
      return { status: 'error' };
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const { url, headers } = signR2GetRequest(config, objectKey);
    const response = await fetch(url, {
      method: 'GET',
      headers,
      redirect: 'manual',
      signal: controller.signal,
    });

    if (response.status === 404) {
      return { status: 'not_found' };
    }

    if (response.status >= 300 && response.status < 400) {
      return { status: 'error' };
    }

    if (!response.ok) {
      return { status: 'error' };
    }

    const contentType = (response.headers?.get('content-type') || '').trim();
    if (isHtmlPayload(contentType)) {
      return { status: 'error' };
    }

    const bytes = await readBoundedArrayBuffer(response, maxBytes, controller);
    if (!bytes) {
      return { status: 'error' };
    }

    return { status: 'ok', bytes, contentType };
  } catch {
    return { status: 'error' };
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

/**
 * Checks via signed AWS SigV4 `HEAD` request whether a volume's JPEG cover exists in R2.
 */
export async function headR2CoverExists(
  bookId: number,
  externalSignal?: AbortSignal
): Promise<'ok' | 'not_found' | 'unconfigured' | 'error'> {
  if (!Number.isInteger(bookId) || bookId <= 0 || bookId > 10_000_000) {
    return 'error';
  }

  const config = getR2Config();
  if (!config) {
    return 'unconfigured';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.min(R2_DEFAULT_TIMEOUT_MS, 4000));
  const onExternalAbort = () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId);
      return 'error';
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const { url, headers } = signR2HeadRequest(config, `covers/${Math.trunc(bookId)}.jpg`);
    const response = await fetch(url, {
      method: 'HEAD',
      headers,
      redirect: 'manual',
      signal: controller.signal,
    });

    if (response.status === 404) {
      return 'not_found';
    }

    if ((response.status >= 300 && response.status < 400) || !response.ok) {
      return 'error';
    }

    const contentType = (response.headers?.get('content-type') || '').trim();
    if (isHtmlPayload(contentType)) {
      return 'error';
    }

    return 'ok';
  } catch {
    return 'error';
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

export async function fetchR2CoverBytes(
  bookId: number,
  signal?: AbortSignal
): Promise<R2CoverFetchResult> {
  if (!Number.isInteger(bookId) || bookId <= 0 || bookId > 10_000_000) {
    return { status: 'error' };
  }

  const result = await fetchSignedR2Object(`covers/${Math.trunc(bookId)}.jpg`, MAX_R2_COVER_BYTES, signal);
  if (result.status !== 'ok') {
    return result;
  }

  const snippet = new TextDecoder('utf-8').decode(new Uint8Array(result.bytes, 0, Math.min(256, result.bytes.byteLength)));
  if (isHtmlPayload(result.contentType, snippet)) {
    return { status: 'error' };
  }

  return result;
}

export async function fetchR2BookText(
  bookId: number,
  signal?: AbortSignal
): Promise<R2BookTextFetchResult> {
  if (!Number.isInteger(bookId) || bookId <= 0 || bookId > 10_000_000) {
    return { status: 'error' };
  }

  const result = await fetchSignedR2Object(
    `books/${Math.trunc(bookId)}.txt.gz`,
    MAX_R2_BOOK_BYTES,
    signal
  );
  if (result.status !== 'ok') {
    return result;
  }

  try {
    const decompressed = await gunzipBounded(Buffer.from(result.bytes), MAX_R2_BOOK_BYTES);
    const text = new TextDecoder('utf-8').decode(decompressed);
    if (!text.trim() || isHtmlPayload('text/plain', text.slice(0, 512))) {
      return { status: 'error' };
    }
    return { status: 'ok', text };
  } catch {
    return { status: 'error' };
  }
}
