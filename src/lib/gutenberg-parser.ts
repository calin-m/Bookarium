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
  pages?: string[];
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
 * Splits chapter content into clean virtual pages snapped to sentence, paragraph, and word boundaries.
 * Guarantees words are NEVER split across page turns.
 */
export function paginateChapterContent(content: string, charsPerPage: number): string[] {
  if (!content || !content.trim()) return [''];
  if (content.length <= charsPerPage) return [content];

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
    remaining = remaining.slice(splitIndex).trimStart();
  }

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
 * Reflows Project Gutenberg plain-text paragraphs by joining single-newline hard wraps
 * into fluid prose blocks while preserving double-spaced paragraph breaks, dialogue, and verse.
 */
export function reflowGutenbergParagraphs(rawText: string | undefined | null): string {
  if (!rawText) return '';
  const normalized = rawText.replace(/\r\n/g, '\n');
  const paragraphs = normalized.split(/\n{2,}/);

  const reflowed = paragraphs.map((para) => {
    if (!para.trim()) return '';

    const lines = para.split('\n');
    if (lines.length <= 1) return para.trim();

    // In Project Gutenberg, standard paragraphs often start with 2-5 spaces on the first line only.
    // Verse/poetry or blockquotes have all lines deeply indented (4+ spaces) or all lines are very short (< 45 chars).
    const allLinesIndented = lines.length > 1 && lines.every((l) => /^\s{4,}|\t/.test(l));
    const isShortVerse = lines.length > 2 && lines.every((l) => l.trim().length > 0 && l.trim().length < 45);

    if (allLinesIndented || isShortVerse) {
      return para.replace(/^\n+|\n+$/g, '');
    }

    // Join single newlines with a single space to allow natural browser text wrapping across any column width
    return lines
      .map((l) => l.trim())
      .filter(Boolean)
      .join(' ');
  });

  return reflowed.filter(Boolean).join('\n\n');
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

  // Strategy 2: If standard CHAPTER/BOOK regex found <= 2 matches, check for a structured Front-Matter TOC (e.g. short story anthologies)
  if (validMatches.length <= 2) {
    const tocHeadingRegex = /(?:^|\n\n)\s*(?:CONTENTS|TABLE OF CONTENTS|INDEX)\b\.?/i;
    const match = tocHeadingRegex.exec(mainBody);
    if (match) {
      const start = match.index + match[0].length;
      const tocSlice = mainBody.slice(start, start + 4000);
      const lines = tocSlice.split('\n');
      const tocItems: string[] = [];
      let foundTable = false;
      let tocEndOffset = 0;

      for (const line of lines) {
        const clean = line.trim();
        if (!clean) {
          tocEndOffset += line.length + 1;
          continue;
        }
        if (/^(?:PAGE|CHAPTER|\.|\-)+$/i.test(clean)) {
          foundTable = true;
          tocEndOffset += line.length + 1;
          continue;
        }
        const hasPageNumber = /\b\d+\s*$/.test(clean);
        if (hasPageNumber) {
          foundTable = true;
          const titleOnly = clean.replace(/\s+(?:\.{2,}|\d+|[IVXLCDM]+)\s*$/i, '').trim();
          if (titleOnly.length >= 3 && titleOnly.length < 80) {
            tocItems.push(titleOnly);
          }
          tocEndOffset += line.length + 1;
        } else if (foundTable) {
          break;
        } else {
          tocEndOffset += line.length + 1;
        }
      }

      if (tocItems.length >= 2) {
        const searchStart = start + tocEndOffset;
        const searchSlice = mainBody.slice(searchStart);
        const tocMatches: { index: number; title: string; bodyLength: number }[] = [];

        for (const title of tocItems) {
          const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
          const regex = new RegExp(`(?:^|\\n\\n)\\s*(${escaped}[.\\s]*)(?:\\n+(?:BY\\s+[^\\n]+|[A-Z\\s]{3,}))?(?=\\n\\n|$)`, 'i');
          const headingMatch = regex.exec(searchSlice);
          if (headingMatch) {
            tocMatches.push({
              index: searchStart + headingMatch.index,
              title,
              bodyLength: 0,
            });
          }
        }

        if (tocMatches.length >= 2) {
          tocMatches.sort((a, b) => a.index - b.index);
          for (let i = 0; i < tocMatches.length; i++) {
            const startIdx = tocMatches[i].index;
            const endIdx = i + 1 < tocMatches.length ? tocMatches[i + 1].index : mainBody.length;
            tocMatches[i].bodyLength = endIdx - startIdx;
          }
          validMatches.length = 0;
          validMatches.push(...tocMatches);
        }
      }
    }
  }

  const sections: ChapterSection[] = [];

  if (validMatches.length === 0) {
    // Single un-segmented document
    if (text.trim().length > 0) {
      sections.push({
        id: 0,
        title: 'Complete Volume',
        displayTitle: 'Complete Volume',
        content: reflowGutenbergParagraphs(mainBody.trim() || text.trim()),
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
      content: reflowGutenbergParagraphs(preambleContent),
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
      content: reflowGutenbergParagraphs(rawContent),
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
      content: reflowGutenbergParagraphs(postBody.trim()),
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

/**
 * Extract Title and Author directly from the Project Gutenberg preamble header.
 */
export function extractGutenbergHeaderMetadata(rawText: string | undefined | null): {
  title?: string;
  author?: string;
} {
  if (!rawText) return {};
  const headerSlice = rawText.slice(0, 4000);
  const titleMatch = /^Title:\s*([^\r\n]+)/im.exec(headerSlice);
  const authorMatch = /^Author:\s*([^\r\n]+)/im.exec(headerSlice);

  return {
    title: titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : undefined,
    author: authorMatch ? authorMatch[1].replace(/\s+/g, ' ').trim() : undefined,
  };
}
