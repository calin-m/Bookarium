'use client';

import { useMemo } from 'react';
import type { GutendexBook } from '@/types/book.types';
import { filterBooksSmart } from '@/lib/smart-search';

export interface UseOfflineCatalogFallbackParams {
  isOffline: boolean;
  resolvedOfflineBooks: GutendexBook[];
  search: string;
  topic: string;
  language: string;
  authorYearStart?: number;
  authorYearEnd?: number;
  sort: string;
  page: number;
  pageSize: number;
}

export function useOfflineCatalogFallback({
  isOffline,
  resolvedOfflineBooks,
  search,
  topic,
  language,
  authorYearStart,
  authorYearEnd,
  sort,
  page,
  pageSize,
}: UseOfflineCatalogFallbackParams) {
  const filteredOfflineCatalogBooks = useMemo(() => {
    if (!isOffline) return [];
    let list = filterBooksSmart(resolvedOfflineBooks, search);
    if (topic.trim()) {
      const topics = topic
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      if (topics.length > 0) {
        list = list.filter((b) =>
          [...b.subjects, ...b.bookshelves].some((s) => {
            const lower = s.toLowerCase();
            return topics.some((t) => lower.includes(t));
          })
        );
      }
    }
    if (language.trim()) {
      const langs = language
        .split(',')
        .map((l) => l.trim().toLowerCase())
        .filter(Boolean);
      if (langs.length > 0) {
        list = list.filter((b) =>
          b.languages.some((l) => langs.includes(l.toLowerCase()))
        );
      }
    }
    if (authorYearStart !== undefined || authorYearEnd !== undefined) {
      list = list.filter((b) => {
        const author = b.authors?.[0];
        if (!author) return false;
        const birthYear = author.birth_year;
        const deathYear = author.death_year;
        const spanStart = birthYear ?? deathYear;
        const spanEnd = deathYear ?? birthYear;
        if (
          spanStart === null ||
          spanStart === undefined ||
          spanEnd === null ||
          spanEnd === undefined
        ) {
          return false;
        }
        if (authorYearStart !== undefined && spanEnd < authorYearStart) return false;
        if (authorYearEnd !== undefined && spanStart > authorYearEnd) return false;
        return true;
      });
    }
    if (sort === 'ascending') {
      return [...list].sort((a, b) => a.id - b.id);
    }
    if (sort === 'descending') {
      return [...list].sort((a, b) => b.id - a.id);
    }
    return [...list].sort((a, b) => (b.download_count || 0) - (a.download_count || 0));
  }, [
    isOffline,
    resolvedOfflineBooks,
    search,
    topic,
    language,
    authorYearStart,
    authorYearEnd,
    sort,
  ]);

  const offlineSliceStart = (page - 1) * pageSize;
  const offlineSliceEnd = offlineSliceStart + pageSize;
  const paginatedOfflineCatalogBooks = useMemo(
    () => filteredOfflineCatalogBooks.slice(offlineSliceStart, offlineSliceEnd),
    [filteredOfflineCatalogBooks, offlineSliceStart, offlineSliceEnd]
  );

  return {
    filteredOfflineCatalogBooks,
    paginatedOfflineCatalogBooks,
    offlineSliceStart,
    offlineSliceEnd,
    hasNextOfflinePage: offlineSliceEnd < filteredOfflineCatalogBooks.length,
  };
}
