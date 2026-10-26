import { useQuery } from '@tanstack/react-query';
import { sampleBookText } from '@/mocks/handlers';
import { API_ENDPOINTS } from '@/config/api-endpoints';
import { getOfflineBook, getOfflineBookRecord } from '@/lib/offline-storage';
import { useJurisdictionStore } from '@/stores/useJurisdictionStore';
import { isBookPublicDomainInJurisdiction, parseLifespansFromName } from '@/lib/copyright-engine';
import { useReaderStore } from '@/stores/useReaderStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { FEATURED_HERO_BOOKS } from '@/config/featured-books';
import type { Author, Book } from '@/types/book.types';

export interface LegalRestrictionDetails {
  country: string;
  rule: string;
  restrictingAuthor?: string;
  restrictingDeathYear?: number;
  publicDomainYear?: number;
  reason?: string;
}

export class LegalRestrictionError extends Error {
  public readonly isLegalRestriction = true;
  public readonly status = 451;
  public readonly details: LegalRestrictionDetails;

  constructor(details: LegalRestrictionDetails) {
    super(details.reason || 'This title is protected by copyright in your jurisdiction.');
    this.name = 'LegalRestrictionError';
    this.details = details;
  }
}

function hasAuthorLifespan(authors?: (Author | string)[]): boolean {
  if (!authors || authors.length === 0) return false;
  return authors.some((a) => {
    if (typeof a === 'string') {
      const parsed = parseLifespansFromName(a);
      return parsed.birthYear != null || parsed.deathYear != null;
    }
    if (a.birth_year != null || a.death_year != null) return true;
    const parsed = parseLifespansFromName(a.name);
    return parsed.birthYear != null || parsed.deathYear != null;
  });
}

function resolveAuthoritativeLocalAuthors(
  bookId: number,
  recordAuthors?: (Author | string)[],
  isBrowser?: boolean
): (Author | string)[] | undefined {
  if (hasAuthorLifespan(recordAuthors)) {
    return recordAuthors;
  }

  if (isBrowser) {
    const readerState = useReaderStore.getState();
    const currentBook = readerState.currentBook;
    if (currentBook?.id === bookId) {
      const details = (currentBook as Book).authorDetails;
      if (hasAuthorLifespan(details)) return details;
      if (hasAuthorLifespan(currentBook.authors)) return currentBook.authors;
    }

    const shelfState = useBookshelfStore.getState();
    const saved = shelfState.savedBooks.find((b) => b.id === bookId);
    if (hasAuthorLifespan(saved?.authors)) return saved!.authors;

    const fav = shelfState.favoriteBooks.find((b) => b.id === bookId);
    if (hasAuthorLifespan(fav?.authors)) return fav!.authors;

    const recent = shelfState.recentBooks.find((b) => b.id === bookId);
    if (hasAuthorLifespan(recent?.authors)) return recent!.authors;

    const posAuthors = readerState.readingPositions[bookId]?.bookAuthors;
    if (hasAuthorLifespan(posAuthors)) return posAuthors;
  }

  const hero = FEATURED_HERO_BOOKS.find((h) => h.id === bookId);
  if (hero && (hero.authorBirthYear != null || hero.authorDeathYear != null)) {
    return [
      {
        name: hero.author,
        birth_year: hero.authorBirthYear ?? null,
        death_year: hero.authorDeathYear ?? null,
      },
    ];
  }

  return undefined;
}

async function resolveLocalOfflineBookContent(
  bookId: number,
  clientCountry: string,
  isBrowser: boolean,
  allowWithoutLifespans: boolean
): Promise<string | null> {
  try {
    const record = typeof getOfflineBookRecord === 'function' ? await getOfflineBookRecord(bookId) : null;
    const offlineText = record ? record.text : await getOfflineBook(bookId);

    if (offlineText && offlineText.trim().length > 0) {
      if (clientCountry === 'US') {
        return offlineText;
      }

      const authors = resolveAuthoritativeLocalAuthors(bookId, record?.authors, isBrowser);
      if (authors && authors.length > 0) {
        const evaluation = isBookPublicDomainInJurisdiction({ authors }, clientCountry);
        if (!evaluation.isAllowed) {
          throw new LegalRestrictionError({
            country: clientCountry,
            rule: evaluation.rule,
            restrictingAuthor: evaluation.restrictingAuthor,
            restrictingDeathYear: evaluation.restrictingDeathYear,
            publicDomainYear: evaluation.publicDomainYear,
            reason: evaluation.reason,
          });
        }
        return offlineText;
      }

      if (allowWithoutLifespans) {
        return offlineText;
      }
    }
  } catch (err: unknown) {
    if (err instanceof LegalRestrictionError) {
      throw err;
    }
  }
  return null;
}

export async function fetchBookContent(url?: string, bookId?: number): Promise<string> {
  const isBrowser = typeof window !== 'undefined';
  const clientCountry = isBrowser ? useJurisdictionStore.getState().getEffectiveCountry() : 'US';

  // 1. Check local offline storage (IndexedDB)
  if (bookId) {
    const isOfflineBrowser = isBrowser && typeof navigator !== 'undefined' && !navigator.onLine;
    const localText = await resolveLocalOfflineBookContent(bookId, clientCountry, isBrowser, isOfflineBrowser);
    if (localText) {
      return localText;
    }
  }

  if (!url && !bookId) {
    return sampleBookText;
  }

  const params = new URLSearchParams();
  if (bookId) params.set('id', String(bookId));
  if (url) params.set('url', url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 8000);

  try {
    const res = await fetch(`${API_ENDPOINTS.INTERNAL_API_CONTENT}?${params.toString()}`, {
      signal: controller.signal,
    });

    if (!res.ok) {
      if (res.status === 451) {
        let details: LegalRestrictionDetails = { country: clientCountry, rule: 'LIFE_70' };
        try {
          details = await res.json();
        } catch {
          // fallback
        }
        throw new LegalRestrictionError(details);
      }
      throw new Error(`Failed to fetch book content from upstream proxy: ${res.statusText || res.status}`);
    }

    const text = await res.text();
    if (!text || text.trim().length === 0) {
      throw new Error('Received empty text content from upstream.');
    }
    return text;
  } catch (err: unknown) {
    if (err instanceof LegalRestrictionError) {
      throw err;
    }
    // Fallback on network disconnect/timeout for offline reading
    if (bookId) {
      const fallbackText = await resolveLocalOfflineBookContent(bookId, clientCountry, isBrowser, true);
      if (fallbackText) {
        return fallbackText;
      }
    }
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Book content request timed out after 8000ms. Please check your connection.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function useBookContent(contentUrl?: string, bookId?: number) {
  return useQuery({
    queryKey: ['book-content', contentUrl, bookId],
    queryFn: () => fetchBookContent(contentUrl, bookId),
    enabled: Boolean(contentUrl || bookId),
    networkMode: 'always',
    staleTime: 60 * 60 * 1000, // 1 hour caching for book text
    retry: (failureCount, error) => {
      // Never retry on HTTP 451 legal restrictions or when device is offline
      if (error instanceof LegalRestrictionError) return false;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
      return failureCount < 2;
    },
  });
}
