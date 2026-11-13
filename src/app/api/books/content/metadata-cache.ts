import { API_ENDPOINTS } from '@/config/api-endpoints';
import { SITE_CONFIG } from '@/config/site-config';
import { FEATURED_HERO_BOOKS } from '@/config/featured-books';
import { parseLifespansFromName, type GenericBookInput } from '@/lib/copyright-engine';
import { isSupabaseConfigured } from '@/lib/catalog/supabase-provider';
import { createClient } from '@/lib/supabase/client';

export interface CachedMetadata {
  book: GenericBookInput;
  expiresAt: number;
}

export interface CachedBookContentEntry {
  text: string;
  source: 'supabase' | 'gutenberg-mirror';
  cachedAt: number;
}

const globalForBookCache = globalThis as typeof globalThis & {
  __bookariumMetadataCache?: Map<number, CachedMetadata>;
  __bookariumContentLruCache?: Map<number, CachedBookContentEntry>;
};

const bookMetadataCache =
  globalForBookCache.__bookariumMetadataCache ??
  (globalForBookCache.__bookariumMetadataCache = new Map<number, CachedMetadata>());
const bookContentLruCache =
  globalForBookCache.__bookariumContentLruCache ??
  (globalForBookCache.__bookariumContentLruCache = new Map<number, CachedBookContentEntry>());
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MAX_METADATA_CACHE_ENTRIES = 1000;
const MAX_CACHED_BOOKS = 20;
const MAX_CACHEABLE_BOOK_CHARS = 1_800_000;

export function getCachedBookContent(bookId: number): CachedBookContentEntry | undefined {
  const entry = bookContentLruCache.get(bookId);
  if (!entry) return undefined;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    bookContentLruCache.delete(bookId);
    return undefined;
  }
  bookContentLruCache.delete(bookId);
  bookContentLruCache.set(bookId, entry);
  return entry;
}

export function setCachedBookContent(
  bookId: number,
  text: string,
  source: 'supabase' | 'gutenberg-mirror'
): void {
  if (!text || text.length > MAX_CACHEABLE_BOOK_CHARS) {
    return;
  }
  if (bookContentLruCache.has(bookId)) {
    bookContentLruCache.delete(bookId);
  } else if (bookContentLruCache.size >= MAX_CACHED_BOOKS) {
    const oldestKey = bookContentLruCache.keys().next().value;
    if (typeof oldestKey === 'number') {
      bookContentLruCache.delete(oldestKey);
    }
  }
  bookContentLruCache.set(bookId, {
    text,
    source,
    cachedAt: Date.now(),
  });
}

export function clearBookContentCache(): void {
  bookContentLruCache.clear();
}

function getFeaturedHeroFallback(bookId: number): GenericBookInput | null {
  const hero = FEATURED_HERO_BOOKS.find((h) => h.id === bookId);
  if (hero && (hero.authorBirthYear != null || hero.authorDeathYear != null)) {
    return {
      id: hero.id,
      title: hero.title,
      authors: [
        {
          name: hero.author,
          birth_year: hero.authorBirthYear ?? null,
          death_year: hero.authorDeathYear ?? null,
        },
      ],
      translators: [],
      copyright: false,
    };
  }
  return null;
}

function enrichWithFeaturedLifespans(bookId: number, book: GenericBookInput): GenericBookInput {
  const hasLifespans = Boolean(
    book.authors?.some((a) => {
      if (typeof a !== 'string' && (a.birth_year != null || a.death_year != null)) return true;
      const parsed = parseLifespansFromName(typeof a === 'string' ? a : a.name);
      return parsed.birthYear != null || parsed.deathYear != null;
    })
  );

  if (hasLifespans) return book;

  const fallback = getFeaturedHeroFallback(bookId);
  return fallback ? { ...book, authors: fallback.authors } : book;
}

export function clearBookMetadataCache(): void {
  bookMetadataCache.clear();
  bookContentLruCache.clear();
}

export function setBookMetadataCache(bookId: number, metadata: CachedMetadata): void {
  if (bookMetadataCache.has(bookId)) {
    bookMetadataCache.delete(bookId);
  } else if (bookMetadataCache.size >= MAX_METADATA_CACHE_ENTRIES) {
    const oldestKey = bookMetadataCache.keys().next().value;
    if (typeof oldestKey === 'number') {
      bookMetadataCache.delete(oldestKey);
    }
  }
  bookMetadataCache.set(bookId, metadata);
}

export function getBookMetadataCache(bookId: number): CachedMetadata | undefined {
  return bookMetadataCache.get(bookId);
}

/**
 * Resolves book metadata for copyright verification.
 * Priority Tier 1: In-memory LRU cache.
 * Priority Tier 2: Dedicated Supabase PostgreSQL catalog (`public.books`).
 * Priority Tier 3: Upstream Gutendex REST API with canonical trailing slash.
 */
export async function resolveBookMetadata(bookId: number): Promise<GenericBookInput | null> {
  const now = Date.now();
  const cached = bookMetadataCache.get(bookId);
  if (cached) {
    if (cached.expiresAt > now) {
      bookMetadataCache.delete(bookId);
      bookMetadataCache.set(bookId, cached);
      return cached.book;
    }
    bookMetadataCache.delete(bookId);
  }

  // Tier 2: Check dedicated Supabase PostgreSQL catalog
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('books')
        .select('id, title, authors, translators, copyright')
        .eq('id', bookId)
        .abortSignal(AbortSignal.timeout(2500))
        .maybeSingle();

      if (!error && data) {
        const book = enrichWithFeaturedLifespans(bookId, {
          id: data.id,
          title: data.title,
          authors: Array.isArray(data.authors) ? (data.authors as unknown as GenericBookInput['authors']) : [],
          translators: Array.isArray(data.translators) ? (data.translators as unknown as GenericBookInput['translators']) : [],
          copyright: data.copyright,
        });
        setBookMetadataCache(bookId, {
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

    const res = await fetch(`${API_ENDPOINTS.GUTENDEX_BASE_URL}/${bookId}/`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': SITE_CONFIG.USER_AGENT,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return getFeaturedHeroFallback(bookId);
    }

    const data = await res.json();
    if (data && typeof data === 'object') {
      const enriched = enrichWithFeaturedLifespans(bookId, data as GenericBookInput);
      setBookMetadataCache(bookId, {
        book: enriched,
        expiresAt: now + CACHE_TTL_MS,
      });
      return enriched;
    }

    return getFeaturedHeroFallback(bookId);
  } catch {
    return getFeaturedHeroFallback(bookId);
  }
}

