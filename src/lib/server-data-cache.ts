/**
 * @module src/lib/server-data-cache
 * @scope Reusable Next.js App Router `unstable_cache` helper providing cross-isolate server Data Caching with safe fallback when executing outside Next.js request/cache runtimes.
 * @invariant Never catch or suppress upstream data/network errors thrown inside the cached callback so transient DB or R2 outages are never cached cleanly across revalidation windows; only fall back to direct execution when Next.js `incrementalCache` runtime store is absent.
 * @rationale Centralizing `unstable_cache` fallback handling prevents stale outage caching and avoids duplicating runtime guards across `/read/[id]` metadata lookups and dynamic `sitemap.xml` queries.
 * @adr ADR-016, ADR-086
 */

import { unstable_cache } from 'next/cache';

/**
 * Invokes a module-scoped `unstable_cache`-wrapped async function cleanly across both
 * Next.js Server runtimes and standalone Node/Vitest execution environments.
 */
export function createOptionalDataCache<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyParts: string[],
  options: { revalidate?: number | false; tags?: string[] }
): (...args: TArgs) => Promise<TResult> {
  const cachedInvoker = unstable_cache(fn, keyParts, options);

  return async (...args: TArgs): Promise<TResult> => {
    if (process.env.VITEST) {
      return fn(...args);
    }

    try {
      return await cachedInvoker(...args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/incrementalCache/i.test(message)) {
        return fn(...args);
      }
      throw error;
    }
  };
}
