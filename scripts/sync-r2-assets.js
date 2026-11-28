/**
 * @module scripts/sync-r2-assets
 * @scope Automated Cloudflare R2 delta synchronization and backfill engine managing `books/<id>.txt.gz`, `covers/<id>.jpg`, and missing-asset cooldown state `_meta/r2-sync-state.json.gz` via zero-dependency AWS Signature V4 S3 calls and targeted multi-host `rsync --files-from` (`aleph.gutenberg.org` <-> `rsync.ibiblio.org` + Windows `wsl-rsync`) with zero bulk HTTPS mirror scraping.
 * @invariant Unconditionally enforce `copyright !== true` (`Rule 2/4`) on all R2 uploads, enforce `MIN_ACTIVE_CATALOG_FOR_PRUNE` before pruning withdrawn IDs (bounded by `DEFAULT_MAX_PRUNE_PER_RUN` unless `--force-prune`), fail fast via `assertValidR2ConfigIfPresent` on partial or malformed `R2_*` configs while exiting `0` cleanly when all `R2_*` variables are unset, prevent transient `_meta/r2-sync-state.json.gz` read errors or `rsync` transport faults from wiping/poisoning 90-day missing cooldowns (union-merging remote state before writes and flushing state cleanly in `try ... finally` alongside mid-batch `isOverBudget` checks), rotate failing `rsync` batches across `RSYNC_HOSTS` (`aleph.gutenberg.org` <-> `rsync.ibiblio.org`) via `resolveRsyncHostOrder` (`--rsync-host=auto|aleph|ibiblio`), require native or WSL `rsync` cleanly inside `resolveTransferEngine` (zero HTTPS mirror scraping fallback), parallelize `putR2Object` writes via `DEFAULT_R2_PUT_CONCURRENCY` (`8`), emit conditional purge tags (`--purge-tags-file`) strictly for deleted or `--force`-overwritten assets, fail non-zero via `shouldFailR2SyncRun` on total or `>= 50%` infrastructure failures, decode `ListObjectsV2` XML entities in a single pass via `XML_ENTITY_MAP` (`CWE-116` safe), validate R2 endpoints strictly via `isAllowedR2EndpointUrl` with `redirect: 'manual'` and bounded payload limits (`MAX_R2_BOOK_BYTES`, `MAX_R2_COVER_BYTES`), and invoke `rsync`/`wsl` strictly with `{ shell: false }`.
 * @rationale Scanning private R2 prefixes with `ListObjectsV2` consumes ~157 Class A operations across ~78,000 books without requiring SQL indexes, sharing zero-dependency SigV4 transport helpers in `scripts/lib/r2-sigv4.js`, targeted `rsync --files-from` with automatic multi-host failover (`aleph.gutenberg.org` zero-lag primary to `rsync.ibiblio.org` mirror, or `--rsync-host=ibiblio` for bulk backfills) complies strictly with Project Gutenberg Robot Access & Mirroring policies without bulk HTTP requests, state read-fail guards + union merges prevent concurrent `catalog-sync`/`r2-sync` cooldown corruption, and prioritizing `PRIORITY_HERO_BOOK_IDS` followed by `download_count DESC` accelerates Quote Pool and classic asset readiness.
 * @adr ADR-083, ADR-085
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { spawn, spawnSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const {
  R2_DEFAULT_TIMEOUT_MS,
  MAX_R2_BOOK_BYTES,
  DEFAULT_R2_PUT_CONCURRENCY,
  XML_ENTITY_MAP,
  loadEnv,
  isHtmlPayload,
  isAllowedR2EndpointUrl,
  getR2Config,
  isR2Configured,
  assertValidR2ConfigIfPresent,
  sha256Hex,
  signR2Request,
  readBoundedBuffer,
  unescapeXmlEntities,
  parseListObjectsV2Xml,
  fetchR2WithTimeout,
  listR2PrefixIds,
  fetchBookTextFromR2,
  runWithConcurrency,
  escapeMarkdownCell,
} = require('./lib/r2-sigv4');
const {
  formatDuration,
  createCliProgressReporter,
} = require('./lib/cli-progress');

const MAX_R2_COVER_BYTES = 2 * 1024 * 1024;
const MAX_R2_STATE_BYTES = 8 * 1024 * 1024;
const DEFAULT_MISSING_RECHECK_DAYS = 90;
const RSYNC_BATCH_SIZE = 200;
const R2_MIN_ATTEMPTS_FOR_RATIO_FAIL = 5;
const R2_MAX_FAILURE_RATIO = 0.5;
const DEFAULT_MAX_PRUNE_PER_RUN = 500;
const MIN_ACTIVE_CATALOG_FOR_PRUNE = 50_000;
const FULL_LEDGER_THRESHOLD = 100;
const BULK_LEDGER_PREVIEW_ROWS = 50;
const RSYNC_PARTIAL_VANISHED_CODES = new Set([0, 23, 24]);

const RSYNC_HOSTS = Object.freeze({
  aleph: 'aleph.gutenberg.org',
  ibiblio: 'rsync.ibiblio.org',
});
const RSYNC_HOST_OPTIONS = new Set(['auto', 'aleph', 'ibiblio']);
const RSYNC_EPUB_SOURCE = `${RSYNC_HOSTS.aleph}::gutenberg-epub`;
const RSYNC_MAIN_SOURCE = `${RSYNC_HOSTS.aleph}::gutenberg`;
const RSYNC_IBIBLIO_EPUB_SOURCE = `${RSYNC_HOSTS.ibiblio}::gutenberg-epub`;
const RSYNC_IBIBLIO_MAIN_SOURCE = `${RSYNC_HOSTS.ibiblio}::gutenberg`;

function extractRsyncHost(remoteSource = '') {
  const str = String(remoteSource || '');
  const idx = str.indexOf('::');
  return idx > 0 ? str.slice(0, idx) : str || null;
}

function resolveRsyncHostOrder(rsyncHost = 'auto') {
  const normalized = String(rsyncHost || 'auto').trim().toLowerCase();
  if (!RSYNC_HOST_OPTIONS.has(normalized)) {
    throw new Error(`Unsupported --rsync-host "${rsyncHost}". Expected auto, aleph, or ibiblio.`);
  }
  if (normalized === 'ibiblio') {
    return [RSYNC_HOSTS.ibiblio, RSYNC_HOSTS.aleph];
  }
  return [RSYNC_HOSTS.aleph, RSYNC_HOSTS.ibiblio];
}

function buildRsyncSourcesForOrder(hostOrder, moduleName = 'gutenberg-epub') {
  const hosts = Array.isArray(hostOrder) && hostOrder.length > 0 ? hostOrder : resolveRsyncHostOrder('auto');
  return hosts.map((host) => `${host}::${moduleName}`);
}

function buildGutenbergPathDir(id) {
  const digits = String(id).trim();
  if (digits.length <= 1) return `0/${digits}`;
  return `${digits.slice(0, -1).split('').join('/')}/${digits}`;
}

/**
 * Canonical 27 Hero & Editorial Classic Book IDs (`FEATURED_HERO_BOOKS` in `src/config/featured-books.ts`).
 * Prioritized first ahead of `download_count DESC` so classics and Quote Pool volumes populate R2 first.
 */
const PRIORITY_HERO_BOOK_IDS = [
  1342, 84, 2701, 64317, 11, 174, 1661, 345, 98, 35, 2600, 135, 2554, 1260,
  768, 5200, 43, 1184, 1232, 132, 2680, 1727, 514, 2147, 164, 205, 76,
];
const PRIORITY_HERO_BOOK_ID_SET = new Set(PRIORITY_HERO_BOOK_IDS);

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
    readFailed: false,
    existedRemotely: false,
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
    if (response.status === 404) {
      return empty;
    }
    if (!response.ok) {
      return { ...empty, readFailed: true };
    }
    const gzBuf = await readBoundedBuffer(response, MAX_R2_STATE_BYTES, controller);
    if (!gzBuf) {
      return { ...empty, readFailed: true };
    }
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
      readFailed: false,
      existedRemotely: true,
    };
  } catch {
    return { ...empty, readFailed: true };
  }
}

function mergeMissingTimestampMaps(baseEntries = {}, incomingEntries = {}, clearedSet = new Set()) {
  const merged = {};
  const addEntry = (idKey, iso) => {
    if (!/^\d{1,8}$/.test(idKey)) return;
    if (clearedSet && clearedSet.has(idKey)) return;
    const incomingTs = Date.parse(iso);
    if (!Number.isFinite(incomingTs)) return;
    const existingTs = merged[idKey] ? Date.parse(merged[idKey]) : -Infinity;
    if (incomingTs > existingTs) {
      merged[idKey] = iso;
    }
  };

  for (const [idKey, iso] of Object.entries(baseEntries || {})) {
    addEntry(idKey, iso);
  }
  for (const [idKey, iso] of Object.entries(incomingEntries || {})) {
    addEntry(idKey, iso);
  }
  return merged;
}

function mergeR2SyncStates(localState, remoteState, clearedKeys = {}, options = {}) {
  const nowMs = typeof options.nowMs === 'number' ? options.nowMs : Date.now();
  const recheckDays = options.recheckDays || DEFAULT_MISSING_RECHECK_DAYS;
  const clearedCovers = clearedKeys?.covers instanceof Set ? clearedKeys.covers : new Set();
  const clearedTexts = clearedKeys?.texts instanceof Set ? clearedKeys.texts : new Set();

  const coversClean = pruneExpiredStateEntries(
    mergeMissingTimestampMaps(remoteState?.missingCovers, localState?.missingCovers, clearedCovers),
    nowMs,
    recheckDays
  ).entries;
  const textsClean = pruneExpiredStateEntries(
    mergeMissingTimestampMaps(remoteState?.missingTexts, localState?.missingTexts, clearedTexts),
    nowMs,
    recheckDays
  ).entries;

  return {
    missingCovers: coversClean,
    missingTexts: textsClean,
  };
}

async function writeR2SyncState(config, state, options = {}) {
  if (state?.readFailed && !options.forceStateOverwrite) {
    return {
      bytes: 0,
      coverlessCount: Object.keys(state.missingCovers || {}).length,
      skippedReadFailed: true,
      extraApiCalls: 0,
    };
  }

  const nowMs = typeof options.nowMs === 'number' ? options.nowMs : Date.now();
  const recheckDays = options.recheckDays || DEFAULT_MISSING_RECHECK_DAYS;
  let mergedCovers = state?.missingCovers || {};
  let mergedTexts = state?.missingTexts || {};
  let extraApiCalls = 0;

  if (options.mergeRemote !== false && config && state?.existedRemotely) {
    const latestRemote = await readR2SyncState(config, {
      fetchFn: options.fetchFn,
      nowMs,
      recheckDays,
    });
    extraApiCalls += latestRemote.apiCalls || 0;
    if (!latestRemote.readFailed) {
      const merged = mergeR2SyncStates(state, latestRemote, options.clearedKeys, {
        nowMs,
        recheckDays,
      });
      mergedCovers = merged.missingCovers;
      mergedTexts = merged.missingTexts;
    }
  }

  const coversClean = pruneExpiredStateEntries(mergedCovers, nowMs, recheckDays).entries;
  const textsClean = pruneExpiredStateEntries(mergedTexts, nowMs, recheckDays).entries;
  const payload = JSON.stringify({
    version: 1,
    updatedAt: new Date(nowMs).toISOString(),
    missingCovers: coversClean,
    missingTexts: textsClean,
  });
  const gzBuf = zlib.gzipSync(Buffer.from(payload, 'utf8'), { level: 9 });
  await putR2Object(config, SYNC_STATE_OBJECT_KEY, gzBuf, 'application/gzip', options);
  return {
    bytes: gzBuf.byteLength,
    coverlessCount: Object.keys(coversClean).length,
    skippedReadFailed: false,
    extraApiCalls,
  };
}

function parseCliArgs(argv = []) {
  const options = {
    help: false,
    dryRun: false,
    limit: null,
    ids: null,
    cacheFile: null,
    catalogSource: 'auto',
    purgeTagsFile: null,
    concurrency: DEFAULT_R2_PUT_CONCURRENCY,
    source: 'auto',
    rsyncHost: 'auto',
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
    } else if (arg.startsWith('--concurrency=')) {
      const c = parseInt(arg.slice('--concurrency='.length), 10);
      if (!Number.isInteger(c) || c < 1 || c > 16) {
        throw new Error(`Invalid --concurrency value "${arg}". Expected integer between 1 and 16.`);
      }
      options.concurrency = c;
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
    } else if (arg.startsWith('--purge-tags-file=')) {
      const p = arg.slice('--purge-tags-file='.length).trim();
      if (!p) throw new Error('Invalid empty --purge-tags-file value.');
      options.purgeTagsFile = p;
    } else if (arg.startsWith('--catalog-source=')) {
      const cs = arg.slice('--catalog-source='.length).trim().toLowerCase();
      if (!['auto', 'snapshot', 'supabase'].includes(cs)) {
        throw new Error(`Unsupported --catalog-source "${cs}". Expected auto, snapshot, or supabase.`);
      }
      options.catalogSource = cs;
    } else if (arg.startsWith('--source=')) {
      const src = arg.slice('--source='.length).trim().toLowerCase();
      if (!['auto', 'rsync', 'wsl-rsync'].includes(src)) {
        throw new Error(
          `Unsupported --source "${src}". Expected auto, rsync, or wsl-rsync (bulk HTTPS mirror scraping is disabled per Project Gutenberg Robot Access Policy).`
        );
      }
      options.source = src;
    } else if (arg.startsWith('--rsync-host=')) {
      const hostChoice = arg.slice('--rsync-host='.length).trim().toLowerCase();
      if (!RSYNC_HOST_OPTIONS.has(hostChoice)) {
        throw new Error(`Unsupported --rsync-host "${hostChoice}". Expected auto, aleph, or ibiblio.`);
      }
      options.rsyncHost = hostChoice;
    } else if (arg.startsWith('--mirror=') || arg.startsWith('--delay-range=')) {
      throw new Error(
        `Unsupported flag "${arg}". Bulk HTTPS mirror transfers are retired; use --source=rsync or --source=wsl-rsync with --rsync-host=auto|aleph|ibiblio.`
      );
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
      .select('id, title, copyright, download_count')
      .in('id', options.ids);
    if (error) throw new Error(`Supabase catalog lookup failed: ${error.message}`);
    return (data || []).map((r) => ({
      id: r.id,
      title: r.title || `Gutenberg #${r.id}`,
      copyright: Boolean(r.copyright),
      media_type: 'Text',
      download_count: typeof r.download_count === 'number' ? r.download_count : 0,
    }));
  }

  let cursorId = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('books')
      .select('id, title, copyright, download_count')
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
          media_type: 'Text',
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

function resolveTransferEngine(requestedSource = 'auto', platform = process.platform, spawnSyncFn = spawnSync) {
  if (requestedSource === 'https') {
    throw new Error(
      'Bulk HTTPS asset sync has been retired per Project Gutenberg Robot Access Policy. Use native rsync or Windows WSL rsync (--source=auto|rsync|wsl-rsync).'
    );
  }
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
    throw new Error(
      'Native rsync binary not found on PATH. Install rsync before running r2:sync (bulk HTTPS mirror scraping is retired).'
    );
  }

  if (hasNativeRsync) return 'rsync';
  if (platform === 'win32') {
    const hasWslRsync = (() => {
      try {
        const check = spawnSyncFn('wsl', ['rsync', '--version'], {
          encoding: 'utf8',
          shell: false,
          stdio: 'ignore',
        });
        return check && check.status === 0;
      } catch {
        return false;
      }
    })();
    if (hasWslRsync) return 'wsl-rsync';
  }
  throw new Error(
    'rsync (or Windows WSL rsync) is required for Bookarium R2 asset sync; bulk HTTPS mirror scraping is disabled per Project Gutenberg Robot Access Policy.'
  );
}

function isRsyncTransportError(stderr = '') {
  return /(?:timed out|connection refused|connection reset|connection unexpectedly closed|broken pipe|max connections|error in rsync protocol data stream|unexpected end of file|socket error|io timeout|name or service not known)/i.test(
    String(stderr || '')
  );
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
      if (RSYNC_PARTIAL_VANISHED_CODES.has(code) && !isRsyncTransportError(stderr)) {
        resolve({ exitCode: code, stderr, remoteSource, host: extractRsyncHost(remoteSource) });
      } else {
        reject(new Error(`${cmd} exited with code ${code}: ${stderr.trim() || 'transfer error'}`));
      }
    });
  });
}

async function runRsyncCommandWithRetry(params, retryOptions = {}) {
  const maxRetries =
    Number.isInteger(retryOptions.maxRetries) && retryOptions.maxRetries >= 0
      ? retryOptions.maxRetries
      : 2;
  const baseDelayMs =
    typeof retryOptions.baseDelayMs === 'number' && retryOptions.baseDelayMs >= 0
      ? retryOptions.baseDelayMs
      : 1500;
  const sleepFn = retryOptions.sleepFn || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const candidateSources =
    Array.isArray(params?.remoteSources) && params.remoteSources.length > 0
      ? params.remoteSources.filter(Boolean)
      : [params?.remoteSource || RSYNC_EPUB_SOURCE];

  let lastErr = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const activeSource = candidateSources[attempt % candidateSources.length];
    try {
      return await runRsyncCommand({
        ...params,
        remoteSource: activeSource,
      });
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        const nextSource = candidateSources[(attempt + 1) % candidateSources.length];
        if (typeof retryOptions.onRetry === 'function') {
          retryOptions.onRetry({
            attempt: attempt + 1,
            maxRetries,
            prevSource: activeSource,
            nextSource,
            error: err,
          });
        }
        if (baseDelayMs > 0) {
          await sleepFn(baseDelayMs * (attempt + 1));
        }
      }
    }
  }
  throw lastErr;
}

function shouldFailR2SyncRun(summary = {}) {
  if (!summary || summary.skippedUnconfigured) return false;
  const failed = typeof summary.failedCount === 'number' ? summary.failedCount : 0;
  if (failed <= 0) return false;
  const succeeded =
    (summary.textsUploaded || 0) +
    (summary.coversUploaded || 0) +
    (summary.textsDeleted || 0) +
    (summary.coversDeleted || 0);
  if (succeeded === 0) return true;
  const attempted = succeeded + failed;
  return (
    attempted >= R2_MIN_ATTEMPTS_FOR_RATIO_FAIL && failed / attempted >= R2_MAX_FAILURE_RATIO
  );
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
  const hostSuffix =
    (context.engine === 'rsync' || context.engine === 'wsl-rsync') &&
    Array.isArray(context.rsyncHostOrder) &&
    context.rsyncHostOrder.length > 0
      ? ` · hosts: ${context.rsyncHostOrder.join(' -> ')}`
      : '';
  const lines = [
    `📊 Cloudflare R2 Inventory Status (Pre-Batch${context.dryRun ? ' · DRY RUN' : ''}):`,
    `  • Active PD Books:     ${plan.eligibleBookCount.toLocaleString()} eligible (copyright = false)`,
    `  • Texts Cached (R2):   ${plan.existingTextsCount.toLocaleString()} / ${plan.eligibleBookCount.toLocaleString()} (${textPct}% · ${plan.totalMissingTexts.toLocaleString()} missing · ${plan.cooldownSkippedTexts.toLocaleString()} cooldown skip)`,
    `  • Covers Cached (R2):  ${plan.existingCoversCount.toLocaleString()} / ${plan.eligibleBookCount.toLocaleString()} (${coverPct}% · ${plan.totalMissingCovers.toLocaleString()} missing · ${plan.cooldownSkippedCovers.toLocaleString()} confirmed coverless)`,
    `  • Cleanup Candidates:  ${plan.copyrightedDeleteCount.toLocaleString()} copyrighted / ${plan.withdrawnCandidateCount.toLocaleString()} withdrawn${plan.pruneBreakerTriggered ? ' (breaker triggered)' : ''}`,
    `  • This Batch Queued:   ${plan.uploadQueue.length.toLocaleString()} volume(s) (engine: ${context.engine || 'auto'}${hostSuffix})`,
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

  const showRsyncHostRow =
    summary.engine === 'rsync' ||
    summary.engine === 'wsl-rsync' ||
    (Array.isArray(summary.rsyncHostsUsed) && summary.rsyncHostsUsed.length > 0);
  const rsyncHostOrderLabel =
    Array.isArray(summary.rsyncHostOrder) && summary.rsyncHostOrder.length > 0
      ? summary.rsyncHostOrder.join(' -> ')
      : summary.rsyncHost || 'auto';
  const rsyncHostsUsedLabel =
    Array.isArray(summary.rsyncHostsUsed) && summary.rsyncHostsUsed.length > 0
      ? summary.rsyncHostsUsed.join(', ')
      : 'none';

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
    ...(showRsyncHostRow
      ? [`| rsync Host Order / Used | \`${rsyncHostOrderLabel}\` / \`${rsyncHostsUsedLabel}\` |`]
      : []),
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
  const nowFn = deps.nowFn || Date.now;
  const startMs = nowFn();

  const options = { ...parseCliArgs([]), ...customOptions };
  const r2Config =
    deps.r2Config !== undefined ? deps.r2Config : assertValidR2ConfigIfPresent(env);

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
      purgeTags: [],
      changedBooks: [],
    };
  }

  let catalogSource = 'none';
  let books = [];
  let isFullCatalog = false;

  if (options.catalogSource === 'snapshot') {
    if (!options.cacheFile || !fsImpl.existsSync(options.cacheFile)) {
      throw new Error(
        `Catalog source set to "snapshot", but cache file "${options.cacheFile || ''}" was not found.`
      );
    }
    const snapBooks = readCatalogSnapshotFile(options.cacheFile, fsImpl, logger);
    if (!snapBooks || snapBooks.length === 0) {
      throw new Error(
        `Catalog snapshot "${options.cacheFile}" is missing, corrupt, or empty.`
      );
    }
    books = snapBooks;
    catalogSource = options.cacheFile;
    isFullCatalog = snapBooks.length >= MIN_ACTIVE_CATALOG_FOR_PRUNE;
  } else if (options.catalogSource !== 'supabase' && options.cacheFile && fsImpl.existsSync(options.cacheFile)) {
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

    if (options.catalogSource === 'supabase') {
      if (!supabase) {
        throw new Error(
          'Catalog source set to "supabase", but NEXT_PUBLIC_SUPABASE_URL / Supabase credentials are not configured.'
        );
      }
      books = await fetchCatalogFromSupabase(supabase, options);
      catalogSource = 'supabase';
      isFullCatalog = !options.ids && books.length >= MIN_ACTIVE_CATALOG_FOR_PRUNE;
    } else if (supabase) {
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

  const invProgress = createCliProgressReporter({
    enabled: true,
    env,
    logger,
    nowFn,
    ...(deps.progressOptions || {}),
  });
  let invBooksCount = 0;
  let invCoversCount = 0;
  let invPages = 0;
  const emitInventoryProgress = () => {
    invPages++;
    const elapsedSec = (nowFn() - startMs) / 1000;
    invProgress.update(
      invBooksCount + invCoversCount,
      `R2 inventory scan: ${invBooksCount.toLocaleString()} texts, ${invCoversCount.toLocaleString()} covers (${invPages} page${invPages === 1 ? '' : 's'}) · ${formatDuration(elapsedSec)}`
    );
  };

  const [booksInv, coversInv, syncState] = await Promise.all([
    listR2PrefixIds(r2Config, 'books/', /^books\/(\d+)\.txt\.gz$/, {
      fetchFn,
      onPage: ({ matchedCount }) => {
        invBooksCount = matchedCount;
        emitInventoryProgress();
      },
    }),
    listR2PrefixIds(r2Config, 'covers/', /^covers\/(\d+)\.jpg$/, {
      fetchFn,
      onPage: ({ matchedCount }) => {
        invCoversCount = matchedCount;
        emitInventoryProgress();
      },
    }),
    readR2SyncState(r2Config, { fetchFn, nowMs: startMs, recheckDays: options.recheckDays }),
  ]);
  invProgress.finish();

  if (syncState.readFailed) {
    const warnFn = typeof logger?.warn === 'function' ? logger.warn.bind(logger) : logger.log.bind(logger);
    warnFn(
      `::warning::Failed to read existing ${SYNC_STATE_OBJECT_KEY}; preserving remote cooldown state without overwriting.`
    );
  }

  let r2ApiCalls = booksInv.apiCalls + coversInv.apiCalls + syncState.apiCalls;
  const plan = buildR2DeltaPlan({
    books,
    existingBookIds: booksInv.ids,
    existingCoverIds: coversInv.ids,
    syncState,
    options,
    isFullCatalog,
  });

  const rsyncHostOrder = resolveRsyncHostOrder(options.rsyncHost);
  const engine = deps.engine || resolveTransferEngine(options.source, process.platform, spawnSyncFn);
  logger.log(
    formatR2CoverageBanner(plan, {
      dryRun: options.dryRun,
      engine,
      rsyncHost: options.rsyncHost,
      rsyncHostOrder,
    })
  );

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
    rsyncHost: options.rsyncHost || 'auto',
    rsyncHostOrder,
    rsyncHostsUsed: [],
    catalogSource,
    stoppedByTimeBudget: false,
    elapsedSeconds: 0,
    purgeTags: [],
    changedBooks: [],
  };
  const rsyncHostsUsedSet = new Set();

  const bookMetaById = new Map(books.map((b) => [b.id, b]));
  const changedMap = new Map();
  const purgedTagsSet = new Set();
  const clearedKeys = { covers: new Set(), texts: new Set() };
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
  let stateDirty = syncState.dirty;

  try {
    for (const target of plan.deleteTargets) {
      if (!options.dryRun && isOverBudget()) {
        summary.stoppedByTimeBudget = true;
        break;
      }
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
        if (target.key.startsWith('books/')) {
          summary.textsDeleted++;
          purgedTagsSet.add('book-content');
        } else {
          summary.coversDeleted++;
          purgedTagsSet.add('covers');
        }
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
    if (plan.uploadQueue.length > 0 && !options.dryRun && !summary.stoppedByTimeBudget) {
      if (engine === 'rsync' || engine === 'wsl-rsync') {
        const useWsl = engine === 'wsl-rsync';
        const batchSize = deps.rsyncBatchSize || RSYNC_BATCH_SIZE;
        const epubRemoteSources = buildRsyncSourcesForOrder(rsyncHostOrder, 'gutenberg-epub');
        const mainRemoteSources = buildRsyncSourcesForOrder(rsyncHostOrder, 'gutenberg');
        for (let i = 0; i < plan.uploadQueue.length; i += batchSize) {
          if (isOverBudget()) {
            summary.stoppedByTimeBudget = true;
            break;
          }
          const batchNum = Math.floor(i / batchSize) + 1;
          const totalBatches = Math.ceil(plan.uploadQueue.length / batchSize);
          const batch = plan.uploadQueue.slice(i, i + batchSize);
          const batchDir = fsImpl.mkdtempSync(path.join(os.tmpdir(), 'bookarium-r2-'));
          try {
            const epubManifestLines = [];
            for (const item of batch) {
              if (item.needsCover) epubManifestLines.push(`${item.id}/pg${item.id}.cover.medium.jpg`);
              if (item.needsText) epubManifestLines.push(`${item.id}/pg${item.id}.txt.utf8`, `${item.id}/pg${item.id}.txt`);
            }
            fsImpl.writeFileSync(path.join(batchDir, 'manifest.txt'), `${epubManifestLines.join('\n')}\n`, 'utf8');
            const epubRes = await runRsyncCommandWithRetry(
              {
                useWsl,
                manifestFile: 'manifest.txt',
                remoteSources: epubRemoteSources,
                cwd: batchDir,
                spawnFn,
              },
              {
                maxRetries: deps.rsyncRetries,
                baseDelayMs: deps.rsyncRetryDelayMs,
                sleepFn,
                onRetry: ({ attempt, maxRetries, prevSource, nextSource, error }) => {
                  logger.log(
                    `  ⚠ rsync failover (Batch ${batchNum}/${totalBatches} · epub): ${extractRsyncHost(prevSource) || prevSource} failed (${error.message}); switching to ${extractRsyncHost(nextSource) || nextSource} (retry ${attempt}/${maxRetries})`
                  );
                },
              }
            );
            if (epubRes?.host) rsyncHostsUsedSet.add(epubRes.host);

            const missingMainTexts = [];
            const missingCoverIdxs = new Set();
            const coverResults = new Array(batch.length).fill(null);
            const textResults = new Array(batch.length).fill(null);
            const epubUploadTasks = [];
            let anyEpubFileFound = false;

            for (let idx = 0; idx < batch.length; idx++) {
              const item = batch[idx];
              const idKey = String(item.id);
              if (item.needsCover) {
                const localCover = path.join(batchDir, idKey, `pg${item.id}.cover.medium.jpg`);
                if (fsImpl.existsSync(localCover)) {
                  anyEpubFileFound = true;
                  const rawCover = fsImpl.readFileSync(localCover);
                  if (
                    rawCover.byteLength > 0 &&
                    rawCover.byteLength <= MAX_R2_COVER_BYTES &&
                    !isHtmlPayload(null, rawCover.subarray(0, 256).toString('utf8'))
                  ) {
                    epubUploadTasks.push(async () => {
                      if (isOverBudget()) {
                        summary.stoppedByTimeBudget = true;
                        return;
                      }
                      try {
                        await putR2Object(r2Config, `covers/${item.id}.jpg`, rawCover, 'image/jpeg', { fetchFn });
                        coverResults[idx] = { ok: true, idKey };
                      } catch (err) {
                        coverResults[idx] = { ok: false, error: err.message };
                      }
                    });
                  } else if (rawCover.byteLength === 0 || rawCover.byteLength > MAX_R2_COVER_BYTES) {
                    missingCoverIdxs.add(idx);
                  }
                } else {
                  missingCoverIdxs.add(idx);
                }
              }

              if (item.needsText) {
                const utf8Txt = path.join(batchDir, idKey, `pg${item.id}.txt.utf8`);
                const plainTxt = path.join(batchDir, idKey, `pg${item.id}.txt`);
                const resolvedTxt = fsImpl.existsSync(utf8Txt) ? utf8Txt : fsImpl.existsSync(plainTxt) ? plainTxt : null;
                if (resolvedTxt) {
                  anyEpubFileFound = true;
                  const rawTxt = fsImpl.readFileSync(resolvedTxt);
                  if (
                    rawTxt.byteLength > 0 &&
                    rawTxt.byteLength <= MAX_R2_BOOK_BYTES &&
                    !isHtmlPayload(null, rawTxt.subarray(0, 512).toString('utf8'))
                  ) {
                    epubUploadTasks.push(async () => {
                      if (isOverBudget()) {
                        summary.stoppedByTimeBudget = true;
                        return;
                      }
                      try {
                        const gzTxt = zlib.gzipSync(rawTxt, { level: 9 });
                        await putR2Object(r2Config, `books/${item.id}.txt.gz`, gzTxt, 'application/gzip', { fetchFn });
                        textResults[idx] = { ok: true, idKey };
                      } catch (err) {
                        textResults[idx] = { ok: false, error: err.message };
                      }
                    });
                  } else {
                    missingMainTexts.push(item);
                  }
                } else {
                  missingMainTexts.push(item);
                }
              }
            }

            await runWithConcurrency(epubUploadTasks, options.concurrency);

            const epubSuspiciousZeroTransfer =
              (epubRes?.exitCode === 23 || epubRes?.exitCode === 24) &&
              batch.length >= 10 &&
              !anyEpubFileFound;

            for (let idx = 0; idx < batch.length; idx++) {
              const item = batch[idx];
              const idKey = String(item.id);
              const coverOutcome = coverResults[idx];
              if (coverOutcome) {
                if (coverOutcome.ok) {
                  summary.r2ApiCalls++;
                  summary.coversUploaded++;
                  if (Object.prototype.hasOwnProperty.call(syncState.missingCovers, idKey)) {
                    delete syncState.missingCovers[idKey];
                    stateDirty = true;
                  }
                  clearedKeys.covers.add(idKey);
                  if (options.force && coversInv.ids.has(item.id)) {
                    purgedTagsSet.add('covers');
                  }
                  recordChanged(item, { coverOutcome: '✅ uploaded' });
                } else {
                  summary.failedCount++;
                  recordChanged(item, { coverOutcome: '❌ upload error', note: coverOutcome.error });
                }
              } else if (missingCoverIdxs.has(idx)) {
                if (epubSuspiciousZeroTransfer) {
                  summary.failedCount++;
                  recordChanged(item, { coverOutcome: '❌ rsync error', note: 'zero-transfer exit 23' });
                } else {
                  syncState.missingCovers[idKey] = new Date(nowFn()).toISOString();
                  stateDirty = true;
                }
              }

              const textOutcome = textResults[idx];
              if (textOutcome) {
                if (textOutcome.ok) {
                  summary.r2ApiCalls++;
                  summary.textsUploaded++;
                  if (Object.prototype.hasOwnProperty.call(syncState.missingTexts, idKey)) {
                    delete syncState.missingTexts[idKey];
                    stateDirty = true;
                  }
                  clearedKeys.texts.add(idKey);
                  if (options.force && booksInv.ids.has(item.id)) {
                    purgedTagsSet.add('book-content');
                  }
                  recordChanged(item, { textOutcome: '✅ uploaded' });
                } else {
                  summary.failedCount++;
                  recordChanged(item, { textOutcome: '❌ upload error', note: textOutcome.error });
                }
              }
            }

            let mainRes = null;
            if (missingMainTexts.length > 0 && !isOverBudget() && !summary.stoppedByTimeBudget) {
              const mainManifestLines = [];
              for (const item of missingMainTexts) {
                const dir = buildGutenbergPathDir(item.id);
                mainManifestLines.push(`${dir}/${item.id}-0.txt`, `${dir}/${item.id}.txt`, `${dir}/${item.id}-8.txt`);
              }
              fsImpl.writeFileSync(path.join(batchDir, 'manifest-main.txt'), `${mainManifestLines.join('\n')}\n`, 'utf8');
              mainRes = await runRsyncCommandWithRetry(
                {
                  useWsl,
                  manifestFile: 'manifest-main.txt',
                  remoteSources: mainRemoteSources,
                  cwd: batchDir,
                  spawnFn,
                },
                {
                  maxRetries: deps.rsyncRetries,
                  baseDelayMs: deps.rsyncRetryDelayMs,
                  sleepFn,
                  onRetry: ({ attempt, maxRetries, prevSource, nextSource, error }) => {
                    logger.log(
                      `  ⚠ rsync failover (Batch ${batchNum}/${totalBatches} · main): ${extractRsyncHost(prevSource) || prevSource} failed (${error.message}); switching to ${extractRsyncHost(nextSource) || nextSource} (retry ${attempt}/${maxRetries})`
                    );
                  },
                }
              );
              if (mainRes?.host) rsyncHostsUsedSet.add(mainRes.host);

              const mainResults = new Array(missingMainTexts.length).fill(null);
              const missingMainIdxs = new Set();
              const oversizedMainIdxs = new Set();
              const mainUploadTasks = [];
              let anyMainFileFound = false;

              for (let j = 0; j < missingMainTexts.length; j++) {
                const item = missingMainTexts[j];
                const idKey = String(item.id);
                const dir = buildGutenbergPathDir(item.id);
                const candidatePaths = [
                  path.join(batchDir, dir, `${item.id}-0.txt`),
                  path.join(batchDir, dir, `${item.id}.txt`),
                  path.join(batchDir, dir, `${item.id}-8.txt`),
                ];
                const foundPath = candidatePaths.find((p) => fsImpl.existsSync(p));
                if (foundPath) {
                  anyMainFileFound = true;
                  const rawTxt = fsImpl.readFileSync(foundPath);
                  if (
                    rawTxt.byteLength > 0 &&
                    rawTxt.byteLength <= MAX_R2_BOOK_BYTES &&
                    !isHtmlPayload(null, rawTxt.subarray(0, 512).toString('utf8'))
                  ) {
                    mainUploadTasks.push(async () => {
                      if (isOverBudget()) {
                        summary.stoppedByTimeBudget = true;
                        return;
                      }
                      try {
                        const gzTxt = zlib.gzipSync(rawTxt, { level: 9 });
                        await putR2Object(r2Config, `books/${item.id}.txt.gz`, gzTxt, 'application/gzip', { fetchFn });
                        mainResults[j] = { ok: true, idKey };
                      } catch (err) {
                        mainResults[j] = { ok: false, error: err.message };
                      }
                    });
                  } else {
                    oversizedMainIdxs.add(j);
                  }
                } else {
                  missingMainIdxs.add(j);
                }
              }

              await runWithConcurrency(mainUploadTasks, options.concurrency);

              const mainSuspiciousZeroTransfer =
                (mainRes?.exitCode === 23 || mainRes?.exitCode === 24) &&
                missingMainTexts.length >= 10 &&
                !anyMainFileFound;

              for (let j = 0; j < missingMainTexts.length; j++) {
                const item = missingMainTexts[j];
                const idKey = String(item.id);
                const mainOutcome = mainResults[j];
                if (mainOutcome) {
                  if (mainOutcome.ok) {
                    summary.r2ApiCalls++;
                    summary.textsUploaded++;
                    if (Object.prototype.hasOwnProperty.call(syncState.missingTexts, idKey)) {
                      delete syncState.missingTexts[idKey];
                      stateDirty = true;
                    }
                    clearedKeys.texts.add(idKey);
                    if (options.force && booksInv.ids.has(item.id)) {
                      purgedTagsSet.add('book-content');
                    }
                    recordChanged(item, { textOutcome: '✅ uploaded' });
                  } else {
                    summary.failedCount++;
                    recordChanged(item, { textOutcome: '❌ upload error', note: mainOutcome.error });
                  }
                } else if (oversizedMainIdxs.has(j)) {
                  syncState.missingTexts[idKey] = new Date(nowFn()).toISOString();
                  stateDirty = true;
                  recordChanged(item, { textOutcome: '⏭ skipped (oversized/invalid)' });
                } else if (missingMainIdxs.has(j)) {
                  if (mainSuspiciousZeroTransfer) {
                    summary.failedCount++;
                    recordChanged(item, { textOutcome: '❌ rsync error', note: 'zero-transfer exit 23' });
                  } else {
                    syncState.missingTexts[idKey] = new Date(nowFn()).toISOString();
                    stateDirty = true;
                  }
                }
              }
            }

            const batchHosts = [epubRes?.host, mainRes?.host].filter(
              (host, idx, arr) => host && arr.indexOf(host) === idx
            );
            const hostTag = batchHosts.length > 0 ? ` [${batchHosts.join(', ')}]` : '';
            logger.log(
              `  ↳ Batch ${batchNum}/${totalBatches}${hostTag}: +${summary.textsUploaded} texts, +${summary.coversUploaded} covers | ${((nowFn() - startMs) / 1000).toFixed(1)}s elapsed`
            );
          } finally {
            fsImpl.rmSync(batchDir, { recursive: true, force: true });
          }
        }
      } else {
        throw new Error(
          `Unsupported transfer engine "${engine}". Only rsync and wsl-rsync are permitted for binary asset synchronization.`
        );
      }
    } else if (options.dryRun) {
      for (const item of plan.uploadQueue) {
        recordChanged(item, {
          textOutcome: item.needsText ? 'would upload' : 'cached',
          coverOutcome: item.needsCover ? 'would upload' : 'cached',
        });
      }
    }
  } finally {
    if (!options.dryRun && stateDirty && !syncState.readFailed) {
      try {
        const writeRes = await writeR2SyncState(r2Config, syncState, {
          fetchFn,
          nowMs: nowFn(),
          recheckDays: options.recheckDays,
          clearedKeys,
        });
        if (!writeRes?.skippedReadFailed) {
          summary.r2ApiCalls += 1 + (writeRes?.extraApiCalls || 0);
        }
      } catch (stateErr) {
        const warnFn =
          typeof logger?.warn === 'function' ? logger.warn.bind(logger) : logger.log.bind(logger);
        warnFn(`::warning::Failed to flush ${SYNC_STATE_OBJECT_KEY}: ${stateErr.message}`);
      }
    }
  }

  summary.knownMissingTextsCount = Object.keys(syncState.missingTexts).length;
  summary.knownMissingCoversCount = Object.keys(syncState.missingCovers).length;
  summary.rsyncHostsUsed = Array.from(rsyncHostsUsedSet);
  summary.purgeTags = Array.from(purgedTagsSet);
  summary.changedBooks = Array.from(changedMap.values());
  summary.elapsedSeconds = Math.max(0, (nowFn() - startMs) / 1000);
  summary.report = formatR2RunReport(summary, { dryRun: options.dryRun });

  if (options.purgeTagsFile && !options.dryRun) {
    fsImpl.writeFileSync(options.purgeTagsFile, summary.purgeTags.join(','), 'utf8');
  }

  if (summary.failedCount > 0 && !options.dryRun) {
    const warnFn =
      typeof logger?.warn === 'function' ? logger.warn.bind(logger) : logger.log.bind(logger);
    warnFn(`::warning::R2 delta asset sync completed with ${summary.failedCount} failed transfer(s).`);
  }

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
  --catalog-source=MODE auto | snapshot | supabase (default: auto)
  --source=ENGINE       auto | rsync | wsl-rsync (rsync-only; HTTPS bulk transfers retired)
  --rsync-host=HOST     auto | aleph | ibiblio (primary rsync host; auto fails over to ibiblio)
  --concurrency=N       Bounded parallel R2 PutObject workers (1-16, default: 8)
  --max-minutes=N       Stop cleanly between batches before reaching minute budget
  --purge-tags-file=P   Write comma-separated Edge Cache tags (covers,book-content) on prune/force
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
      process.exit(shouldFailR2SyncRun(res) ? 1 : 0);
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
  DEFAULT_R2_PUT_CONCURRENCY,
  R2_MIN_ATTEMPTS_FOR_RATIO_FAIL,
  R2_MAX_FAILURE_RATIO,
  DEFAULT_MAX_PRUNE_PER_RUN,
  MIN_ACTIVE_CATALOG_FOR_PRUNE,
  FULL_LEDGER_THRESHOLD,
  BULK_LEDGER_PREVIEW_ROWS,
  PRIORITY_HERO_BOOK_IDS,
  PRIORITY_HERO_BOOK_ID_SET,
  RSYNC_HOSTS,
  RSYNC_HOST_OPTIONS,
  RSYNC_EPUB_SOURCE,
  RSYNC_MAIN_SOURCE,
  RSYNC_IBIBLIO_EPUB_SOURCE,
  RSYNC_IBIBLIO_MAIN_SOURCE,
  resolveRsyncHostOrder,
  buildRsyncSourcesForOrder,
  SYNC_STATE_OBJECT_KEY,
  loadEnv,
  isHtmlPayload,
  isAllowedR2EndpointUrl,
  getR2Config,
  isR2Configured,
  assertValidR2ConfigIfPresent,
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
  mergeMissingTimestampMaps,
  mergeR2SyncStates,
  writeR2SyncState,
  parseCliArgs,
  readCatalogSnapshotFile,
  fetchCatalogFromSupabase,
  buildR2DeltaPlan,
  resolveTransferEngine,
  isRsyncTransportError,
  runRsyncCommand,
  runRsyncCommandWithRetry,
  runWithConcurrency,
  shouldFailR2SyncRun,
  formatR2CoverageBanner,
  formatR2RunReport,
  formatR2ConsoleSummary,
  appendR2StepSummary,
  runR2AssetSync,
};
