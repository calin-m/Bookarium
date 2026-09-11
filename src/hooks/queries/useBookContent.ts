import { useQuery } from '@tanstack/react-query';
import { sampleBookText } from '@/mocks/handlers';
import { API_ENDPOINTS } from '@/config/api-endpoints';
import { getOfflineBook } from '@/lib/offline-storage';
import { useJurisdictionStore } from '@/stores/useJurisdictionStore';

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

export async function fetchBookContent(url?: string, bookId?: number): Promise<string> {
  const isBrowser = typeof window !== 'undefined';
  const clientCountry = isBrowser ? useJurisdictionStore.getState().getEffectiveCountry() : 'US';

  // 1. Check local offline storage (IndexedDB) first for US users
  // Non-US users must verify clearance through the gatekeeper to prevent cross-border leaks
  if (bookId && clientCountry === 'US') {
    try {
      const offlineText = await getOfflineBook(bookId);
      if (offlineText && offlineText.trim().length > 0) {
        return offlineText;
      }
    } catch {
      // Non-blocking fallback to network proxy
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
    staleTime: 60 * 60 * 1000, // 1 hour caching for book text
    retry: (failureCount, error) => {
      // Never retry on HTTP 451 legal restrictions
      if (error instanceof LegalRestrictionError) return false;
      return failureCount < 2;
    },
  });
}
