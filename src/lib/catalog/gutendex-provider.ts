import type {
  ICatalogProvider,
  CatalogQueryOptions,
  CatalogQueryResult,
} from '@/types/catalog.types';
import { CatalogProviderError } from '@/types/catalog.types';
import type { GutendexBook, GutendexResponse } from '@/types/book.types';
import { API_ENDPOINTS } from '@/config/api-endpoints';
import {
  isBookPublicDomainInJurisdiction,
  getJurisdictionRule,
} from '@/lib/copyright-engine';

/**
 * Gutendex API Catalog Provider
 * Wraps upstream Project Gutenberg / Gutendex REST calls and applies in-memory
 * jurisdictional copyright filtering per Berne Convention and local statutes.
 */
export class GutendexCatalogProvider implements ICatalogProvider {
  public readonly name = 'gutendex' as const;

  public async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${API_ENDPOINTS.GUTENDEX_BASE_URL}/?ids=1`, {
        method: 'HEAD',
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async searchBooks(options: CatalogQueryOptions): Promise<CatalogQueryResult> {
    const startTime = Date.now();
    const gutendexParams = new URLSearchParams();

    // Strictly enforce upstream US copyright clearance
    gutendexParams.set('copyright', 'false');

    if (options.ids) {
      gutendexParams.set('ids', options.ids.trim());
    }
    if (options.search && options.search.length >= 2) {
      gutendexParams.set('search', options.search);
    }
    if (options.topic) {
      gutendexParams.set('topic', options.topic);
    }
    if (options.languages && options.languages.length > 0) {
      gutendexParams.set('languages', options.languages.join(','));
    }
    if (options.page && options.page > 1) {
      gutendexParams.set('page', String(options.page));
    }
    if (options.authorYearStart !== undefined) {
      gutendexParams.set('author_year_start', String(options.authorYearStart));
    }
    if (options.authorYearEnd !== undefined) {
      gutendexParams.set('author_year_end', String(options.authorYearEnd));
    }
    if (options.sort) {
      gutendexParams.set('sort', options.sort);
    }
    if (options.mimeType) {
      gutendexParams.set('mime_type', options.mimeType);
    }

    const apiUrl = `${API_ENDPOINTS.GUTENDEX_BASE_URL}/?${gutendexParams.toString()}`;
    const country = options.country;
    const jurisdictionRule = getJurisdictionRule(country);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for deep Gutenberg offset queries

      const response = await fetch(apiUrl, {
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          'User-Agent': 'Bookarium/1.0 (Public Domain Library Reader)',
        },
        signal: controller.signal,
        next: { revalidate: 3600 },
      });

      clearTimeout(timeoutId);

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        throw new CatalogProviderError(
          `Upstream Gutenberg API error: ${response.statusText || response.status}`,
          response.status,
          'upstream'
        );
      }

      let data: GutendexResponse;
      try {
        data = await response.json();
      } catch {
        throw new CatalogProviderError(
          'Invalid JSON response from upstream Gutenberg API',
          502,
          'upstream'
        );
      }

      // Apply strict jurisdictional copyright filtering unless includeRestrictedMetadata is requested
      const originalResults = data.results || [];
      const filteredResults = options.includeRestrictedMetadata
        ? originalResults
        : originalResults.filter((b: GutendexBook) => {
            const evaluation = isBookPublicDomainInJurisdiction(b, country);
            return evaluation.isAllowed;
          });

      const totalFiltered = originalResults.length - filteredResults.length;
      const adjustedCount =
        data.count !== undefined
          ? Math.max(0, data.count - totalFiltered)
          : filteredResults.length;

      return {
        ...data,
        results: filteredResults,
        count: adjustedCount,
        source: 'upstream',
        latencyMs,
        clientCountry: country,
        jurisdictionRule,
        totalFiltered,
      };
    } catch (err: unknown) {
      if (err instanceof CatalogProviderError) {
        throw err;
      }
      const isTimeout =
        err instanceof Error &&
        (err.name === 'AbortError' || err.name === 'TimeoutError');
      const statusCode = isTimeout ? 504 : 502;
      const message = isTimeout
        ? 'Gutenberg API request timed out'
        : 'Unable to connect to Gutenberg API';

      throw new CatalogProviderError(message, statusCode, 'upstream');
    }
  }
}

export const gutendexProvider = new GutendexCatalogProvider();

