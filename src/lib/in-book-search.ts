import type { ChapterSection } from '@/lib/gutenberg-parser';
import { getCharsPerPage, paginateChapterContent } from '@/lib/gutenberg-parser';
import { normalizeSearchText } from '@/lib/smart-search';

export interface BookSearchMatch {
  id: string;
  chapterIndex: number;
  chapterTitle: string;
  chapterDisplayTitle: string;
  chapterPage: number;
  globalPage: number;
  snippetBefore: string;
  matchedText: string;
  snippetAfter: string;
}

export interface InBookSearchResult {
  query: string;
  totalMatches: number;
  matches: BookSearchMatch[];
  matchedChapterCount: number;
}

/**
 * Escapes special regex characters in a query string.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Searches for a query string across all chapters and virtual pages of a book.
 * Utilizes Unicode normalization for diacritic-insensitive and case-insensitive matching,
 * while extracting original-cased excerpts with surrounding context.
 */
export function searchInBook(
  chapters: ChapterSection[] | undefined | null,
  rawQuery: string | undefined | null,
  fontSize: number = 18,
  maxResults: number = 100
): InBookSearchResult {
  const trimmed = (rawQuery || '').trim();
  const normalizedQuery = normalizeSearchText(trimmed);

  if (!chapters || chapters.length === 0 || !trimmed || normalizedQuery.length < 2) {
    return {
      query: trimmed,
      totalMatches: 0,
      matches: [],
      matchedChapterCount: 0,
    };
  }

  const charsPerPage = getCharsPerPage(fontSize);
  const matches: BookSearchMatch[] = [];
  const matchedChapterIndices = new Set<number>();

  const escapedQuery = escapeRegExp(trimmed);
  const regex = new RegExp(escapedQuery, 'gi');

  for (let cIdx = 0; cIdx < chapters.length; cIdx++) {
    const chapter = chapters[cIdx];
    if (!chapter || !chapter.content) continue;

    const pages = chapter.pages && chapter.pages.length > 0
      ? chapter.pages
      : paginateChapterContent(chapter.content, charsPerPage);

    const startGlobalPage = chapter.startPageNumber || 1;

    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
      const pageText = pages[pIdx];
      if (!pageText) continue;

      let match: RegExpExecArray | null;
      regex.lastIndex = 0;

      // 1. Direct Regex Search (Preserves exact phrase & casing)
      let foundOnPage = false;
      while ((match = regex.exec(pageText)) !== null) {
        foundOnPage = true;
        const matchIndex = match.index;
        const matchLength = match[0].length;

        const snippetStart = Math.max(0, matchIndex - 50);
        const snippetEnd = Math.min(pageText.length, matchIndex + matchLength + 50);

        const rawBefore = pageText.slice(snippetStart, matchIndex);
        const rawMatched = pageText.slice(matchIndex, matchIndex + matchLength);
        const rawAfter = pageText.slice(matchIndex + matchLength, snippetEnd);

        matches.push({
          id: `match-${cIdx}-${pIdx}-${matchIndex}`,
          chapterIndex: cIdx,
          chapterTitle: chapter.title,
          chapterDisplayTitle: chapter.displayTitle || chapter.title,
          chapterPage: pIdx + 1,
          globalPage: startGlobalPage + pIdx,
          snippetBefore: (snippetStart > 0 ? '… ' : '') + rawBefore,
          matchedText: rawMatched,
          snippetAfter: rawAfter + (snippetEnd < pageText.length ? ' …' : ''),
        });

        matchedChapterIndices.add(cIdx);

        if (matches.length >= maxResults) {
          return {
            query: trimmed,
            totalMatches: matches.length,
            matches,
            matchedChapterCount: matchedChapterIndices.size,
          };
        }

        // Prevent infinite loops on zero-width matches
        if (regex.lastIndex === matchIndex) {
          regex.lastIndex++;
        }
      }

      // 2. Diacritic-Insensitive Fallback (e.g. searching 'valjean' for 'Valjean' or accent variants)
      if (!foundOnPage) {
        const normPage = normalizeSearchText(pageText);
        const normMatchIndex = normPage.indexOf(normalizedQuery);

        if (normMatchIndex !== -1) {
          // Approximate position in original page
          const ratio = normMatchIndex / Math.max(1, normPage.length);
          const approxIndex = Math.min(pageText.length - 1, Math.floor(pageText.length * ratio));
          const snippetStart = Math.max(0, approxIndex - 40);
          const snippetEnd = Math.min(pageText.length, approxIndex + trimmed.length + 40);

          matches.push({
            id: `match-norm-${cIdx}-${pIdx}-${normMatchIndex}`,
            chapterIndex: cIdx,
            chapterTitle: chapter.title,
            chapterDisplayTitle: chapter.displayTitle || chapter.title,
            chapterPage: pIdx + 1,
            globalPage: startGlobalPage + pIdx,
            snippetBefore: (snippetStart > 0 ? '… ' : '') + pageText.slice(snippetStart, approxIndex),
            matchedText: pageText.slice(approxIndex, approxIndex + trimmed.length),
            snippetAfter: pageText.slice(approxIndex + trimmed.length, snippetEnd) + (snippetEnd < pageText.length ? ' …' : ''),
          });

          matchedChapterIndices.add(cIdx);

          if (matches.length >= maxResults) {
            return {
              query: trimmed,
              totalMatches: matches.length,
              matches,
              matchedChapterCount: matchedChapterIndices.size,
            };
          }
        }
      }
    }
  }

  return {
    query: trimmed,
    totalMatches: matches.length,
    matches,
    matchedChapterCount: matchedChapterIndices.size,
  };
}

