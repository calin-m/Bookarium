import { cache } from 'react';
import { headers } from 'next/headers';
import type { GutendexBook } from '@/types/book.types';
import { API_ENDPOINTS } from '@/config/api-endpoints';
import { SITE_CONFIG } from '@/config/site-config';
import {
  isSupabaseConfigured,
  mapDatabaseBookToGutendexBook,
  CATALOG_METADATA_COLUMNS,
} from '@/lib/catalog/supabase-provider';
import { createClient } from '@/lib/supabase/client';
import type { DatabaseBook } from '@/types/database.types';

export const MAX_SERVER_METADATA_CACHE_ENTRIES = 500;
export const serverMetadataCache = new Map<number, GutendexBook>();

export function setServerMetadataCache(bookId: number, book: GutendexBook): void {
  if (serverMetadataCache.has(bookId)) {
    serverMetadataCache.delete(bookId);
  } else if (serverMetadataCache.size >= MAX_SERVER_METADATA_CACHE_ENTRIES) {
    const oldestKey = serverMetadataCache.keys().next().value;
    if (typeof oldestKey === 'number') {
      serverMetadataCache.delete(oldestKey);
    }
  }
  serverMetadataCache.set(bookId, book);
}

export function clearServerMetadataCache(): void {
  serverMetadataCache.clear();
}

/**
 * Detects whether the incoming request is an internal Next.js client-side router transition (RSC).
 * When true, we bypass outbound network fetches to gutendex.com so client readers transition in 0ms.
 */
export async function isClientSideNavigation(): Promise<boolean> {
  try {
    const headersList = await headers();
    return (
      headersList.get('rsc') === '1' ||
      Boolean(headersList.get('next-router-state-tree')) ||
      Boolean(headersList.get('next-router-prefetch')) ||
      headersList.get('accept')?.includes('text/x-component') === true
    );
  } catch {
    return false;
  }
}

export const fetchBookData = cache(async (bookId: number): Promise<GutendexBook | null> => {
  if (!bookId || isNaN(bookId)) return null;

  // Tier 1: In-memory LRU server cache
  const cached = serverMetadataCache.get(bookId);
  if (cached) {
    serverMetadataCache.delete(bookId);
    serverMetadataCache.set(bookId, cached);
    return cached;
  }

  // Tier 2: Self-hosted Supabase PostgreSQL catalog (sub-15ms)
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('books')
        .select(CATALOG_METADATA_COLUMNS)
        .eq('id', bookId)
        .abortSignal(AbortSignal.timeout(2500))
        .maybeSingle();

      if (!error && data) {
        const book = mapDatabaseBookToGutendexBook(data as unknown as DatabaseBook);
        setServerMetadataCache(bookId, book);
        return book;
      }
    } catch {
      // Degrade gracefully to upstream Gutendex
    }
  }

  // Tier 3: Upstream Gutendex REST fallback
  try {
    const res = await fetch(`${API_ENDPOINTS.GUTENDEX_BASE_URL}/?ids=${bookId}&copyright=false`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': SITE_CONFIG.USER_AGENT,
      },
      signal: AbortSignal.timeout(1500),
      next: { revalidate: 86400 }, // 24-hour ISR edge cache
    });

    if (!res.ok) return null;
    const data = await res.json();
    const book = data.results?.[0] || null;
    if (book) {
      setServerMetadataCache(bookId, book);
    }
    return book;
  } catch {
    return null;
  }
});

