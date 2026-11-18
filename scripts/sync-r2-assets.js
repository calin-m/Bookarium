/**
 * @module scripts/sync-r2-assets
 * @scope Automated Cloudflare R2 delta synchronization and backfill engine managing `books/<id>.txt.gz`, `covers/<id>.jpg`, and missing-asset cooldown state `_meta/r2-sync-state.json.gz` via zero-dependency AWS Signature V4 S3 calls and targeted `rsync --files-from` / PGLAF HTTPS transfers.
 * @invariant Unconditionally enforce `copyright !== true` (`Rule 2/4`) on all R2 uploads, enforce `MIN_ACTIVE_CATALOG_FOR_PRUNE` before pruning withdrawn IDs (bounded by `DEFAULT_MAX_PRUNE_PER_RUN` unless `--force-prune`), decode `ListObjectsV2` XML entities in a single pass via `XML_ENTITY_MAP` (`CWE-116` safe), validate all remote endpoints via `isAllowedR2EndpointUrl` and `isAllowedGutenbergAssetUrl` with `redirect: 'manual'` and bounded payload limits (`MAX_R2_BOOK_BYTES`, `MAX_R2_COVER_BYTES`), invoke `rsync`/`wsl` strictly with `{ shell: false }`, and exit `0` cleanly when `R2_*` credentials are unconfigured.
 * @rationale Scanning private R2 prefixes with `ListObjectsV2` consumes ~157 Class A operations across ~78,000 books without requiring SQL indexes, targeted `rsync --files-from` eliminates 78k remote directory walks on CI runners while `_meta/r2-sync-state.json.gz` (`DEFAULT_MISSING_RECHECK_DAYS` TTL) suppresses repeated missing-cover probes, and prioritizing `PRIORITY_HERO_BOOK_IDS` followed by `download_count DESC` accelerates Quote Pool and classic asset readiness.
 * @adr ADR-083
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { spawn, spawnSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const R2_DEFAULT_TIMEOUT_MS = 10_000;
const MAX_R2_BOOK_BYTES = 15 * 1024 * 1024;
const MAX_R2_COVER_BYTES = 2 * 1024 * 1024;
const MAX_R2_STATE_BYTES = 8 * 1024 * 1024;
const DEFAULT_MISSING_RECHECK_DAYS = 90;
const RSYNC_BATCH_SIZE = 200;
const DEFAULT_MAX_PRUNE_PER_RUN = 500;
const MIN_ACTIVE_CATALOG_FOR_PRUNE = 50_000;
const FULL_LEDGER_THRESHOLD = 100;
const BULK_LEDGER_PREVIEW_ROWS = 50;
const RSYNC_PARTIAL_VANISHED_CODES = new Set([0, 23, 24]);

const R2_ACCOUNT_ID_REGEX = /^[a-z0-9]{16,64}$/i;
const R2_BUCKET_NAME_REGEX = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const EMPTY_PAYLOAD_SHA256 = 'UNSIGNED-PAYLOAD';

const RSYNC_EPUB_SOURCE = 'aleph.gutenberg.org::gutenberg-epub';
const RSYNC_MAIN_SOURCE = 'aleph.gutenberg.org::gutenberg';

const MIRROR_SHORTCUT_MAP = {
  pglaf: 'https://gutenberg.pglaf.org',
  aleph: 'https://aleph.gutenberg.org',
  readingroo: 'https://gutenberg.readingroo.ms',
};

const GUTENBERG_ASSET_MIRRORS = [
  'https://gutenberg.pglaf.org',
  'https://aleph.gutenberg.org',
  'https://gutenberg.readingroo.ms',
];

const ALLOWED_GUTENBERG_ASSET_HOSTS = new Set([
  'gutenberg.pglaf.org',
  'aleph.gutenberg.org',
  'gutenberg.readingroo.ms',
]);

/**
 * Canonical 27 Hero & Editorial Classic Book IDs (`FEATURED_HERO_BOOKS` in `src/config/featured-books.ts`).
 * Prioritized first ahead of `download_count DESC` so classics and Quote Pool volumes populate R2 first.
 */
const PRIORITY_HERO_BOOK_IDS = [
  1342, 84, 2701, 64317, 11, 174, 1661, 345, 98, 35, 2600, 135, 2554, 1260,
  768, 5200, 43, 1184, 1232, 132, 2680, 1727, 514, 2147, 164, 205, 76,
];
const PRIORITY_HERO_BOOK_ID_SET = new Set(PRIORITY_HERO_BOOK_IDS);

function resolveSiteOriginFallback(env = process.env) {
  const candidates = [
    env.NEXT_PUBLIC_SITE_URL,
    env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
    env.VERCEL_PROJECT_PRODUCTION_URL,
  ];
  for (const raw of candidates) {
    const trimmed = (raw || '').trim().replace(/\/+$/, '');
    if (!trimmed) continue;
    const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    try {
      const parsed = new URL(withProtocol);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.origin;
      }
    } catch {}
  }
  return 'https://bookarium.vercel.app';
}

function resolveRepositoryUrl(env = process.env) {
  if (env.NEXT_PUBLIC_GITHUB_REPO) {
    return env.NEXT_PUBLIC_GITHUB_REPO.trim();
  }
  if (env.BOOKARIUM_REPO_URL) {
    return env.BOOKARIUM_REPO_URL.trim();
  }
  if (env.GITHUB_REPOSITORY) {
    return `https://github.com/${env.GITHUB_REPOSITORY.trim().replace(/^\/+|\/+$/g, '')}`;
  }
  if (env.VERCEL_GIT_REPO_OWNER && env.VERCEL_GIT_REPO_SLUG) {
    return `https://github.com/${env.VERCEL_GIT_REPO_OWNER.trim()}/${env.VERCEL_GIT_REPO_SLUG.trim()}`;
  }
  return resolveSiteOriginFallback(env);
}

function buildDescriptiveUserAgent(
  appName = 'Bookarium-R2-Sync',
  version = '1.0',
  env = process.env
) {
  const repoOrSiteUrl = resolveRepositoryUrl(env);
  const email = (env.GUTENBERG_CONTACT_EMAIL || '').trim();
  const contactPart = email ? `+${repoOrSiteUrl}; ${email}` : `+${repoOrSiteUrl}`;
  return `${appName}/${version} (${contactPart})`;
}

function loadEnv(rootDir = path.resolve(__dirname, '..')) {
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

function isAllowedGutenbergAssetUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return false;
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port &&
      ALLOWED_GUTENBERG_ASSET_HOSTS.has(parsed.hostname.toLowerCase())
    );
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
          controller.abort();
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

const XML_ENTITY_MAP = Object.freeze(
  Object.assign(Object.create(null), {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
  })
);

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

async function listR2PrefixIds(config, prefix, keyRegex, options = {}) {
  const fetchFn = options.fetchFn || globalThis.fetch;
  const timeoutMs = options.timeoutMs || R2_DEFAULT_TIMEOUT_MS;
  const maxPages = options.maxPages || 2000;
  const ids = new Set();
  let keyCount = 0;
  let apiCalls = 0;
  let continuationToken = null;

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
      const m = obj.key.match(keyRegex);
      if (m && m[1]) {
        const id = parseInt(m[1], 10);
        if (Number.isInteger(id) && id > 0) {
          ids.add(id);
        }
      }
    }

    if (!parsed.isTruncated || !parsed.nextContinuationToken) {
      break;
    }
    continuationToken = parsed.nextContinuationToken;
  }

  return { ids, keyCount, apiCalls };
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

  const fetchFn = options.fetchFn || globalThis.fetch;
  const timeoutMs = options.timeoutMs || R2_DEFAULT_TIMEOUT_MS;
  const signed = signR2Request({
    config,
    method: 'GET',
    key: `books/${numericId}.txt.gz`,
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
      return { status: 'error', error: 'Unexpected redirect from R2' };
    }
    if (response.status === 404) {
      return { status: 'not_found' };
    }
    if (!response.ok) {
      return { status: 'error', error: `R2 GetObject returned HTTP ${response.status}` };
    }

    const contentType = response.headers?.get?.('content-type') || null;
    if (isHtmlPayload(contentType)) {
      return { status: 'error', error: 'Rejected HTML response from R2' };
    }

    const gzBuf = await readBoundedBuffer(response, MAX_R2_BOOK_BYTES, controller);
    if (!gzBuf) {
      return { status: 'error', error: 'Empty or oversized R2 gzip payload' };
    }

    const text = zlib.gunzipSync(gzBuf, { maxOutputLength: MAX_R2_BOOK_BYTES }).toString('utf8');
    if (isHtmlPayload(null, text.slice(0, 512))) {
      return { status: 'error', error: 'Rejected HTML content inside R2 archive' };
    }

    return { status: 'ok', text };
  } catch (err) {
    return { status: 'error', error: err.message || 'R2 fetch error' };
  }
}

async function putR2Object(config, key, bodyBuffer, contentType, options = {}) {
  const fetchFn = options.fetchFn || globalThis.fetch;
  const timeoutMs = options.timeoutMs || R2_DEFAULT_TIMEOUT_MS;
  const payloadHash = sha256Hex(bodyBuffer);
  const signed = signR2Request({
    config,
    method: 'PUT',
    key,
    payloadHash,
    contentType,
  });

  const { response } = await fetchR2WithTimeout({
    url: signed.url,
    method: 'PUT',
    headers: signed.headers,
    body: bodyBuffer,
    fetchFn,
    timeoutMs,
  });

  if (!response.ok) {
    throw new Error(`R2 PutObject (${key}) returned HTTP ${response.status}`);
  }
  return { key, bytes: bodyBuffer.byteLength };
}

async function deleteR2Object(config, key, options = {}) {
  const fetchFn = options.fetchFn || globalThis.fetch;
  const timeoutMs = options.timeoutMs || R2_DEFAULT_TIMEOUT_MS;
  const signed = signR2Request({
    config,
    method: 'DELETE',
    key,
  });

  const { response } = await fetchR2WithTimeout({
    url: signed.url,
    method: 'DELETE',
    headers: signed.headers,
    fetchFn,
    timeoutMs,
  });

  if (response.status !== 404 && !response.ok) {
    throw new Error(`R2 DeleteObject (${key}) returned HTTP ${response.status}`);
  }
  return { key, deleted: true };
}

const SYNC_STATE_OBJECT_KEY = '_meta/r2-sync-state.json.gz';

function pruneExpiredStateEntries(entries, nowMs, recheckDays = DEFAULT_MISSING_RECHECK_DAYS) {
  const ttlMs = Math.max(1, recheckDays) * 86_400_000;
  const next = {};
  let pruned = 0;
  for (const [id, iso] of Object.entries(entries || {})) {
    const ts = Date.parse(iso);
    if (Number.isFinite(ts) && nowMs - ts < ttlMs) {
      next[id] = iso;
    } else {
      pruned++;
    }
  }
  return { entries: next, pruned };
}

async function readR2SyncState(config, options = {}) {
  const fetchFn = options.fetchFn || globalThis.fetch;
  const timeoutMs = options.timeoutMs || R2_DEFAULT_TIMEOUT_MS;
  const nowMs = typeof options.nowMs === 'number' ? options.nowMs : Date.now();
  const recheckDays = options.recheckDays || DEFAULT_MISSING_RECHECK_DAYS;
  const empty = {
    version: 1,
    updatedAt: null,
    missingCovers: {},
    missingTexts: {},
    dirty: false,
    apiCalls: 1,
  };

  const signed = signR2Request({
    config,
    method: 'GET',
    key: SYNC_STATE_OBJECT_KEY,
  });

  try {
    const { response, controller } = await fetchR2WithTimeout({
      url: signed.url,
      method: 'GET',
      headers: signed.headers,
      fetchFn,
      timeoutMs,
    });
    if (response.status === 404 || !response.ok) {
      return empty;
    }
    const gzBuf = await readBoundedBuffer(response, MAX_R2_STATE_BYTES, controller);
    if (!gzBuf) return empty;
    const raw = zlib.gunzipSync(gzBuf, { maxOutputLength: MAX_R2_STATE_BYTES }).toString('utf8');
    const parsed = JSON.parse(raw);
    const coversRes = pruneExpiredStateEntries(parsed?.missingCovers, nowMs, recheckDays);
    const textsRes = pruneExpiredStateEntries(parsed?.missingTexts, nowMs, recheckDays);

    return {
      version: 1,
      updatedAt: parsed?.updatedAt || null,
      missingCovers: coversRes.entries,
      missingTexts: textsRes.entries,
      dirty: coversRes.pruned > 0 || textsRes.pruned > 0,
      apiCalls: 1,
    };
  } catch {
    return empty;
  }
}

async function writeR2SyncState(config, state, options = {}) {
  const nowMs = typeof options.nowMs === 'number' ? options.nowMs : Date.now();
  const recheckDays = options.recheckDays || DEFAULT_MISSING_RECHECK_DAYS;
  const coversClean = pruneExpiredStateEntries(state.missingCovers, nowMs, recheckDays).entries;
  const textsClean = pruneExpiredStateEntries(state.missingTexts, nowMs, recheckDays).entries;
  const payload = JSON.stringify({
    version: 1,
    updatedAt: new Date(nowMs).toISOString(),
    missingCovers: coversClean,
    missingTexts: textsClean,
  });
  const gzBuf = zlib.gzipSync(Buffer.from(payload, 'utf8'), { level: 9 });
  await putR2Object(config, SYNC_STATE_OBJECT_KEY, gzBuf, 'application/gzip', options);
  return { bytes: gzBuf.byteLength, coverlessCount: Object.keys(coversClean).length };
}

function parseDelayRange(rawRange, defaultMin = 8, defaultMax = 16) {
  if (!rawRange) return { min: defaultMin, max: defaultMax };
  const parts = String(rawRange).split('-');
  if (parts.length !== 2) return { min: defaultMin, max: defaultMax };
  const min = parseFloat(parts[0]);
  const max = parseFloat(parts[1]);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) {
    return { min: defaultMin, max: defaultMax };
  }
  return { min, max };
}

function parseCliArgs(argv = []) {
  const options = {
    help: false,
    dryRun: false,
    limit: null,
    ids: null,
    cacheFile: null,
    source: 'auto',
    mirrors: [...GUTENBERG_ASSET_MIRRORS],
    delayMin: 8,
    delayMax: 16,
    maxMinutes: null,
    syncBooks: true,
    syncCovers: true,
    force: false,
    recheckMissing: false,
    pruneWithdrawn: true,
    forcePrune: false,
    maxPrune: DEFAULT_MAX_PRUNE_PER_RUN,
    recheckDays: DEFAULT_MISSING_RECHECK_DAYS,
  };

  for (const rawArg of argv) {
    const arg = String(rawArg || '').trim();
    if (!arg) continue;
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--recheck-missing') {
      options.recheckMissing = true;
    } else if (arg === '--no-prune') {
      options.pruneWithdrawn = false;
    } else if (arg === '--force-prune') {
      options.forcePrune = true;
    } else if (arg === '--books-only') {
      options.syncBooks = true;
      options.syncCovers = false;
    } else if (arg === '--covers-only') {
      options.syncBooks = false;
      options.syncCovers = true;
    } else if (arg.startsWith('--limit=')) {
      const n = parseInt(arg.slice('--limit='.length), 10);
      if (!Number.isInteger(n) || n <= 0) {
        throw new Error(`Invalid --limit value "${arg}". Must be a positive integer.`);
      }
      options.limit = n;
    } else if (arg.startsWith('--max-minutes=')) {
      const m = parseInt(arg.slice('--max-minutes='.length), 10);
      if (!Number.isInteger(m) || m <= 0) {
        throw new Error(`Invalid --max-minutes value "${arg}". Must be a positive integer.`);
      }
      options.maxMinutes = m;
    } else if (arg.startsWith('--max-prune=')) {
      const p = parseInt(arg.slice('--max-prune='.length), 10);
      if (!Number.isInteger(p) || p < 0) {
        throw new Error(`Invalid --max-prune value "${arg}". Must be a non-negative integer.`);
      }
      options.maxPrune = p;
    } else if (arg.startsWith('--cache-file=')) {
      const p = arg.slice('--cache-file='.length).trim();
      if (!p) throw new Error('Invalid empty --cache-file value.');
      options.cacheFile = p;
    } else if (arg.startsWith('--source=')) {
      const src = arg.slice('--source='.length).trim().toLowerCase();
      if (!['auto', 'rsync', 'wsl-rsync', 'https'].includes(src)) {
        throw new Error(`Unsupported --source "${src}". Expected auto, rsync, wsl-rsync, or https.`);
      }
      options.source = src;
    } else if (arg.startsWith('--mirror=')) {
      const key = arg.slice('--mirror='.length).trim().toLowerCase();
      if (!MIRROR_SHORTCUT_MAP[key]) {
        throw new Error(`Unsupported --mirror "${key}". Expected pglaf, aleph, or readingroo.`);
      }
      options.mirrors = [MIRROR_SHORTCUT_MAP[key]];
    } else if (arg.startsWith('--delay-range=')) {
      const { min, max } = parseDelayRange(arg.slice('--delay-range='.length));
      options.delayMin = min;
      options.delayMax = max;
    } else if (arg.startsWith('--ids=')) {
      const rawIds = arg.slice('--ids='.length).split(',').map((v) => v.trim()).filter(Boolean);
      const parsedIds = [];
      for (const token of rawIds) {
        if (!/^\d{1,8}$/.test(token)) {
          throw new Error(`Invalid Gutenberg ID "${token}" in --ids.`);
        }
        const id = parseInt(token, 10);
        if (!Number.isInteger(id) || id <= 0) {
          throw new Error(`Invalid Gutenberg ID "${token}" in --ids.`);
        }
        parsedIds.push(id);
      }
      options.ids = Array.from(new Set(parsedIds));
    }
  }

  return options;
}

function readCatalogSnapshotFile(cacheFilePath, fsImpl = fs, logger = console) {
  if (!cacheFilePath || !fsImpl.existsSync(cacheFilePath)) {
    return null;
  }

  const rawBuf = fsImpl.readFileSync(cacheFilePath);
  const shaPath = `${cacheFilePath}.sha256`;
  if (fsImpl.existsSync(shaPath)) {
    const shaMatch = fsImpl.readFileSync(shaPath, 'utf8').match(/^\s*([a-f0-9]{64})(?:\s|$)/i);
    const expectedHex = shaMatch ? shaMatch[1].toLowerCase() : null;
    const actualHex = sha256Hex(rawBuf);
    if (
      !expectedHex ||
      !crypto.timingSafeEqual(Buffer.from(expectedHex, 'hex'), Buffer.from(actualHex, 'hex'))
    ) {
      if (logger) {
        logger.warn(
          `  ⚠ Security Warning: Snapshot cache SHA-256 verification failed for ${cacheFilePath}; falling back to Supabase catalog.`
        );
      }
      return null;
    }
  }

  const jsonStr = cacheFilePath.endsWith('.gz')
    ? zlib.gunzipSync(rawBuf).toString('utf8')
    : rawBuf.toString('utf8');
  const parsed = JSON.parse(jsonStr);
  const rawBooks = Array.isArray(parsed)
    ? parsed
    : parsed && Array.isArray(parsed.books)
      ? parsed.books
      : [];

  return rawBooks
    .filter((b) => b && Number.isInteger(b.id) && b.id > 0)
    .map((b) => ({
      id: b.id,
      title: b.title || `Gutenberg #${b.id}`,
      copyright: Boolean(b.copyright),
      media_type: b.media_type || 'Text',
      download_count: typeof b.download_count === 'number' ? b.download_count : 0,
    }));
}

async function fetchCatalogFromSupabase(supabase, options = {}) {
  const rows = [];
  if (Array.isArray(options.ids) && options.ids.length > 0) {
    const { data, error } = await supabase
      .from('books')
      .select('id, title, copyright, media_type, download_count')
      .in('id', options.ids);
    if (error) throw new Error(`Supabase catalog lookup failed: ${error.message}`);
    return (data || []).map((r) => ({
      id: r.id,
      title: r.title || `Gutenberg #${r.id}`,
      copyright: Boolean(r.copyright),
      media_type: r.media_type || 'Text',
      download_count: typeof r.download_count === 'number' ? r.download_count : 0,
    }));
  }

  let cursorId = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('books')
      .select('id, title, copyright, media_type, download_count')
      .gt('id', cursorId)
      .order('id', { ascending: true })
      .limit(pageSize);

    if (error) throw new Error(`Supabase catalog scan failed: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const r of data) {
      if (Number.isInteger(r.id) && r.id > 0) {
        rows.push({
          id: r.id,
          title: r.title || `Gutenberg #${r.id}`,
          copyright: Boolean(r.copyright),
          media_type: r.media_type || 'Text',
          download_count: typeof r.download_count === 'number' ? r.download_count : 0,
        });
        if (r.id > cursorId) cursorId = r.id;
      }
    }
    if (data.length < pageSize) break;
  }

  return rows;
}

function buildR2DeltaPlan({
  books = [],
  existingBookIds = new Set(),
  existingCoverIds = new Set(),
  syncState = { missingCovers: {}, missingTexts: {} },
  options = {},
  isFullCatalog = false,
}) {
  const syncBooks = options.syncBooks !== false;
  const syncCovers = options.syncCovers !== false;
  const force = Boolean(options.force);
  const recheckMissing = Boolean(options.recheckMissing);
  const pruneWithdrawn = options.pruneWithdrawn !== false;
  const forcePrune = Boolean(options.forcePrune);
  const maxPrune = typeof options.maxPrune === 'number' ? options.maxPrune : DEFAULT_MAX_PRUNE_PER_RUN;
  const limit = typeof options.limit === 'number' && options.limit > 0 ? options.limit : null;

  const activeIds = new Set();
  const copyrightedIds = new Set();
  const eligibleBooks = [];

  for (const row of books) {
    if (!row || !Number.isInteger(row.id) || row.id <= 0) continue;
    activeIds.add(row.id);
    if (row.copyright === true) {
      copyrightedIds.add(row.id);
      continue;
    }
    if (!row.media_type || row.media_type === 'Text') {
      eligibleBooks.push(row);
    }
  }

  let skippedCopyrightIds = [];
  let orderedCandidates = [];

  if (Array.isArray(options.ids) && options.ids.length > 0) {
    const byId = new Map(eligibleBooks.map((b) => [b.id, b]));
    for (const reqId of options.ids) {
      if (copyrightedIds.has(reqId)) {
        skippedCopyrightIds.push(reqId);
        continue;
      }
      orderedCandidates.push(
        byId.get(reqId) || {
          id: reqId,
          title: `Gutenberg #${reqId}`,
          copyright: false,
          download_count: 0,
        }
      );
    }
  } else {
    orderedCandidates = [...eligibleBooks].sort((a, b) => {
      const aHero = PRIORITY_HERO_BOOK_ID_SET.has(a.id) ? 1 : 0;
      const bHero = PRIORITY_HERO_BOOK_ID_SET.has(b.id) ? 1 : 0;
      if (aHero !== bHero) return bHero - aHero;
      return (b.download_count || 0) - (a.download_count || 0) || a.id - b.id;
    });
  }

  let totalMissingTexts = 0;
  let totalMissingCovers = 0;
  let cooldownSkippedTexts = 0;
  let cooldownSkippedCovers = 0;

  const uploadQueue = [];
  for (const book of orderedCandidates) {
    const idKey = String(book.id);
    const hasTextInR2 = existingBookIds.has(book.id);
    const hasCoverInR2 = existingCoverIds.has(book.id);
    const textCooldown = Boolean(!force && !recheckMissing && syncState?.missingTexts?.[idKey]);
    const coverCooldown = Boolean(!force && !recheckMissing && syncState?.missingCovers?.[idKey]);

    const rawNeedsText = syncBooks && (force || !hasTextInR2);
    const rawNeedsCover = syncCovers && (force || !hasCoverInR2);

    if (rawNeedsText && textCooldown) cooldownSkippedTexts++;
    if (rawNeedsCover && coverCooldown) cooldownSkippedCovers++;

    const needsText = rawNeedsText && !textCooldown;
    const needsCover = rawNeedsCover && !coverCooldown;

    if (rawNeedsText) totalMissingTexts++;
    if (rawNeedsCover) totalMissingCovers++;

    if (needsText || needsCover) {
      uploadQueue.push({
        id: book.id,
        title: book.title || `Gutenberg #${book.id}`,
        downloadCount: book.download_count || 0,
        needsText,
        needsCover,
      });
    }
  }

  const targetedQueue = limit ? uploadQueue.slice(0, limit) : uploadQueue;

  const copyrightedDeleteKeys = [];
  const withdrawnDeleteKeys = [];

  if (pruneWithdrawn) {
    const allR2Ids = new Set([...existingBookIds, ...existingCoverIds]);
    const canPruneWithdrawn =
      isFullCatalog && !options.ids && !limit && activeIds.size >= MIN_ACTIVE_CATALOG_FOR_PRUNE;

    for (const r2Id of allR2Ids) {
      if (copyrightedIds.has(r2Id)) {
        if (existingBookIds.has(r2Id)) copyrightedDeleteKeys.push({ id: r2Id, key: `books/${r2Id}.txt.gz`, reason: 'copyrighted' });
        if (existingCoverIds.has(r2Id)) copyrightedDeleteKeys.push({ id: r2Id, key: `covers/${r2Id}.jpg`, reason: 'copyrighted' });
      } else if (canPruneWithdrawn && !activeIds.has(r2Id)) {
        if (existingBookIds.has(r2Id)) withdrawnDeleteKeys.push({ id: r2Id, key: `books/${r2Id}.txt.gz`, reason: 'withdrawn' });
        if (existingCoverIds.has(r2Id)) withdrawnDeleteKeys.push({ id: r2Id, key: `covers/${r2Id}.jpg`, reason: 'withdrawn' });
      }
    }
  }

  let pruneBreakerTriggered = false;
  let effectiveWithdrawnDeletes = withdrawnDeleteKeys;
  if (!forcePrune && withdrawnDeleteKeys.length > maxPrune) {
    pruneBreakerTriggered = true;
    effectiveWithdrawnDeletes = [];
  }

  const deleteTargets = [...copyrightedDeleteKeys, ...effectiveWithdrawnDeletes];

  return {
    eligibleBookCount: eligibleBooks.length,
    existingTextsCount: existingBookIds.size,
    existingCoversCount: existingCoverIds.size,
    totalMissingTexts,
    totalMissingCovers,
    cooldownSkippedTexts,
    cooldownSkippedCovers,
    skippedCopyrightIds,
    uploadQueue: targetedQueue,
    totalQueuedBeforeLimit: uploadQueue.length,
    copyrightedDeleteCount: copyrightedDeleteKeys.length,
    withdrawnCandidateCount: withdrawnDeleteKeys.length,
    pruneBreakerTriggered,
    deleteTargets,
  };
}

function buildGutenbergPathDir(bookId) {
  const str = String(bookId).trim();
  if (str.length <= 1) return `0/${str}`;
  return `${str.slice(0, -1).split('').join('/')}/${str}`;
}

function resolveTransferEngine(requestedSource = 'auto', platform = process.platform, spawnSyncFn = spawnSync) {
  if (requestedSource === 'https') return 'https';
  if (requestedSource === 'wsl-rsync') return 'wsl-rsync';

  const hasNativeRsync = (() => {
    try {
      const check = spawnSyncFn('rsync', ['--version'], {
        encoding: 'utf8',
        shell: false,
        stdio: 'ignore',
      });
      return check && check.status === 0;
    } catch {
      return false;
    }
  })();

  if (requestedSource === 'rsync') {
    if (hasNativeRsync) return 'rsync';
    if (platform === 'win32') return 'wsl-rsync';
    return 'rsync';
  }

  if (hasNativeRsync) return 'rsync';
  return 'https';
}

function runRsyncCommand({
  useWsl = false,
  manifestFile = 'manifest.txt',
  remoteSource = RSYNC_EPUB_SOURCE,
  cwd,
  spawnFn = spawn,
}) {
  return new Promise((resolve, reject) => {
    const rsyncArgs = [
      '-rltz',
      '--ignore-missing-args',
      '--contimeout=20',
      '--timeout=45',
      `--files-from=${manifestFile}`,
      remoteSource,
      '.',
    ];
    const cmd = useWsl ? 'wsl' : 'rsync';
    const args = useWsl ? ['rsync', ...rsyncArgs] : rsyncArgs;

    let stderr = '';
    const child = spawnFn(cmd, args, {
      cwd,
      shell: false,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        if (stderr.length < 4096) stderr += chunk.toString('utf8');
      });
    }
    child.on('error', reject);
    child.on('close', (code) => {
      if (RSYNC_PARTIAL_VANISHED_CODES.has(code)) {
        resolve({ exitCode: code, stderr });
      } else {
        reject(new Error(`${cmd} exited with code ${code}: ${stderr.trim() || 'transfer error'}`));
      }
    });
  });
}

async function fetchValidHttpAsset(urls, maxBytes, headers, fetchFn = globalThis.fetch) {
  let authoritativeNotFound = true;
  for (const candidateUrl of urls) {
    if (!isAllowedGutenbergAssetUrl(candidateUrl)) continue;
    let activeUrl = candidateUrl;
    for (let hop = 0; hop <= 3; hop++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), R2_DEFAULT_TIMEOUT_MS);
      try {
        const res = await fetchFn(activeUrl, {
          method: 'GET',
          headers,
          redirect: 'manual',
          signal: controller.signal,
        });
        if (res.status >= 300 && res.status < 400 && res.headers?.get?.('location')) {
          const nextUrl = new URL(res.headers.get('location'), activeUrl).toString();
          if (!isAllowedGutenbergAssetUrl(nextUrl)) {
            authoritativeNotFound = false;
            break;
          }
          activeUrl = nextUrl;
          continue;
        }
        if (res.status === 404 || res.status === 410) {
          break;
        }
        if (!res.ok) {
          authoritativeNotFound = false;
          break;
        }
        const contentType = res.headers?.get?.('content-type') || null;
        if (isHtmlPayload(contentType)) {
          authoritativeNotFound = false;
          break;
        }
        const buf = await readBoundedBuffer(res, maxBytes, controller);
        if (!buf) {
          authoritativeNotFound = false;
          break;
        }
        if (isHtmlPayload(null, buf.subarray(0, 512).toString('utf8'))) {
          authoritativeNotFound = false;
          break;
        }
        return { ok: true, buffer: buf, sourceUrl: activeUrl, authoritativeNotFound: false };
      } catch {
        authoritativeNotFound = false;
        break;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  return { ok: false, buffer: null, sourceUrl: null, authoritativeNotFound };
}

function buildHttpsTextUrls(bookId, mirrors = GUTENBERG_ASSET_MIRRORS) {
  const dir = buildGutenbergPathDir(bookId);
  const urls = [];
  for (const mirror of mirrors) {
    const base = String(mirror || '').replace(/\/+$/, '');
    urls.push(
      `${base}/cache/epub/${bookId}/pg${bookId}.txt`,
      `${base}/${dir}/${bookId}-0.txt`,
      `${base}/${dir}/${bookId}.txt`,
      `${base}/${dir}/${bookId}-8.txt`
    );
  }
  return urls;
}

function buildHttpsCoverUrls(bookId, mirrors = GUTENBERG_ASSET_MIRRORS) {
  return mirrors.map((mirror) => `${String(mirror || '').replace(/\/+$/, '')}/cache/epub/${bookId}/pg${bookId}.cover.medium.jpg`);
}

function escapeMarkdownCell(val) {
  return String(val === undefined || val === null ? '' : val)
    .replace(/[\\|]/g, '\\$&')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function formatR2CoverageBanner(plan, context = {}) {
  const textPct =
    plan.eligibleBookCount > 0
      ? ((plan.existingTextsCount / plan.eligibleBookCount) * 100).toFixed(1)
      : '0.0';
  const coverPct =
    plan.eligibleBookCount > 0
      ? ((plan.existingCoversCount / plan.eligibleBookCount) * 100).toFixed(1)
      : '0.0';
  const lines = [
    `📊 Cloudflare R2 Inventory Status (Pre-Batch${context.dryRun ? ' · DRY RUN' : ''}):`,
    `  • Active PD Books:     ${plan.eligibleBookCount.toLocaleString()} eligible (copyright = false)`,
    `  • Texts Cached (R2):   ${plan.existingTextsCount.toLocaleString()} / ${plan.eligibleBookCount.toLocaleString()} (${textPct}% · ${plan.totalMissingTexts.toLocaleString()} missing · ${plan.cooldownSkippedTexts.toLocaleString()} cooldown skip)`,
    `  • Covers Cached (R2):  ${plan.existingCoversCount.toLocaleString()} / ${plan.eligibleBookCount.toLocaleString()} (${coverPct}% · ${plan.totalMissingCovers.toLocaleString()} missing · ${plan.cooldownSkippedCovers.toLocaleString()} confirmed coverless)`,
    `  • Cleanup Candidates:  ${plan.copyrightedDeleteCount.toLocaleString()} copyrighted / ${plan.withdrawnCandidateCount.toLocaleString()} withdrawn${plan.pruneBreakerTriggered ? ' (breaker triggered)' : ''}`,
    `  • This Batch Queued:   ${plan.uploadQueue.length.toLocaleString()} volume(s) (engine: ${context.engine || 'auto'})`,
  ];
  return lines.join('\n');
}

function formatR2RunReport(summary, context = {}) {
  const fmtPct = (done, total) => (total > 0 ? `${Math.min(100, (done / total) * 100).toFixed(1)}%` : '0.0%');
  const textsAfter = summary.existingTextsBefore + summary.textsUploaded - summary.textsDeleted;
  const coversAfter = summary.existingCoversBefore + summary.coversUploaded - summary.coversDeleted;
  const textsRemaining = Math.max(
    0,
    summary.eligibleBookCount - textsAfter - summary.knownMissingTextsCount
  );
  const coversRemaining = Math.max(
    0,
    summary.eligibleBookCount - coversAfter - summary.knownMissingCoversCount
  );

  const lines = [
    '## ☁️ Cloudflare R2 Delta Asset Sync — Run Report',
    '',
  ];
  if (context.dryRun) {
    lines.push('_Dry run: no R2 uploads or deletions were performed._', '');
  }

  lines.push(
    '### Bucket Coverage',
    '',
    '| Asset Type | Eligible PD | Before | Uploaded (+) | Known Missing (TTL) | Pruned | Remaining | Coverage |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
    `| Books (\`.txt.gz\`) | ${summary.eligibleBookCount.toLocaleString()} | ${summary.existingTextsBefore.toLocaleString()} | +${summary.textsUploaded.toLocaleString()} | ${summary.knownMissingTextsCount.toLocaleString()} | ${summary.textsDeleted.toLocaleString()} | ${textsRemaining.toLocaleString()} | ${fmtPct(textsAfter + summary.knownMissingTextsCount, summary.eligibleBookCount)} |`,
    `| Covers (\`.jpg\`) | ${summary.eligibleBookCount.toLocaleString()} | ${summary.existingCoversBefore.toLocaleString()} | +${summary.coversUploaded.toLocaleString()} | ${summary.knownMissingCoversCount.toLocaleString()} | ${summary.coversDeleted.toLocaleString()} | ${coversRemaining.toLocaleString()} | ${fmtPct(coversAfter + summary.knownMissingCoversCount, summary.eligibleBookCount)} |`,
    '',
    '### Execution Telemetry',
    '',
    '| Metric | Value |',
    '| :--- | :--- |',
    `| Mode | \`${context.dryRun ? 'DRY-RUN' : 'LIVE'}\` |`,
    `| Transfer Engine | \`${summary.engine}\` |`,
    `| Catalog Source | \`${summary.catalogSource}\` |`,
    `| Copyrighted Skipped / Pruned | \`${summary.skippedCopyrightCount}\` skipped / \`${summary.deletedCopyrightedCount}\` object(s) deleted |`,
    `| Withdrawn Objects Pruned | \`${summary.deletedWithdrawnCount}\` deleted |`,
    `| Failed Asset Transfers | \`${summary.failedCount}\` |`,
    `| R2 S3 API Calls (` + '`List`/`Put`/`Del`/`State`' + `) | \`${summary.r2ApiCalls.toLocaleString()}\` |`,
    `| Duration | \`${summary.elapsedSeconds.toFixed(1)}s\`${summary.stoppedByTimeBudget ? ' *(time budget cutoff reached; state saved)*' : ''} |`,
    '',
    '### Changed Volumes',
    ''
  );

  const changed = Array.isArray(summary.changedBooks) ? summary.changedBooks : [];
  if (changed.length === 0) {
    lines.push('_No R2 assets changed during this run._', '');
  } else {
    const previewLimit =
      changed.length <= FULL_LEDGER_THRESHOLD ? changed.length : BULK_LEDGER_PREVIEW_ROWS;
    const displayed = changed.slice(0, previewLimit);
    lines.push(
      '| # | ID | Title | Downloads | Text (`.txt.gz`) | Cover (`.jpg`) | Notes |',
      '|---:|---:|---|---:|---|---|---|'
    );
    displayed.forEach((entry, idx) => {
      lines.push(
        `| ${idx + 1} | ${entry.id} | ${escapeMarkdownCell(entry.title)} | ${(entry.downloadCount || 0).toLocaleString()} | ${entry.textOutcome || '—'} | ${entry.coverOutcome || '—'} | ${escapeMarkdownCell(entry.note || '')} |`
      );
    });
    if (changed.length > displayed.length) {
      lines.push(
        '',
        `_Showing first ${displayed.length} of ${changed.length.toLocaleString()} changed volumes (` +
          `+${summary.textsUploaded.toLocaleString()} texts, +${summary.coversUploaded.toLocaleString()} covers, ` +
          `${summary.textsDeleted + summary.coversDeleted} deleted)._`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatR2ConsoleSummary(summary, context = {}) {
  return [
    `✔ Cloudflare R2 Delta Sync Complete${context.dryRun ? ' (DRY RUN)' : ''}!`,
    `  • Texts:    +${summary.textsUploaded.toLocaleString()} uploaded · ${summary.textsDeleted.toLocaleString()} deleted (${summary.knownMissingTextsCount.toLocaleString()} known missing TTL)`,
    `  • Covers:   +${summary.coversUploaded.toLocaleString()} uploaded · ${summary.coversDeleted.toLocaleString()} deleted (${summary.knownMissingCoversCount.toLocaleString()} confirmed coverless)`,
    `  • Errors:   ${summary.failedCount} failed · ${summary.r2ApiCalls.toLocaleString()} R2 ops · ${summary.elapsedSeconds.toFixed(1)}s`,
  ].join('\n');
}

function appendR2StepSummary(stepSummaryPath, reportMarkdown, fsImpl = fs) {
  if (!stepSummaryPath || !reportMarkdown) return false;
  fsImpl.appendFileSync(stepSummaryPath, `\n${reportMarkdown}\n`, 'utf8');
  return true;
}

async function runR2AssetSync(customOptions = {}, deps = {}) {
  const env = deps.env || loadEnv();
  const logger = deps.logger || console;
  const fsImpl = deps.fsImpl || fs;
  const fetchFn = deps.fetchFn || globalThis.fetch;
  const spawnFn = deps.spawnFn || spawn;
  const spawnSyncFn = deps.spawnSyncFn || spawnSync;
  const sleepFn = deps.sleepFn || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const rng = deps.rng || Math.random;
  const nowFn = deps.nowFn || Date.now;
  const startMs = nowFn();

  const options = { ...parseCliArgs([]), ...customOptions };
  const r2Config = deps.r2Config || getR2Config(env);

  if (!r2Config) {
    logger.log(
      'ℹ Cloudflare R2 credentials (R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) are not configured; skipping R2 asset sync cleanly.'
    );
    return {
      skippedUnconfigured: true,
      textsUploaded: 0,
      coversUploaded: 0,
      textsDeleted: 0,
      coversDeleted: 0,
      failedCount: 0,
      changedBooks: [],
    };
  }

  let catalogSource = 'none';
  let books = [];
  let isFullCatalog = false;

  if (options.cacheFile && fsImpl.existsSync(options.cacheFile)) {
    const snapBooks = readCatalogSnapshotFile(options.cacheFile, fsImpl, logger);
    if (snapBooks && snapBooks.length > 0) {
      books = snapBooks;
      catalogSource = options.cacheFile;
      isFullCatalog = snapBooks.length >= MIN_ACTIVE_CATALOG_FOR_PRUNE;
    }
  }

  if (books.length === 0) {
    const supabase =
      deps.supabase ||
      (env.NEXT_PUBLIC_SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
        ? createClient(
            env.NEXT_PUBLIC_SUPABASE_URL,
            env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            { auth: { persistSession: false, autoRefreshToken: false } }
          )
        : null);

    if (supabase) {
      books = await fetchCatalogFromSupabase(supabase, options);
      catalogSource = 'supabase';
      isFullCatalog = !options.ids && books.length >= MIN_ACTIVE_CATALOG_FOR_PRUNE;
    } else if (Array.isArray(options.ids) && options.ids.length > 0) {
      books = options.ids.map((id) => ({
        id,
        title: `Gutenberg #${id}`,
        copyright: false,
        media_type: 'Text',
        download_count: 0,
      }));
      catalogSource = 'cli-ids';
    } else {
      throw new Error(
        'Cannot resolve catalog list: provide --cache-file=gutenberg-catalog-cache.json.gz or configure NEXT_PUBLIC_SUPABASE_URL.'
      );
    }
  }

  const [booksInv, coversInv, syncState] = await Promise.all([
    listR2PrefixIds(r2Config, 'books/', /^books\/(\d+)\.txt\.gz$/, { fetchFn }),
    listR2PrefixIds(r2Config, 'covers/', /^covers\/(\d+)\.jpg$/, { fetchFn }),
    readR2SyncState(r2Config, { fetchFn, nowMs: startMs, recheckDays: options.recheckDays }),
  ]);

  let r2ApiCalls = booksInv.apiCalls + coversInv.apiCalls + syncState.apiCalls;
  const plan = buildR2DeltaPlan({
    books,
    existingBookIds: booksInv.ids,
    existingCoverIds: coversInv.ids,
    syncState,
    options,
    isFullCatalog,
  });

  const engine = deps.engine || resolveTransferEngine(options.source, process.platform, spawnSyncFn);
  logger.log(formatR2CoverageBanner(plan, { dryRun: options.dryRun, engine }));

  const summary = {
    skippedUnconfigured: false,
    eligibleBookCount: plan.eligibleBookCount,
    existingTextsBefore: plan.existingTextsCount,
    existingCoversBefore: plan.existingCoversCount,
    textsUploaded: 0,
    coversUploaded: 0,
    textsDeleted: 0,
    coversDeleted: 0,
    deletedCopyrightedCount: 0,
    deletedWithdrawnCount: 0,
    skippedCopyrightCount: plan.skippedCopyrightIds.length,
    knownMissingTextsCount: Object.keys(syncState.missingTexts).length,
    knownMissingCoversCount: Object.keys(syncState.missingCovers).length,
    failedCount: 0,
    r2ApiCalls,
    engine,
    catalogSource,
    stoppedByTimeBudget: false,
    elapsedSeconds: 0,
    changedBooks: [],
  };

  const bookMetaById = new Map(books.map((b) => [b.id, b]));
  const changedMap = new Map();
  const recordChanged = (book, updates) => {
    const meta = bookMetaById.get(book.id);
    const existing = changedMap.get(book.id) || {
      id: book.id,
      title: book.title || meta?.title || `Gutenberg #${book.id}`,
      downloadCount:
        typeof book.downloadCount === 'number'
          ? book.downloadCount
          : meta?.download_count || 0,
      textOutcome: '—',
      coverOutcome: '—',
      note: '',
    };
    if (updates.textOutcome) existing.textOutcome = updates.textOutcome;
    if (updates.coverOutcome) existing.coverOutcome = updates.coverOutcome;
    if (updates.note) {
      existing.note = existing.note ? `${existing.note}; ${updates.note}` : updates.note;
    }
    changedMap.set(book.id, existing);
  };

  const maxDurationMs = options.maxMinutes ? options.maxMinutes * 60_000 : null;
  const isOverBudget = () => Boolean(maxDurationMs && nowFn() - startMs >= maxDurationMs);

  // 1. Prune copyrighted & withdrawn R2 objects first (legal compliance & $0 DeleteObject)
  for (const target of plan.deleteTargets) {
    if (options.dryRun) {
      if (target.key.startsWith('books/')) summary.textsDeleted++;
      else summary.coversDeleted++;
      if (target.reason === 'copyrighted') summary.deletedCopyrightedCount++;
      else summary.deletedWithdrawnCount++;
      recordChanged(
        { id: target.id },
        target.key.startsWith('books/')
          ? { textOutcome: `would prune (${target.reason})` }
          : { coverOutcome: `would prune (${target.reason})` }
      );
      continue;
    }

    try {
      await deleteR2Object(r2Config, target.key, { fetchFn });
      summary.r2ApiCalls++;
      if (target.key.startsWith('books/')) summary.textsDeleted++;
      else summary.coversDeleted++;
      if (target.reason === 'copyrighted') summary.deletedCopyrightedCount++;
      else summary.deletedWithdrawnCount++;
      recordChanged(
        { id: target.id },
        target.key.startsWith('books/')
          ? { textOutcome: `🗑 pruned (${target.reason})` }
          : { coverOutcome: `🗑 pruned (${target.reason})` }
      );
    } catch (err) {
      summary.failedCount++;
      recordChanged(
        { id: target.id },
        { note: `delete error: ${err.message}` }
      );
    }
  }

  // 2. Upload missing / updated books & covers
  let stateDirty = syncState.dirty;
  const userAgent = buildDescriptiveUserAgent('Bookarium-R2-Sync', '1.0', env);

  if (plan.uploadQueue.length > 0 && !options.dryRun) {
    if (engine === 'rsync' || engine === 'wsl-rsync') {
      const useWsl = engine === 'wsl-rsync';
      const batchSize = deps.rsyncBatchSize || RSYNC_BATCH_SIZE;
      for (let i = 0; i < plan.uploadQueue.length; i += batchSize) {
        if (isOverBudget()) {
          summary.stoppedByTimeBudget = true;
          break;
        }
        const batch = plan.uploadQueue.slice(i, i + batchSize);
        const batchDir = fsImpl.mkdtempSync(path.join(os.tmpdir(), 'bookarium-r2-'));
        try {
          const epubManifestLines = [];
          for (const item of batch) {
            if (item.needsCover) epubManifestLines.push(`${item.id}/pg${item.id}.cover.medium.jpg`);
            if (item.needsText) epubManifestLines.push(`${item.id}/pg${item.id}.txt.utf8`, `${item.id}/pg${item.id}.txt`);
          }
          fsImpl.writeFileSync(path.join(batchDir, 'manifest.txt'), `${epubManifestLines.join('\n')}\n`, 'utf8');
          await runRsyncCommand({
            useWsl,
            manifestFile: 'manifest.txt',
            remoteSource: RSYNC_EPUB_SOURCE,
            cwd: batchDir,
            spawnFn,
          });

          const missingMainTexts = [];
          for (const item of batch) {
            if (item.needsCover) {
              const localCover = path.join(batchDir, String(item.id), `pg${item.id}.cover.medium.jpg`);
              if (fsImpl.existsSync(localCover)) {
                const rawCover = fsImpl.readFileSync(localCover);
                if (rawCover.byteLength > 0 && rawCover.byteLength <= MAX_R2_COVER_BYTES && !isHtmlPayload(null, rawCover.subarray(0, 256).toString('utf8'))) {
                  try {
                    await putR2Object(r2Config, `covers/${item.id}.jpg`, rawCover, 'image/jpeg', { fetchFn });
                    summary.r2ApiCalls++;
                    summary.coversUploaded++;
                    delete syncState.missingCovers[String(item.id)];
                    stateDirty = true;
                    recordChanged(item, { coverOutcome: '✅ uploaded' });
                  } catch (err) {
                    summary.failedCount++;
                    recordChanged(item, { coverOutcome: '❌ upload error', note: err.message });
                  }
                }
              } else {
                syncState.missingCovers[String(item.id)] = new Date(nowFn()).toISOString();
                stateDirty = true;
              }
            }

            if (item.needsText) {
              const utf8Txt = path.join(batchDir, String(item.id), `pg${item.id}.txt.utf8`);
              const plainTxt = path.join(batchDir, String(item.id), `pg${item.id}.txt`);
              const resolvedTxt = fsImpl.existsSync(utf8Txt) ? utf8Txt : fsImpl.existsSync(plainTxt) ? plainTxt : null;
              if (resolvedTxt) {
                const rawTxt = fsImpl.readFileSync(resolvedTxt);
                if (rawTxt.byteLength > 0 && rawTxt.byteLength <= MAX_R2_BOOK_BYTES && !isHtmlPayload(null, rawTxt.subarray(0, 512).toString('utf8'))) {
                  try {
                    const gzTxt = zlib.gzipSync(rawTxt, { level: 9 });
                    await putR2Object(r2Config, `books/${item.id}.txt.gz`, gzTxt, 'application/gzip', { fetchFn });
                    summary.r2ApiCalls++;
                    summary.textsUploaded++;
                    delete syncState.missingTexts[String(item.id)];
                    stateDirty = true;
                    recordChanged(item, { textOutcome: '✅ uploaded' });
                  } catch (err) {
                    summary.failedCount++;
                    recordChanged(item, { textOutcome: '❌ upload error', note: err.message });
                  }
                } else {
                  missingMainTexts.push(item);
                }
              } else {
                missingMainTexts.push(item);
              }
            }
          }

          if (missingMainTexts.length > 0 && !isOverBudget()) {
            const mainManifestLines = [];
            for (const item of missingMainTexts) {
              const dir = buildGutenbergPathDir(item.id);
              mainManifestLines.push(`${dir}/${item.id}-0.txt`, `${dir}/${item.id}.txt`, `${dir}/${item.id}-8.txt`);
            }
            fsImpl.writeFileSync(path.join(batchDir, 'manifest-main.txt'), `${mainManifestLines.join('\n')}\n`, 'utf8');
            await runRsyncCommand({
              useWsl,
              manifestFile: 'manifest-main.txt',
              remoteSource: RSYNC_MAIN_SOURCE,
              cwd: batchDir,
              spawnFn,
            });

            for (const item of missingMainTexts) {
              const dir = buildGutenbergPathDir(item.id);
              const candidatePaths = [
                path.join(batchDir, dir, `${item.id}-0.txt`),
                path.join(batchDir, dir, `${item.id}.txt`),
                path.join(batchDir, dir, `${item.id}-8.txt`),
              ];
              const foundPath = candidatePaths.find((p) => fsImpl.existsSync(p));
              if (foundPath) {
                const rawTxt = fsImpl.readFileSync(foundPath);
                if (rawTxt.byteLength > 0 && rawTxt.byteLength <= MAX_R2_BOOK_BYTES && !isHtmlPayload(null, rawTxt.subarray(0, 512).toString('utf8'))) {
                  try {
                    const gzTxt = zlib.gzipSync(rawTxt, { level: 9 });
                    await putR2Object(r2Config, `books/${item.id}.txt.gz`, gzTxt, 'application/gzip', { fetchFn });
                    summary.r2ApiCalls++;
                    summary.textsUploaded++;
                    delete syncState.missingTexts[String(item.id)];
                    stateDirty = true;
                    recordChanged(item, { textOutcome: '✅ uploaded' });
                  } catch (err) {
                    summary.failedCount++;
                    recordChanged(item, { textOutcome: '❌ upload error', note: err.message });
                  }
                }
              } else {
                syncState.missingTexts[String(item.id)] = new Date(nowFn()).toISOString();
                stateDirty = true;
              }
            }
          }

          const batchNum = Math.floor(i / batchSize) + 1;
          const totalBatches = Math.ceil(plan.uploadQueue.length / batchSize);
          logger.log(
            `  ↳ Batch ${batchNum}/${totalBatches}: +${summary.textsUploaded} texts, +${summary.coversUploaded} covers | ${((nowFn() - startMs) / 1000).toFixed(1)}s elapsed`
          );
        } finally {
          fsImpl.rmSync(batchDir, { recursive: true, force: true });
        }
      }
    } else {
      // HTTPS PGLAF-first mirror mode (e.g. local Windows dev runs without native rsync/WSL)
      for (let i = 0; i < plan.uploadQueue.length; i++) {
        if (isOverBudget()) {
          summary.stoppedByTimeBudget = true;
          break;
        }
        const item = plan.uploadQueue[i];
        const reqHeaders = { 'User-Agent': userAgent };

        if (item.needsText) {
          const textRes = await fetchValidHttpAsset(
            buildHttpsTextUrls(item.id, options.mirrors),
            MAX_R2_BOOK_BYTES,
            reqHeaders,
            fetchFn
          );
          if (textRes.ok) {
            try {
              const gzTxt = zlib.gzipSync(textRes.buffer, { level: 9 });
              await putR2Object(r2Config, `books/${item.id}.txt.gz`, gzTxt, 'application/gzip', { fetchFn });
              summary.r2ApiCalls++;
              summary.textsUploaded++;
              delete syncState.missingTexts[String(item.id)];
              stateDirty = true;
              recordChanged(item, { textOutcome: '✅ uploaded (https)' });
            } catch (err) {
              summary.failedCount++;
              recordChanged(item, { textOutcome: '❌ upload error', note: err.message });
            }
          } else if (textRes.authoritativeNotFound) {
            syncState.missingTexts[String(item.id)] = new Date(nowFn()).toISOString();
            stateDirty = true;
          } else {
            summary.failedCount++;
            recordChanged(item, { textOutcome: '❌ mirror error' });
          }
        }

        if (item.needsCover) {
          const coverRes = await fetchValidHttpAsset(
            buildHttpsCoverUrls(item.id, options.mirrors),
            MAX_R2_COVER_BYTES,
            reqHeaders,
            fetchFn
          );
          if (coverRes.ok) {
            try {
              await putR2Object(r2Config, `covers/${item.id}.jpg`, coverRes.buffer, 'image/jpeg', { fetchFn });
              summary.r2ApiCalls++;
              summary.coversUploaded++;
              delete syncState.missingCovers[String(item.id)];
              stateDirty = true;
              recordChanged(item, { coverOutcome: '✅ uploaded (https)' });
            } catch (err) {
              summary.failedCount++;
              recordChanged(item, { coverOutcome: '❌ upload error', note: err.message });
            }
          } else if (coverRes.authoritativeNotFound) {
            syncState.missingCovers[String(item.id)] = new Date(nowFn()).toISOString();
            stateDirty = true;
          } else {
            summary.failedCount++;
            recordChanged(item, { coverOutcome: '❌ mirror error' });
          }
        }

        if (i < plan.uploadQueue.length - 1 && options.delayMax > 0) {
          const delayMs = Math.round((options.delayMin + rng() * (options.delayMax - options.delayMin)) * 1000);
          if (delayMs > 0) await sleepFn(delayMs);
        }
      }
    }
  } else if (options.dryRun) {
    for (const item of plan.uploadQueue) {
      recordChanged(item, {
        textOutcome: item.needsText ? 'would upload' : 'cached',
        coverOutcome: item.needsCover ? 'would upload' : 'cached',
      });
    }
  }

  if (!options.dryRun && stateDirty) {
    await writeR2SyncState(r2Config, syncState, { fetchFn, nowMs: nowFn(), recheckDays: options.recheckDays });
    summary.r2ApiCalls++;
  }

  summary.knownMissingTextsCount = Object.keys(syncState.missingTexts).length;
  summary.knownMissingCoversCount = Object.keys(syncState.missingCovers).length;
  summary.changedBooks = Array.from(changedMap.values());
  summary.elapsedSeconds = Math.max(0, (nowFn() - startMs) / 1000);
  summary.report = formatR2RunReport(summary, { dryRun: options.dryRun });

  logger.log(formatR2ConsoleSummary(summary, { dryRun: options.dryRun }));
  appendR2StepSummary(deps.stepSummaryPath, summary.report, fsImpl);

  return summary;
}

/* v8 ignore start */
if (require.main === module) {
  let cliOptions;
  try {
    cliOptions = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`✖ Error: ${err.message}`);
    process.exit(1);
  }
  if (cliOptions.help) {
    console.log(`
Bookarium Cloudflare R2 Delta Asset Sync
========================================
Synchronizes public-domain book texts (.txt.gz) and covers (.jpg) into private Cloudflare R2.

Options:
  --dry-run             Inspect R2 inventory and delta plan without mutating R2
  --limit=N             Max missing books to upload in this run
  --ids=1342,84         Target specific Gutenberg IDs cleanly
  --cache-file=PATH     Read compressed catalog snapshot (gutenberg-catalog-cache.json.gz)
  --source=ENGINE       auto | rsync | wsl-rsync | https
  --mirror=NAME         pglaf | aleph | readingroo (HTTPS fallback)
  --delay-range=MIN-MAX Delay range in seconds for HTTPS mode (default: 8-16)
  --max-minutes=N       Stop cleanly between batches before reaching minute budget
  --books-only          Sync texts only (skip covers)
  --covers-only         Sync covers only (skip texts)
  --force               Overwrite existing R2 objects in targeted scope
  --recheck-missing     Bypass 90-day missing-asset cooldown cache
  --no-prune            Skip copyrighted/withdrawn R2 object deletion
  --force-prune         Override 500-object withdrawn prune breaker
  --help, -h            Show this help message
`);
    process.exit(0);
  }
  runR2AssetSync(cliOptions, { stepSummaryPath: process.env.GITHUB_STEP_SUMMARY })
    .then((res) => {
      process.exit(res.failedCount > 0 && res.textsUploaded === 0 && res.coversUploaded === 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error(`Fatal error in sync-r2-assets: ${err.message}`);
      process.exit(1);
    });
}
/* v8 ignore stop */

module.exports = {
  R2_DEFAULT_TIMEOUT_MS,
  MAX_R2_BOOK_BYTES,
  MAX_R2_COVER_BYTES,
  MAX_R2_STATE_BYTES,
  DEFAULT_MISSING_RECHECK_DAYS,
  RSYNC_BATCH_SIZE,
  DEFAULT_MAX_PRUNE_PER_RUN,
  MIN_ACTIVE_CATALOG_FOR_PRUNE,
  FULL_LEDGER_THRESHOLD,
  BULK_LEDGER_PREVIEW_ROWS,
  PRIORITY_HERO_BOOK_IDS,
  PRIORITY_HERO_BOOK_ID_SET,
  RSYNC_EPUB_SOURCE,
  RSYNC_MAIN_SOURCE,
  MIRROR_SHORTCUT_MAP,
  GUTENBERG_ASSET_MIRRORS,
  SYNC_STATE_OBJECT_KEY,
  resolveSiteOriginFallback,
  resolveRepositoryUrl,
  buildDescriptiveUserAgent,
  loadEnv,
  isHtmlPayload,
  isAllowedR2EndpointUrl,
  isAllowedGutenbergAssetUrl,
  getR2Config,
  isR2Configured,
  signR2Request,
  XML_ENTITY_MAP,
  unescapeXmlEntities,
  parseListObjectsV2Xml,
  listR2PrefixIds,
  fetchBookTextFromR2,
  putR2Object,
  deleteR2Object,
  pruneExpiredStateEntries,
  readR2SyncState,
  writeR2SyncState,
  parseDelayRange,
  parseCliArgs,
  readCatalogSnapshotFile,
  fetchCatalogFromSupabase,
  buildR2DeltaPlan,
  buildGutenbergPathDir,
  resolveTransferEngine,
  runRsyncCommand,
  fetchValidHttpAsset,
  buildHttpsTextUrls,
  buildHttpsCoverUrls,
  formatR2CoverageBanner,
  formatR2RunReport,
  formatR2ConsoleSummary,
  appendR2StepSummary,
  runR2AssetSync,
};
