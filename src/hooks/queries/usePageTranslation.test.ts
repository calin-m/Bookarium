import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  usePageTranslation,
  getTranslationCacheKey,
  readTranslationFromStorage,
  writeTranslationToStorage,
  fetchTranslation,
} from './usePageTranslation';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('usePageTranslation', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('generates consistent cache keys', () => {
    const key = getTranslationCacheKey(1342, 2, 5, 'es');
    expect(key).toBe('bookarium-translation-v1:1342:2:5:es');

    const fallbackKey = getTranslationCacheKey(undefined, undefined, undefined, 'fr');
    expect(fallbackKey).toBe('bookarium-translation-v1:unknown:0:0:fr');
  });

  it('handles localStorage read and write safely', () => {
    const key = 'test-key';
    const mockData = {
      translatedText: 'Hola',
      detectedSourceLanguage: 'en',
      targetLanguage: 'es',
      segments: [{ original: 'Hello', translated: 'Hola' }],
    };

    expect(readTranslationFromStorage(key)).toBeNull();

    writeTranslationToStorage(key, mockData);
    expect(readTranslationFromStorage(key)).toEqual(mockData);

    // Corrupted JSON returns null
    localStorage.setItem(key, 'invalid-json');
    expect(readTranslationFromStorage(key)).toBeNull();
  });

  it('returns empty result when targetLanguage is null', () => {
    const { result } = renderHook(
      () =>
        usePageTranslation({
          text: 'Hello world',
          targetLanguage: null,
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.translatedText).toBeNull();
    expect(result.current.segments).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('fetches translation and populates result and localStorage', async () => {
    const mockResponse = {
      translatedText: 'Bonjour le monde',
      detectedSourceLanguage: 'en',
      targetLanguage: 'fr',
      segments: [{ original: 'Hello world', translated: 'Bonjour le monde' }],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
    } as any);

    const { result } = renderHook(
      () =>
        usePageTranslation({
          text: 'Hello world',
          targetLanguage: 'fr',
          bookId: 84,
          chapterIndex: 0,
          pageIndex: 1,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.translatedText).toBe('Bonjour le monde');
    });

    expect(result.current.segments).toHaveLength(1);
    expect(result.current.detectedSourceLanguage).toBe('en');

    // Verify localStorage was populated
    const cacheKey = getTranslationCacheKey(84, 0, 1, 'fr');
    expect(readTranslationFromStorage(cacheKey)).toEqual(mockResponse);
  });

  it('uses cached translation directly without calling fetch', async () => {
    const mockResponse = {
      translatedText: 'Cached Spanish translation',
      detectedSourceLanguage: 'en',
      targetLanguage: 'es',
      segments: [{ original: 'Hello', translated: 'Cached Spanish translation' }],
    };

    const cacheKey = getTranslationCacheKey(1342, 1, 0, 'es');
    writeTranslationToStorage(cacheKey, mockResponse);

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const { result } = renderHook(
      () =>
        usePageTranslation({
          text: 'Hello',
          targetLanguage: 'es',
          bookId: 1342,
          chapterIndex: 1,
          pageIndex: 0,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.translatedText).toBe('Cached Spanish translation');
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('handles API error gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: 'Upstream rate limit' }),
    } as any);

    const { result } = renderHook(
      () =>
        usePageTranslation({
          text: 'Error text',
          targetLanguage: 'de',
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('Upstream rate limit');
  });

  it('throws error when fetchTranslation fails without JSON body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockRejectedValue(new Error('no json')),
    } as any);

    await expect(fetchTranslation('text', 'es')).rejects.toThrow('Failed to translate page');
  });
});
