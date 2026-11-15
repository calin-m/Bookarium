import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const purgeCache = require('./purge-vercel-cache.js');

describe('purge-vercel-cache pipeline', () => {
  it('parses --tags, --target, --dry-run, and --max-retries flags with deduplication and validation', () => {
    expect(purgeCache.parsePurgeCliArgs([])).toEqual({
      tags: ['catalog', 'quotes', 'translations'],
      target: 'production',
      dryRun: false,
      maxRetries: 2,
    });

    expect(
      purgeCache.parsePurgeCliArgs([
        '--tags=quotes, translations, invalid tag!, quotes',
        '--target=preview',
        '--dry-run',
        '--max-retries=4',
      ])
    ).toEqual({
      tags: ['quotes', 'translations'],
      target: 'preview',
      dryRun: true,
      maxRetries: 4,
    });

    // Out-of-bounds target / retry count fall back cleanly to defaults
    expect(
      purgeCache.parsePurgeCliArgs(['--target=staging', '--max-retries=99'])
    ).toMatchObject({
      target: 'production',
      maxRetries: 2,
    });
  });

  it('constructs canonical dangerously-delete-by-tags URLs with optional teamId and rejects empty projectId', () => {
    expect(() => purgeCache.buildVercelCachePurgeUrl('')).toThrow(
      /VERCEL_PROJECT_ID is required/
    );

    expect(purgeCache.buildVercelCachePurgeUrl('prj_123abc')).toBe(
      'https://api.vercel.com/v1/edge-cache/dangerously-delete-by-tags?projectIdOrName=prj_123abc'
    );

    expect(purgeCache.buildVercelCachePurgeUrl('prj_123abc', 'team_456def')).toBe(
      'https://api.vercel.com/v1/edge-cache/dangerously-delete-by-tags?projectIdOrName=prj_123abc&teamId=team_456def'
    );
  });

  it('skips cleanly and writes step summary when Vercel credentials are unconfigured or --dry-run is active', async () => {
    const tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-purge-skip-'));
    const summaryPath = path.join(tmpDir, 'summary.md');
    const logger = { log: vi.fn(), error: vi.fn() };
    const fetchFn = vi.fn();

    try {
      const skippedRes = await purgeCache.purgeVercelEdgeCache(
        { tags: ['quotes'] },
        {
          env: {},
          fetchFn,
          logger,
          stepSummaryPath: summaryPath,
        }
      );

      expect(skippedRes).toEqual({
        purged: false,
        skipped: true,
        reason: 'not-configured',
        tags: ['quotes'],
        target: 'production',
        attempts: 0,
      });
      expect(fetchFn).not.toHaveBeenCalled();

      const dryRes = await purgeCache.purgeVercelEdgeCache(
        { tags: ['catalog', 'quotes'], dryRun: true, target: 'preview' },
        {
          env: {
            VERCEL_API_TOKEN: 'sample-bearer-secret-99',
            VERCEL_PROJECT_ID: 'prj_bookarium',
          },
          fetchFn,
          logger,
          stepSummaryPath: summaryPath,
        }
      );

      expect(dryRes).toMatchObject({
        purged: false,
        skipped: true,
        reason: 'dry-run',
        tags: ['catalog', 'quotes'],
        target: 'preview',
        attempts: 0,
      });
      expect(fetchFn).not.toHaveBeenCalled();

      const summaryContent = fs.readFileSync(summaryPath, 'utf8');
      expect(summaryContent).toContain('Skipped (Unconfigured)');
      expect(summaryContent).toContain('Dry Run (Skipped)');
      expect(summaryContent).toContain('`quotes`');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('sends authenticated POST requests to dangerously-delete-by-tags and retries transient 429/5xx errors', async () => {
    const tmpDir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-purge-ok-'));
    const summaryPath = path.join(tmpDir, 'summary.md');
    const logger = { log: vi.fn(), error: vi.fn() };
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: (k: string) => (k.toLowerCase() === 'retry-after' ? '2' : null) },
        text: async () => 'Too Many Requests',
      })
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

    try {
      const result = await purgeCache.purgeVercelEdgeCache(
        { tags: ['catalog', 'quotes', 'translations'], retryDelayMs: 10 },
        {
          env: {
            VERCEL_API_TOKEN: 'sample-bearer-secret-99',
            VERCEL_PROJECT_ID: 'prj_bookarium',
            VERCEL_TEAM_ID: 'team_hobby_scope',
          },
          fetchFn,
          sleepFn,
          logger,
          stepSummaryPath: summaryPath,
        }
      );

      expect(result).toEqual({
        purged: true,
        skipped: false,
        status: 200,
        tags: ['catalog', 'quotes', 'translations'],
        target: 'production',
        url: 'https://api.vercel.com/v1/edge-cache/dangerously-delete-by-tags?projectIdOrName=prj_bookarium&teamId=team_hobby_scope',
        attempts: 3,
      });

      expect(fetchFn).toHaveBeenCalledTimes(3);
      const [calledUrl, init] = fetchFn.mock.calls[0];
      expect(calledUrl).toBe(
        'https://api.vercel.com/v1/edge-cache/dangerously-delete-by-tags?projectIdOrName=prj_bookarium&teamId=team_hobby_scope'
      );
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('Bearer sample-bearer-secret-99');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(init.body)).toEqual({
        tags: ['catalog', 'quotes', 'translations'],
        target: 'production',
      });

      // Retry-After: 2s clamped to 2000ms on first retry, exponential 20ms on second
      expect(sleepFn).toHaveBeenNthCalledWith(1, 2000);
      expect(sleepFn).toHaveBeenNthCalledWith(2, 20);

      const summaryMd = fs.readFileSync(summaryPath, 'utf8');
      expect(summaryMd).toContain('| Status | Purged |');
      expect(summaryMd).toContain('HTTP 200 after 3 attempt(s).');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('fails fast on non-retryable 401/403/404 responses, validates empty tags, and logs step summary failures safely', async () => {
    await expect(
      purgeCache.purgeVercelEdgeCache({ tags: [] }, { env: {} })
    ).rejects.toThrow(/At least one valid cache tag must be specified/);

    const logger = { log: vi.fn(), error: vi.fn() };
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden project access',
    });

    await expect(
      purgeCache.purgeVercelEdgeCache(
        { tags: ['quotes'], maxRetries: 2, retryDelayMs: 0 },
        {
          env: {
            VERCEL_API_TOKEN: 'sample-bearer-secret-99',
            VERCEL_PROJECT_ID: 'prj_bookarium',
          },
          fetchFn,
          logger,
          stepSummaryPath: '/locked/summary.md',
          fsImpl: {
            appendFileSync: () => {
              throw new Error('EACCES');
            },
          },
        }
      )
    ).rejects.toThrow(/HTTP 403: Forbidden project access/);

    // Non-retryable 403 does not waste retries
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('[Edge Cache Purge] Failed: Vercel Edge Cache purge failed with HTTP 403')
    );
  });
});
