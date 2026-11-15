#!/usr/bin/env node

/**
 * Bookarium — Vercel Edge Cache Tag Purge Script
 *
 * Invalidates Vercel Edge CDN cached responses (`Vercel-Cache-Tag`: `catalog`, `quotes`,
 * `translations`) immediately after GitHub Actions catalog, quote, or translation syncs
 * finish writing to Supabase.
 *
 * Safe by default: if `VERCEL_API_TOKEN` or `VERCEL_PROJECT_ID` are not configured
 * (e.g. local runs or community forks), logs a skip notice and exits cleanly with status 0.
 */

const fs = require('fs');

const VERCEL_EDGE_CACHE_PURGE_ENDPOINT =
  'https://api.vercel.com/v1/edge-cache/dangerously-delete-by-tags';
const DEFAULT_CACHE_TAGS = ['catalog', 'quotes', 'translations'];
const DEFAULT_PURGE_TARGET = 'production';
const ALLOWED_PURGE_TARGETS = new Set(['production', 'preview']);
const VALID_TAG_REGEX = /^[a-z0-9][a-z0-9:_-]{0,63}$/i;

/**
 * Parses CLI flags (`--tags=a,b`, `--target=production|preview`, `--dry-run`, `--max-retries=N`).
 */
function parsePurgeCliArgs(argv = []) {
  const options = {
    tags: [...DEFAULT_CACHE_TAGS],
    target: DEFAULT_PURGE_TARGET,
    dryRun: false,
    maxRetries: 2,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--tags=')) {
      const rawTags = arg.slice('--tags='.length);
      const parsedTags = [];
      const seen = new Set();
      for (const part of rawTags.split(',')) {
        const tag = part.trim();
        if (tag && VALID_TAG_REGEX.test(tag) && !seen.has(tag)) {
          seen.add(tag);
          parsedTags.push(tag);
        }
      }
      options.tags = parsedTags;
    } else if (arg.startsWith('--target=')) {
      const targetVal = arg.slice('--target='.length).trim().toLowerCase();
      if (ALLOWED_PURGE_TARGETS.has(targetVal)) {
        options.target = targetVal;
      }
    } else if (arg.startsWith('--max-retries=')) {
      const retriesVal = parseInt(arg.slice('--max-retries='.length).trim(), 10);
      if (Number.isInteger(retriesVal) && retriesVal >= 0 && retriesVal <= 5) {
        options.maxRetries = retriesVal;
      }
    }
  }

  return options;
}

/**
 * Constructs the canonical Vercel Edge Cache tag-deletion URL with encoded query parameters.
 */
function buildVercelCachePurgeUrl(projectId, teamId = '') {
  const cleanProjectId = typeof projectId === 'string' ? projectId.trim() : '';
  if (!cleanProjectId) {
    throw new Error('VERCEL_PROJECT_ID is required to build Vercel Edge Cache purge URL.');
  }

  const url = new URL(VERCEL_EDGE_CACHE_PURGE_ENDPOINT);
  url.searchParams.set('projectIdOrName', cleanProjectId);

  const cleanTeamId = typeof teamId === 'string' ? teamId.trim() : '';
  if (cleanTeamId) {
    url.searchParams.set('teamId', cleanTeamId);
  }

  return url.toString();
}

/**
 * Best-effort append of the Edge Cache Purge status block to `$GITHUB_STEP_SUMMARY`.
 */
function appendPurgeStepSummary(filePath, markdown, logger = console, fsImpl = fs) {
  if (!filePath) return false;
  try {
    fsImpl.appendFileSync(filePath, `${markdown}\n`, 'utf8');
    return true;
  } catch (err) {
    logger.error(`[Edge Cache Purge] Could not write GitHub step summary: ${err.message}`);
    return false;
  }
}

function buildStepSummaryMarkdown({ statusLabel, tags, target, details }) {
  return [
    '### Vercel Edge Cache Purge',
    '',
    `| Field | Value |`,
    `|---|---|`,
    `| Status | ${statusLabel} |`,
    `| Tags | ${tags.map((t) => `\`${t}\``).join(', ')} |`,
    `| Target | \`${target}\` |`,
    `| Details | ${details} |`,
    '',
  ].join('\n');
}

function computeRetryDelayMs(response, attempt, baseRetryDelayMs) {
  if (baseRetryDelayMs <= 0) return 0;
  const retryAfterHeader =
    response && response.headers && typeof response.headers.get === 'function'
      ? response.headers.get('retry-after')
      : null;
  if (retryAfterHeader) {
    const retryAfterSec = parseFloat(retryAfterHeader);
    if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
      return Math.min(Math.max(Math.round(retryAfterSec * 1000), 100), 30_000);
    }
  }
  return baseRetryDelayMs * Math.pow(2, attempt);
}

/**
 * Purges matching `Vercel-Cache-Tag` entries on Vercel's Edge CDN using bounded retry/backoff
 * for transient `429` or `5xx` responses.
 */
async function purgeVercelEdgeCache(customOptions = {}, deps = {}) {
  const options = {
    tags: [...DEFAULT_CACHE_TAGS],
    target: DEFAULT_PURGE_TARGET,
    dryRun: false,
    maxRetries: 2,
    retryDelayMs: 1000,
    ...customOptions,
  };

  const tags = Array.isArray(options.tags)
    ? Array.from(
        new Set(
          options.tags
            .map((t) => String(t || '').trim())
            .filter((t) => VALID_TAG_REGEX.test(t))
        )
      )
    : [];

  if (tags.length === 0) {
    throw new Error('At least one valid cache tag must be specified for Vercel Edge cache purge.');
  }

  const target = ALLOWED_PURGE_TARGETS.has(options.target)
    ? options.target
    : DEFAULT_PURGE_TARGET;

  const env = deps.env || {
    VERCEL_API_TOKEN: process.env.VERCEL_API_TOKEN,
    VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID,
    VERCEL_TEAM_ID: process.env.VERCEL_TEAM_ID,
  };

  const token = typeof env.VERCEL_API_TOKEN === 'string' ? env.VERCEL_API_TOKEN.trim() : '';
  const projectId =
    typeof env.VERCEL_PROJECT_ID === 'string' ? env.VERCEL_PROJECT_ID.trim() : '';
  const teamId = typeof env.VERCEL_TEAM_ID === 'string' ? env.VERCEL_TEAM_ID.trim() : '';

  const fetchFn = deps.fetchFn || globalThis.fetch;
  const sleepFn =
    deps.sleepFn || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const logger = deps.logger || console;
  const fsImpl = deps.fsImpl || fs;
  const stepSummaryPath =
    deps.stepSummaryPath !== undefined ? deps.stepSummaryPath : process.env.GITHUB_STEP_SUMMARY;

  if (!token || !projectId) {
    const details =
      'VERCEL_API_TOKEN or VERCEL_PROJECT_ID not configured — skipped cleanly.';
    logger.log(`[Edge Cache Purge] Skipped — ${details}`);
    appendPurgeStepSummary(
      stepSummaryPath,
      buildStepSummaryMarkdown({
        statusLabel: 'Skipped (Unconfigured)',
        tags,
        target,
        details,
      }),
      logger,
      fsImpl
    );
    return {
      purged: false,
      skipped: true,
      reason: 'not-configured',
      tags,
      target,
      attempts: 0,
    };
  }

  const purgeUrl = buildVercelCachePurgeUrl(projectId, teamId);

  if (options.dryRun) {
    const details = `Dry run enabled — target URL prepared (${purgeUrl}).`;
    logger.log(
      `[Edge Cache Purge] Dry run — would purge tags [${tags.join(', ')}] on target "${target}".`
    );
    appendPurgeStepSummary(
      stepSummaryPath,
      buildStepSummaryMarkdown({
        statusLabel: 'Dry Run (Skipped)',
        tags,
        target,
        details,
      }),
      logger,
      fsImpl
    );
    return {
      purged: false,
      skipped: true,
      reason: 'dry-run',
      tags,
      target,
      url: purgeUrl,
      attempts: 0,
    };
  }

  if (typeof fetchFn !== 'function') {
    throw new Error('Global fetch API is unavailable in this Node.js runtime.');
  }

  const maxRetries =
    Number.isInteger(options.maxRetries) && options.maxRetries >= 0 ? options.maxRetries : 2;
  const baseRetryDelayMs =
    typeof options.retryDelayMs === 'number' && options.retryDelayMs >= 0
      ? options.retryDelayMs
      : 1000;

  let lastError = null;
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts = attempt + 1;
    let response = null;

    try {
      response = await fetchFn(purgeUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Bookarium-EdgeCache-Purge/1.0',
        },
        body: JSON.stringify({ tags, target }),
      });

      if (response && response.ok) {
        const details = `HTTP ${response.status} after ${attempts} attempt(s).`;
        logger.log(
          `[Edge Cache Purge] Purged tags [${tags.join(', ')}] on "${target}" (${details}).`
        );
        appendPurgeStepSummary(
          stepSummaryPath,
          buildStepSummaryMarkdown({
            statusLabel: 'Purged',
            tags,
            target,
            details,
          }),
          logger,
          fsImpl
        );
        return {
          purged: true,
          skipped: false,
          status: response.status,
          tags,
          target,
          url: purgeUrl,
          attempts,
        };
      }

      const status = response ? response.status : 0;
      let responseBody = '';
      if (response && typeof response.text === 'function') {
        try {
          responseBody = String(await response.text()).replace(/\s+/g, ' ').trim().slice(0, 300);
        } catch {
          responseBody = '';
        }
      }

      const isRetryableStatus = status === 429 || status >= 500;
      const errMsg = `Vercel Edge Cache purge failed with HTTP ${status}${responseBody ? `: ${responseBody}` : ''}`;
      lastError = new Error(errMsg);

      if (isRetryableStatus && attempt < maxRetries) {
        const delayMs = computeRetryDelayMs(response, attempt, baseRetryDelayMs);
        logger.log(
          `[Edge Cache Purge] Transient HTTP ${status} on attempt ${attempts}/${maxRetries + 1}; retrying in ${delayMs}ms...`
        );
        if (delayMs > 0) {
          await sleepFn(delayMs);
        }
        continue;
      }

      break;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const delayMs = baseRetryDelayMs > 0 ? baseRetryDelayMs * Math.pow(2, attempt) : 0;
        logger.log(
          `[Edge Cache Purge] Network error on attempt ${attempts}/${maxRetries + 1} (${lastError.message}); retrying in ${delayMs}ms...`
        );
        if (delayMs > 0) {
          await sleepFn(delayMs);
        }
        continue;
      }
      break;
    }
  }

  const failMessage = lastError ? lastError.message : 'Unknown Edge Cache purge failure';
  logger.error(`[Edge Cache Purge] Failed: ${failMessage}`);
  appendPurgeStepSummary(
    stepSummaryPath,
    buildStepSummaryMarkdown({
      statusLabel: 'Failed',
      tags,
      target,
      details: failMessage,
    }),
    logger,
    fsImpl
  );
  throw new Error(failMessage);
}

/* v8 ignore start */
if (require.main === module) {
  const cliOptions = parsePurgeCliArgs(process.argv.slice(2));
  purgeVercelEdgeCache(cliOptions)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`Fatal error in purge-vercel-cache: ${err.message}`);
      process.exit(1);
    });
}
/* v8 ignore stop */

module.exports = {
  VERCEL_EDGE_CACHE_PURGE_ENDPOINT,
  DEFAULT_CACHE_TAGS,
  DEFAULT_PURGE_TARGET,
  parsePurgeCliArgs,
  buildVercelCachePurgeUrl,
  appendPurgeStepSummary,
  purgeVercelEdgeCache,
};
