'use client';

import { useState, useMemo, useCallback } from 'react';
import { getBookPassages, type BookPassage } from '@/config/featured-books';
import { extractDynamicBookPassages } from '@/lib/gutenberg/passages';
import { useBookContent } from '@/hooks/queries/useBookContent';

export interface UseBookPassageShuffleParams {
  id: number;
  title: string;
  authors?: Array<{ name: string }> | string;
  subjects?: string[];
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

  const targetBookId = enabled && id > 0 ? id : undefined;
  const { data: rawBookText } = useBookContent(undefined, targetBookId);

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
    if (rawBookText && id) {
      return extractDynamicBookPassages(rawBookText, {
        id,
        title,
        authors: normalizedAuthors,
        subjects,
      });
    }
    return [];
  }, [rawBookText, id, title, normalizedAuthors, subjects]);

  const passages: BookPassage[] = useMemo(() => {
    const baseFirstPassage = curatedPassages[0] || dynamicPassages[0];
    if (!baseFirstPassage) return [];
    if (dynamicPassages.length > 1) {
      return [baseFirstPassage, ...dynamicPassages.slice(1)];
    }
    return curatedPassages.length > 0 ? curatedPassages : [baseFirstPassage];
  }, [curatedPassages, dynamicPassages]);

  const currentPassage = passages[activePassageIndex] || {
    chapterLabel: 'Chapter I',
    openingLine: 'Preserved in the public domain for all readers.',
    quoteExcerpt: 'A timeless literary classic.',
  };

  const prevPassage = passages[prevPassageIndex] || currentPassage;

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
    setIsTurningLeaf,
    shuffleNextPassage,
    resetPassages,
  };
}
