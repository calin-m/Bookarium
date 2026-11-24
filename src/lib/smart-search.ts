import type { CatalogBook } from '@/types/book.types';

/**
 * Normalizes text for search indexing and matching:
 * 1. Lowercases the string.
 * 2. Decomposes Unicode diacritics via NFD and removes combining marks (e.g., é -> e, ñ -> n).
 * 3. Replaces punctuation and special symbols with spaces to prevent punctuation clumping.
 * 4. Normalizes multiple whitespace into a single space and trims.
 */
export function normalizeSearchText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts whitespace-separated search tokens from a search query.
 */
export function extractSearchTokens(query: string | null | undefined): string[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  return normalized.split(' ').filter(Boolean);
}

/**
 * Checks if all tokens in the query match somewhere within the haystack string.
 * Order-independent (AND-matching).
 */
export function matchesSmartSearch<T>(
  item: T,
  query: string,
  extractHaystack: (item: T) => string
): boolean {
  const tokens = extractSearchTokens(query);
  if (tokens.length === 0) return true;

  const haystack = normalizeSearchText(extractHaystack(item));
  if (!haystack) return false;

  return tokens.every((token) => haystack.includes(token));
}

/**
 * Builds a comprehensive search haystack for a CatalogBook object.
 */
export function getBookSearchHaystack(book: CatalogBook): string {
  const parts: string[] = [
    book.title || '',
    ...(book.authors || []).map((a) => a.name || ''),
    ...(book.translators || []).map((t) => t.name || ''),
    ...(book.subjects || []),
    ...(book.bookshelves || []),
    ...(book.languages || []),
  ];
  return parts.join(' ');
}

/**
 * Filters an array of CatalogBook items using order-independent multi-token search.
 */
export function filterBooksSmart(books: CatalogBook[], query: string): CatalogBook[] {
  if (!query || !query.trim()) return books;
  return books.filter((book) =>
    matchesSmartSearch(book, query, getBookSearchHaystack)
  );
}

