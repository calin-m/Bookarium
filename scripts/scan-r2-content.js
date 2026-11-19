/**
 * @module scripts/scan-r2-content
 * @scope Zero-dependency read-only Cloudflare R2 content integrity scanner listing `books/<id>.txt.gz` objects via AWS SigV4 `ListObjectsV2` (or targeted `--ids`) and scanning gunzipped payloads for unwanted or injected terms (`asiafilm` default) without touching Vercel, Supabase, or Project Gutenberg mirrors.
 * @invariant Enforce `assertValidR2ConfigIfPresent` (clean `exit 0` skip when all 4 `R2_*` vars are unset, fail-fast on partial or malformed configs), lock key scope to `ALLOWED_SCAN_PREFIXES` (`books/`), match terms strictly via literal `String.prototype.indexOf` (`CWE-1333` ReDoS-safe, never `new RegExp()` on CLI input), cap concurrent `GetObject` streams (`MAX_SCAN_CONCURRENCY = 64`), enforce `MAX_R2_BOOK_BYTES` (`15 MB`) bounded gzip reads via `scripts/lib/r2-sigv4.js`, and sanitize output snippets in `$GITHUB_STEP_SUMMARY`.
 * @rationale Scanning directly against private Cloudflare R2 via zero-dependency Node 22 built-ins eliminates `npm ci` workflow overhead, incurs zero R2 egress, consumes `< 0.8%` of the monthly Class B free quota across 78k books (`0` under `--dry-run`), and isolates audit runs completely from production Next.js and PostgreSQL compute.
 * @adr ADR-083, ADR-085
 */

const fs = require('fs');
const {
  MAX_R2_BOOK_BYTES,
  R2_DEFAULT_TIMEOUT_MS,
  loadEnv,
  assertValidR2ConfigIfPresent,
  listR2PrefixKeys,
  fetchR2GzippedText,
  runWithConcurrency,
  escapeMarkdownCell,
  appendStepSummary,
} = require('./lib/r2-sigv4');

const DEFAULT_SCAN_TERMS = ['asiafilm'];
const DEFAULT_SCAN_PREFIX = 'books/';
const ALLOWED_SCAN_PREFIXES = new Set(['books/']);
const DEFAULT_SCAN_CONCURRENCY = 32;
const MAX_SCAN_CONCURRENCY = 64;
const DEFAULT_MAX_MATCHES = 100;
const MAX_REPORTED_MATCHES = 500;
const DEFAULT_SCAN_MAX_MINUTES = 45;
const MAX_SCAN_MINUTES = 120;
const MAX_SCAN_TERMS = 20;
const MAX_SCAN_TERM_LENGTH = 120;
const SCAN_MIN_ATTEMPTS_FOR_RATIO_FAIL = 5;
const SCAN_MAX_FAILURE_RATIO = 0.5;
const BOOK_TEXT_KEY_REGEX = /^books\/(\d+)\.txt\.gz$/;
const SNIPPET_RADIUS_CHARS = 28;

function extractBookIdFromKey(key) {
  const match = String(key || '').match(BOOK_TEXT_KEY_REGEX);
  if (!match || !match[1]) return null;
  const parsed = parseInt(match[1], 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeScanTerms(rawTerms) {
  const parts = String(rawTerms || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    throw new Error('At least one non-empty search term is required (--terms=...).');
  }
  if (parts.length > MAX_SCAN_TERMS) {
    throw new Error(`Too many search terms (${parts.length}). Maximum supported is ${MAX_SCAN_TERMS}.`);
  }

  const deduped = [];
  const seen = new Set();
  for (const term of parts) {
    if (term.length > MAX_SCAN_TERM_LENGTH) {
      throw new Error(`Search term exceeds ${MAX_SCAN_TERM_LENGTH} characters.`);
    }
    if (!seen.has(term)) {
      seen.add(term);
      deduped.push(term);
    }
  }
  return deduped;
}

function parsePositiveIntInRange(rawValue, flagName, min, max) {
  const trimmed = String(rawValue || '').trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${flagName} must be an integer between ${min} and ${max}.`);
  }
  const value = parseInt(trimmed, 10);
  if (value < min || value > max) {
    throw new Error(`${flagName} must be between ${min} and ${max}.`);
  }
  return value;
}

function parseScanCliArgs(argv = []) {
  const options = {
    terms: [...DEFAULT_SCAN_TERMS],
    prefix: DEFAULT_SCAN_PREFIX,
    ids: [],
    concurrency: DEFAULT_SCAN_CONCURRENCY,
    limit: null,
    maxMatches: DEFAULT_MAX_MATCHES,
    maxMinutes: DEFAULT_SCAN_MAX_MINUTES,
    caseSensitive: false,
    failOnMatch: false,
    dryRun: false,
    json: false,
  };

  for (const arg of argv) {
    if (arg.startsWith('--terms=') || arg.startsWith('--term=')) {
      const val = arg.slice(arg.indexOf('=') + 1);
      options.terms = normalizeScanTerms(val);
    } else if (arg.startsWith('--prefix=')) {
      const rawPrefix = arg.slice('--prefix='.length).trim();
      const normalizedPrefix = rawPrefix.endsWith('/') ? rawPrefix : `${rawPrefix}/`;
      if (!ALLOWED_SCAN_PREFIXES.has(normalizedPrefix)) {
        throw new Error(`Unsupported R2 scan prefix "${rawPrefix}". Allowed: books/.`);
      }
      options.prefix = normalizedPrefix;
    } else if (arg.startsWith('--ids=')) {
      const rawIds = arg.slice('--ids='.length);
      const seen = new Set();
      const ids = [];
      for (const part of rawIds.split(',')) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        if (!/^\d+$/.test(trimmed)) {
          throw new Error(`Invalid book ID "${trimmed}" in --ids=.`);
        }
        const id = parseInt(trimmed, 10);
        if (id <= 0) {
          throw new Error(`Invalid non-positive book ID "${trimmed}" in --ids=.`);
        }
        if (!seen.has(id)) {
          seen.add(id);
          ids.push(id);
        }
      }
      options.ids = ids;
    } else if (arg.startsWith('--concurrency=')) {
      options.concurrency = parsePositiveIntInRange(
        arg.slice('--concurrency='.length),
        '--concurrency',
        1,
        MAX_SCAN_CONCURRENCY
      );
    } else if (arg.startsWith('--limit=')) {
      options.limit = parsePositiveIntInRange(
        arg.slice('--limit='.length),
        '--limit',
        1,
        1_000_000
      );
    } else if (arg.startsWith('--max-matches=')) {
      options.maxMatches = parsePositiveIntInRange(
        arg.slice('--max-matches='.length),
        '--max-matches',
        1,
        MAX_REPORTED_MATCHES
      );
    } else if (arg.startsWith('--max-minutes=')) {
      options.maxMinutes = parsePositiveIntInRange(
        arg.slice('--max-minutes='.length),
        '--max-minutes',
        1,
        MAX_SCAN_MINUTES
      );
    } else if (arg === '--case-sensitive') {
      options.caseSensitive = true;
    } else if (arg === '--fail-on-match') {
      options.failOnMatch = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown CLI flag: ${arg}`);
    }
  }

  return options;
}

function sanitizeMatchSnippet(text, matchIndex, needleLength) {
  const source = String(text || '');
  const start = Math.max(0, matchIndex - SNIPPET_RADIUS_CHARS);
  const end = Math.min(source.length, matchIndex + needleLength + SNIPPET_RADIUS_CHARS);
  const rawSlice = source.slice(start, end);
  // Collapse control characters cleanly before logging or inserting into Markdown tables.
  let withoutControls = '';
  for (let i = 0; i < rawSlice.length; i++) {
    const code = rawSlice.charCodeAt(i);
    withoutControls += code < 32 || code === 127 ? ' ' : rawSlice[i];
  }
  const cleaned = withoutControls.replace(/\s+/g, ' ').trim();
  const prefix = start > 0 ? '...' : '';
  const suffix = end < source.length ? '...' : '';
  return `${prefix}${cleaned}${suffix}`;
}

function scanTextForTerms(text, terms = DEFAULT_SCAN_TERMS, options = {}) {
  const source = String(text || '');
  const caseSensitive = Boolean(options.caseSensitive);
  const haystack = caseSensitive ? source : source.toLowerCase();

  let totalHits = 0;
  let firstMatchIndex = -1;
  let firstNeedleLength = 0;
  const termCounts = {};
  const matchedTerms = [];

  for (const term of terms) {
    const needle = caseSensitive ? term : term.toLowerCase();
    if (!needle) continue;
    let count = 0;
    let searchFrom = 0;
    while (searchFrom < haystack.length) {
      const idx = haystack.indexOf(needle, searchFrom);
      if (idx === -1) break;
      if (firstMatchIndex === -1 || idx < firstMatchIndex) {
        firstMatchIndex = idx;
        firstNeedleLength = needle.length;
      }
      count++;
      totalHits++;
      searchFrom = idx + needle.length;
    }
    if (count > 0) {
      termCounts[term] = count;
      matchedTerms.push(term);
    }
  }

  return {
    matched: totalHits > 0,
    totalHits,
    termCounts,
    matchedTerms,
    snippet:
      firstMatchIndex !== -1
        ? sanitizeMatchSnippet(source, firstMatchIndex, firstNeedleLength)
        : '',
  };
}

function shouldFailR2ScanRun(summary = {}, options = {}) {
  if (!summary || summary.skippedUnconfigured) return false;
  if (summary.dryRun) return false;

  const infraFailures = typeof summary.infraFailureCount === 'number' ? summary.infraFailureCount : 0;
  const attempted = typeof summary.scannedObjects === 'number' ? summary.scannedObjects : 0;
  const succeeded = typeof summary.readableObjects === 'number' ? summary.readableObjects : 0;

  if (attempted > 0 && succeeded === 0 && infraFailures > 0) {
    return true;
  }
  if (
    attempted >= SCAN_MIN_ATTEMPTS_FOR_RATIO_FAIL &&
    infraFailures / attempted >= SCAN_MAX_FAILURE_RATIO
  ) {
    return true;
  }
  if (options.failOnMatch && typeof summary.matchedCount === 'number' && summary.matchedCount > 0) {
    return true;
  }
  return false;
}

function formatR2ScanReport(summary, options = {}) {
  const maxDisplayedMatches = options.maxMatches || DEFAULT_MAX_MATCHES;
  const lines = [
    `## 🔍 Cloudflare R2 Content Integrity Scan${summary.dryRun ? ' (DRY RUN)' : ''}`,
    '',
    `- **Search Terms**: \`${summary.terms.join(', ')}\` (${summary.caseSensitive ? 'case-sensitive' : 'case-insensitive'})`,
    `- **Prefix / Scope**: ${summary.targetedIdsCount > 0 ? `${summary.targetedIdsCount} targeted ID(s)` : `\`${summary.prefix}\``}`,
    `- **Queued Objects**: **${summary.queuedCount.toLocaleString()}** (Discovered: ${summary.discoveredCount.toLocaleString()})`,
    `- **Scanned Objects**: **${summary.scannedObjects.toLocaleString()}** (${summary.readableObjects.toLocaleString()} readable · ${summary.notFoundCount.toLocaleString()} not found · ${summary.infraFailureCount.toLocaleString()} read errors)`,
    `- **Matches Found**: **${summary.matchedCount.toLocaleString()}** book(s) (${summary.totalHitCount.toLocaleString()} total term hit(s))`,
    `- **R2 Operations & Transfer**: **${summary.listApiCalls.toLocaleString()}** Class A (\`ListObjectsV2\`) · **${summary.getApiCalls.toLocaleString()}** Class B (\`GetObject\`) · **${(summary.bytesDownloaded / (1024 * 1024)).toFixed(2)} MB** compressed · **${summary.elapsedSeconds.toFixed(1)}s**`,
  ];

  if (summary.stoppedByBudget) {
    lines.push(
      `- **Budget Cutoff Reached**: Stopped cleanly at \`--max-minutes=${summary.maxMinutes}\` (${summary.scannedObjects}/${summary.queuedCount} scanned).`
    );
  }

  lines.push('');

  if (summary.matches.length > 0) {
    const shown = summary.matches.slice(0, maxDisplayedMatches);
    lines.push('### Matched Books', '');
    lines.push('| Book ID | R2 Key | Matched Terms | Hits | Context Snippet |');
    lines.push('| :--- | :--- | :--- | ---: | :--- |');
    for (const item of shown) {
      lines.push(
        `| ${item.bookId ?? '—'} | \`${escapeMarkdownCell(item.key)}\` | \`${escapeMarkdownCell(item.matchedTerms.join(', '))}\` | ${item.totalHits} | ${escapeMarkdownCell(item.snippet)} |`
      );
    }
    if (summary.matches.length > shown.length) {
      lines.push(
        '',
        `> Showing first **${shown.length}** of **${summary.matches.length}** matching books (\`max_matches=${maxDisplayedMatches}\`).`
      );
    }
    lines.push('');
  } else if (!summary.dryRun) {
    lines.push('✅ **No stored books matched the configured search terms.**', '');
  }

  if (summary.errors.length > 0) {
    const shownErrors = summary.errors.slice(0, 25);
    lines.push('### Read / Decompression Errors (Preview)', '');
    lines.push('| Book ID | R2 Key | Error |');
    lines.push('| :--- | :--- | :--- |');
    for (const errItem of shownErrors) {
      lines.push(
        `| ${errItem.bookId ?? '—'} | \`${escapeMarkdownCell(errItem.key)}\` | ${escapeMarkdownCell(errItem.error)} |`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatR2ScanConsoleSummary(summary) {
  if (summary.skippedUnconfigured) {
    return '⏭️  Cloudflare R2 credentials are not configured; skipping content scan cleanly.';
  }
  const header = `✔ Cloudflare R2 Content Scan Complete${summary.dryRun ? ' (DRY RUN)' : ''}!`;
  return [
    header,
    `  • Terms:    ${summary.terms.join(', ')} (${summary.caseSensitive ? 'case-sensitive' : 'case-insensitive'})`,
    `  • Scope:    ${summary.queuedCount.toLocaleString()} queued · ${summary.scannedObjects.toLocaleString()} scanned (${summary.readableObjects.toLocaleString()} readable, ${summary.notFoundCount.toLocaleString()} 404, ${summary.infraFailureCount.toLocaleString()} errors)`,
    `  • Matches:  ${summary.matchedCount.toLocaleString()} book(s) (${summary.totalHitCount.toLocaleString()} hits)`,
    `  • R2 Ops:   ${summary.listApiCalls.toLocaleString()} Class A · ${summary.getApiCalls.toLocaleString()} Class B · ${(summary.bytesDownloaded / (1024 * 1024)).toFixed(2)} MB · ${summary.elapsedSeconds.toFixed(1)}s`,
  ].join('\n');
}

async function runR2ContentScan(customOptions = {}, deps = {}) {
  const startMs = typeof deps.nowFn === 'function' ? deps.nowFn() : Date.now();
  const nowFn = deps.nowFn || Date.now;
  const env = deps.env || loadEnv();
  const fsImpl = deps.fsImpl || fs;
  const logger = deps.logger || console;
  const fetchFn = deps.fetchFn || globalThis.fetch;
  const stepSummaryPath =
    deps.stepSummaryPath !== undefined ? deps.stepSummaryPath : env.GITHUB_STEP_SUMMARY;

  const options = {
    ...parseScanCliArgs([]),
    ...customOptions,
  };

  const config = assertValidR2ConfigIfPresent(env);

  if (!config) {
    const skippedSummary = {
      skippedUnconfigured: true,
      dryRun: options.dryRun,
      terms: options.terms,
      caseSensitive: options.caseSensitive,
      prefix: options.prefix,
      targetedIdsCount: options.ids.length,
      discoveredCount: 0,
      queuedCount: 0,
      scannedObjects: 0,
      readableObjects: 0,
      notFoundCount: 0,
      infraFailureCount: 0,
      matchedCount: 0,
      totalHitCount: 0,
      listApiCalls: 0,
      getApiCalls: 0,
      bytesDownloaded: 0,
      elapsedSeconds: 0,
      stoppedByBudget: false,
      maxMinutes: options.maxMinutes,
      matches: [],
      errors: [],
    };
    logger.log(formatR2ScanConsoleSummary(skippedSummary));
    return skippedSummary;
  }

  let queuedObjects = [];
  let discoveredCount = 0;
  let listApiCalls = 0;

  if (options.ids.length > 0) {
    queuedObjects = options.ids.map((id) => ({
      key: `${options.prefix}${id}.txt.gz`,
      bookId: id,
      size: null,
    }));
    discoveredCount = queuedObjects.length;
  } else {
    const listed = await listR2PrefixKeys(config, options.prefix, {
      fetchFn,
      timeoutMs: deps.timeoutMs || R2_DEFAULT_TIMEOUT_MS,
      maxPages: deps.maxPages || 2000,
      maxMatched: options.limit || undefined,
      filterFn: (obj) => BOOK_TEXT_KEY_REGEX.test(obj.key),
    });
    listApiCalls = listed.apiCalls;
    discoveredCount = listed.objects.length;
    queuedObjects = (options.limit ? listed.objects.slice(0, options.limit) : listed.objects).map(
      (obj) => ({
        key: obj.key,
        bookId: extractBookIdFromKey(obj.key),
        size: obj.size || 0,
      })
    );
  }

  if (options.dryRun) {
    const drySummary = {
      skippedUnconfigured: false,
      dryRun: true,
      terms: options.terms,
      caseSensitive: options.caseSensitive,
      prefix: options.prefix,
      targetedIdsCount: options.ids.length,
      discoveredCount,
      queuedCount: queuedObjects.length,
      scannedObjects: 0,
      readableObjects: 0,
      notFoundCount: 0,
      infraFailureCount: 0,
      matchedCount: 0,
      totalHitCount: 0,
      listApiCalls,
      getApiCalls: 0,
      bytesDownloaded: 0,
      elapsedSeconds: (nowFn() - startMs) / 1000,
      stoppedByBudget: false,
      maxMinutes: options.maxMinutes,
      matches: [],
      errors: [],
    };
    const reportMd = formatR2ScanReport(drySummary, options);
    appendStepSummary(stepSummaryPath, `\n${reportMd}\n`, fsImpl);
    logger.log(
      options.json ? JSON.stringify(drySummary, null, 2) : formatR2ScanConsoleSummary(drySummary)
    );
    return drySummary;
  }

  const deadlineMs = startMs + options.maxMinutes * 60_000;
  let scannedObjects = 0;
  let readableObjects = 0;
  let notFoundCount = 0;
  let infraFailureCount = 0;
  let totalHitCount = 0;
  let getApiCalls = 0;
  let bytesDownloaded = 0;
  let stoppedByBudget = false;
  const matches = [];
  const errors = [];

  const tasks = queuedObjects.map((target) => async () => {
    if (nowFn() >= deadlineMs) {
      stoppedByBudget = true;
      return;
    }

    scannedObjects++;
    getApiCalls++;

    const res = await fetchR2GzippedText(config, target.key, {
      fetchFn,
      timeoutMs: deps.timeoutMs || R2_DEFAULT_TIMEOUT_MS,
      maxBytes: MAX_R2_BOOK_BYTES,
      rejectHtmlBody: false,
    });

    if (res.status === 'not_found') {
      notFoundCount++;
      return;
    }

    if (res.status !== 'ok') {
      infraFailureCount++;
      errors.push({
        bookId: target.bookId,
        key: target.key,
        error: res.error || 'Unknown R2 fetch error',
      });
      return;
    }

    readableObjects++;
    bytesDownloaded += res.compressedBytes || 0;

    const scanResult = scanTextForTerms(res.text, options.terms, {
      caseSensitive: options.caseSensitive,
    });
    if (scanResult.matched) {
      totalHitCount += scanResult.totalHits;
      matches.push({
        bookId: target.bookId,
        key: target.key,
        matchedTerms: scanResult.matchedTerms,
        termCounts: scanResult.termCounts,
        totalHits: scanResult.totalHits,
        snippet: scanResult.snippet,
      });
    }
  });

  await runWithConcurrency(tasks, options.concurrency);

  matches.sort((a, b) => (a.bookId || 0) - (b.bookId || 0) || a.key.localeCompare(b.key));

  const summary = {
    skippedUnconfigured: false,
    dryRun: false,
    terms: options.terms,
    caseSensitive: options.caseSensitive,
    prefix: options.prefix,
    targetedIdsCount: options.ids.length,
    discoveredCount,
    queuedCount: queuedObjects.length,
    scannedObjects,
    readableObjects,
    notFoundCount,
    infraFailureCount,
    matchedCount: matches.length,
    totalHitCount,
    listApiCalls,
    getApiCalls,
    bytesDownloaded,
    elapsedSeconds: (nowFn() - startMs) / 1000,
    stoppedByBudget,
    maxMinutes: options.maxMinutes,
    matches,
    errors,
  };

  const reportMd = formatR2ScanReport(summary, options);
  appendStepSummary(stepSummaryPath, `\n${reportMd}\n`, fsImpl);

  if (options.json) {
    logger.log(JSON.stringify(summary, null, 2));
  } else {
    logger.log(formatR2ScanConsoleSummary(summary));
    if (matches.length > 0) {
      const shown = matches.slice(0, options.maxMatches);
      logger.log('\nMatching Book IDs:');
      for (const m of shown) {
        logger.log(
          `  - [${m.bookId ?? 'N/A'}] ${m.key} (${m.totalHits} hit(s) for ${m.matchedTerms.join(', ')}) :: ${m.snippet}`
        );
      }
      if (matches.length > shown.length) {
        logger.log(`  ...and ${matches.length - shown.length} more (--max-matches=${options.maxMatches}).`);
      }
    }
  }

  return summary;
}

/* v8 ignore start */
if (require.main === module) {
  const cliOptions = parseScanCliArgs(process.argv.slice(2));
  runR2ContentScan(cliOptions)
    .then((summary) => {
      if (shouldFailR2ScanRun(summary, cliOptions)) {
        if (cliOptions.failOnMatch && summary.matchedCount > 0) {
          console.error(
            `R2 content scan matched ${summary.matchedCount} book(s) for [${summary.terms.join(', ')}] with --fail-on-match enabled.`
          );
        } else {
          console.error(
            `R2 content scan failed due to excessive read failures (${summary.infraFailureCount}/${summary.scannedObjects} failed).`
          );
        }
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error(`Fatal error in scan-r2-content: ${err.message}`);
      process.exit(1);
    });
}
/* v8 ignore stop */

module.exports = {
  DEFAULT_SCAN_TERMS,
  DEFAULT_SCAN_PREFIX,
  ALLOWED_SCAN_PREFIXES,
  DEFAULT_SCAN_CONCURRENCY,
  MAX_SCAN_CONCURRENCY,
  DEFAULT_MAX_MATCHES,
  MAX_REPORTED_MATCHES,
  DEFAULT_SCAN_MAX_MINUTES,
  MAX_SCAN_MINUTES,
  MAX_SCAN_TERMS,
  MAX_SCAN_TERM_LENGTH,
  SCAN_MIN_ATTEMPTS_FOR_RATIO_FAIL,
  SCAN_MAX_FAILURE_RATIO,
  BOOK_TEXT_KEY_REGEX,
  extractBookIdFromKey,
  normalizeScanTerms,
  parseScanCliArgs,
  sanitizeMatchSnippet,
  scanTextForTerms,
  shouldFailR2ScanRun,
  formatR2ScanReport,
  formatR2ScanConsoleSummary,
  runR2ContentScan,
};
