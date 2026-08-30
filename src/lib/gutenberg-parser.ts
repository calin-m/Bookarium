/**
 * Project Gutenberg Chapter Segmentation & Pagination Engine
 * Parses raw Gutenberg texts, cleans license preambles/colophons,
 * segments texts into discrete chapter AST nodes, and calculates virtual volume page spreads.
 */

export interface ChapterSection {
  id: number;
  title: string;
  displayTitle: string;
  content: string;
  startPageNumber: number;
  pageCount: number;
}

export const GUTENBERG_PARSER_CONFIG = {
  CHARS_PER_PAGE_BASE: 5600,
  MIN_CHARS_PER_PAGE: 1200,
  TOC_MAX_HEADING_LENGTH: 180,
  TOC_SEARCH_WINDOW_BYTES: 9000,
  TOC_CLUSTER_BODY_THRESHOLD: 25000,
  ESTIMATED_WORDS_PER_MINUTE: 200,
} as const;

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
 * Parse raw Gutenberg plain-text into clean structured chapter sections.
 * Suppresses front-matter Table of Contents (TOC) lists, prefaces, extracts, and closing license matter.
 */
export function parseGutenbergChapters(rawText: string | undefined | null): ChapterSection[] {
  if (!rawText) return [];
  const text = rawText.replace(/\r\n/g, '\n');

  // 1. Separate Gutenberg Start and End markers if present
  const startMarkerRegex = /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\*]*\*\*\*/i;
  const endMarkerRegex = /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\*]*\*\*\*/i;

  const startMatch = startMarkerRegex.exec(text);
  const endMatch = endMarkerRegex.exec(text);

  const bodyStart = startMatch ? startMatch.index + startMatch[0].length : 0;
  const bodyEnd = endMatch ? endMatch.index : text.length;

  const preBody = text.slice(0, bodyStart);
  const mainBody = text.slice(bodyStart, bodyEnd);
  const postBody = text.slice(bodyEnd);

  // 2. Identify candidate chapter / major headings in mainBody
  const headingRegex = /(?:^|\n\n)(?:(?:CHAPTER|Chapter|BOOK|Book|ACT|Act|SCENE|Scene|CANTO|Canto|PART|Part)\s+([IVXLCDM\d]+[^\n]*)|(?:ETYMOLOGY|EXTRACTS|PREFACE|PROLOGUE|EPILOGUE|INTRODUCTION)\b[^\n]*)/g;
  const tocMatch = /(?:^|\n\n)(?:CONTENTS|TABLE OF CONTENTS|INDEX)\b/i.exec(mainBody);

  const rawMatches: { index: number; title: string; bodyLength: number }[] = [];
  let m: RegExpExecArray | null;

  while ((m = headingRegex.exec(mainBody)) !== null) {
    rawMatches.push({
      index: m.index,
      title: m[0].trim(),
      bodyLength: 0,
    });
  }

  // Calculate distance to next heading
  for (let i = 0; i < rawMatches.length; i++) {
    const start = rawMatches[i].index;
    const end = i + 1 < rawMatches.length ? rawMatches[i + 1].index : mainBody.length;
    rawMatches[i].bodyLength = end - start;
  }

  // 3. Filter out Front-Matter Table of Contents lines
  const validMatches: { index: number; title: string }[] = [];
  for (let i = 0; i < rawMatches.length; i++) {
    const item = rawMatches[i];
    const prevItem = rawMatches[i - 1];
    const nextItem = rawMatches[i + 1];

    const isVeryShort = item.bodyLength < GUTENBERG_PARSER_CONFIG.TOC_MAX_HEADING_LENGTH;
    const isInsideTOCCluster =
      (prevItem && prevItem.bodyLength < GUTENBERG_PARSER_CONFIG.TOC_MAX_HEADING_LENGTH) ||
      (nextItem && nextItem.bodyLength < GUTENBERG_PARSER_CONFIG.TOC_MAX_HEADING_LENGTH);

    const hasLaterDuplicate = rawMatches.some(
      (other, idx) => idx > i && other.title.toLowerCase().slice(0, 10) === item.title.toLowerCase().slice(0, 10)
    );

    // If it has a duplicate later and short body, or is inside a TOC cluster before main body
    if (
      (isVeryShort && hasLaterDuplicate) ||
      (isInsideTOCCluster &&
        isVeryShort &&
        tocMatch &&
        item.index < tocMatch.index + GUTENBERG_PARSER_CONFIG.TOC_SEARCH_WINDOW_BYTES &&
        item.bodyLength < GUTENBERG_PARSER_CONFIG.TOC_CLUSTER_BODY_THRESHOLD &&
        hasLaterDuplicate)
    ) {
      continue;
    }

    validMatches.push(item);
  }

  const sections: ChapterSection[] = [];

  if (validMatches.length === 0) {
    // Single un-segmented document
    if (text.trim().length > 0) {
      sections.push({
        id: 0,
        title: 'Complete Volume',
        displayTitle: 'Complete Volume',
        content: mainBody.trim() || text.trim(),
        startPageNumber: 1,
        pageCount: 1,
      });
    }
    return sections;
  }

  // Preamble / Front Matter section
  const firstChapterIndex = validMatches[0].index;
  const preambleContent = (preBody + mainBody.slice(0, firstChapterIndex)).trim();
  if (preambleContent.length > 0) {
    sections.push({
      id: 0,
      title: 'Title & Preamble',
      displayTitle: 'Title & Preamble',
      content: preambleContent,
      startPageNumber: 1,
      pageCount: 1,
    });
  }

  // Chapters
  for (let i = 0; i < validMatches.length; i++) {
    const current = validMatches[i];
    const next = validMatches[i + 1];
    const rawContent = mainBody.slice(current.index, next ? next.index : mainBody.length).trim();

    sections.push({
      id: i + 1,
      title: current.title,
      displayTitle: current.title.replace(/\n+/g, ' — '),
      content: rawContent,
      startPageNumber: 1,
      pageCount: 1,
    });
  }

  // Colophon / License Postscript
  if (postBody.trim().length > 0 && sections.length > 0) {
    sections.push({
      id: sections.length,
      title: 'Project Gutenberg License & Colophon',
      displayTitle: 'Colophon & License',
      content: postBody.trim(),
      startPageNumber: 1,
      pageCount: 1,
    });
  }

  return sections;
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
    const pageCount = Math.max(1, Math.ceil(ch.content.length / charsPerPage));
    const startPage = cumulativePage;
    cumulativePage += pageCount;
    return {
      ...ch,
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
