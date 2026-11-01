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
  'Bookarium/1.0 (+https://github.com/Synaptix1999/Bookarium; Public Domain Literary Sanctuary)';

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
    minIntervalHours: 6,
    maxIntervalHours: 12,
    limit: 25,
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
 * between [minHours, maxHours] (default 6.0h to 12.0h, with minutes & seconds)
 * seeded by the last batch's `updated_at` timestamp so stateless cron checks
 * agree on the exact target wakeup time without wasting GitHub runner minutes.
 */
function computeScheduleWindowMs(seedTimestampIso, minHours = 6, maxHours = 12) {
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
 * Evaluates whether the randomized 6.0h–12.0h float schedule window has elapsed
 * since the most recent quote update in `public.books`.
 */
async function evaluateScheduleGate(supabase, options, nowMs = Date.now()) {
  if (!options.scheduleGate || !supabase) {
    return { allowed: true, elapsedHours: null, requiredWindowHours: null };
  }

  const { data } = await supabase
    .from('books')
    .select('updated_at')
    .neq('quotes', '[]')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data || !data.updated_at) {
    return { allowed: true, elapsedHours: null, requiredWindowHours: null };
  }

  const lastUpdatedMs = Date.parse(data.updated_at);
  if (!Number.isFinite(lastUpdatedMs)) {
    return { allowed: true, elapsedHours: null, requiredWindowHours: null };
  }

  const requiredWindowMs = computeScheduleWindowMs(
    data.updated_at,
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
    try {
      const response = await fetchFn(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/plain,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(25000),
      });

      if (response && response.ok) {
        const text = await response.text();
        if (text && text.trim().length >= 500 && !/<!DOCTYPE html/i.test(text.slice(0, 300))) {
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
 * Queries `public.books` for the next batch of candidate volumes to populate with quotes.
 * - When `options.ids` is provided, fetches those specific IDs.
 * - Otherwise, queries `public.books` where `quotes = '[]'::jsonb`, `copyright = false`,
 *   `media_type = 'Text'`, and `languages @> ARRAY['en']`, ordered by `download_count DESC, id ASC`.
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
    const { data, error } = await supabase
      .from('books')
      .select('id, title, authors, translators, subjects, languages, quotes, content, download_count')
      .in('id', options.ids.slice(0, options.limit));
    if (error) throw new Error(error.message);
    const byId = new Map((data || []).map((row) => [row.id, row]));
    return options.ids.slice(0, options.limit).map(
      (id) =>
        byId.get(id) || {
          id,
          title: `Gutenberg Volume #${id}`,
          authors: [],
          quotes: [],
          content: null,
        }
    );
  }

  let query = supabase
    .from('books')
    .select('id, title, authors, translators, subjects, languages, quotes, content, download_count')
    .eq('copyright', false)
    .eq('media_type', 'Text')
    .contains('languages', ['en']);

  if (!options.force) {
    query = query.eq('quotes', '[]');
  }

  const { data, error } = await query
    .order('download_count', { ascending: false })
    .order('id', { ascending: true })
    .limit(options.limit);

  if (error) throw new Error(error.message);
  return data || [];
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
    failed: 0,
    mirrorBreakdown: {},
    sqlStatements: [],
  };

  if (options.scheduleGate && supabase) {
    const gate = await evaluateScheduleGate(supabase, options, deps.nowMs);
    if (!gate.allowed) {
      summary.skippedByScheduleGate = true;
      logger.log(
        `[Schedule Gate] Last quote sync was ${gate.elapsedHours}h ago; next randomized window (${gate.requiredWindowHours}h) not reached yet. Exiting cleanly.`
      );
      return summary;
    }
    const jitterMs = computeRandomDelayMs(5, 35, deps.rng);
    logger.log(
      `[Schedule Gate] Randomized window (${gate.requiredWindowHours ?? 0}h) elapsed. Applying ${(
        jitterMs / 1000
      ).toFixed(2)}s startup jitter...`
    );
    await sleepFn(jitterMs);
  }

  const booksToProcess = await fetchCandidateBooksFromSupabase(supabase, options);
  if (booksToProcess.length === 0) {
    logger.log('All eligible books in public.books already have quotes — nothing to sync.');
    return summary;
  }

  async function saveQuotesToDatabase(book, quotesPayload) {
    summary.sqlStatements.push(buildSqlQuoteSeedStatement(book.id, quotesPayload));
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

  async function persistExtractedBookQuotes(book, existingQuotes, rawText) {
    const extracted = extractBookQuoteSpreads(rawText, book, options.targetCount);
    const mergedQuotes = mergeDistinctQuoteSpreads(existingQuotes, extracted, 16);

    if (mergedQuotes.length === 0) {
      const sentinel = [buildSentinelQuoteSpread(book)];
      await saveQuotesToDatabase(book, sentinel);
      summary.sentinelMarked++;
      return false;
    }

    await saveQuotesToDatabase(book, mergedQuotes);
    summary.updated++;
    return true;
  }

  const mirrorWorkQueue = [];

  for (const book of booksToProcess) {
    summary.processed++;
    try {
      const existingQuotes = Array.isArray(book.quotes) ? book.quotes : [];
      if (existingQuotes.length >= 10 && !options.force) {
        summary.skippedExisting++;
        logger.log(
          `[Skip] #${book.id} "${book.title}" already has ${existingQuotes.length} quotes.`
        );
        continue;
      }

      if (book.content && book.content.trim().length >= 500) {
        summary.fromSupabaseContent++;
        logger.log(`[Supabase Content] Using stored text for #${book.id} "${book.title}".`);
        await persistExtractedBookQuotes(book, existingQuotes, book.content);
      } else {
        mirrorWorkQueue.push({
          book,
          existingQuotes,
          attemptedMirrors: new Set(),
        });
      }
    } catch (err) {
      summary.failed++;
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
              fetchRes.text
            );
          } catch (err) {
            summary.failed++;
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
              } catch {
                summary.failed++;
              }
            } else {
              summary.failed++;
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

  return summary;
}

/* v8 ignore start */
if (require.main === module) {
  const cliOptions = parseCliArgs(process.argv.slice(2));
  runFeaturedQuotesSync(cliOptions)
    .then((res) => {
      console.log(
        `Featured Quotes Sync complete: ${res.updated} updated, ${res.skippedExisting} skipped, ${res.sentinelMarked} sentinel-marked, ${res.failed} failed.`
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
  fetchCandidateBooksFromSupabase,
  runFeaturedQuotesSync,
};
