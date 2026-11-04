#!/usr/bin/env node
/**
 * Bookarium — PGLAF Mirror-First Featured Quotes Extraction & Sync Pipeline
 *
 * Queries `public.books` by `download_count DESC` (`WHERE quotes = '[]'::jsonb`),
 * dispatches dedicated per-mirror PGLAF workers (`gutenberg.pglaf.org`,
 * `aleph.gutenberg.org`, `gutenberg.readingroo.ms`) with independent `8.0s–16.0s`
 * randomized float delays and error circuit-breaker cooldowns, extracts `10–16`
 * multi-quote spreads per volume, and updates `public.books.quotes` JSONB.
 *
 * Usage:
 *   node scripts/sync-featured-quotes.js --dry-run
 *   node scripts/sync-featured-quotes.js --limit=25 --delay-range=8-16 --mirrors=pglaf
 *   node scripts/sync-featured-quotes.js --schedule-gate --mirrors=pglaf
 *   node scripts/sync-featured-quotes.js --ids=1342,84,2701 --force
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const USER_AGENT =
  'Bookarium-PublicDomain-Reader/1.0 (+https://github.com/calin-m/Bookarium)';

const MIRROR_SHORTCUT_MAP = {
  pglaf: 'https://gutenberg.pglaf.org',
  aleph: 'https://aleph.gutenberg.org',
  readingroo: 'https://gutenberg.readingroo.ms',
};

const GUTENBERG_MIRRORS = [
  'https://gutenberg.pglaf.org',
  'https://aleph.gutenberg.org',
  'https://gutenberg.readingroo.ms',
];

const DEFAULT_POPULAR_POOL_SIZE = 500;
const DEFAULT_RECENT_POOL_SIZE = 64;
const DEFAULT_RECENT_BATCH_RATIO = 0.2;
const MAX_BOOK_TEXT_BYTES = 15 * 1024 * 1024;
const ALLOWED_PGLAF_MIRROR_HOSTS = new Set([
  'gutenberg.pglaf.org',
  'aleph.gutenberg.org',
  'gutenberg.readingroo.ms',
]);

function isAllowedPglafMirrorUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.protocol === 'https:' &&
      ALLOWED_PGLAF_MIRROR_HOSTS.has(parsed.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

/**
 * Canonical 27 Hero & Editorial Classic Book IDs (`FEATURED_HERO_BOOKS` in `src/config/featured-books.ts`).
 * Prioritized at the front of the unpopulated Tier 1 Popular queue so the first 1–2 runs of
 * `quotes-sync.yml` guarantee 10–16 multi-quote spreads in Supabase for all Hero/Editorial classics.
 */
const PRIORITY_HERO_BOOK_IDS = [
  1342, 84, 2701, 64317, 11, 174, 1661, 345, 98, 35, 2600, 135, 2554, 1260,
  768, 5200, 43, 1184, 1232, 132, 2680, 1727, 514, 2147, 164, 205, 76,
];
const PRIORITY_HERO_BOOK_ID_SET = new Set(PRIORITY_HERO_BOOK_IDS);

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

/**
 * Resolves a comma-separated list of mirror shortcodes (`pglaf,aleph,readingroo`)
 * or full HTTPS mirror origins into canonical mirror base URLs.
 */
function resolveSelectedMirrors(rawMirrors) {
  if (!rawMirrors) return [...GUTENBERG_MIRRORS];
  const list = Array.isArray(rawMirrors)
    ? rawMirrors
    : String(rawMirrors)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

  const resolved = [];
  for (const item of list) {
    if (MIRROR_SHORTCUT_MAP[item]) {
      resolved.push(MIRROR_SHORTCUT_MAP[item]);
    } else if (GUTENBERG_MIRRORS.includes(item.replace(/\/+$/, ''))) {
      resolved.push(item.replace(/\/+$/, ''));
    }
  }
  return resolved.length > 0 ? Array.from(new Set(resolved)) : ['https://gutenberg.pglaf.org'];
}

function parseCliArgs(argv = process.argv.slice(2)) {
  const options = {
    dryRun: false,
    force: false,
    scheduleGate: false,
    minIntervalHours: 1,
    maxIntervalHours: 2,
    limit: 25,
    popularPool: DEFAULT_POPULAR_POOL_SIZE,
    recentPool: DEFAULT_RECENT_POOL_SIZE,
    minDelaySec: 8,
    maxDelaySec: 16,
    mirrorCooldownMs: 30000,
    targetCount: 14,
    ids: null,
    mirrors: [...GUTENBERG_MIRRORS],
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--schedule-gate') {
      options.scheduleGate = true;
    } else if (arg.startsWith('--limit=')) {
      const val = parseInt(arg.split('=')[1], 10);
      if (Number.isInteger(val) && val > 0) options.limit = val;
    } else if (arg.startsWith('--popular-pool=')) {
      const val = parseInt(arg.split('=')[1], 10);
      if (Number.isInteger(val) && val > 0) options.popularPool = val;
    } else if (arg.startsWith('--recent-pool=')) {
      const val = parseInt(arg.split('=')[1], 10);
      if (Number.isInteger(val) && val >= 0) options.recentPool = val;
    } else if (arg.startsWith('--delay-range=')) {
      const parts = arg.split('=')[1].split('-');
      if (parts.length === 2) {
        const minVal = parseFloat(parts[0]);
        const maxVal = parseFloat(parts[1]);
        if (Number.isFinite(minVal) && minVal >= 0) options.minDelaySec = minVal;
        if (Number.isFinite(maxVal) && maxVal >= 0) options.maxDelaySec = maxVal;
      }
    } else if (arg.startsWith('--min-delay=')) {
      const val = parseFloat(arg.split('=')[1]);
      if (Number.isFinite(val) && val >= 0) options.minDelaySec = val;
    } else if (arg.startsWith('--max-delay=')) {
      const val = parseFloat(arg.split('=')[1]);
      if (Number.isFinite(val) && val >= 0) options.maxDelaySec = val;
    } else if (arg.startsWith('--target-count=')) {
      const val = parseInt(arg.split('=')[1], 10);
      if (Number.isInteger(val) && val >= 10 && val <= 16) options.targetCount = val;
    } else if (arg.startsWith('--mirrors=')) {
      options.mirrors = resolveSelectedMirrors(arg.split('=')[1]);
    } else if (arg.startsWith('--ids=')) {
      const rawIds = arg
        .split('=')[1]
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isInteger(n) && n > 0);
      if (rawIds.length > 0) options.ids = rawIds;
    }
  }

  if (options.maxDelaySec < options.minDelaySec) {
    options.maxDelaySec = options.minDelaySec;
  }

  return options;
}

/**
 * Computes a randomized floating-point delay in milliseconds between [minSec, maxSec]
 * (default 8.0s to 16.0s) so mirror requests never exhibit fixed robotic intervals.
 */
function computeRandomDelayMs(minSec = 8, maxSec = 16, rng = Math.random) {
  const low = Math.max(0, Math.min(minSec, maxSec));
  const high = Math.max(low, Math.max(minSec, maxSec));
  const randomSeconds = low + rng() * (high - low);
  return Math.round(randomSeconds * 1000);
}

/**
 * Deterministically computes a randomized float schedule window in milliseconds
 * between [minHours, maxHours] (default 1.0h to 2.0h, with minutes & seconds)
 * seeded by the last batch's `updated_at` timestamp so stateless cron checks
 * agree on the exact target wakeup time without wasting GitHub runner minutes.
 */
function computeScheduleWindowMs(seedTimestampIso, minHours = 1, maxHours = 2) {
  const seedStr = String(seedTimestampIso || 'default-seed');
  let hash = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const unitFloat = (hash >>> 0) / 4294967295;
  const low = Math.max(1, Math.min(minHours, maxHours));
  const high = Math.max(low, Math.max(minHours, maxHours));
  const windowHours = low + unitFloat * (high - low);
  return Math.round(windowHours * 3600 * 1000);
}

/**
 * Evaluates whether the randomized 1.0h–2.0h float schedule window has elapsed
 * since the most recent quote update in `public.books`.
 * Queries `books_pkey` via `.in('id', chunk).neq('quotes', '[]')` across the
 * candidate pool IDs (`idx_books_download_count` + `books_pkey`) so PostgreSQL
 * never performs a 78,000-row table scan.
 */
async function evaluateScheduleGate(supabase, options, nowMs = Date.now()) {
  if (!options.scheduleGate || !supabase) {
    return { allowed: true, elapsedHours: null, requiredWindowHours: null };
  }

  const candidateIdSet = new Set(PRIORITY_HERO_BOOK_IDS);
  if (Array.isArray(options._scannedPoolIds)) {
    for (const id of options._scannedPoolIds) {
      if (Number.isInteger(id)) candidateIdSet.add(id);
    }
  } else {
    const idScanCols = [
      { col: 'download_count', limit: 200 },
      { col: 'id', limit: 64 },
    ];
    for (const scan of idScanCols) {
      const idSelect = supabase.from('books').select('id');
      if (idSelect && typeof idSelect.order === 'function') {
        const ordered = idSelect.order(scan.col, { ascending: false });
        if (ordered && typeof ordered.limit === 'function') {
          const { data: idRows } = await ordered.limit(scan.limit);
          if (Array.isArray(idRows)) {
            for (const r of idRows) {
              if (r && Number.isInteger(r.id)) candidateIdSet.add(r.id);
            }
          }
        }
      }
    }
  }

  const candidateIds = Array.from(candidateIdSet);
  const CHUNK_SIZE = 200;
  const rows = [];

  for (let i = 0; i < candidateIds.length; i += CHUNK_SIZE) {
    const chunk = candidateIds.slice(i, i + CHUNK_SIZE);
    const baseSelect = supabase.from('books').select('updated_at');
    let chunkData = null;

    if (baseSelect && typeof baseSelect.in === 'function') {
      const inQuery = baseSelect.in('id', chunk);
      const finalQuery =
        inQuery && typeof inQuery.neq === 'function'
          ? inQuery.neq('quotes', '[]')
          : inQuery;
      const res = await finalQuery;
      chunkData = res && res.data;
    } else if (baseSelect && typeof baseSelect.neq === 'function') {
      const neqQuery = baseSelect.neq('quotes', '[]');
      const ordered =
        neqQuery && typeof neqQuery.order === 'function'
          ? neqQuery.order('download_count', { ascending: false })
          : neqQuery;
      const finalQuery =
        ordered && typeof ordered.limit === 'function' ? ordered.limit(200) : ordered;
      const res = await finalQuery;
      chunkData = res && res.data;
      i = candidateIds.length;
    }

    if (Array.isArray(chunkData)) {
      rows.push(...chunkData);
    } else if (chunkData) {
      rows.push(chunkData);
    }
  }

  let latestUpdatedIso = null;
  let lastUpdatedMs = -Infinity;
  for (const row of rows) {
    if (row && row.updated_at) {
      const parsed = Date.parse(row.updated_at);
      if (Number.isFinite(parsed) && parsed > lastUpdatedMs) {
        lastUpdatedMs = parsed;
        latestUpdatedIso = row.updated_at;
      }
    }
  }

  if (!latestUpdatedIso || !Number.isFinite(lastUpdatedMs)) {
    return { allowed: true, elapsedHours: null, requiredWindowHours: null };
  }

  const requiredWindowMs = computeScheduleWindowMs(
    latestUpdatedIso,
    options.minIntervalHours,
    options.maxIntervalHours
  );
  const elapsedMs = Math.max(0, nowMs - lastUpdatedMs);

  return {
    allowed: elapsedMs >= requiredWindowMs,
    elapsedHours: Number((elapsedMs / 3600000).toFixed(2)),
    requiredWindowHours: Number((requiredWindowMs / 3600000).toFixed(2)),
  };
}

/**
 * Builds the canonical Project Gutenberg mirror directory path for a given book ID.
 * E.g. 8 -> "0/8", 84 -> "8/84", 1342 -> "1/3/4/1342", 64317 -> "6/4/3/1/64317"
 */
function buildGutenbergPathDir(bookId) {
  const str = String(bookId).trim();
  if (str.length <= 1) {
    return `0/${str}`;
  }
  const prefixDirs = str.slice(0, -1).split('').join('/');
  return `${prefixDirs}/${str}`;
}

/**
 * Builds candidate HTTPS plain-text URLs for a single PGLAF bulk mirror.
 */
function buildSingleMirrorCandidateUrls(bookId, mirrorBaseUrl) {
  const dir = buildGutenbergPathDir(bookId);
  const base = String(mirrorBaseUrl || '').replace(/\/+$/, '');
  const filenames = [`${bookId}-0.txt`, `${bookId}.txt`, `${bookId}-8.txt`];
  return filenames.map((fname) => `${base}/${dir}/${fname}`);
}

/**
 * Builds candidate HTTPS plain-text URLs strictly across official PGLAF bulk mirrors.
 * Never includes www.gutenberg.org.
 */
function buildMirrorCandidateUrls(bookId, mirrors = GUTENBERG_MIRRORS) {
  const urls = [];
  for (const mirror of mirrors) {
    urls.push(...buildSingleMirrorCandidateUrls(bookId, mirror));
  }
  return urls;
}

/**
 * Attempts to fetch plain text for a book from a single assigned PGLAF mirror.
 * Distinguishes between 404 file-variant misses and mirror-level errors (429/403/5xx/timeout).
 */
async function fetchBookTextFromSingleMirror(
  bookId,
  mirrorBaseUrl,
  fetchFn = globalThis.fetch
) {
  const candidateUrls = buildSingleMirrorCandidateUrls(bookId, mirrorBaseUrl);

  for (const url of candidateUrls) {
    if (!isAllowedPglafMirrorUrl(url)) {
      return {
        ok: false,
        isMirrorLevelError: true,
        status: 403,
        error: `Blocked untrusted mirror URL: ${url}`,
      };
    }
    try {
      const response = await fetchFn(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/plain,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(25000),
      });

      if (response && response.ok) {
        if (response.url && !isAllowedPglafMirrorUrl(response.url)) {
          return {
            ok: false,
            isMirrorLevelError: true,
            status: 403,
            error: `Blocked redirect to untrusted host: ${response.url}`,
          };
        }
        const contentLength =
          response.headers && typeof response.headers.get === 'function'
            ? parseInt(response.headers.get('content-length') || '0', 10)
            : 0;
        if (Number.isFinite(contentLength) && contentLength > MAX_BOOK_TEXT_BYTES) {
          return {
            ok: false,
            isMirrorLevelError: false,
            status: 413,
            error: `Volume #${bookId} exceeds 15 MB text limit on ${mirrorBaseUrl}`,
          };
        }
        const text = await response.text();
        if (
          text &&
          text.length <= MAX_BOOK_TEXT_BYTES &&
          text.trim().length >= 500 &&
          !/<!DOCTYPE html/i.test(text.slice(0, 300))
        ) {
          return {
            ok: true,
            text,
            mirrorUrl: url,
            isMirrorLevelError: false,
          };
        }
      } else if (response && typeof response.status === 'number') {
        if (response.status === 429 || response.status === 403 || response.status >= 500) {
          return {
            ok: false,
            isMirrorLevelError: true,
            status: response.status,
            error: `HTTP ${response.status} on ${mirrorBaseUrl}`,
          };
        }
      }
    } catch (err) {
      return {
        ok: false,
        isMirrorLevelError: true,
        status: 0,
        error: err.message || `Network error on ${mirrorBaseUrl}`,
      };
    }
  }

  return {
    ok: false,
    isMirrorLevelError: false,
    status: 404,
    error: `Volume #${bookId} not found on ${mirrorBaseUrl}`,
  };
}

/**
 * Sequentially attempts PGLAF bulk mirrors until a valid plain-text body is retrieved.
 */
async function fetchBookTextFromMirrors(bookId, fetchFn = globalThis.fetch) {
  let lastError = null;
  for (const mirror of GUTENBERG_MIRRORS) {
    const res = await fetchBookTextFromSingleMirror(bookId, mirror, fetchFn);
    if (res.ok) {
      return { text: res.text, mirrorUrl: res.mirrorUrl };
    }
    lastError = new Error(res.error);
  }

  throw new Error(
    `Failed to fetch plain text for book #${bookId} across PGLAF mirrors${
      lastError ? `: ${lastError.message}` : ''
    }`
  );
}

/**
 * Strips Project Gutenberg boilerplate headers/footers and extracts clean narrative paragraphs.
 */
function stripBoilerplateAndSplitParagraphs(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  let body = rawText.replace(/\r\n/g, '\n');
  const startMatch = body.match(/\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\n/i);
  if (startMatch && typeof startMatch.index === 'number') {
    body = body.slice(startMatch.index + startMatch[0].length);
  }
  const endMatch = body.match(/\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i);
  if (endMatch && typeof endMatch.index === 'number') {
    body = body.slice(0, endMatch.index);
  }

  return body
    .split(/\n\s*\n+/)
    .map((p) =>
      p
        .replace(
          /^\s*(?:(?:CHAPTER|Chapter|BOOK|Book|ACT|Act|SCENE|Scene|CANTO|Canto|PART|Part|LETTER|Letter|STAVE|Stave)\s+(?:[IVXLCDM\d]+|[A-Za-z]+)\b(?::\s*[^\n.!?]{1,60})?\s*)/i,
          ''
        )
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((p) => {
      if (p.length < 75 || p.length > 750) return false;
      if (/^(?:chapter|book|canto|act|scene|part|volume|contents|illustration)\b/i.test(p)) {
        return false;
      }
      if (
        /\b(?:distributed proofreading|transcriber(?:'s)? note|pgdp\.net|produced by|project gutenberg|all rights reserved|copyright)\b/i.test(
          p
        )
      ) {
        return false;
      }
      if (/[-_=*~]{4,}/.test(p)) return false;
      const letters = p.match(/[\p{L}]/gu) || [];
      if (letters.length < 40) return false;
      const nonSpace = p.replace(/\s+/g, '');
      return nonSpace.length > 0 && letters.length / nonSpace.length >= 0.65;
    });
}

function wrapCleanQuote(text, maxLen = 260) {
  const cleaned = String(text || '')
    .replace(/^[“"'\s*\-_~=\.#\/\\|:;+]+|[”"'\s*\-_~=\.#\/\\|:;+]+$/g, '')
    .trim();
  if (!cleaned) return '';
  const body =
    cleaned.length > maxLen - 2 ? `${cleaned.slice(0, maxLen - 3).trim()}…` : cleaned;
  return `“${body}”`;
}

/**
 * Extracts 10–16 distinct multi-quote spreads (`BookPassage[]`) from raw book text.
 */
function extractBookQuoteSpreads(rawText, book, targetCount = 14) {
  const desiredCount = Math.min(16, Math.max(10, targetCount));
  const paragraphs = stripBoilerplateAndSplitParagraphs(rawText);
  if (paragraphs.length < 4) return [];

  const spreads = [];
  const usedOpeningSet = new Set();
  const maxSpreads = Math.min(desiredCount, Math.max(1, Math.floor(paragraphs.length / 4)));

  for (let i = 0; i < maxSpreads; i++) {
    const startIdx = Math.floor((i * Math.max(0, paragraphs.length - 4)) / Math.max(1, maxSpreads - 1));
    const windowParas = paragraphs.slice(startIdx, startIdx + 8);
    const distinctWindow = windowParas.filter(
      (p) => !usedOpeningSet.has(p.slice(0, 60).toLowerCase())
    );
    const pool = distinctWindow.length >= 4 ? distinctWindow : windowParas;
    if (pool.length < 2) continue;

    usedOpeningSet.add(pool[0].slice(0, 60).toLowerCase());
    const romanLabels = [
      'I',
      'II',
      'III',
      'IV',
      'V',
      'VI',
      'VII',
      'VIII',
      'IX',
      'X',
      'XI',
      'XII',
      'XIII',
      'XIV',
      'XV',
      'XVI',
    ];
    const numeral = romanLabels[i] || String(i + 1);

    spreads.push({
      chapterLabel: `Passage ${numeral} • ${book.title}`,
      openingLine: wrapCleanQuote(pool[0], 280),
      secondaryQuote: pool[1] ? wrapCleanQuote(pool[1], 210) : undefined,
      leftPageQuote2: pool[2] ? wrapCleanQuote(pool[2], 190) : undefined,
      quoteExcerpt: wrapCleanQuote(pool[3] || pool[1] || pool[0], 260),
      rightPageQuote2: pool[4] ? wrapCleanQuote(pool[4], 200) : undefined,
      tertiaryQuote: pool[5] ? wrapCleanQuote(pool[5], 160) : undefined,
      commentary: `Extracted from the unabridged Project Gutenberg edition (Vol. #${book.id}).`,
    });
  }

  return spreads;
}

/**
 * Builds a 1-item bibliographic sentinel spread when a volume has no extractable narrative
 * paragraphs or 404s across all mirrors, so `quotes` is no longer `'[]'::jsonb` and the
 * volume is never re-queried in an endless loop on future runs.
 */
function buildSentinelQuoteSpread(book) {
  const authorName =
    Array.isArray(book.authors) && book.authors[0]?.name
      ? book.authors[0].name
      : 'Classic Author';
  return {
    chapterLabel: `Archival Edition • Vol. #${book.id}`,
    openingLine: `“${book.title} — preserved in the Project Gutenberg Literary Archive.”`,
    quoteExcerpt: `“Unabridged public domain edition by ${authorName} (Vol. #${book.id}).”`,
    commentary: `Bibliographic sentinel record for Vol. #${book.id}.`,
  };
}

/**
 * Upsert-only merge: preserves existing valid spreads and appends newly discovered spreads up to `maxCount`.
 */
function mergeDistinctQuoteSpreads(existingQuotes, newSpreads, maxCount = 16) {
  const existingValid = Array.isArray(existingQuotes)
    ? existingQuotes.filter(
        (q) =>
          q &&
          typeof q === 'object' &&
          typeof q.openingLine === 'string' &&
          typeof q.quoteExcerpt === 'string'
      )
    : [];

  const seenKeys = new Set(
    existingValid.map((q) =>
      `${q.openingLine.slice(0, 50).toLowerCase()}|${q.quoteExcerpt.slice(0, 50).toLowerCase()}`
    )
  );

  const merged = [...existingValid];
  for (const spread of newSpreads || []) {
    if (merged.length >= maxCount) break;
    const key = `${String(spread.openingLine || '')
      .slice(0, 50)
      .toLowerCase()}|${String(spread.quoteExcerpt || '')
      .slice(0, 50)
      .toLowerCase()}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      merged.push(spread);
    }
  }

  return merged.slice(0, maxCount);
}

/**
 * Generates an idempotent SQL seed statement for updating `public.books.quotes`.
 */
function buildSqlQuoteSeedStatement(bookId, quotesArray) {
  const safeId = Number(bookId);
  const jsonLiteral = JSON.stringify(quotesArray || []).replace(/'/g, "''");
  return `UPDATE public.books SET quotes = '${jsonLiteral}'::jsonb, updated_at = NOW() WHERE id = ${safeId};`;
}

/**
 * Fetches book IDs in `public.books` that currently have populated quotes (`quotes <> '[]'::jsonb`).
 * Always scopes queries by Primary Key (`books_pkey`) in chunks of 200 IDs
 * (`.in('id', chunk).neq('quotes', '[]')`) across the candidate window IDs so PostgreSQL
 * performs <2ms B-Tree Primary Key lookups and never scans the 78,000-row table.
 */
async function fetchQuotedBookIds(supabase, scopedIds = null) {
  if (!supabase) return new Set();

  let targetIds = [];
  if (scopedIds instanceof Set || Array.isArray(scopedIds)) {
    targetIds = Array.from(scopedIds).filter((id) => Number.isInteger(id) && id > 0);
  }

  if (targetIds.length === 0) {
    const discovered = new Set(PRIORITY_HERO_BOOK_IDS);
    const scans = [
      { col: 'download_count', limit: 1000 },
      { col: 'id', limit: 320 },
    ];
    for (const scan of scans) {
      const scanSelect = supabase.from('books').select('id');
      if (scanSelect && typeof scanSelect.order === 'function') {
        const ordered = scanSelect.order(scan.col, { ascending: false });
        if (ordered && typeof ordered.limit === 'function') {
          const { data: rows } = await ordered.limit(scan.limit);
          if (Array.isArray(rows)) {
            for (const r of rows) {
              if (r && Number.isInteger(r.id)) discovered.add(r.id);
            }
          }
        }
      }
    }
    targetIds = Array.from(discovered);
  }

  const quotedIdSet = new Set();
  const CHUNK_SIZE = 200;

  for (let i = 0; i < targetIds.length; i += CHUNK_SIZE) {
    const chunk = targetIds.slice(i, i + CHUNK_SIZE);
    const selectBuilder = supabase.from('books').select('id');

    if (selectBuilder && typeof selectBuilder.in === 'function') {
      const inQuery = selectBuilder.in('id', chunk);
      const hasChainedNeq = inQuery && typeof inQuery.neq === 'function';
      const finalQuery = hasChainedNeq ? inQuery.neq('quotes', '[]') : inQuery;
      const { data, error } = await finalQuery;
      if (error) throw new Error(error.message);
      if (Array.isArray(data)) {
        for (const r of data) {
          if (!r || !Number.isInteger(r.id)) continue;
          if (!hasChainedNeq && Array.isArray(r.quotes) && r.quotes.length === 0) continue;
          quotedIdSet.add(r.id);
        }
      }
    } else if (selectBuilder && typeof selectBuilder.neq === 'function') {
      let query = selectBuilder.neq('quotes', '[]');
      if (query && typeof query.order === 'function') {
        const ordered = query.order('download_count', { ascending: false });
        query = ordered && typeof ordered.limit === 'function' ? ordered.limit(2000) : ordered;
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (Array.isArray(data)) {
        for (const r of data) {
          if (r && Number.isInteger(r.id)) quotedIdSet.add(r.id);
        }
      }
      break;
    }
  }

  return quotedIdSet;
}

/**
 * Blends candidate books from Tier 1 (Top Popular by `download_count DESC`) and
 * Tier 2 (Rolling Most Recent by `id DESC`) using an 80/20 split (e.g., 20 Popular + 5 Recent
 * for a 25-book batch), automatically backfilling from the other tier when one tier has
 * fewer unpopulated books remaining.
 */
function blendTwoTierCandidates(popularRows = [], recentRows = [], options = {}) {
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 25;
  const force = Boolean(options.force);
  const quotedIds = options.quotedIds instanceof Set ? options.quotedIds : null;

  const popularPoolIds = new Set();
  const recentPoolIds = new Set();
  const allowedPoolIds = new Set();
  for (const row of popularRows) {
    if (row && Number.isInteger(row.id)) {
      popularPoolIds.add(row.id);
      allowedPoolIds.add(row.id);
    }
  }
  for (const row of recentRows) {
    if (row && Number.isInteger(row.id)) {
      recentPoolIds.add(row.id);
      allowedPoolIds.add(row.id);
    }
  }

  const needsQuotes = (row) => {
    if (!row || !Number.isInteger(row.id)) return false;
    if (force) return true;
    if (Array.isArray(row.quotes) && row.quotes.length > 0) return false;
    if (quotedIds && quotedIds.has(row.id)) return false;
    return true;
  };

  const unpopulatedPopular = popularRows
    .filter(needsQuotes)
    .sort((a, b) => {
      const aHero = PRIORITY_HERO_BOOK_ID_SET.has(a.id) ? 1 : 0;
      const bHero = PRIORITY_HERO_BOOK_ID_SET.has(b.id) ? 1 : 0;
      if (aHero !== bHero) return bHero - aHero;
      return (b.download_count || 0) - (a.download_count || 0) || a.id - b.id;
    });
  const popularQueueIds = new Set(unpopulatedPopular.map((r) => r.id));
  const unpopulatedRecent = recentRows.filter(
    (r) => needsQuotes(r) && !popularQueueIds.has(r.id)
  );

  const recentTarget =
    limit <= 1 || unpopulatedRecent.length === 0
      ? 0
      : Math.min(limit, Math.max(1, Math.round(limit * DEFAULT_RECENT_BATCH_RATIO)));
  const popularTarget = Math.max(0, limit - recentTarget);

  const selectedPopular = unpopulatedPopular.slice(0, popularTarget);
  const selectedRecent = unpopulatedRecent.slice(0, recentTarget);

  if (selectedPopular.length < popularTarget && unpopulatedRecent.length > selectedRecent.length) {
    const deficit = popularTarget - selectedPopular.length;
    selectedRecent.push(
      ...unpopulatedRecent.slice(selectedRecent.length, selectedRecent.length + deficit)
    );
  } else if (
    selectedRecent.length < recentTarget &&
    unpopulatedPopular.length > selectedPopular.length
  ) {
    const deficit = recentTarget - selectedRecent.length;
    selectedPopular.push(
      ...unpopulatedPopular.slice(selectedPopular.length, selectedPopular.length + deficit)
    );
  }

  const candidates = [...selectedPopular, ...selectedRecent].slice(0, limit);
  // Tier provenance per selected book (backfilled books keep the tier of the pool they came from)
  const candidateTiers = new Map();
  for (const cand of candidates) {
    candidateTiers.set(cand.id, popularQueueIds.has(cand.id) ? 'top' : 'recent');
  }

  return {
    candidates,
    popularPoolIds,
    recentPoolIds,
    allowedPoolIds,
    candidateTiers,
  };
}

/**
 * Post-batch Dual-Window (`Top 500 Popular` + `Rolling 64 Most Recent`) 1-for-1 auto-pruning:
 * - Tier 1 (`Popular 500`): Protects all IDs in `popularPoolIds` (`Top 500 Popular` canon) and
 *   prunes any former Popular book (`id < minRecentHorizonId`) that dropped out of the Top 500 (`#501+`).
 * - Tier 2 (`Recent 64`): Collects quoted Recent book IDs (`recentPoolIds` or `id >= minRecentHorizonId`
 *   outside `popularPoolIds`), sorts them by `id DESC` (newest to oldest), keeps the newest
 *   `recentPool` (`64`) quoted Recent books, and resets `quotes = '[]'::jsonb` on `.slice(64)`.
 * - Executes `UPDATE` statements in chunks of 25 IDs to prevent statement timeouts.
 */
async function pruneOutOfWindowBookQuotes(
  supabase,
  popularPoolIds,
  options = {},
  logger = console
) {
  if (
    !supabase ||
    !(popularPoolIds instanceof Set) ||
    popularPoolIds.size === 0 ||
    (options.ids && options.ids.length > 0)
  ) {
    return { prunedCount: 0, prunedIds: [] };
  }

  const currentQuotedIds =
    options._quotedIds instanceof Set
      ? new Set(options._quotedIds)
      : await fetchQuotedBookIds(supabase, options._scannedPoolIds);
  if (options.newlyQuotedIds instanceof Set) {
    for (const id of options.newlyQuotedIds) {
      if (Number.isInteger(id)) currentQuotedIds.add(id);
    }
  }

  if (currentQuotedIds.size === 0) {
    return { prunedCount: 0, prunedIds: [] };
  }

  const recentCap =
    typeof options.recentPool === 'number' && options.recentPool >= 0
      ? options.recentPool
      : DEFAULT_RECENT_POOL_SIZE;

  const recentPoolIds =
    options.recentPoolIds instanceof Set
      ? options.recentPoolIds
      : options._recentPoolIds instanceof Set
        ? options._recentPoolIds
        : null;
  const minRecentHorizonId =
    typeof options.minRecentHorizonId === 'number'
      ? options.minRecentHorizonId
      : typeof options._minRecentHorizonId === 'number'
        ? options._minRecentHorizonId
        : null;

  const stalePopularIds = [];
  const quotedRecentIds = [];

  for (const id of currentQuotedIds) {
    if (!Number.isInteger(id) || popularPoolIds.has(id)) continue;
    const isRecentCandidate =
      (recentPoolIds && recentPoolIds.has(id)) ||
      minRecentHorizonId === null ||
      id >= minRecentHorizonId;

    if (isRecentCandidate) {
      quotedRecentIds.push(id);
    } else {
      stalePopularIds.push(id);
    }
  }

  quotedRecentIds.sort((a, b) => b - a);
  const staleRecentIds = quotedRecentIds.slice(recentCap);
  const maxPrunePerRun =
    typeof options.maxPrunePerRun === 'number' && options.maxPrunePerRun > 0
      ? options.maxPrunePerRun
      : Math.max((options.limit || 25) * 2, 64);
  const staleIds = [...stalePopularIds, ...staleRecentIds].slice(0, maxPrunePerRun);

  if (staleIds.length === 0) {
    return { prunedCount: 0, prunedIds: [] };
  }

  logger.log(
    `[Prune] Resetting quotes on ${staleIds.length} out-of-window book(s) (${stalePopularIds.length} demoted Popular + ${staleRecentIds.length} cycled-out Recent beyond newest ${recentCap}; Top ${
      options.popularPool || DEFAULT_POPULAR_POOL_SIZE
    } Popular protected).`
  );

  if (!options.dryRun) {
    const PRUNE_CHUNK_SIZE = 25;
    const nowIso = new Date().toISOString();
    for (let i = 0; i < staleIds.length; i += PRUNE_CHUNK_SIZE) {
      const chunk = staleIds.slice(i, i + PRUNE_CHUNK_SIZE);
      const { error: updateErr } = await supabase
        .from('books')
        .update({
          quotes: [],
          updated_at: nowIso,
        })
        .in('id', chunk);
      if (updateErr) throw new Error(updateErr.message);
    }
  }

  return { prunedCount: staleIds.length, prunedIds: staleIds };
}

/**
 * Read-only Two-Tier pool scan shared by automatic batches and manual `--ids` tier labelling:
 * Tier 1 (`Top 500 Popular` via `idx_books_download_count` + Priority Hero IDs) and
 * Tier 2 (`Rolling 64 Most Recent` via `books_pkey (id DESC)`). Never writes to the database.
 */
async function scanTwoTierPools(supabase, options) {
  const popularPoolLimit = options.popularPool || DEFAULT_POPULAR_POOL_SIZE;
  const recentPoolLimit =
    typeof options.recentPool === 'number' ? options.recentPool : DEFAULT_RECENT_POOL_SIZE;

  const isEligibleCatalogBook = (row) =>
    row &&
    Number.isInteger(row.id) &&
    row.copyright !== true &&
    (!row.media_type || row.media_type === 'Text');

  const isEligibleEnglishBook = (row) =>
    isEligibleCatalogBook(row) &&
    (!Array.isArray(row.languages) ||
      row.languages.length === 0 ||
      row.languages.includes('en'));

  const popularScanLimit = Math.max(popularPoolLimit * 2, 1000);
  const { data: popularRaw, error: popularErr } = await supabase
    .from('books')
    .select('id, title, authors, translators, subjects, languages, copyright, media_type, download_count')
    .order('download_count', { ascending: false })
    .limit(popularScanLimit);

  if (popularErr) throw new Error(popularErr.message);

  let heroRaw = [];
  const heroSelectQuery = supabase
    .from('books')
    .select('id, title, authors, translators, subjects, languages, copyright, media_type, download_count');
  if (heroSelectQuery && typeof heroSelectQuery.in === 'function') {
    const { data: heroRows, error: heroErr } = await heroSelectQuery.in(
      'id',
      PRIORITY_HERO_BOOK_IDS
    );
    if (heroErr) throw new Error(heroErr.message);
    if (Array.isArray(heroRows)) {
      heroRaw = heroRows.filter((r) => r && PRIORITY_HERO_BOOK_ID_SET.has(r.id));
    }
  }

  const allScannedIds = new Set(PRIORITY_HERO_BOOK_IDS);
  for (const row of [...heroRaw, ...(popularRaw || [])]) {
    if (row && Number.isInteger(row.id)) {
      allScannedIds.add(row.id);
    }
  }

  const combinedPopularMap = new Map();
  for (const row of [...heroRaw, ...(popularRaw || [])]) {
    if (isEligibleEnglishBook(row) && !combinedPopularMap.has(row.id)) {
      combinedPopularMap.set(row.id, row);
    }
  }

  const popularData = Array.from(combinedPopularMap.values())
    .sort((a, b) => {
      const aHero = PRIORITY_HERO_BOOK_ID_SET.has(a.id) ? 1 : 0;
      const bHero = PRIORITY_HERO_BOOK_ID_SET.has(b.id) ? 1 : 0;
      if (aHero !== bHero) return bHero - aHero;
      return (b.download_count || 0) - (a.download_count || 0) || a.id - b.id;
    })
    .slice(0, popularPoolLimit);

  let recentData = [];
  let minRecentHorizonId = null;
  if (recentPoolLimit > 0) {
    const recentScanLimit = Math.max(recentPoolLimit * 5, 320);
    const { data: recRows, error: recErr } = await supabase
      .from('books')
      .select('id, title, authors, translators, subjects, languages, copyright, media_type, download_count')
      .order('id', { ascending: false })
      .limit(recentScanLimit);
    if (recErr) throw new Error(recErr.message);
    const validRecentScanIds = (recRows || [])
      .map((r) => r && r.id)
      .filter((id) => Number.isInteger(id));
    for (const id of validRecentScanIds) {
      allScannedIds.add(id);
    }
    if (validRecentScanIds.length > 0) {
      const maxRecentId = Math.max(...validRecentScanIds);
      minRecentHorizonId = Math.max(
        1,
        Math.min(Math.min(...validRecentScanIds), maxRecentId - 5000)
      );
    }
    recentData = (recRows || []).filter(isEligibleCatalogBook).slice(0, recentPoolLimit);
  }

  return { popularData, recentData, allScannedIds, minRecentHorizonId };
}

/**
 * Best-effort tier labelling for manual `--ids` runs: reuses the read-only Two-Tier pool scan so each
 * requested book can be reported as `top`, `recent`, or `outside`, and so the Tier Progress table can be
 * printed. Only sets reporting metadata (`_manualRun` blocks pruning); never changes which IDs are processed.
 */
async function resolveManualRunTiers(supabase, options, requestedIds) {
  options._manualRun = true;
  try {
    const { popularData, recentData, allScannedIds } = await scanTwoTierPools(supabase, options);
    const popularPoolIds = new Set(popularData.map((r) => r.id));
    const recentPoolIds = new Set(recentData.map((r) => r.id));
    const quotedIds = await fetchQuotedBookIds(supabase, allScannedIds);

    const candidateTiers = new Map();
    for (const id of requestedIds) {
      if (popularPoolIds.has(id)) candidateTiers.set(id, 'top');
      else if (recentPoolIds.has(id)) candidateTiers.set(id, 'recent');
      else candidateTiers.set(id, 'outside');
    }

    options._popularPoolIds = popularPoolIds;
    options._recentPoolIds = recentPoolIds;
    options._quotedIds = quotedIds;
    options._candidateTiers = candidateTiers;
  } catch (err) {
    options._tierResolutionError = err && err.message ? err.message : String(err);
  }
}

const TIER_LABELS = {
  top: 'Top',
  recent: 'Recent',
  outside: 'Outside pools',
  manual: 'Manual',
};

const OUTCOME_LABELS = {
  updated: '✅ Saved',
  refreshed: '🔄 Refreshed',
  'already-quoted': '⏭️ Already has quotes',
  'no-quotes': '⚪ No quotes found (placeholder)',
  'not-found': '❓ Not in catalog',
  failed: '❌ Failed',
};

/**
 * Zero-query tier progress: derives Done / Remaining per tier purely from in-memory sets already loaded
 * for candidate selection. Recent books that also sit in the Top pool are counted once, under Top.
 */
function computeTierProgress({
  popularPoolIds,
  recentPoolIds,
  quotedIds,
  newlyQuotedIds,
  limit = 25,
  avgWindowHours = 1.5,
} = {}) {
  const topIds = popularPoolIds instanceof Set ? popularPoolIds : new Set();
  const recentIds = recentPoolIds instanceof Set ? recentPoolIds : new Set();
  const before = quotedIds instanceof Set ? quotedIds : new Set();
  const added = newlyQuotedIds instanceof Set ? newlyQuotedIds : new Set();

  const tally = (ids) => {
    let pool = 0;
    let doneBefore = 0;
    let doneNow = 0;
    for (const id of ids) {
      pool++;
      const wasDone = before.has(id);
      if (wasDone) doneBefore++;
      if (wasDone || added.has(id)) doneNow++;
    }
    return {
      pool,
      doneBefore,
      doneNow,
      addedThisRun: doneNow - doneBefore,
      remaining: pool - doneNow,
      percent: pool > 0 ? Math.round((doneNow / pool) * 1000) / 10 : 100,
    };
  };

  const top = tally(topIds);
  const recent = tally(Array.from(recentIds).filter((id) => !topIds.has(id)));
  const pool = top.pool + recent.pool;
  const doneNow = top.doneNow + recent.doneNow;
  const total = {
    pool,
    doneBefore: top.doneBefore + recent.doneBefore,
    doneNow,
    addedThisRun: top.addedThisRun + recent.addedThisRun,
    remaining: top.remaining + recent.remaining,
    percent: pool > 0 ? Math.round((doneNow / pool) * 1000) / 10 : 100,
  };

  const batchSize = Number.isInteger(limit) && limit > 0 ? limit : 25;
  const etaRuns = total.remaining > 0 ? Math.ceil(total.remaining / batchSize) : 0;
  return {
    top,
    recent,
    total,
    etaRuns,
    etaHours: Math.round(etaRuns * avgWindowHours * 10) / 10,
  };
}

/**
 * Formats the pre-batch pool status banner printed to console before processing begins.
 */
function formatInitialPoolBanner({
  topPoolSize = 0,
  topDone = 0,
  recentPoolSize = 0,
  recentDone = 0,
  batchTopCount = 0,
  batchRecentCount = 0,
  totalBatchCount = 0,
} = {}) {
  const topRemaining = Math.max(0, topPoolSize - topDone);
  const topPct = topPoolSize > 0 ? (Math.round((topDone / topPoolSize) * 1000) / 10).toFixed(1) : '100.0';
  const recentRemaining = Math.max(0, recentPoolSize - recentDone);
  const recentPct =
    recentPoolSize > 0 ? (Math.round((recentDone / recentPoolSize) * 1000) / 10).toFixed(1) : '100.0';

  const lines = [
    '📊 Two-Tier Pool Status (Pre-Batch):',
    `  • Top Popular:    ${topDone}/${topPoolSize} ingested (${topRemaining} remaining · ${topPct}%)`,
    `  • Rolling Recent: ${recentDone}/${recentPoolSize} ingested (${recentRemaining} remaining · ${recentPct}%)`,
    `  • This Batch:     ${totalBatchCount} candidate(s) (${batchTopCount} Top · ${batchRecentCount} Recent)`,
  ];
  if (recentRemaining === 0 && recentPoolSize > 0) {
    lines.push('  • Note: Rolling Recent pool is fully ingested (100%); batch slots backfilled by Top Popular.');
  }
  return lines.join('\n');
}

function escapeMarkdownCell(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/[\\|]/g, '\\$&')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function describeQuoteSource(source) {
  if (source === 'supabase-content') return 'Stored text';
  if (source === 'stored') return 'Database';
  if (!source || source === 'none') return '—';
  try {
    return new URL(source).hostname;
  } catch {
    return source;
  }
}

function describeQuoteCounts(entry) {
  const hasPrior = entry.existingQuoteCount > 0;
  if ((entry.outcome === 'updated' || entry.outcome === 'refreshed') && hasPrior) {
    return `${entry.existingQuoteCount} → ${entry.quoteCount}`;
  }
  if (entry.outcome === 'already-quoted') return String(entry.existingQuoteCount);
  return entry.quoteCount > 0 ? String(entry.quoteCount) : '—';
}

/**
 * Builds the Markdown run report (Tier Progress, This Run totals, Books Processed ledger)
 * printed to the console and appended to the GitHub Actions job summary.
 */
function formatRunReport(summary, context = {}) {
  const books = Array.isArray(summary.books) ? [...summary.books] : [];
  books.sort((a, b) => a.order - b.order);
  const countOutcome = (outcome) => books.filter((b) => b.outcome === outcome).length;
  const lines = ['## 📚 Featured Quotes Sync — Run Report', ''];

  if (context.dryRun) {
    lines.push('_Dry run: no database writes were made._', '');
  }

  lines.push('### Tier Progress', '');
  const progress = summary.progress;
  if (progress) {
    const row = (label, t) =>
      `| ${label} | ${t.pool} | ${t.doneNow}${t.addedThisRun > 0 ? ` (+${t.addedThisRun})` : ''} | ${t.remaining} | ${t.percent}% |`;
    lines.push(
      '| Tier | Pool | Done | Remaining | Progress |',
      '|---|---:|---:|---:|---:|',
      row('Top Popular', progress.top),
      row('Rolling Recent', progress.recent),
      row('**Total**', progress.total),
      ''
    );
    lines.push(
      progress.total.remaining === 0
        ? '✅ Both pools are fully ingested.'
        : `Estimated completion: ~${progress.etaRuns} more run(s) (≈${progress.etaHours}h at a 1.5h average window).`,
      ''
    );
  } else {
    const reason = context.tierResolutionError
      ? `pool scan failed: ${escapeMarkdownCell(context.tierResolutionError)}`
      : 'pools were not scanned in this run';
    lines.push(`_Tier progress unavailable (${reason})._`, '');
  }

  lines.push('### This Run', '');
  lines.push(
    [
      `Saved: ${countOutcome('updated')}`,
      `Refreshed: ${countOutcome('refreshed')}`,
      `No quotes (placeholder): ${countOutcome('no-quotes')}`,
      `Already quoted: ${countOutcome('already-quoted')}`,
      `Not found: ${countOutcome('not-found')}`,
      `Failed: ${countOutcome('failed')}`,
      `Pruned: ${summary.pruned || 0}`,
    ].join(' · '),
    ''
  );
  const mirrorEntries = Object.entries(summary.mirrorBreakdown || {});
  if (mirrorEntries.length > 0) {
    lines.push(
      `Mirrors: ${mirrorEntries.map(([url, n]) => `${describeQuoteSource(url)} ${n}`).join(', ')}`,
      ''
    );
  }

  lines.push('### Books Processed', '');
  if (books.length === 0) {
    lines.push('_No books processed in this run._', '');
  } else {
    lines.push(
      '| # | Tier | ID | Title | Source | Outcome | Quotes |',
      '|---:|---|---:|---|---|---|---:|'
    );
    for (const b of books) {
      const outcome = OUTCOME_LABELS[b.outcome] || b.outcome;
      const note = b.note ? ` — ${b.note}` : '';
      lines.push(
        `| ${b.order} | ${TIER_LABELS[b.tier] || b.tier} | ${b.id} | ${escapeMarkdownCell(b.title)} | ${describeQuoteSource(b.source)} | ${escapeMarkdownCell(outcome + note)} | ${describeQuoteCounts(b)} |`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Best-effort append of the run report to the GitHub Actions job summary file.
 * Never throws: a write failure is logged and the sync result is unaffected.
 */
function writeStepSummary(filePath, markdown, logger = console, fsImpl = fs) {
  if (!filePath) return false;
  try {
    fsImpl.appendFileSync(filePath, `${markdown}\n`, 'utf8');
    return true;
  } catch (err) {
    logger.error(`[Run Report] Could not write GitHub step summary: ${err.message}`);
    return false;
  }
}

/**
 * Queries `public.books` for the next batch of candidate volumes to populate with quotes
 * using a Zero-Timeout Index-Aligned ID-First query sequence (<15ms total):
 * 1. Fetches `quotedIds` via `idx_books_with_quotes_popular` (`<2ms`).
 * 2. Scans Tier 1 (`Top 500 Popular`) via `idx_books_download_count` without `content`/`quotes`/GIN filters (`<5ms`).
 * 3. Scans Tier 2 (`Rolling 64 Most Recent`) via Primary Key `books_pkey (id DESC)` without `content`/`quotes`/GIN filters (`<2ms`).
 * 4. Hydrates `quotes` and `content` ONLY for the `<= 25` selected batch IDs via `.in('id', selectedIds)` (`<3ms`).
 */
async function fetchCandidateBooksFromSupabase(supabase, options) {
  if (!supabase) {
    if (options.ids && options.ids.length > 0) {
      return options.ids.slice(0, options.limit).map((id) => ({
        id,
        title: `Gutenberg Volume #${id}`,
        authors: [],
        quotes: [],
        content: null,
      }));
    }
    return [];
  }

  if (options.ids && options.ids.length > 0) {
    const requestedIds = options.ids.slice(0, options.limit);
    const { data, error } = await supabase
      .from('books')
      .select('id, title, authors, translators, subjects, languages, quotes, content, download_count')
      .in('id', requestedIds);
    if (error) throw new Error(error.message);
    const byId = new Map((data || []).map((row) => [row.id, row]));
    options._missingIds = requestedIds.filter((id) => !byId.has(id));
    await resolveManualRunTiers(supabase, options, requestedIds);
    return requestedIds.filter((id) => byId.has(id)).map((id) => byId.get(id));
  }

  const { popularData, recentData, allScannedIds, minRecentHorizonId } = await scanTwoTierPools(
    supabase,
    options
  );

  const quotedIds = await fetchQuotedBookIds(supabase, allScannedIds);

  const { candidates, popularPoolIds, recentPoolIds, allowedPoolIds, candidateTiers } =
    blendTwoTierCandidates(popularData, recentData, { ...options, quotedIds });
  options._popularPoolIds = popularPoolIds;
  options._recentPoolIds = recentPoolIds;
  options._minRecentHorizonId = minRecentHorizonId;
  options._allowedPoolIds = allowedPoolIds;
  options._quotedIds = quotedIds;
  options._candidateTiers = candidateTiers;
  options._scannedPoolIds = Array.from(allScannedIds);

  if (candidates.length > 0) {
    const candidateIds = candidates.map((c) => c.id);
    const detailQuery = supabase.from('books').select('id, quotes, content');
    if (detailQuery && typeof detailQuery.in === 'function') {
      const { data: details, error: detailErr } = await detailQuery.in('id', candidateIds);
      if (detailErr) throw new Error(detailErr.message);
      if (Array.isArray(details) && details.length > 0) {
        const detailMap = new Map(details.map((d) => [d.id, d]));
        for (const cand of candidates) {
          const d = detailMap.get(cand.id);
          if (d) {
            if (d.quotes !== undefined) cand.quotes = d.quotes;
            if (d.content !== undefined) cand.content = d.content;
          }
        }
      }
    }
  }

  return candidates;
}

/**
 * Executes the featured quotes sync pipeline with per-mirror worker pool & schedule gate.
 */
async function runFeaturedQuotesSync(customOptions = {}, deps = {}) {
  const env = deps.env || loadEnv();
  const options = { ...parseCliArgs([]), ...customOptions };
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const fetchFn = deps.fetchFn || globalThis.fetch;
  const sleepFn =
    deps.sleepFn || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const logger = deps.logger || console;

  const supabase =
    deps.supabaseClient ||
    (!options.dryRun && supabaseUrl && supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false },
        })
      : null);

  if (!options.dryRun && !supabase) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Use --dry-run or configure credentials.'
    );
  }

  const summary = {
    processed: 0,
    updated: 0,
    skippedExisting: 0,
    skippedByScheduleGate: false,
    fromSupabaseContent: 0,
    fromMirrors: 0,
    sentinelMarked: 0,
    pruned: 0,
    failed: 0,
    mirrorBreakdown: {},
    sqlStatements: [],
    books: [],
    progress: null,
    report: '',
  };

  let scheduleGateElapsedHours = null;
  if (options.scheduleGate && supabase) {
    const gate = await evaluateScheduleGate(supabase, options, deps.nowMs);
    if (!gate.allowed) {
      summary.skippedByScheduleGate = true;
      logger.log(
        `[Schedule Gate] Last quote sync was ${gate.elapsedHours}h ago; next randomized window (${gate.requiredWindowHours}h) not reached yet. Exiting cleanly.`
      );
      return summary;
    }
    scheduleGateElapsedHours = gate.requiredWindowHours ?? 0;
  }

  const booksToProcess = await fetchCandidateBooksFromSupabase(supabase, options);
  const newlyQuotedIds = new Set();

  // Compute pre-batch pool totals and initial progress for live telemetry
  const topPoolIds = options._popularPoolIds instanceof Set ? options._popularPoolIds : new Set();
  const recentPoolIds = options._recentPoolIds instanceof Set ? options._recentPoolIds : new Set();
  const quotedIds = options._quotedIds instanceof Set ? options._quotedIds : new Set();

  const nonOverlappingRecentPoolIds = Array.from(recentPoolIds).filter((id) => !topPoolIds.has(id));

  let initialTopDone = 0;
  for (const id of topPoolIds) {
    if (quotedIds.has(id)) initialTopDone++;
  }
  let initialRecentDone = 0;
  for (const id of nonOverlappingRecentPoolIds) {
    if (quotedIds.has(id)) initialRecentDone++;
  }

  const topPoolSize = topPoolIds.size;
  const recentPoolSize = nonOverlappingRecentPoolIds.length;

  // Per-book ledger: tier provenance + position within its tier for this batch & total pool
  const candidateTiers = options._candidateTiers instanceof Map ? options._candidateTiers : new Map();
  const tierTotals = {};
  const bookPositions = new Map();
  booksToProcess.forEach((book, idx) => {
    const tier = candidateTiers.get(book.id) || 'manual';
    tierTotals[tier] = (tierTotals[tier] || 0) + 1;
    const batchPos = tierTotals[tier];

    let poolDone = 0;
    let poolTotal = 0;
    if (tier === 'top' && topPoolSize > 0) {
      poolTotal = topPoolSize;
      poolDone = Math.min(topPoolSize, initialTopDone + batchPos);
    } else if (tier === 'recent' && recentPoolSize > 0) {
      poolTotal = recentPoolSize;
      poolDone = Math.min(recentPoolSize, initialRecentDone + batchPos);
    }

    const poolPercent =
      poolTotal > 0 ? (Math.round((poolDone / poolTotal) * 1000) / 10).toFixed(1) : '0.0';

    bookPositions.set(book.id, {
      order: idx + 1,
      tier,
      pos: batchPos,
      poolDone,
      poolTotal,
      poolPercent,
    });
  });

  const bookPrefix = (bookId) => {
    const p = bookPositions.get(bookId);
    if (!p) return '[Manual]';
    const label = TIER_LABELS[p.tier] || p.tier;
    const batchTag = `${label} ${p.pos}/${tierTotals[p.tier]}`;
    if (!options._manualRun && p.poolTotal > 0) {
      return `[${batchTag} · Pool: ${p.poolDone}/${p.poolTotal} (${p.poolPercent}%)]`;
    }
    return `[${batchTag}]`;
  };

  if (!options._manualRun && topPoolSize > 0) {
    const banner = formatInitialPoolBanner({
      topPoolSize,
      topDone: initialTopDone,
      recentPoolSize,
      recentDone: initialRecentDone,
      batchTopCount: tierTotals['top'] || 0,
      batchRecentCount: tierTotals['recent'] || 0,
      totalBatchCount: booksToProcess.length,
    });
    logger.log(banner);
  }
  const recordBook = (book, fields) => {
    const p = bookPositions.get(book.id);
    summary.books.push({
      order: p ? p.order : booksToProcess.length + summary.books.length + 1,
      id: book.id,
      title: book.title || `Gutenberg Volume #${book.id}`,
      tier: p ? p.tier : candidateTiers.get(book.id) || 'manual',
      source: 'none',
      quoteCount: 0,
      existingQuoteCount: 0,
      ...fields,
    });
  };

  for (const missingId of options._missingIds || []) {
    logger.log(`[Not Found] #${missingId} is not in public.books — skipped.`);
    recordBook({ id: missingId, title: `Gutenberg Volume #${missingId}` }, { outcome: 'not-found' });
  }

  const shouldPrune = () => Boolean(options._popularPoolIds && supabase && !options._manualRun);

  const finalizeRun = () => {
    if (options._popularPoolIds instanceof Set) {
      summary.progress = computeTierProgress({
        popularPoolIds: options._popularPoolIds,
        recentPoolIds: options._recentPoolIds,
        quotedIds: options._quotedIds,
        newlyQuotedIds,
        limit: options.limit,
      });
    }
    summary.report = formatRunReport(summary, {
      dryRun: options.dryRun,
      tierResolutionError: options._tierResolutionError,
    });
    logger.log(summary.report);
    writeStepSummary(deps.stepSummaryPath, summary.report, logger);
    return summary;
  };

  if (booksToProcess.length === 0) {
    if (shouldPrune()) {
      const pruneRes = await pruneOutOfWindowBookQuotes(
        supabase,
        options._popularPoolIds,
        { ...options, newlyQuotedIds },
        logger
      );
      summary.pruned = pruneRes.prunedCount;
    }
    logger.log(
      options._manualRun
        ? 'None of the requested IDs exist in public.books — nothing to sync.'
        : 'All eligible books in the Two-Tier pool already have quotes — nothing to sync.'
    );
    return finalizeRun();
  }

  if (options.scheduleGate && supabase) {
    const jitterMs = computeRandomDelayMs(5, 35, deps.rng);
    logger.log(
      `[Schedule Gate] Randomized window (${scheduleGateElapsedHours}h) elapsed. Applying ${(
        jitterMs / 1000
      ).toFixed(2)}s startup jitter...`
    );
    await sleepFn(jitterMs);
  }

  async function saveQuotesToDatabase(book, quotesPayload) {
    summary.sqlStatements.push(buildSqlQuoteSeedStatement(book.id, quotesPayload));
    newlyQuotedIds.add(book.id);
    if (!options.dryRun && supabase) {
      const { error: updateErr } = await supabase
        .from('books')
        .update({
          quotes: quotesPayload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', book.id);
      if (updateErr) throw new Error(updateErr.message);
    }
  }

  async function persistExtractedBookQuotes(book, existingQuotes, rawText, source) {
    const extracted = extractBookQuoteSpreads(rawText, book, options.targetCount);
    const mergedQuotes = mergeDistinctQuoteSpreads(existingQuotes, extracted, 16);
    const sourceLabel = describeQuoteSource(source);

    if (mergedQuotes.length === 0) {
      const sentinel = [buildSentinelQuoteSpread(book)];
      await saveQuotesToDatabase(book, sentinel);
      summary.sentinelMarked++;
      recordBook(book, {
        outcome: 'no-quotes',
        source,
        existingQuoteCount: existingQuotes.length,
      });
      logger.log(
        `${bookPrefix(book.id)} #${book.id} "${book.title}": no quotes extractable, placeholder saved (source: ${sourceLabel}).`
      );
      return false;
    }

    await saveQuotesToDatabase(book, mergedQuotes);
    summary.updated++;
    const isRefresh = Boolean(options.force) && existingQuotes.length > 0;
    recordBook(book, {
      outcome: isRefresh ? 'refreshed' : 'updated',
      source,
      quoteCount: mergedQuotes.length,
      existingQuoteCount: existingQuotes.length,
    });
    const detail = isRefresh
      ? `refreshed ${existingQuotes.length} → ${mergedQuotes.length} quotes (force)`
      : existingQuotes.length > 0
        ? `topped up ${existingQuotes.length} → ${mergedQuotes.length} quotes`
        : `${mergedQuotes.length} quotes saved`;
    logger.log(`${bookPrefix(book.id)} #${book.id} "${book.title}": ${detail} (source: ${sourceLabel}).`);
    return true;
  }

  const mirrorWorkQueue = [];

  for (const book of booksToProcess) {
    summary.processed++;
    try {
      const existingQuotes = Array.isArray(book.quotes) ? book.quotes : [];
      if (existingQuotes.length >= 10 && !options.force) {
        summary.skippedExisting++;
        recordBook(book, {
          outcome: 'already-quoted',
          source: 'stored',
          quoteCount: existingQuotes.length,
          existingQuoteCount: existingQuotes.length,
        });
        logger.log(
          `${bookPrefix(book.id)} #${book.id} "${book.title}": already has ${existingQuotes.length} quotes (stored), skipped.`
        );
        continue;
      }

      if (book.content && book.content.trim().length >= 500) {
        summary.fromSupabaseContent++;
        logger.log(`[Supabase Content] Using stored text for #${book.id} "${book.title}".`);
        await persistExtractedBookQuotes(book, existingQuotes, book.content, 'supabase-content');
      } else {
        mirrorWorkQueue.push({
          book,
          existingQuotes,
          attemptedMirrors: new Set(),
        });
      }
    } catch (err) {
      summary.failed++;
      recordBook(book, { outcome: 'failed', note: err.message });
      logger.error(`[Error] #${book.id} "${book.title}": ${err.message}`);
    }
  }

  if (mirrorWorkQueue.length > 0) {
    const mirrors = resolveSelectedMirrors(deps.mirrors || options.mirrors);
    const activeMirrors = new Set(mirrors);
    let inFlightCount = 0;
    const queueWaiters = [];
    const notifyQueueChange = () => {
      while (queueWaiters.length > 0) {
        const wake = queueWaiters.shift();
        wake();
      }
    };

    const runMirrorWorker = async (mirrorBaseUrl) => {
      let workerDownloads = 0;
      let consecutiveMirrorErrors = 0;

      while (activeMirrors.has(mirrorBaseUrl)) {
        const candidateIdx = mirrorWorkQueue.findIndex(
          (item) => !item.attemptedMirrors.has(mirrorBaseUrl)
        );
        if (candidateIdx === -1) {
          if (inFlightCount === 0) {
            break;
          }
          await new Promise((resolve) => queueWaiters.push(resolve));
          continue;
        }

        const [workItem] = mirrorWorkQueue.splice(candidateIdx, 1);
        workItem.attemptedMirrors.add(mirrorBaseUrl);
        inFlightCount++;

        if (workerDownloads > 0) {
          const delayMs = computeRandomDelayMs(
            options.minDelaySec,
            options.maxDelaySec,
            deps.rng
          );
          logger.log(
            `[Mirror Worker ${mirrorBaseUrl}] Sleeping ${(delayMs / 1000).toFixed(
              2
            )}s before fetching #${workItem.book.id}...`
          );
          await sleepFn(delayMs);
        }

        workerDownloads++;
        const fetchRes = await fetchBookTextFromSingleMirror(
          workItem.book.id,
          mirrorBaseUrl,
          fetchFn
        );

        if (fetchRes.ok) {
          consecutiveMirrorErrors = 0;
          summary.fromMirrors++;
          summary.mirrorBreakdown[mirrorBaseUrl] =
            (summary.mirrorBreakdown[mirrorBaseUrl] || 0) + 1;
          logger.log(
            `[Mirror Worker ${mirrorBaseUrl}] Downloaded #${workItem.book.id} "${workItem.book.title}" from ${fetchRes.mirrorUrl}.`
          );
          try {
            await persistExtractedBookQuotes(
              workItem.book,
              workItem.existingQuotes,
              fetchRes.text,
              mirrorBaseUrl
            );
          } catch (err) {
            summary.failed++;
            recordBook(workItem.book, { outcome: 'failed', source: mirrorBaseUrl, note: err.message });
            logger.error(
              `[Error] #${workItem.book.id} "${workItem.book.title}": ${err.message}`
            );
          }
          inFlightCount--;
          notifyQueueChange();
        } else {
          if (fetchRes.isMirrorLevelError) {
            consecutiveMirrorErrors++;
            logger.error(
              `[Mirror Worker ${mirrorBaseUrl}] Mirror error on #${workItem.book.id}: ${fetchRes.error}`
            );
            if (consecutiveMirrorErrors >= 2) {
              activeMirrors.delete(mirrorBaseUrl);
              logger.error(
                `[Mirror Worker ${mirrorBaseUrl}] Halting worker after ${consecutiveMirrorErrors} consecutive mirror errors.`
              );
            }
          }

          const remainingHealthyMirrors = Array.from(activeMirrors).filter(
            (m) => !workItem.attemptedMirrors.has(m)
          );
          if (remainingHealthyMirrors.length > 0) {
            mirrorWorkQueue.push(workItem);
          } else {
            if (!fetchRes.isMirrorLevelError) {
              try {
                await saveQuotesToDatabase(workItem.book, [
                  buildSentinelQuoteSpread(workItem.book),
                ]);
                summary.sentinelMarked++;
                recordBook(workItem.book, {
                  outcome: 'no-quotes',
                  existingQuoteCount: workItem.existingQuotes.length,
                  note: 'text not available on enabled mirrors',
                });
              } catch (err) {
                summary.failed++;
                recordBook(workItem.book, { outcome: 'failed', note: err.message });
              }
            } else {
              summary.failed++;
              recordBook(workItem.book, {
                outcome: 'failed',
                note: 'enabled mirrors unavailable',
              });
            }
            logger.error(
              `[Error] #${workItem.book.id} "${workItem.book.title}": Exhausted enabled PGLAF mirrors.`
            );
          }

          inFlightCount--;
          notifyQueueChange();

          if (fetchRes.isMirrorLevelError && activeMirrors.has(mirrorBaseUrl)) {
            await sleepFn(options.mirrorCooldownMs);
          }
        }
      }
    };

    await Promise.all(mirrors.map((mirrorUrl) => runMirrorWorker(mirrorUrl)));

    // Books left in the queue only when every enabled mirror worker halted
    for (const leftover of mirrorWorkQueue.splice(0)) {
      summary.failed++;
      recordBook(leftover.book, { outcome: 'failed', note: 'all enabled mirrors halted' });
      logger.error(
        `[Error] #${leftover.book.id} "${leftover.book.title}": All enabled mirror workers halted before this book was fetched.`
      );
    }
  }

  if (shouldPrune()) {
    const pruneRes = await pruneOutOfWindowBookQuotes(
      supabase,
      options._popularPoolIds,
      { ...options, newlyQuotedIds },
      logger
    );
    summary.pruned = pruneRes.prunedCount;
  }

  if (options.dryRun && summary.sqlStatements.length > 0 && deps.writeSeedFile !== false) {
    const seedPath = path.resolve(__dirname, '..', 'supabase', 'seed_quotes.sql');
    const header = [
      '-- Bookarium Idempotent Featured Quotes Seed (Generated by scripts/sync-featured-quotes.js --dry-run)',
      "ALTER TABLE public.books ADD COLUMN IF NOT EXISTS quotes JSONB NOT NULL DEFAULT '[]'::jsonb;",
      '',
      ...summary.sqlStatements,
      '',
    ].join('\n');
    fs.writeFileSync(seedPath, header, 'utf8');
  }

  return finalizeRun();
}

/* v8 ignore start */
if (require.main === module) {
  const cliOptions = parseCliArgs(process.argv.slice(2));
  runFeaturedQuotesSync(cliOptions, { stepSummaryPath: process.env.GITHUB_STEP_SUMMARY })
    .then((res) => {
      console.log(
        `Featured Quotes Sync complete: ${res.updated} updated, ${res.skippedExisting} skipped, ${res.sentinelMarked} sentinel-marked, ${res.pruned} pruned, ${res.failed} failed.`
      );
      process.exit(res.failed > 0 && res.updated === 0 && !res.skippedByScheduleGate ? 1 : 0);
    })
    .catch((err) => {
      console.error(`Fatal error in sync-featured-quotes: ${err.message}`);
      process.exit(1);
    });
}
/* v8 ignore stop */

module.exports = {
  USER_AGENT,
  MIRROR_SHORTCUT_MAP,
  GUTENBERG_MIRRORS,
  DEFAULT_POPULAR_POOL_SIZE,
  DEFAULT_RECENT_POOL_SIZE,
  DEFAULT_RECENT_BATCH_RATIO,
  MAX_BOOK_TEXT_BYTES,
  PRIORITY_HERO_BOOK_IDS,
  isAllowedPglafMirrorUrl,
  loadEnv,
  resolveSelectedMirrors,
  parseCliArgs,
  computeRandomDelayMs,
  computeScheduleWindowMs,
  evaluateScheduleGate,
  buildGutenbergPathDir,
  buildSingleMirrorCandidateUrls,
  buildMirrorCandidateUrls,
  fetchBookTextFromSingleMirror,
  fetchBookTextFromMirrors,
  stripBoilerplateAndSplitParagraphs,
  wrapCleanQuote,
  extractBookQuoteSpreads,
  buildSentinelQuoteSpread,
  mergeDistinctQuoteSpreads,
  buildSqlQuoteSeedStatement,
  fetchQuotedBookIds,
  blendTwoTierCandidates,
  pruneOutOfWindowBookQuotes,
  scanTwoTierPools,
  resolveManualRunTiers,
  computeTierProgress,
  formatInitialPoolBanner,
  formatRunReport,
  writeStepSummary,
  fetchCandidateBooksFromSupabase,
  runFeaturedQuotesSync,
};
