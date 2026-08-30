import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import type { GutendexResponse } from '@/mocks/handlers';

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

export async function fetchBooks(params: UseBooksParams = {}): Promise<GutendexResponse> {
  const searchParams = new URLSearchParams();

  // Enforce zero-copyright public domain filter
  searchParams.set('copyright', params.copyright !== undefined ? String(params.copyright) : 'false');

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

  // In browser runtime, route through internal Next.js API proxy to avoid CORS & timeouts
  const isBrowser = typeof window !== 'undefined';
  const url = isBrowser
    ? `/api/books?${searchParams.toString()}`
    : `https://gutendex.com/books?${searchParams.toString()}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch books: ${res.statusText}`);
  }

  return res.json();
}

export function useBooks(params: UseBooksParams = {}) {
  return useQuery({
    queryKey: ['books', params],
    queryFn: () => fetchBooks(params),
    placeholderData: keepPreviousData, // Keep previous page data while new page is loading
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000,
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

    if ('requestIdleCallback' in window) {
      const handle = (window as any).requestIdleCallback(prefetch);
      return () => (window as any).cancelIdleCallback(handle);
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
