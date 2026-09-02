'use client';

import { useQuery } from '@tanstack/react-query';
import type { TranslationResponse, TranslationSegment } from '@/app/api/translate/route';

export interface UsePageTranslationOptions {
  text: string;
  targetLanguage: string | null;
  bookId?: number | string;
  chapterIndex?: number;
  pageIndex?: number;
  enabled?: boolean;
}

export interface UsePageTranslationResult {
  translatedText: string | null;
  segments: TranslationSegment[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  detectedSourceLanguage?: string;
  isCached: boolean;
}

const CACHE_PREFIX = 'bookarium-translation-v1';

export function getTranslationCacheKey(
  bookId: number | string | undefined,
  chapterIndex: number | undefined,
  pageIndex: number | undefined,
  targetLang: string
): string {
  return `${CACHE_PREFIX}:${bookId || 'unknown'}:${chapterIndex ?? 0}:${pageIndex ?? 0}:${targetLang}`;
}

export function readTranslationFromStorage(cacheKey: string): TranslationResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeTranslationToStorage(cacheKey: string, data: TranslationResponse): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(cacheKey, JSON.stringify(data));
  } catch {
    // Quota exceeded or private browsing - fail silently
  }
}

export async function fetchTranslation(
  text: string,
  targetLanguage: string
): Promise<TranslationResponse> {
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      to: targetLanguage,
    }),
  });

  if (!response.ok) {
    let message = 'Failed to translate page';
    try {
      const err = await response.json();
      if (err.error) message = err.error;
    } catch {
      // Ignore fallback
    }
    throw new Error(message);
  }

  return response.json();
}

export function usePageTranslation({
  text,
  targetLanguage,
  bookId,
  chapterIndex,
  pageIndex,
  enabled = true,
}: UsePageTranslationOptions): UsePageTranslationResult {
  const isQueryEnabled =
    Boolean(enabled) &&
    Boolean(targetLanguage) &&
    typeof text === 'string' &&
    text.trim().length > 0;

  const cacheKey = targetLanguage
    ? getTranslationCacheKey(bookId, chapterIndex, pageIndex, targetLanguage)
    : '';

  const { data, isLoading, isError, error } = useQuery<TranslationResponse>({
    queryKey: ['page-translation', cacheKey, text.slice(0, 80)],
    queryFn: async () => {
      // Check local storage cache first
      if (cacheKey) {
        const cached = readTranslationFromStorage(cacheKey);
        if (cached && cached.translatedText) {
          return cached;
        }
      }

      if (!targetLanguage) {
        throw new Error('No target language provided');
      }

      const fresh = await fetchTranslation(text, targetLanguage);
      if (cacheKey && fresh) {
        writeTranslationToStorage(cacheKey, fresh);
      }
      return fresh;
    },
    enabled: isQueryEnabled,
    staleTime: Infinity, // Translations for public domain literature never change
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
  });

  if (!targetLanguage || !text || text.trim().length === 0) {
    return {
      translatedText: null,
      segments: [],
      isLoading: false,
      isError: false,
      error: null,
      isCached: false,
    };
  }

  return {
    translatedText: data?.translatedText || null,
    segments: data?.segments || [],
    isLoading,
    isError,
    error: error as Error | null,
    detectedSourceLanguage: data?.detectedSourceLanguage,
    isCached: Boolean(cacheKey && readTranslationFromStorage(cacheKey)),
  };
}
