import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import type { GutendexBook, GutendexResponse } from '@/mocks/handlers';
import { API_ENDPOINTS } from '@/config/api-endpoints';

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
}

export interface UseBooksOptions {
  enabled?: boolean;
}

export async function fetchBooks(params: UseBooksParams = {}): Promise<GutendexResponse> {
  const searchParams = new URLSearchParams();

  // Only forward copyright if explicitly provided (rarely needed)
  if (params.copyright !== undefined) {
    searchParams.set('copyright', String(params.copyright));
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
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const internalUrl = `${API_ENDPOINTS.INTERNAL_API_BOOKS}?${searchParams.toString()}`;
      const res = await fetch(internalUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && (Array.isArray(data.results) || data.count !== undefined)) {
          return data;
        }
      }
    } catch {
      // Fall through to Strategy 2 (Direct client-side API fetch)
    }

    // Strategy 2: Direct Client Upstream Fetch (bypasses serverless datacenter IP blocks)
    const directUrl = `${API_ENDPOINTS.GUTENDEX_BASE_URL}/?${searchParams.toString()}`;
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

    const filteredResults = (data.results || []).filter((b: GutendexBook) => b.copyright !== true);
    return {
      ...data,
      results: filteredResults,
      count: data.count !== undefined ? data.count : filteredResults.length,
      source: 'upstream',
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
    const filteredResults = (data.results || []).filter((b: GutendexBook) => b.copyright !== true);
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

  useEffect(() => {
    if (!hasNextPage || typeof window === 'undefined') return;

    const nextParams: UseBooksParams = {
      ...params,
      page: currentPage + 1,
    };

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
  }, [queryClient, params, currentPage, hasNextPage]);

  // Return manual prefetch trigger (e.g. for onMouseEnter on Next button)
  return React.useCallback(() => {
    if (!hasNextPage) return;
    const nextParams: UseBooksParams = {
      ...params,
      page: currentPage + 1,
    };
    queryClient.prefetchQuery({
      queryKey: ['books', nextParams],
      queryFn: () => fetchBooks(nextParams),
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient, params, currentPage, hasNextPage]);
}
