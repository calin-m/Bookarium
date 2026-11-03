'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { getBookPassages, hasCuratedBookPassages, type BookPassage } from '@/config/featured-books';
import { extractDynamicBookPassages } from '@/lib/gutenberg/passages';
import { useBookContent } from '@/hooks/queries/useBookContent';

export const EXTRACTED_PASSAGES_CACHE_KEY = 'bookarium-extracted-passages-v1' as const;
const EXTRACTED_PASSAGES_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_EXTRACTED_PASSAGES_ENTRIES = 100;

interface CachedPassageEntry {
  updatedAt: number;
  passages: BookPassage[];
}

function isValidBookPassage(item: unknown): item is BookPassage {
  if (!item || typeof item !== 'object') return false;
  const candidate = item as Record<string, unknown>;
  return (
    typeof candidate.chapterLabel === 'string' &&
    candidate.chapterLabel.trim().length > 0 &&
    typeof candidate.openingLine === 'string' &&
    candidate.openingLine.trim().length > 0 &&
    typeof candidate.quoteExcerpt === 'string' &&
    candidate.quoteExcerpt.trim().length > 0
  );
}

export function readCachedBookPassages(bookId: number): BookPassage[] | undefined {
  if (
    !Number.isInteger(bookId) ||
    bookId <= 0 ||
    typeof window === 'undefined' ||
    typeof window.localStorage === 'undefined'
  ) {
    return undefined;
  }
  try {
    const raw = window.localStorage.getItem(EXTRACTED_PASSAGES_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Record<string, CachedPassageEntry>;
    if (!parsed || typeof parsed !== 'object') return undefined;
    const entry = parsed[String(bookId)];
    if (!entry || typeof entry.updatedAt !== 'number' || !Array.isArray(entry.passages)) {
      return undefined;
    }
    if (Date.now() - entry.updatedAt > EXTRACTED_PASSAGES_TTL_MS) {
      return undefined;
    }
    const validPassages = entry.passages.filter(isValidBookPassage);
    return validPassages.length > 0 ? validPassages : undefined;
  } catch {
    return undefined;
  }
}

export function writeCachedBookPassages(bookId: number, passages: BookPassage[]): void {
  if (
    !Number.isInteger(bookId) ||
    bookId <= 0 ||
    !Array.isArray(passages) ||
    passages.length === 0 ||
    typeof window === 'undefined' ||
    typeof window.localStorage === 'undefined'
  ) {
    return;
  }
  try {
    const validPassages = passages.filter(isValidBookPassage);
    if (validPassages.length === 0) return;
    const raw = window.localStorage.getItem(EXTRACTED_PASSAGES_CACHE_KEY);
    const parsed: Record<string, CachedPassageEntry> =
      raw ? (JSON.parse(raw) as Record<string, CachedPassageEntry>) || {} : {};
    const now = Date.now();
    parsed[String(bookId)] = {
      updatedAt: now,
      passages: validPassages,
    };
    const keys = Object.keys(parsed);
    if (keys.length > MAX_EXTRACTED_PASSAGES_ENTRIES) {
      const sortedKeys = keys.sort(
        (a, b) => (parsed[b]?.updatedAt ?? 0) - (parsed[a]?.updatedAt ?? 0)
      );
      for (const staleKey of sortedKeys.slice(MAX_EXTRACTED_PASSAGES_ENTRIES)) {
        delete parsed[staleKey];
      }
    }
    window.localStorage.setItem(EXTRACTED_PASSAGES_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore storage quota or private-browsing write errors
  }
}

export function clearCachedBookPassages(): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(EXTRACTED_PASSAGES_CACHE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export interface UseBookPassageShuffleParams {
  id: number;
  title: string;
  authors?: Array<{ name: string } | string> | string;
  subjects?: string[];
  contentUrl?: string;
  supabaseQuotes?: BookPassage[];
  enabled?: boolean;
}

/**
 * Headless hook encapsulating multi-chapter literary passage extraction,
 * curated quote fallbacks, and 3D leaf-flip animation states.
 */
export function useBookPassageShuffle({
  id,
  title,
  authors = [],
  subjects = [],
  contentUrl,
  supabaseQuotes,
  enabled = true,
}: UseBookPassageShuffleParams) {
  const [activePassageIndex, setActivePassageIndex] = useState(0);
  const [prevPassageIndex, setPrevPassageIndex] = useState(0);
  const [isTurningLeaf, setIsTurningLeaf] = useState(false);

  const normalizedAuthors = useMemo(() => {
    if (Array.isArray(authors)) {
      return authors.map((a) => (typeof a === 'string' ? { name: a } : a));
    }
    if (typeof authors === 'string' && authors.trim()) {
      return [{ name: authors }];
    }
    return [];
  }, [authors]);

  const isCuratedFeatured = useMemo(() => {
    return hasCuratedBookPassages(id, title);
  }, [id, title]);

  const hasMultiSpreadSupabaseQuotes = Array.isArray(supabaseQuotes) && supabaseQuotes.length >= 2;
  const cachedPassages = useMemo(
    () => (id > 0 && !hasMultiSpreadSupabaseQuotes ? readCachedBookPassages(id) : undefined),
    [id, hasMultiSpreadSupabaseQuotes]
  );
  const hasCachedPassages = Array.isArray(cachedPassages) && cachedPassages.length >= 2;

  const targetBookId =
    enabled && !hasMultiSpreadSupabaseQuotes && !hasCachedPassages && id > 0 ? id : undefined;
  const targetContentUrl =
    enabled && !hasMultiSpreadSupabaseQuotes && !hasCachedPassages && id > 0
      ? contentUrl
      : undefined;
  const { data: rawBookText, isFetching } = useBookContent(targetContentUrl, targetBookId);

  const curatedPassages = useMemo(() => {
    if (!id) return [];
    return getBookPassages({
      id,
      title,
      authors: normalizedAuthors,
      subjects,
    });
  }, [id, title, normalizedAuthors, subjects]);

  const dynamicPassages = useMemo(() => {
    if (hasCachedPassages && cachedPassages) {
      return cachedPassages;
    }
    if (rawBookText && id) {
      return extractDynamicBookPassages(rawBookText, {
        id,
        title,
        authors: normalizedAuthors,
        subjects,
      });
    }
    return [];
  }, [hasCachedPassages, cachedPassages, rawBookText, id, title, normalizedAuthors, subjects]);

  useEffect(() => {
    if (!hasCachedPassages && rawBookText && id > 0 && dynamicPassages.length >= 2) {
      writeCachedBookPassages(id, dynamicPassages);
    }
  }, [hasCachedPassages, rawBookText, id, dynamicPassages]);

  const passages: BookPassage[] = useMemo(() => {
    // Tier 1: Primary Supabase public.books.quotes (10–16 multi-quote spreads per book)
    if (Array.isArray(supabaseQuotes) && supabaseQuotes.length > 0) {
      if (dynamicPassages.length > 1) {
        return [...supabaseQuotes, ...dynamicPassages.slice(1)];
      }
      return supabaseQuotes;
    }

    // Tier 2: For non-curated catalog books (including all Newest Releases), prioritize dynamic book-specific passages
    if (!isCuratedFeatured && dynamicPassages.length > 0) {
      return dynamicPassages;
    }

    // Tier 3: Local curated fallback spreads (featured-books.ts)
    const baseFirstPassage = curatedPassages[0] || dynamicPassages[0];
    if (!baseFirstPassage) return [];
    if (dynamicPassages.length > 1) {
      return [...(curatedPassages.length > 0 ? curatedPassages : [baseFirstPassage]), ...dynamicPassages.slice(1)];
    }
    return curatedPassages.length > 0 ? curatedPassages : [baseFirstPassage];
  }, [supabaseQuotes, isCuratedFeatured, curatedPassages, dynamicPassages]);

  const isLoadingPassages = Boolean(
    isFetching &&
      dynamicPassages.length === 0 &&
      !isCuratedFeatured &&
      (!supabaseQuotes || supabaseQuotes.length === 0)
  );

  const currentPassage = passages[activePassageIndex] || {
    chapterLabel: 'Chapter I',
    openingLine: 'Preserved in the public domain for all readers.',
    quoteExcerpt: 'A timeless literary classic.',
  };

  const prevPassage = passages[prevPassageIndex] || currentPassage;

  // Safety fallback timer: ensures isTurningLeaf resets even when CSS animations are disabled
  // (e.g. prefers-reduced-motion: reduce or 2D static presentation mode)
  useEffect(() => {
    if (!isTurningLeaf) return;
    const timer = setTimeout(() => {
      setIsTurningLeaf(false);
    }, 450);
    return () => clearTimeout(timer);
  }, [isTurningLeaf]);

  const shuffleNextPassage = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isTurningLeaf || passages.length <= 1) return;
    setPrevPassageIndex(activePassageIndex);
    setActivePassageIndex((prev) => (prev + 1) % passages.length);
    setIsTurningLeaf(true);
  }, [isTurningLeaf, passages.length, activePassageIndex]);

  const resetPassages = useCallback(() => {
    setActivePassageIndex(0);
    setPrevPassageIndex(0);
    setIsTurningLeaf(false);
  }, []);

  return {
    passages,
    currentPassage,
    prevPassage,
    activePassageIndex,
    prevPassageIndex,
    isTurningLeaf,
    isLoadingPassages,
    isCuratedFeatured,
    setIsTurningLeaf,
    shuffleNextPassage,
    resetPassages,
  };
}
