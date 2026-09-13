import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CATALOG_LANGUAGES } from '@/config/catalog-filters';
import { resolveTranslationLanguage } from '@/config/translation-languages';
import { isPlaceholderAuthor } from '@/lib/book-metadata';
import type { GutendexBook } from '@/types/book.types';

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
 * Preserves catalog-level localization and resolves extended historical Gutenberg languages (e.g. Catalan, Ancient Greek).
 */
export function resolveLanguageLabel(code: string): string {
  if (!code) return 'Unknown';
  const match = CATALOG_LANGUAGES.find((l) => l.value.toLowerCase() === code.toLowerCase());
  if (match?.label && match?.value) {
    return match.label;
  }
  const resolved = resolveTranslationLanguage(code);
  if (resolved?.label) {
    return resolved.label;
  }
  return code.toUpperCase();
}

/**
 * React Query hook that discovers alternative language translations and editions
 * for the currently active book volume.
 * 
 * Uses a Two-Tier Resolution Architecture:
 * - Tier 1: Queries /api/books/translations?id=... for 100% verified Supabase relational editions.
 * - Tier 2: Gracefully falls back to local AST search filtering if DB returns 0 editions or is unseeded.
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

  // Tier 1: Query relational database translation links
  const {
    data: dbData,
    isLoading: isDbLoading,
  } = useQuery<{ results: { bookId: number; title: string; languageCode: string; isCurrent: boolean }[] }>({
    queryKey: ['db-book-translations', currentBookId],
    queryFn: async () => {
      if (!currentBookId || currentBookId <= 0) return { results: [] };
      const endpoint = `/api/books/translations?id=${currentBookId}`;
      const res = await fetch(endpoint);
      if (!res.ok) return { results: [] };
      return res.json();
    },
    enabled: Boolean(currentBookId && currentBookId > 0),
    staleTime: 1000 * 60 * 30, // 30 minutes cache
    gcTime: 1000 * 60 * 60, // 1 hour garbage collection
  });

  const hasDbEditions = Boolean(
    dbData?.results &&
    Array.isArray(dbData.results) &&
    dbData.results.some(
      (r) => typeof r.languageCode === 'string' && r.bookId > 0 && r.bookId !== currentBookId
    )
  );

  // Tier 2: Heuristic AST Search Fallback (Only queried when DB has no other editions)
  const {
    data: astData,
    isLoading: isAstLoading,
    isError: isAstError,
  } = useQuery<{ results: GutendexBook[] }>({
    queryKey: ['ast-book-translations', currentBookId, searchQuery],
    queryFn: async () => {
      if (!searchQuery) return { results: [] };
      const endpoint = `/api/books?search=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(endpoint);
      if (!res.ok) {
        throw new Error(`Failed to fetch translations: ${res.status}`);
      }
      return res.json();
    },
    enabled: Boolean(!hasDbEditions && searchQuery && currentBookId && currentBookId > 0),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });

  const translations = useMemo<BookTranslationOption[]>(() => {
    const activeId = currentBookId || 0;

    // TIER 1: If relational translations exist in Supabase, return them with 100% precision
    if (hasDbEditions && dbData?.results) {
      const options: BookTranslationOption[] = dbData.results.map((r) => ({
        bookId: r.bookId,
        title: r.title,
        languageCode: r.languageCode,
        languageLabel: resolveLanguageLabel(r.languageCode),
        isCurrent: r.bookId === activeId,
      }));

      // Ensure current volume is represented
      if (!options.some((o) => o.isCurrent)) {
        for (const lang of currentLangs) {
          const code = lang.toLowerCase();
          options.unshift({
            bookId: activeId,
            title: title || 'Current Edition',
            languageCode: code,
            languageLabel: resolveLanguageLabel(code),
            isCurrent: true,
          });
        }
      }

      return options.sort((a, b) => {
        if (a.isCurrent && !b.isCurrent) return -1;
        if (!a.isCurrent && b.isCurrent) return 1;
        return a.languageLabel.localeCompare(b.languageLabel);
      });
    }

    // TIER 2: Fallback to client-side AST logic gates
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
    if (astData?.results && Array.isArray(astData.results)) {
      const hasAuthenticAuthor = Boolean(authorSurname && !isPlaceholderAuthor(author));
      const surnameLower = authorSurname.toLowerCase();
      const firstKeyword = titleKeywords.split(/\s+/)[0]?.toLowerCase() || '';

      for (const book of astData.results) {
        if (!book.languages || book.languages.length === 0) continue;
        if (book.id === activeId) continue;

        // Author check: does any author or translator name contain the surname?
        const matchesAuthor =
          Boolean(surnameLower) &&
          (book.authors?.some((a) => a.name?.toLowerCase().includes(surnameLower)) ||
           book.translators?.some((t) => t.name?.toLowerCase().includes(surnameLower)));

        const matchesTitle =
          Boolean(firstKeyword) &&
          Boolean(book.title?.toLowerCase().includes(firstKeyword));

        // Strict rejection:
        // 1. If the current volume has a known author, candidate MUST match the author or translator.
        //    Never allow foreign-author books through due to database stemmer collisions (e.g. Alcover vs Alcove).
        if (hasAuthenticAuthor && !matchesAuthor) {
          continue;
        }

        // 2. If the current volume is anonymous/placeholder, candidate MUST match the title keywords.
        if (!hasAuthenticAuthor && !matchesTitle) {
          continue;
        }

        for (const lang of book.languages) {
          const langCode = lang.toLowerCase();

          const existing = map.get(langCode);
          if (!existing) {
            map.set(langCode, {
              bookId: book.id,
              title: book.title || `Volume #${book.id}`,
              languageCode: langCode,
              languageLabel: resolveLanguageLabel(langCode),
              isCurrent: false,
            });
          } else if (!existing.isCurrent && matchesTitle) {
            // Prioritize an edition that matches title keywords over one that only matched author
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
  }, [hasDbEditions, dbData, astData, currentBookId, title, currentLangs, authorSurname, titleKeywords]);

  return {
    translations,
    currentLanguage: resolvedCurrentLang,
    isLoading: isDbLoading || (!hasDbEditions && isAstLoading),
    isError: Boolean(isAstError),
  };
}
