import { cache } from 'react';
import { headers } from 'next/headers';
import type { GutendexBook } from '@/types/book.types';

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

  if (serverMetadataCache.has(bookId)) {
    return serverMetadataCache.get(bookId) || null;
  }

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

