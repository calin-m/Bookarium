/**
 * @module scripts/lib/r2-sigv4
 * @scope Shared zero-dependency AWS Signature V4 transport, SSRF allowlist, strict config verification, paginated XML listing, and bounded `.txt.gz` reader for private Cloudflare R2 storage across CLI pipelines (`sync-r2-assets.js`, `scan-r2-content.js`, `sync-featured-quotes.js`).
 * @invariant Strictly validate `R2_ACCOUNT_ID` and `R2_BUCKET_NAME` via `assertValidR2ConfigIfPresent` (failing fast on partial or malformed configs while returning `null` only when all 4 `R2_*` variables are unset), lock all outbound requests to `isAllowedR2EndpointUrl` (`https://<account>.r2.cloudflarestorage.com`) with `redirect: 'manual'`, enforce bounded reads and gzip decompression (`MAX_R2_BOOK_BYTES`), and decode `ListObjectsV2` XML entities in a single regex pass (`XML_ENTITY_MAP`, `CWE-116` safe).
 * @rationale Centralizing S3-compatible R2 SigV4 transport primitives into a zero-third-party-dependency module prevents duplicated cryptographic signing and allows standalone maintenance workflows such as `r2-content-scan.yml` to run on Node 22 without `npm ci`.
 * @adr ADR-083, ADR-085
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const R2_DEFAULT_TIMEOUT_MS = 10_000;
const MAX_R2_BOOK_BYTES = 15 * 1024 * 1024;
const DEFAULT_R2_PUT_CONCURRENCY = 8;
const R2_ACCOUNT_ID_REGEX = /^[a-z0-9]{16,64}$/i;
const R2_BUCKET_NAME_REGEX = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const EMPTY_PAYLOAD_SHA256 = 'UNSIGNED-PAYLOAD';

const XML_ENTITY_MAP = Object.freeze(
  Object.assign(Object.create(null), {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
  })
);

function loadEnv(rootDir = path.resolve(__dirname, '../..')) {
  const envFiles = ['.env.local', '.env'];
  const env = { ...process.env };

  for (const file of envFiles) {
    const fullPath = path.join(rootDir, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const m = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
          if (m && !env[m[1]]) {
            let val = m[2].trim();
            if (
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))
            ) {
              val = val.slice(1, -1);
            }
            env[m[1]] = val;
          }
        }
      });
    }
  }
  return env;
}

function isHtmlPayload(contentType, bodySnippet) {
  const normalizedType = String(contentType || '').trim().toLowerCase();
  if (normalizedType.includes('text/html') || normalizedType.includes('application/xhtml+xml')) {
    return true;
  }
  if (!bodySnippet) return false;
  const trimmed = String(bodySnippet).trimStart().toLowerCase();
  return (
    trimmed.startsWith('<p>the document has moved') ||
    trimmed.startsWith('<!doctype html') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<head')
  );
}

function isAllowedR2EndpointUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return false;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    return /^[a-z0-9]{16,64}\.r2\.cloudflarestorage\.com$/.test(hostname);
  } catch {
    return false;
  }
}

function getR2Config(env = process.env) {
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

function isR2Configured(env = process.env) {
  return getR2Config(env) !== null;
}

function assertValidR2ConfigIfPresent(env = process.env) {
  const fields = [
    ['R2_ACCOUNT_ID', (env.R2_ACCOUNT_ID || '').trim()],
    ['R2_BUCKET_NAME', (env.R2_BUCKET_NAME || '').trim()],
    ['R2_ACCESS_KEY_ID', (env.R2_ACCESS_KEY_ID || '').trim()],
    ['R2_SECRET_ACCESS_KEY', (env.R2_SECRET_ACCESS_KEY || '').trim()],
  ];
  const configuredKeys = fields.filter(([, val]) => val.length > 0).map(([k]) => k);
  if (configuredKeys.length === 0) {
    return null;
  }

  const config = getR2Config(env);
  if (!config) {
    const missingKeys = fields.filter(([, val]) => !val).map(([k]) => k);
    if (missingKeys.length > 0) {
      throw new Error(
        `Partial Cloudflare R2 configuration detected (missing: ${missingKeys.join(', ')}). Configure all 4 R2_* variables or leave all unset to skip.`
      );
    }
    throw new Error(
      'Invalid R2_ACCOUNT_ID (expected 16-64 alphanumeric chars) or R2_BUCKET_NAME (expected lowercase S3 bucket name).'
    );
  }
  return config;
}

function encodeRfc3986Segment(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function signR2Request({
  config,
  method = 'GET',
  key = '',
  queryParams = {},
  payloadHash = EMPTY_PAYLOAD_SHA256,
  contentType = null,
  now = new Date(),
}) {
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const normalizedKey = String(key || '').replace(/^\/+/, '');
  const encodedBucket = encodeRfc3986Segment(config.bucket);
  const canonicalUri = normalizedKey
    ? `/${encodedBucket}/${normalizedKey.split('/').map(encodeRfc3986Segment).join('/')}`
    : `/${encodedBucket}`;

  const queryPairs = Object.entries(queryParams || {})
    .filter(([, val]) => val !== undefined && val !== null && val !== '')
    .map(([k, val]) => [encodeRfc3986Segment(k), encodeRfc3986Segment(String(val))])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const canonicalQueryString = queryPairs.map(([k, v]) => `${k}=${v}`).join('&');

  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    String(method || 'GET').toUpperCase(),
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
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

  const rawUrl = canonicalQueryString
    ? `https://${host}${canonicalUri}?${canonicalQueryString}`
    : `https://${host}${canonicalUri}`;

  const headers = {
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    Authorization: authorization,
  };
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  return {
    url: isAllowedR2EndpointUrl(rawUrl) ? rawUrl : null,
    headers,
  };
}

async function readBoundedBuffer(response, maxBytes, controller) {
  const contentLengthHeader = response.headers?.get?.('content-length');
  if (contentLengthHeader) {
    const declaredLength = parseInt(contentLengthHeader, 10);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      return null;
    }
  }

  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          controller?.abort?.();
          return null;
        }
        chunks.push(value);
      }
    }

    if (totalBytes === 0) return null;
    return Buffer.concat(chunks.map((c) => Buffer.from(c)));
  }

  const arr = await response.arrayBuffer();
  if (!arr || arr.byteLength === 0 || arr.byteLength > maxBytes) {
    return null;
  }
  return Buffer.from(arr);
}

/**
 * Decodes standard XML character entities in a single regex pass so doubly-encoded
 * payloads (e.g. `&amp;lt;`) are never double-unescaped (`CWE-116`).
 */
function unescapeXmlEntities(str) {
  return String(str || '').replace(
    /&(?:amp|lt|gt|quot|apos);/g,
    (entity) => XML_ENTITY_MAP[entity] || entity
  );
}

function parseListObjectsV2Xml(xmlText) {
  const text = String(xmlText || '');
  const truncatedMatch = text.match(/<IsTruncated>([^<]+)<\/IsTruncated>/i);
  const isTruncated = truncatedMatch ? truncatedMatch[1].trim().toLowerCase() === 'true' : false;
  const tokenMatch = text.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/i);
  const nextContinuationToken = tokenMatch ? unescapeXmlEntities(tokenMatch[1].trim()) : null;

  const objects = [];
  let cursor = 0;
  while (cursor < text.length) {
    const startIdx = text.indexOf('<Contents>', cursor);
    if (startIdx === -1) break;
    const endIdx = text.indexOf('</Contents>', startIdx);
    if (endIdx === -1) break;
    const block = text.slice(startIdx, endIdx);
    const keyMatch = block.match(/<Key>([^<]+)<\/Key>/i);
    if (keyMatch && keyMatch[1]) {
      const sizeMatch = block.match(/<Size>(\d+)<\/Size>/i);
      objects.push({
        key: unescapeXmlEntities(keyMatch[1].trim()),
        size: sizeMatch ? parseInt(sizeMatch[1], 10) : 0,
      });
    }
    cursor = endIdx + '</Contents>'.length;
  }

  return {
    isTruncated,
    nextContinuationToken,
    objects,
  };
}

async function fetchR2WithTimeout({
  url,
  method = 'GET',
  headers,
  body,
  fetchFn = globalThis.fetch,
  timeoutMs = R2_DEFAULT_TIMEOUT_MS,
  maxRetries = 2,
  retryDelayMs = 250,
  sleepFn = (ms) => new Promise((r) => setTimeout(r, ms)),
}) {
  if (!isAllowedR2EndpointUrl(url)) {
    throw new Error(`Blocked invalid R2 endpoint URL: ${url}`);
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchFn(url, {
        method,
        headers,
        body,
        redirect: 'manual',
        signal: controller.signal,
      });

      const isRetryable = response.status === 429 || (response.status >= 500 && response.status < 600);
      if (!isRetryable || attempt === maxRetries) {
        return { response, controller };
      }
      const retryAfterSec = parseInt(response.headers?.get?.('retry-after') || '', 10);
      const waitMs =
        Number.isFinite(retryAfterSec) && retryAfterSec > 0
          ? Math.min(5000, retryAfterSec * 1000)
          : retryDelayMs * Math.pow(2, attempt);
      if (waitMs > 0) await sleepFn(waitMs);
    } catch (err) {
      if (attempt === maxRetries) {
        throw err;
      }
      const waitMs = retryDelayMs * Math.pow(2, attempt);
      if (waitMs > 0) await sleepFn(waitMs);
    } finally {
      clearTimeout(timer);
    }
  }
}

async function listR2PrefixKeys(config, prefix, options = {}) {
  const fetchFn = options.fetchFn || globalThis.fetch;
  const timeoutMs = options.timeoutMs || R2_DEFAULT_TIMEOUT_MS;
  const maxPages = options.maxPages || 2000;
  const maxMatched =
    Number.isInteger(options.maxMatched) && options.maxMatched > 0 ? options.maxMatched : null;
  const filterFn = typeof options.filterFn === 'function' ? options.filterFn : null;
  const objects = [];
  let keyCount = 0;
  let apiCalls = 0;
  let continuationToken = null;
  let truncatedByLimit = false;

  for (let page = 0; page < maxPages; page++) {
    const signed = signR2Request({
      config,
      method: 'GET',
      key: '',
      queryParams: {
        'list-type': '2',
        'max-keys': '1000',
        prefix,
        ...(continuationToken ? { 'continuation-token': continuationToken } : {}),
      },
    });
    apiCalls++;
    const { response } = await fetchR2WithTimeout({
      url: signed.url,
      method: 'GET',
      headers: signed.headers,
      fetchFn,
      timeoutMs,
    });

    if (!response.ok) {
      throw new Error(`R2 ListObjectsV2 (${prefix}) returned HTTP ${response.status}`);
    }

    const xml = await response.text();
    const parsed = parseListObjectsV2Xml(xml);
    for (const obj of parsed.objects) {
      keyCount++;
      if (!filterFn || filterFn(obj)) {
        objects.push(obj);
        if (maxMatched && objects.length >= maxMatched) {
          truncatedByLimit = parsed.isTruncated || keyCount < parsed.objects.length;
          return { objects, keyCount, apiCalls, truncatedByLimit };
        }
      }
    }

    if (!parsed.isTruncated || !parsed.nextContinuationToken) {
      break;
    }
    continuationToken = parsed.nextContinuationToken;
  }

  return { objects, keyCount, apiCalls, truncatedByLimit };
}

async function listR2PrefixIds(config, prefix, keyRegex, options = {}) {
  const result = await listR2PrefixKeys(config, prefix, options);
  const ids = new Set();

  for (const obj of result.objects) {
    const m = obj.key.match(keyRegex);
    if (m && m[1]) {
      const id = parseInt(m[1], 10);
      if (Number.isInteger(id) && id > 0) {
        ids.add(id);
      }
    }
  }

  return { ids, keyCount: result.keyCount, apiCalls: result.apiCalls };
}

async function fetchR2GzippedText(config, key, options = {}) {
  const fetchFn = options.fetchFn || globalThis.fetch;
  const timeoutMs = options.timeoutMs || R2_DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes || MAX_R2_BOOK_BYTES;
  const rejectHtmlBody = options.rejectHtmlBody !== false;

  const signed = signR2Request({
    config,
    method: 'GET',
    key,
  });

  try {
    const { response, controller } = await fetchR2WithTimeout({
      url: signed.url,
      method: 'GET',
      headers: signed.headers,
      fetchFn,
      timeoutMs,
    });

    if (response.status >= 300 && response.status < 400) {
      return { status: 'error', error: 'Unexpected redirect from R2', httpStatus: response.status };
    }
    if (response.status === 404) {
      return { status: 'not_found', httpStatus: 404 };
    }
    if (!response.ok) {
      return {
        status: 'error',
        error: `R2 GetObject returned HTTP ${response.status}`,
        httpStatus: response.status,
      };
    }

    const contentType = response.headers?.get?.('content-type') || null;
    if (isHtmlPayload(contentType)) {
      return { status: 'error', error: 'Rejected HTML response from R2', httpStatus: response.status };
    }

    const rawBuf = await readBoundedBuffer(response, maxBytes, controller);
    if (!rawBuf) {
      return { status: 'error', error: 'Empty or oversized R2 gzip payload' };
    }

    const isGzip = key.toLowerCase().endsWith('.gz') || (rawBuf[0] === 0x1f && rawBuf[1] === 0x8b);
    const decodedBuf = isGzip ? zlib.gunzipSync(rawBuf, { maxOutputLength: maxBytes }) : rawBuf;
    const text = decodedBuf.toString('utf8');

    if (rejectHtmlBody && isHtmlPayload(null, text.slice(0, 512))) {
      return { status: 'error', error: 'Rejected HTML content inside R2 archive' };
    }

    return {
      status: 'ok',
      text,
      compressedBytes: rawBuf.byteLength,
      textBytes: decodedBuf.byteLength,
    };
  } catch (err) {
    return { status: 'error', error: err.message || 'R2 fetch error' };
  }
}

async function fetchBookTextFromR2(bookId, options = {}) {
  const numericId = typeof bookId === 'number' ? bookId : parseInt(String(bookId || ''), 10);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return { status: 'error', error: 'Invalid Gutenberg ID' };
  }

  const config = options.config || getR2Config(options.env || process.env);
  if (!config) {
    return { status: 'unconfigured' };
  }

  const res = await fetchR2GzippedText(config, `books/${numericId}.txt.gz`, {
    ...options,
    rejectHtmlBody: true,
  });

  if (res.status === 'ok') {
    return { status: 'ok', text: res.text };
  }
  if (res.status === 'not_found') {
    return { status: 'not_found' };
  }
  return { status: 'error', error: res.error };
}

async function runWithConcurrency(tasks = [], concurrency = DEFAULT_R2_PUT_CONCURRENCY) {
  if (!Array.isArray(tasks) || tasks.length === 0) return;
  const workerCount = Math.max(1, Math.min(tasks.length, concurrency || DEFAULT_R2_PUT_CONCURRENCY));
  let nextIdx = 0;

  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++;
      await tasks[idx]();
    }
  });
  await Promise.all(workers);
}

function escapeMarkdownCell(val) {
  return String(val === undefined || val === null ? '' : val)
    .replace(/[\\|]/g, '\\$&')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function appendStepSummary(stepSummaryPath, reportMarkdown, fsImpl = fs) {
  if (!stepSummaryPath || !reportMarkdown) return false;
  fsImpl.appendFileSync(stepSummaryPath, reportMarkdown, 'utf8');
  return true;
}

module.exports = {
  R2_DEFAULT_TIMEOUT_MS,
  MAX_R2_BOOK_BYTES,
  DEFAULT_R2_PUT_CONCURRENCY,
  R2_ACCOUNT_ID_REGEX,
  R2_BUCKET_NAME_REGEX,
  EMPTY_PAYLOAD_SHA256,
  XML_ENTITY_MAP,
  loadEnv,
  isHtmlPayload,
  isAllowedR2EndpointUrl,
  getR2Config,
  isR2Configured,
  assertValidR2ConfigIfPresent,
  encodeRfc3986Segment,
  sha256Hex,
  hmacSha256,
  signR2Request,
  readBoundedBuffer,
  unescapeXmlEntities,
  parseListObjectsV2Xml,
  fetchR2WithTimeout,
  listR2PrefixKeys,
  listR2PrefixIds,
  fetchR2GzippedText,
  fetchBookTextFromR2,
  runWithConcurrency,
  escapeMarkdownCell,
  appendStepSummary,
};
