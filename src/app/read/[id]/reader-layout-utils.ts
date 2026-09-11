import { cache } from 'react';
import { headers } from 'next/headers';
import type { GutendexBook } from '@/types/book.types';
import {
  isSupabaseConfigured,
  mapDatabaseBookToGutendexBook,
  CATALOG_METADATA_COLUMNS,
} from '@/lib/catalog/supabase-provider';
import { createClient } from '@/lib/supabase/client';
import type { DatabaseBook } from '@/types/database.types';

export const serverMetadataCache = new Map<number, GutendexBook>();

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
  if (serverMetadataCache.has(bookId)) {
    return serverMetadataCache.get(bookId) || null;
  }

  // Tier 2: Self-hosted Supabase PostgreSQL catalog (sub-15ms)
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('books')
        .select(CATALOG_METADATA_COLUMNS)
        .eq('id', bookId)
        .maybeSingle();

      if (!error && data) {
        const book = mapDatabaseBookToGutendexBook(data as unknown as DatabaseBook);
        serverMetadataCache.set(bookId, book);
        return book;
      }
    } catch {
      // Degrade gracefully to upstream Gutendex
    }
  }

  // Tier 3: Upstream Gutendex REST fallback
  try {
    const res = await fetch(`https://gutendex.com/books?ids=${bookId}`, {
      signal: AbortSignal.timeout(1500),
      next: { revalidate: 86400 }, // 24-hour ISR edge cache
    });

    if (!res.ok) return null;
    const data = await res.json();
    const book = data.results?.[0] || null;
    if (book) {
      serverMetadataCache.set(bookId, book);
    }
    return book;
  } catch {
    return null;
  }
});

