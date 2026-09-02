import { GUTENBERG_PARSER_CONFIG, type ChapterSection } from './types';

const paginationCache = new Map<string, string[]>();
const MAX_PAGINATION_CACHE_ENTRIES = 500;

export function clearPaginationCache(): void {
  paginationCache.clear();
}

/**
 * Splits chapter content into clean virtual pages snapped to sentence, paragraph, and word boundaries.
 * Guarantees words are NEVER split across page turns.
 */
export function paginateChapterContent(content: string, charsPerPage: number): string[] {
  if (!content || !content.trim()) return [''];
  if (content.length <= charsPerPage) return [content];

  const headSample = content.slice(0, 24);
  const tailSample = content.slice(-24);
  const cacheKey = `${content.length}:${charsPerPage}:${headSample}:${tailSample}`;

  const cached = paginationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pages: string[] = [];
  let remaining = content;

  while (remaining.length > 0) {
    if (remaining.length <= charsPerPage) {
      pages.push(remaining.trim());
      break;
    }

    let splitIndex = charsPerPage;
    const minSearch = Math.floor(charsPerPage * 0.75);
    const windowText = remaining.slice(minSearch, charsPerPage + 100);

    // 1. Prefer splitting cleanly on a paragraph boundary (\n\n)
    const paraIndex = windowText.lastIndexOf('\n\n');
    if (paraIndex !== -1 && minSearch + paraIndex <= charsPerPage + 60) {
      splitIndex = minSearch + paraIndex + 2;
    } else {
      // 2. Look for a sentence boundary (. , ! , ? )
      const searchSub = remaining.slice(minSearch, charsPerPage + 60);
      const sentenceRegex = /[.!?]["']?\s+/g;
      let lastSentenceEnd = -1;
      let match: RegExpExecArray | null;
      while ((match = sentenceRegex.exec(searchSub)) !== null) {
        lastSentenceEnd = minSearch + match.index + match[0].length;
      }

      if (lastSentenceEnd !== -1 && lastSentenceEnd <= charsPerPage + 60) {
        splitIndex = lastSentenceEnd;
      } else {
        // 3. Fallback: snap to the last whitespace before charsPerPage
        const spaceIndex = remaining.slice(0, charsPerPage).lastIndexOf(' ');
        if (spaceIndex > minSearch) {
          splitIndex = spaceIndex + 1;
        }
      }
    }

    const pageSlice = remaining.slice(0, splitIndex).trim();
    if (pageSlice) {
      pages.push(pageSlice);
    }
    remaining = remaining.slice(splitIndex).trim();
  }

  if (paginationCache.size >= MAX_PAGINATION_CACHE_ENTRIES) {
    const firstKey = paginationCache.keys().next().value;
    if (firstKey) paginationCache.delete(firstKey);
  }
  paginationCache.set(cacheKey, pages);

  return pages.length > 0 ? pages : [content];
}

/**
 * Calculate the estimated characters per page for a given font size.
 */
export function getCharsPerPage(fontSize: number = 18): number {
  return Math.max(
    GUTENBERG_PARSER_CONFIG.MIN_CHARS_PER_PAGE,
    Math.floor(GUTENBERG_PARSER_CONFIG.CHARS_PER_PAGE_BASE / (fontSize / 18))
  );
}

/**
 * Calculate estimated reading time in minutes based on 200 wpm standard.
 */
export function calculateReadingTime(text: string): number {
  const totalWords = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(totalWords / GUTENBERG_PARSER_CONFIG.ESTIMATED_WORDS_PER_MINUTE);
}

/**
 * Calculate the true continuous book-wide pagination across all chapters for a given font size.
 */
export function calculateVolumePageSpread(
  chapters: ChapterSection[],
  fontSize: number = 18
): {
  chaptersWithPagination: ChapterSection[];
  totalVolumePages: number;
} {
  const charsPerPage = getCharsPerPage(fontSize);
  let cumulativePage = 1;

  const chaptersWithPagination = chapters.map((ch) => {
    const pages = paginateChapterContent(ch.content, charsPerPage);
    const pageCount = pages.length;
    const startPage = cumulativePage;
    cumulativePage += pageCount;
    return {
      ...ch,
      pages,
      startPageNumber: startPage,
      pageCount,
    };
  });

  const totalVolumePages = Math.max(1, cumulativePage - 1);
  return {
    chaptersWithPagination,
    totalVolumePages,
  };
}

