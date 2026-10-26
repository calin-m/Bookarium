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

const bookMetadataCache = new Map<number, CachedMetadata>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
      bookMetadataCache.set(bookId, {
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

