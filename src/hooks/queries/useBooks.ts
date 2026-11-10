import {
  useQuery,
  useQueryClient,
  keepPreviousData,
  QueryClient,
  QueryClientContext,
} from '@tanstack/react-query';
import React, { useEffect } from 'react';
import type { GutendexBook, GutendexResponse, BookPassage } from '@/types/book.types';
import { API_ENDPOINTS } from '@/config/api-endpoints';
import { FEATURED_HERO_BOOKS } from '@/config/featured-books';
import { LITERARY_QUOTES } from '@/config/literary-quotes';
import { useJurisdictionStore } from '@/stores/useJurisdictionStore';
import {
  isBookPublicDomainInJurisdiction,
  getJurisdictionRule,
  JURISDICTION_BASELINE_COUNTS,
} from '@/lib/copyright-engine';
import { createClient } from '@/lib/supabase/client';
import {
  isSupabaseConfigured,
  filterValidBookPassages,
  sortQuoteEnrichedBooksDeterministically,
} from '@/lib/catalog/supabase-provider';
import { useHasMounted } from '@/hooks/useHasMounted';

export interface UseBooksParams {
  ids?: string | number;
  search?: string;
  topic?: string;
  languages?: string;
  page?: number;
  copyright?: boolean;
  authorYearStart?: number;
  authorYearEnd?: number;
  sort?: 'popular' | 'descending' | 'ascending' | '';
  mimeType?: string;
  includeRestrictedMetadata?: boolean;
}

export interface UseBooksOptions {
  enabled?: boolean;
}

export async function fetchBooks(params: UseBooksParams = {}): Promise<GutendexResponse> {
  const searchParams = new URLSearchParams();

  // Always enforce upstream public domain clearance
  searchParams.set('copyright', 'false');

  if (params.includeRestrictedMetadata) {
    searchParams.set('include_restricted_metadata', 'true');
  }
  if (params.ids) {
    searchParams.set('ids', String(params.ids).trim());
  }
  if (params.search?.trim()) {
    searchParams.set('search', params.search.trim());
  }
  if (params.topic?.trim()) {
    searchParams.set('topic', params.topic.trim());
  }
  if (params.languages?.trim()) {
    searchParams.set('languages', params.languages.trim());
  }
  if (params.page && params.page > 1) {
    searchParams.set('page', String(params.page));
  }
  if (params.authorYearStart !== undefined) {
    searchParams.set('author_year_start', String(params.authorYearStart));
  }
  if (params.authorYearEnd !== undefined) {
    searchParams.set('author_year_end', String(params.authorYearEnd));
  }
  if (params.sort) {
    searchParams.set('sort', params.sort);
  }
  if (params.mimeType?.trim()) {
    searchParams.set('mime_type', params.mimeType.trim());
  }

  const isBrowser = typeof window !== 'undefined';

  // Strategy 1: Browser runtime - try internal Next.js API proxy with quick failover
  if (isBrowser) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const requestStartMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

      const internalUrl = `${API_ENDPOINTS.INTERNAL_API_BOOKS}?${searchParams.toString()}`;
      const res = await fetch(internalUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && (Array.isArray(data.results) || data.count !== undefined)) {
          const elapsedMs =
            (typeof performance !== 'undefined' ? performance.now() : Date.now()) - requestStartMs;
          return {
            ...data,
            latencyMs: Math.max(1, Math.round(elapsedMs)),
          };
        }
      }
    } catch {
      // Fall through to Strategy 2 (Direct client-side API fetch)
    }

    // Strategy 2: Direct Client Upstream Fetch (bypasses serverless datacenter IP blocks)
    const directUrl = `${API_ENDPOINTS.GUTENDEX_BASE_URL}/?${searchParams.toString()}`;
    const directStartMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let directRes: Response;
    try {
      directRes = await fetch(directUrl, {
        headers: { Accept: 'application/json' },
      });
    } catch (netErr: unknown) {
      const msg = netErr instanceof Error ? netErr.message : 'Network error';
      throw new Error(`Failed to fetch books: ${msg}`);
    }

    if (!directRes.ok) {
      throw new Error(`Failed to fetch books: ${directRes.statusText || directRes.status}`);
    }

    let data: GutendexResponse;
    try {
      data = await directRes.json();
    } catch {
      throw new Error('Failed to fetch books: Invalid JSON response from server');
    }
    const directElapsedMs =
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - directStartMs;

    const clientCountry = useJurisdictionStore.getState().getEffectiveCountry() || 'US';
    const jurisdictionRule = getJurisdictionRule(clientCountry);
    const originalResults = data.results || [];
    const filteredResults = params.includeRestrictedMetadata
      ? originalResults
      : originalResults.filter((b: GutendexBook) => {
          if (b.copyright !== true) {
            const evaluation = isBookPublicDomainInJurisdiction(b, clientCountry);
            return evaluation.isAllowed;
          }
          return false;
        });
    const totalFiltered = originalResults.length - filteredResults.length;

    const isUnfiltered =
      !params.search &&
      !params.topic &&
      !params.languages &&
      params.authorYearStart === undefined &&
      params.authorYearEnd === undefined &&
      !params.ids &&
      !params.mimeType;

    let adjustedCount: number;
    if (
      isUnfiltered &&
      jurisdictionRule !== 'US_PUBLIC_DOMAIN' &&
      JURISDICTION_BASELINE_COUNTS[jurisdictionRule]
    ) {
      adjustedCount = JURISDICTION_BASELINE_COUNTS[jurisdictionRule];
    } else if (data.count !== undefined) {
      adjustedCount = Math.max(0, data.count - totalFiltered);
    } else {
      adjustedCount = filteredResults.length;
    }

    return {
      ...data,
      results: filteredResults,
      count: adjustedCount,
      source: 'upstream',
      latencyMs: Math.max(1, Math.round(directElapsedMs)),
      clientCountry,
      jurisdictionRule,
      totalFiltered,
    };
  } else {
    // Server runtime: Direct fetch to Gutendex
    const directUrl = `${API_ENDPOINTS.GUTENDEX_BASE_URL}/?${searchParams.toString()}`;
    let res: Response;
    try {
      res = await fetch(directUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Bookarium/1.0 (Public Domain Library Reader)',
        },
      });
    } catch (netErr: unknown) {
      const msg = netErr instanceof Error ? netErr.message : 'Network error';
      throw new Error(`Failed to fetch books: ${msg}`);
    }
    if (!res.ok) {
      throw new Error(`Failed to fetch books: ${res.statusText || res.status}`);
    }
    let data: GutendexResponse;
    try {
      data = await res.json();
    } catch {
      throw new Error('Failed to fetch books: Invalid JSON response from server');
    }
    const filteredResults = params.includeRestrictedMetadata
      ? (data.results || [])
      : (data.results || []).filter((b: GutendexBook) => {
          if (b.copyright !== true) {
            const evaluation = isBookPublicDomainInJurisdiction(b, 'US');
            return evaluation.isAllowed;
          }
          return false;
        });
    return {
      ...data,
      results: filteredResults,
      count: data.count !== undefined ? data.count : filteredResults.length,
      source: 'upstream',
    };
  }
}

export function useBooks(params: UseBooksParams = {}, options: UseBooksOptions = {}) {
  return useQuery({
    queryKey: ['books', params],
    queryFn: () => fetchBooks(params),
    placeholderData: keepPreviousData, // Keep previous page data while new page is loading
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000,
    enabled: options.enabled ?? true,
  });
}

/**
 * Predictive Next-Page Prefetcher
 * Background prefetches page N+1 during browser idle time or on user hover for 0ms transitions.
 */
export function usePrefetchNextPage(params: UseBooksParams = {}, hasNextPage = true) {
  const queryClient = useQueryClient();
  const currentPage = params.page || 1;
  const {
    ids,
    search,
    topic,
    languages,
    copyright,
    authorYearStart,
    authorYearEnd,
    sort,
    mimeType,
    includeRestrictedMetadata,
  } = params;

  const nextParams = React.useMemo<UseBooksParams>(() => {
    const base: UseBooksParams = {};
    if (ids !== undefined) base.ids = ids;
    if (search !== undefined) base.search = search;
    if (topic !== undefined) base.topic = topic;
    if (languages !== undefined) base.languages = languages;
    if (copyright !== undefined) base.copyright = copyright;
    if (authorYearStart !== undefined) base.authorYearStart = authorYearStart;
    if (authorYearEnd !== undefined) base.authorYearEnd = authorYearEnd;
    if (sort !== undefined) base.sort = sort;
    if (mimeType !== undefined) base.mimeType = mimeType;
    if (includeRestrictedMetadata !== undefined) {
      base.includeRestrictedMetadata = includeRestrictedMetadata;
    }
    base.page = currentPage + 1;
    return base;
  }, [
    ids,
    search,
    topic,
    languages,
    copyright,
    authorYearStart,
    authorYearEnd,
    sort,
    mimeType,
    includeRestrictedMetadata,
    currentPage,
  ]);

  useEffect(() => {
    if (!hasNextPage || typeof window === 'undefined') return;

    // Use requestIdleCallback if available, or fallback to setTimeout
    const prefetch = () => {
      queryClient.prefetchQuery({
        queryKey: ['books', nextParams],
        queryFn: () => fetchBooks(nextParams),
        staleTime: 5 * 60 * 1000,
      });
    };

    const win = window as unknown as {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof win.requestIdleCallback === 'function' && typeof win.cancelIdleCallback === 'function') {
      const handle = win.requestIdleCallback(prefetch);
      return () => win.cancelIdleCallback?.(handle);
    } else {
      const timer = setTimeout(prefetch, 400);
      return () => clearTimeout(timer);
    }
  }, [queryClient, nextParams, hasNextPage]);

  // Return manual prefetch trigger (e.g. for onMouseEnter on Next button)
  return React.useCallback(() => {
    if (!hasNextPage) return;
    queryClient.prefetchQuery({
      queryKey: ['books', nextParams],
      queryFn: () => fetchBooks(nextParams),
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient, nextParams, hasNextPage]);
}

/**
 * Queries `public.books.quotes` from Supabase for a list of featured book IDs.
 * Fail-safe: returns `{}` if Supabase is unconfigured, offline, or pre-migration.
 */
export async function fetchFeaturedQuotesMap(
  bookIds: number[]
): Promise<Record<number, BookPassage[]>> {
  const uniqueIds = Array.from(
    new Set(bookIds.filter((id) => Number.isInteger(id) && id > 0))
  ).sort((a, b) => a - b);

  if (uniqueIds.length === 0) {
    return {};
  }

  const quotesMap: Record<number, BookPassage[]> = {};
  const cachedPool = readCachedQuoteEnrichedBooks(600)?.books;
  if (Array.isArray(cachedPool) && cachedPool.length > 0) {
    const cachedById = new Map<number, BookPassage[]>();
    for (const book of cachedPool) {
      const validPassages = filterValidBookPassages(book.quotes);
      if (validPassages.length > 0) {
        cachedById.set(book.id, validPassages);
      }
    }
    for (const id of uniqueIds) {
      const cachedPassages = cachedById.get(id);
      if (cachedPassages) {
        quotesMap[id] = cachedPassages;
      }
    }
  }

  const remainingIds = uniqueIds.filter((id) => (quotesMap[id]?.length ?? 0) < 3);
  if (remainingIds.length === 0 || !isSupabaseConfigured()) {
    return quotesMap;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return quotesMap;
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('books')
      .select('id, quotes')
      .in('id', remainingIds);

    if (error || !Array.isArray(data)) {
      return quotesMap;
    }

    for (const row of data) {
      if (row && typeof row.id === 'number') {
        const validPassages = filterValidBookPassages(row.quotes);
        if (validPassages.length > 0) {
          quotesMap[row.id] = validPassages;
        }
      }
    }
    return quotesMap;
  } catch {
    return quotesMap;
  }
}

export const QUOTE_ENRICHED_BOOKS_CACHE_KEY = 'bookarium-quote-enriched-books-v1' as const;

export function readCachedQuoteEnrichedBooks(
  limit: number = 600
): { books: GutendexBook[]; updatedAt: number; isFresh?: boolean } | undefined {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return undefined;
  }
  try {
    const raw = window.localStorage.getItem(QUOTE_ENRICHED_BOOKS_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { books?: unknown; updatedAt?: unknown };
    if (!Array.isArray(parsed?.books) || parsed.books.length === 0) {
      return undefined;
    }
    const validBooks = sortQuoteEnrichedBooksDeterministically(
      (parsed.books as GutendexBook[]).filter(
        (b) => b && typeof b.id === 'number' && typeof b.title === 'string'
      )
    ).slice(0, Math.max(1, Math.min(600, limit)));
    if (validBooks.length === 0) return undefined;
    const now = Date.now();
    const updatedAt = typeof parsed.updatedAt === 'number' ? parsed.updatedAt : now;
    return {
      books: validBooks,
      updatedAt,
      isFresh: typeof parsed.updatedAt === 'number' && now - parsed.updatedAt < 60 * 60 * 1000,
    };
  } catch {
    return undefined;
  }
}

export function writeCachedQuoteEnrichedBooks(books: GutendexBook[]): void {
  if (
    typeof window === 'undefined' ||
    typeof window.localStorage === 'undefined' ||
    !Array.isArray(books) ||
    books.length === 0
  ) {
    return;
  }
  try {
    window.localStorage.setItem(
      QUOTE_ENRICHED_BOOKS_CACHE_KEY,
      JSON.stringify({ updatedAt: Date.now(), books })
    );
  } catch {
    // Ignore storage quota or private-browsing write errors
  }
}

/**
 * Queries top popular quote-enriched books (`WHERE quotes <> '[]'::jsonb`) via the Edge-cached
 * `/api/books?pool=quotes` endpoint (with graceful fallback to direct client Supabase and localStorage).
 * Trims quote spreads to 2 passages per volume to safely respect the 5 MB browser localStorage quota.
 */
export async function fetchQuoteEnrichedBooks(limit: number = 600): Promise<GutendexBook[]> {
  const boundedLimit = Math.max(1, Math.min(600, limit));

  if (!isSupabaseConfigured()) {
    return [];
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return readCachedQuoteEnrichedBooks(boundedLimit)?.books ?? [];
  }

  // 1. Primary: Query the Edge-cached /api/books?pool=quotes endpoint (s-maxage=3600)
  try {
    const res = await fetch(`/api/books?pool=quotes&limit=${boundedLimit}`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const json = (await res.json()) as { results?: unknown };
      if (Array.isArray(json?.results) && json.results.length > 0) {
        const books: GutendexBook[] = [];
        for (const item of json.results) {
          if (item && typeof item === 'object' && typeof (item as GutendexBook).id === 'number') {
            const b = item as GutendexBook;
            const validPassages = filterValidBookPassages(b.quotes);
            if (validPassages.length > 0) {
              books.push({
                ...b,
                quotes: validPassages.slice(0, 2),
              });
            }
          }
        }
        const sortedBooks = sortQuoteEnrichedBooksDeterministically(books);
        if (sortedBooks.length > 0) {
          writeCachedQuoteEnrichedBooks(sortedBooks);
          return sortedBooks;
        }
      }
    }
  } catch {
    // Edge API unavailable or network glitch; gracefully fall through to client Supabase fallback
  }

  // 2. Secondary: Direct client Supabase fallback if Edge API is unreachable
  if (!isSupabaseConfigured()) {
    return readCachedQuoteEnrichedBooks(boundedLimit)?.books ?? [];
  }

  try {
    const supabase = createClient();
    const candidateIdSet = new Set<number>([
      ...FEATURED_HERO_BOOKS.map((b) => b.id),
      ...LITERARY_QUOTES.map((q) => q.bookId),
    ]);
    const idScanSpecs = [
      { col: 'download_count', scanLimit: 500 },
      { col: 'id', scanLimit: 64 },
    ] as const;

    const scanResults = await Promise.all(
      idScanSpecs.map(async (spec) => {
        const idSelect = supabase.from('books').select('id');
        if (idSelect && typeof idSelect.order === 'function') {
          const ordered = idSelect.order(spec.col, { ascending: false });
          if (ordered && typeof ordered.limit === 'function') {
            return ordered.limit(spec.scanLimit);
          }
        }
        return { data: null };
      })
    );

    for (const res of scanResults) {
      if (Array.isArray(res?.data)) {
        for (const row of res.data) {
          if (row && typeof row.id === 'number') {
            candidateIdSet.add(row.id);
          }
        }
      }
    }

    const baseSelect = supabase
      .from('books')
      .select(
        'id, title, authors, translators, subjects, bookshelves, languages, copyright, download_count, quotes'
      );
    const scopedSelect =
      baseSelect && typeof baseSelect.in === 'function'
        ? baseSelect.in('id', Array.from(candidateIdSet))
        : baseSelect;

    const { data, error } = await scopedSelect
      .neq('quotes', '[]')
      .order('download_count', { ascending: false })
      .limit(boundedLimit);

    if (error || !Array.isArray(data)) {
      return readCachedQuoteEnrichedBooks(boundedLimit)?.books ?? [];
    }

    const books: GutendexBook[] = [];
    for (const row of data) {
      if (!row || typeof row.id !== 'number' || typeof row.title !== 'string') continue;
      const validPassages = filterValidBookPassages(row.quotes);
      if (validPassages.length === 0) continue;

      books.push({
        id: row.id,
        title: row.title,
        authors: Array.isArray(row.authors)
          ? (row.authors as unknown as GutendexBook['authors'])
          : [],
        translators: Array.isArray(row.translators)
          ? (row.translators as unknown as GutendexBook['translators'])
          : [],
        subjects: Array.isArray(row.subjects) ? row.subjects : [],
        bookshelves: Array.isArray((row as { bookshelves?: string[] }).bookshelves)
          ? ((row as { bookshelves: string[] }).bookshelves)
          : [],
        languages: Array.isArray(row.languages) ? row.languages : ['en'],
        copyright: typeof row.copyright === 'boolean' ? row.copyright : false,
        media_type: 'Text',
        formats: {},
        download_count: typeof row.download_count === 'number' ? row.download_count : 0,
        quotes: validPassages.slice(0, 2),
      });
    }
    const sortedBooks = sortQuoteEnrichedBooksDeterministically(books);
    if (sortedBooks.length > 0) {
      writeCachedQuoteEnrichedBooks(sortedBooks);
    }
    return sortedBooks;
  } catch {
    return readCachedQuoteEnrichedBooks(boundedLimit)?.books ?? [];
  }
}

const fallbackFeaturedQuotesClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

/**
 * React Query hook fetching `public.books.quotes` (`10–16` passages per volume) from Supabase
 * with a 1-hour cache and zero-error fallback to local TypeScript fixtures.
 */
export function useFeaturedQuotes(bookIds: number[], options: UseBooksOptions = {}) {
  const contextClient = React.useContext(QueryClientContext);
  const normalizedIds = React.useMemo(
    () =>
      Array.from(new Set(bookIds.filter((id) => Number.isInteger(id) && id > 0))).sort(
        (a, b) => a - b
      ),
    [bookIds]
  );

  return useQuery(
    {
      queryKey: ['featured-quotes', normalizedIds],
      queryFn: () => fetchFeaturedQuotesMap(normalizedIds),
      staleTime: 60 * 60 * 1000, // 1 hour
      gcTime: 2 * 60 * 60 * 1000, // 2 hours
      enabled: (options.enabled ?? true) && normalizedIds.length > 0 && isSupabaseConfigured(),
    },
    contextClient ?? fallbackFeaturedQuotesClient
  );
}

/**
 * Upper bound (ms) a consumer waits for the quote pool before revealing its static fallback content,
 * so a hung network request can never keep quote areas hidden indefinitely.
 */
export const QUOTE_POOL_SETTLE_TIMEOUT_MS = 1500;

/**
 * React Query hook fetching all quote-enriched books (`quotes <> '[]'::jsonb`) from Supabase
 * ordered by popularity (`download_count DESC`) to dynamically expand the Hero, Editorial,
 * and Literary Quotes pools.
 *
 * Also exposes `isPoolSettled`: `true` once the pool the consumer should render is final
 * (warm cache, completed fetch, caller opt-out, unconfigured Supabase, or settle timeout). Consumers hold
 * quote content invisible until then so static fallback text is never swapped for database text in place.
 */
export function useQuoteEnrichedBooks(
  options: UseBooksOptions & { limit?: number } = {}
) {
  const contextClient = React.useContext(QueryClientContext);
  const limit = options.limit ?? 600;
  const isEnabled = options.enabled ?? true;
  const hasMounted = useHasMounted();
  const cached = React.useMemo(
    () => (hasMounted ? readCachedQuoteEnrichedBooks(limit) : undefined),
    [hasMounted, limit]
  );
  const isCacheFresh = Boolean(cached?.isFresh);
  const [hasTimedOut, setHasTimedOut] = React.useState(false);

  useEffect(() => {
    if (!hasMounted || !isEnabled) return;
    const timer = setTimeout(() => setHasTimedOut(true), QUOTE_POOL_SETTLE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [hasMounted, isEnabled]);

  const query = useQuery(
    {
      queryKey: ['quote-enriched-books', limit],
      queryFn: () => fetchQuoteEnrichedBooks(limit),
      staleTime: 60 * 60 * 1000, // 1 hour
      gcTime: 2 * 60 * 60 * 1000, // 2 hours
      enabled: isEnabled && hasMounted && isSupabaseConfigured() && !isCacheFresh,
    },
    contextClient ?? fallbackFeaturedQuotesClient
  );

  const hasCachedBooks = Boolean(cached?.books && cached.books.length > 0);
  const isPoolSettled =
    !isEnabled ||
    !isSupabaseConfigured() ||
    (hasMounted && (hasCachedBooks || query.isFetched || hasTimedOut));

  return React.useMemo(
    () => ({
      ...query,
      data: query.data && query.data.length > 0 ? query.data : cached?.books,
      isPoolSettled,
    }),
    [query, cached, isPoolSettled]
  );
}
