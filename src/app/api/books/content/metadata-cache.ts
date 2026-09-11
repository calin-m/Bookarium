import { API_ENDPOINTS } from '@/config/api-endpoints';
import { SITE_CONFIG } from '@/config/site-config';
import type { GenericBookInput } from '@/lib/copyright-engine';
import { isSupabaseConfigured } from '@/lib/catalog/supabase-provider';
import { createClient } from '@/lib/supabase/client';

export interface CachedMetadata {
  book: GenericBookInput;
  expiresAt: number;
}

const bookMetadataCache = new Map<number, CachedMetadata>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function clearBookMetadataCache(): void {
  bookMetadataCache.clear();
}

export function setBookMetadataCache(bookId: number, metadata: CachedMetadata): void {
  bookMetadataCache.set(bookId, metadata);
}

export function getBookMetadataCache(bookId: number): CachedMetadata | undefined {
  return bookMetadataCache.get(bookId);
}

/**
 * Resolves book metadata for copyright verification.
 * Priority Tier 1: In-memory LRU cache.
 * Priority Tier 2: Self-hosted Supabase PostgreSQL catalog (`public.books`).
 * Priority Tier 3: Upstream Gutendex REST API with canonical trailing slash.
 */
export async function resolveBookMetadata(bookId: number): Promise<GenericBookInput | null> {
  const now = Date.now();
  const cached = bookMetadataCache.get(bookId);
  if (cached && cached.expiresAt > now) {
    return cached.book;
  }

  // Tier 2: Check self-hosted Supabase PostgreSQL catalog
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('books')
        .select('id, title, authors, translators, copyright')
        .eq('id', bookId)
        .maybeSingle();

      if (!error && data) {
        const book: GenericBookInput = {
          id: data.id,
          title: data.title,
          authors: Array.isArray(data.authors) ? (data.authors as unknown as GenericBookInput['authors']) : [],
          translators: Array.isArray(data.translators) ? (data.translators as unknown as GenericBookInput['translators']) : [],
          copyright: data.copyright,
        };
        bookMetadataCache.set(bookId, {
          book,
          expiresAt: now + CACHE_TTL_MS,
        });
        return book;
      }
    } catch {
      // Degrade gracefully to upstream Gutendex
    }
  }

  // Tier 3: Fallback to upstream Gutendex API with canonical trailing slash
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${API_ENDPOINTS.GUTENDEX_BASE_URL}/books/${bookId}/`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': `Bookarium-Gatekeeper/1.0 (${SITE_CONFIG.GITHUB_REPO})`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (data && typeof data === 'object') {
      bookMetadataCache.set(bookId, {
        book: data as GenericBookInput,
        expiresAt: now + CACHE_TTL_MS,
      });
      return data as GenericBookInput;
    }

    return null;
  } catch {
    return null;
  }
}

