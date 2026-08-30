import { useQuery } from '@tanstack/react-query';
import type { GutendexResponse } from '@/mocks/handlers';

export interface UseBooksParams {
  search?: string;
  topic?: string;
  languages?: string;
  page?: number;
  copyright?: boolean;
}

export async function fetchBooks(params: UseBooksParams = {}): Promise<GutendexResponse> {
  const searchParams = new URLSearchParams();

  // Enforce zero-copyright public domain filter
  searchParams.set('copyright', params.copyright !== undefined ? String(params.copyright) : 'false');

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

  const url = `https://gutendex.com/books?${searchParams.toString()}`;

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
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000,
  });
}

