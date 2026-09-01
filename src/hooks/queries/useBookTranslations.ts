import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CATALOG_LANGUAGES } from '@/config/catalog-filters';
import { isPlaceholderAuthor } from '@/lib/book-metadata';
import type { GutendexBook } from '@/mocks/handlers';

export interface BookTranslationOption {
  bookId: number;
  title: string;
  languageCode: string;
  languageLabel: string;
  isCurrent: boolean;
}

export interface UseBookTranslationsResult {
  translations: BookTranslationOption[];
  currentLanguage: string;
  isLoading: boolean;
  isError: boolean;
}

const TITLE_STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from',
  'history', 'story', 'stories', 'adventures', 'memoirs', 'life', 'works', 'book', 'books',
  'volume', 'vol', 'part', 'gutenberg', 'ebook', 'classic', 'selected',
]);

/**
 * Normalizes complex book titles by stripping subtitles, volume numerals, and punctuation.
 * e.g. "Frankenstein; Or, The Modern Prometheus" -> "Frankenstein"
 * e.g. "The German Classics of the 19th Century, Vol. 01" -> "The German Classics of the 19th Century"
 */
export function extractRootTitle(title: string): string {
  if (!title) return '';
  const clean = title.replace(/[\r\n]+/g, ' ').trim();
  // Strip after primary title separators (; or :)
  const withoutSub = clean.split(/[;:]/)[0].trim();
  // Strip volume / part suffixes
  const withoutVol = withoutSub.replace(/,\s*(volume|vol\.|book|part|tome|canto)\s*[\divxlc]+/gi, '').trim();
  return withoutVol || clean;
}

/**
 * Extracts the most distinctive core keywords from a title by stripping common structural stopwords.
 * e.g. "The History of Don Quixote, Volume 1" -> "Don Quixote"
 * e.g. "Pride and Prejudice" -> "Pride Prejudice"
 */
export function extractSignificantTitleKeywords(title: string): string {
  const root = extractRootTitle(title);
  if (!root) return '';
  const words = root.split(/[\s,\-_/]+/).filter(Boolean);
  const significant = words.filter(
    (w) => !TITLE_STOPWORDS.has(w.toLowerCase()) && !/^\d+$/.test(w)
  );
  return significant.slice(0, 2).join(' ') || words.slice(0, 2).join(' ') || root;
}

/**
 * Extracts author surname or primary identifying name component.
 * e.g. "Austen, Jane" -> "Austen"
 * e.g. "Cervantes Saavedra, Miguel de" -> "Cervantes"
 * e.g. "Miguel de Cervantes Saavedra" -> "Cervantes"
 */
export function extractAuthorSurname(author: string): string {
  if (!author) return '';
  const clean = author.replace(/[\r\n]+/g, ' ').trim();
  if (clean.includes(',')) {
    const surnamePart = clean.split(',')[0].trim();
    return surnamePart.split(/\s+/)[0] || surnamePart;
  }
  const parts = clean.split(/\s+/).filter(Boolean);
  const prefixIndex = parts.findIndex((p) =>
    ['de', 'del', 'von', 'van', 'di', 'da'].includes(p.toLowerCase())
  );
  if (prefixIndex !== -1 && prefixIndex + 1 < parts.length) {
    return parts[prefixIndex + 1];
  }
  return parts[parts.length - 1] || clean;
}

/**
 * Resolves a human-readable language label for any ISO-639-1 code.
 */
export function resolveLanguageLabel(code: string): string {
  const match = CATALOG_LANGUAGES.find((l) => l.value.toLowerCase() === code.toLowerCase());
  if (match && match.label && match.value) {
    return match.label;
  }
  return code ? code.toUpperCase() : 'Unknown';
}

/**
 * React Query hook that discovers alternative language translations and editions
 * for the currently active book volume.
 */
export function useBookTranslations(
  title?: string,
  author?: string,
  currentBookId?: number,
  currentBookLanguages?: string[]
): UseBookTranslationsResult {
  const titleKeywords = useMemo(() => extractSignificantTitleKeywords(title || ''), [title]);
  const authorSurname = useMemo(() => extractAuthorSurname(author || ''), [author]);
  const currentLangs = useMemo(() => {
    return currentBookLanguages && currentBookLanguages.length > 0
      ? currentBookLanguages
      : ['en'];
  }, [currentBookLanguages]);

  const resolvedCurrentLang = useMemo(() => {
    return currentLangs.map(resolveLanguageLabel).join(', ');
  }, [currentLangs]);

  const searchQuery = useMemo(() => {
    if (authorSurname && !isPlaceholderAuthor(author)) {
      return authorSurname;
    }
    return titleKeywords || '';
  }, [authorSurname, author, titleKeywords]);

  const { data, isLoading, isError } = useQuery<{ results: GutendexBook[] }>({
    queryKey: ['book-translations', currentBookId, searchQuery],
    queryFn: async () => {
      if (!searchQuery) return { results: [] };
      const endpoint = `/api/books?search=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(endpoint);
      if (!res.ok) {
        throw new Error(`Failed to fetch translations: ${res.status}`);
      }
      return res.json();
    },
    enabled: Boolean(searchQuery && currentBookId && currentBookId > 0),
    staleTime: 1000 * 60 * 30, // 30 minutes cache
    gcTime: 1000 * 60 * 60, // 1 hour garbage collection
  });

  const translations = useMemo<BookTranslationOption[]>(() => {
    const activeId = currentBookId || 0;
    const map = new Map<string, BookTranslationOption>();

    // 1. Always ensure all languages of the current book edition are present as base entries
    for (const lang of currentLangs) {
      const code = lang.toLowerCase();
      map.set(code, {
        bookId: activeId,
        title: title || 'Current Edition',
        languageCode: code,
        languageLabel: resolveLanguageLabel(code),
        isCurrent: true,
      });
    }

    // 2. Process search results to discover editions in other languages
    if (data?.results && Array.isArray(data.results)) {
      const surnameLower = authorSurname.toLowerCase();
      const firstKeyword = titleKeywords.split(/\s+/)[0]?.toLowerCase() || '';

      for (const book of data.results) {
        if (!book.languages || book.languages.length === 0) continue;
        
        // Author check: does any author name contain the surname?
        const matchesAuthor =
          !surnameLower ||
          book.authors?.some((a) => a.name?.toLowerCase().includes(surnameLower));

        const matchesTitle =
          !firstKeyword ||
          book.title?.toLowerCase().includes(firstKeyword);

        if (!matchesAuthor && !matchesTitle && data.results.length > 5) continue;

        for (const lang of book.languages) {
          const langCode = lang.toLowerCase();
          
          if (book.id === activeId) {
            // Already set as current
            continue;
          }

          // Add or replace with best matching edition per language
          if (!map.has(langCode)) {
            map.set(langCode, {
              bookId: book.id,
              title: book.title || `Volume #${book.id}`,
              languageCode: langCode,
              languageLabel: resolveLanguageLabel(langCode),
              isCurrent: false,
            });
          }
        }
      }
    }

    // Sort: Current edition first, then alphabetically by language label
    return Array.from(map.values()).sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      return a.languageLabel.localeCompare(b.languageLabel);
    });
  }, [data, currentBookId, title, currentLangs, authorSurname]);

  return {
    translations,
    currentLanguage: resolvedCurrentLang,
    isLoading,
    isError,
  };
}

