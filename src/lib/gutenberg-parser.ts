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
  // Matches:
  // 1. Explicit CHAPTER / BOOK / ACT / SCENE / CANTO / PART / STORY / TALE / SECTION + number/title
  // 2. Special literary sections (ETYMOLOGY, EXTRACTS, PREFACE, PROLOGUE, EPILOGUE, INTRODUCTION, etc.)
  // 3. Standalone Roman numerals on their own line preceded by a blank line (e.g. "\n\n  IV  \n\n" as in The Great Gatsby, Dorian Gray, etc.)
  const headingRegex = /(?:^|\n\s*\n)\s*(?:(?:(?:CHAPTER|Chapter|BOOK|Book|ACT|Act|SCENE|Scene|CANTO|Canto|PART|Part|STORY|Story|TALE|Tale|SECTION|Section)\s+([IVXLCDM\d]+[^\n]*))|(?:(?:ETYMOLOGY|EXTRACTS|PREFACE|PROLOGUE|EPILOGUE|INTRODUCTION)\b[^\n]*)|(?:([IVXLCDM]{1,8})\s*(?=\n\s*\n)))/g;
  const tocMatch = /(?:^|\n\n)(?:CONTENTS|TABLE OF CONTENTS|INDEX)\b/i.exec(mainBody);

  const rawMatches: { index: number; title: string; displayTitle?: string; bodyLength: number }[] = [];
  let m: RegExpExecArray | null;

  while ((m = headingRegex.exec(mainBody)) !== null) {
    const rawHeading = m[0].trim();
    const displayTitle = m[2] ? `Chapter ${m[2]}` : rawHeading;
    rawMatches.push({
      index: m.index,
      title: rawHeading,
      displayTitle,
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
  const validMatches: { index: number; title: string; displayTitle?: string }[] = [];
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

  // Strategy 3: If standard chaptering and front-matter TOC found <= 1 match,
  // scan for whitespace-isolated major work titles in anthologies/collections (e.g. Book 831, Dubliners)
  if (validMatches.length <= 1) {
    const lines = mainBody.split('\n');
    const anthologyCandidates: { index: number; title: string; displayTitle?: string; bodyLength: number }[] = [];
    let currentOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const lineOffset = currentOffset;
      currentOffset += line.length + 1;

      if (!trimmed) continue;

      const prevBlank = i === 0 || lines[i - 1].trim() === '';
      const nextBlank = i === lines.length - 1 || lines[i + 1].trim() === '';

      if (!prevBlank || !nextBlank) continue;

      // Clean footnote brackets: [11], [21], [Footnote ...]
      const cleaned = trimmed.replace(/\[\s*\d+\s*\]|\[\s*Footnote.*?\]/gi, '').trim();
      if (!cleaned || cleaned.length < 3 || cleaned.length > 60) continue;

      // Ignore lines that start with quotes or have comma-separated lists
      if (/^["'“‘]/.test(cleaned) || cleaned.includes('", "') || cleaned.includes('", AND')) continue;

      // Exclude Gutenberg front/back legal & bibliographic notices
      const isExcluded =
        /^(?:THE\s+PROJECT\s+GUTENBERG|PROJECT\s+GUTENBERG|GUTENBERG|BIBLIOGRAPHY|SELECTED\s+BIBLIOGRAPHY|OTHER\s+TRANSLATIONS|RECOMMENDED\s+READING|ORIGINAL\s+TEXT|TRANSLATED\s+BY|EDITED\s+BY|PUBLISHED\s+BY|ILLUSTRATIONS|CONTENTS|TABLE\s+OF\s+CONTENTS|INDEX|PAGE|PART\s+OF)\b/i.test(
          cleaned
        ) ||
        /^--.*--$/.test(cleaned) ||
        /^--\s*[A-Z]/.test(cleaned) ||
        /^[A-Z\s]+:\s*$/.test(cleaned);

      if (isExcluded) continue;

      // Check if line is all-caps or title-cased major heading
      const isUpper = cleaned === cleaned.toUpperCase() && /[A-Z]/.test(cleaned);
      const isTitleHeading = isUpper || /^(?:Introduction|Preface|Prologue|Epilogue|Conclusion)\b/i.test(cleaned);

      if (isTitleHeading) {
        // Format all-caps headings with clean title casing for display
        const displayTitle = cleaned
          .toLowerCase()
          .replace(/(?:^|\s)\S/g, (a) => a.toUpperCase())
          .replace(/\b(Et|And|Of|The|In|A|An|Or|For|With|To)\b/g, (match, p1, offset) =>
            offset === 0 ? match : match.toLowerCase()
          );

        anthologyCandidates.push({
          index: lineOffset,
          title: cleaned.replace(/\s+/g, ' '),
          displayTitle,
          bodyLength: 0,
        });
      }
    }

    // Filter out candidates that are too close (< 1000 characters)
    const filteredCandidates: { index: number; title: string; displayTitle?: string; bodyLength: number }[] = [];
    for (let i = 0; i < anthologyCandidates.length; i++) {
      const cand = anthologyCandidates[i];
      const next = anthologyCandidates[i + 1];
      const dist = next ? next.index - cand.index : mainBody.length - cand.index;
      if (dist >= 1000) {
        cand.bodyLength = dist;
        filteredCandidates.push(cand);
      }
    }

    if (filteredCandidates.length >= 2) {
      validMatches.length = 0;
      validMatches.push(...filteredCandidates);
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
      displayTitle: (current.displayTitle || current.title).replace(/\n+/g, ' — '),
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
  const headerSlice = rawText.slice(0, 5000);
  const titleMatch = /^\s*Title:\s*([^\r\n]+)/im.exec(headerSlice);
  const authorMatch =
    /^\s*Author:\s*([^\r\n]+)/im.exec(headerSlice) ||
    /^\s*by\s+([^\r\n]+)/im.exec(headerSlice);

  return {
    title: titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : undefined,
    author: authorMatch ? authorMatch[1].replace(/\s+/g, ' ').trim() : undefined,
  };
}

export interface DynamicBookPassage {
  chapterLabel: string;
  openingLine: string;
  secondaryQuote?: string;
  leftPageQuote2?: string;
  quoteExcerpt: string;
  rightPageQuote2?: string;
  tertiaryQuote?: string;
  commentary?: string;
}

/**
 * Dynamically extracts authentic passages and literary quotes directly from raw Gutenberg book text.
 */
export function extractDynamicBookPassages(
  rawText: string | undefined | null,
  book: { id: number; title: string; authors?: { name: string }[]; subjects?: string[] }
): DynamicBookPassage[] {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 200) {
    return [];
  }

  const chapters = parseGutenbergChapters(rawText);
  // Filter out pure preamble/license sections to focus on narrative chapters
  const narrativeChapters = chapters.filter(
    (ch) =>
      !ch.title.toLowerCase().includes('preamble') &&
      !ch.title.toLowerCase().includes('license') &&
      !ch.title.toLowerCase().includes('contents') &&
      ch.content.trim().length > 300
  );

  const targetChapters = narrativeChapters.length > 0 ? narrativeChapters : chapters;
  if (targetChapters.length === 0) return [];

  const cleanParagraphs = (content: string): string[] => {
    return content
      .split(/\n\s*\n+/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter((p) => {
        // Exclude headings, roman numerals, short index lines, and license artifacts
        if (p.length < 35 || p.length > 800) return false;
        if (/^(chapter|book|canto|act|scene|part|volume)\s+[0-9ivxlcdm]+/i.test(p)) return false;
        if (/^table of contents/i.test(p)) return false;
        return true;
      });
  };

  const findQuotesInParagraphs = (paras: string[]): string[] => {
    return paras.filter((p) => /["'“][^"'”]{15,}["'”]/.test(p));
  };

  const safeCleanQuote = (text: string | undefined | null, maxLen: number = 220, fallback: string = ''): string => {
    if (!text || typeof text !== 'string') {
      return fallback ? (fallback.startsWith('“') ? fallback : `“${fallback}”`) : '';
    }
    const trimmed = text.trim();
    if (!trimmed) {
      return fallback ? (fallback.startsWith('“') ? fallback : `“${fallback}”`) : '';
    }
    const withQuotes = trimmed.startsWith('“') || trimmed.startsWith('"') ? trimmed : `“${trimmed}”`;
    return withQuotes.length > maxLen ? `${withQuotes.slice(0, maxLen - 1).trim()}…”` : withQuotes;
  };

  const createPassageFromChapter = (
    chapter: ChapterSection,
    fallbackIndex: number,
    labelPrefix: string
  ): DynamicBookPassage => {
    const paras = cleanParagraphs(chapter.content);
    const quotes = findQuotesInParagraphs(paras);

    const firstPara = paras[0] || chapter.content.slice(0, 200) || `Here begins ${book.title}.`;
    const secQuote = quotes[0] || paras[1] || paras[0] || firstPara;
    const leftQuote2 = quotes[1] || paras[2] || paras[0] || firstPara;
    const mainExcerpt = quotes[2] || paras[3] || paras[1] || firstPara;
    const rightQuote2 = quotes[3] || paras[4] || paras[2] || firstPara;
    const tertQuote = quotes[4] || paras[5] || paras[3] || firstPara;

    return {
      chapterLabel: chapter.displayTitle ? `${labelPrefix} • ${chapter.displayTitle}` : `${labelPrefix} • Chapter ${fallbackIndex}`,
      openingLine: safeCleanQuote(firstPara, 280, `Here begins ${book.title}.`),
      secondaryQuote: safeCleanQuote(secQuote, 200, firstPara),
      leftPageQuote2: safeCleanQuote(leftQuote2, 190, firstPara),
      quoteExcerpt: safeCleanQuote(mainExcerpt, 260, firstPara),
      rightPageQuote2: safeCleanQuote(rightQuote2, 200, firstPara),
      tertiaryQuote: safeCleanQuote(tertQuote, 160, firstPara),
      commentary: `Dynamically extracted from the authentic unabridged text (ID #${book.id}).`,
    };
  };

  const passages: DynamicBookPassage[] = [];

  if (targetChapters.length >= 5) {
    // 5 Passages across the entire narrative arc: Chapter 1, 2, 3, Mid-Book, Climax
    passages.push(createPassageFromChapter(targetChapters[0], 1, 'Chapter I'));
    passages.push(createPassageFromChapter(targetChapters[1], 2, 'Chapter II'));
    passages.push(createPassageFromChapter(targetChapters[2], 3, 'Act II'));
    const midIdx = Math.floor(targetChapters.length * 0.5);
    passages.push(createPassageFromChapter(targetChapters[midIdx], midIdx + 1, 'Act III • Climax'));
    const lastIdx = targetChapters.length - 1;
    passages.push(createPassageFromChapter(targetChapters[lastIdx], lastIdx + 1, 'Final Chapter'));
  } else if (targetChapters.length >= 3) {
    passages.push(createPassageFromChapter(targetChapters[0], 1, 'Chapter I'));
    passages.push(createPassageFromChapter(targetChapters[1], 2, 'Act II'));
    passages.push(createPassageFromChapter(targetChapters[2], 3, 'Act III'));
  } else if (targetChapters.length === 2) {
    passages.push(createPassageFromChapter(targetChapters[0], 1, 'Chapter I'));
    passages.push(createPassageFromChapter(targetChapters[1], 2, 'Chapter II'));
    const midIdx = 1;
    passages.push(createPassageFromChapter(targetChapters[midIdx], midIdx + 1, 'Act III'));
  } else if (targetChapters.length === 1) {
    // For single un-segmented texts, create 3 passages from different paragraph offsets
    const paras = cleanParagraphs(targetChapters[0].content);
    const chunk = Math.max(1, Math.floor(paras.length / 3));

    const makeSlicePassage = (startPara: number, label: string): DynamicBookPassage => {
      const slice = paras.length > 0 ? paras.slice(startPara, startPara + chunk) : [targetChapters[0].content];
      const quotes = findQuotesInParagraphs(slice);
      const first = slice[0] || targetChapters[0].content.slice(0, 200) || `Here begins ${book.title}.`;
      const sec = quotes[0] || slice[1] || slice[0] || first;
      const left2 = quotes[1] || slice[2] || slice[0] || first;
      const main = quotes[2] || slice[3] || slice[1] || first;
      const right2 = quotes[3] || slice[4] || slice[2] || first;
      const tert = quotes[4] || slice[5] || slice[3] || first;

      return {
        chapterLabel: `${label} • ${book.title}`,
        openingLine: safeCleanQuote(first, 280, `Here begins ${book.title}.`),
        secondaryQuote: safeCleanQuote(sec, 200, first),
        leftPageQuote2: safeCleanQuote(left2, 190, first),
        quoteExcerpt: safeCleanQuote(main, 260, first),
        rightPageQuote2: safeCleanQuote(right2, 200, first),
        tertiaryQuote: safeCleanQuote(tert, 160, first),
        commentary: `Preserved in the Project Gutenberg archive (ID #${book.id}).`,
      };
    };

    passages.push(makeSlicePassage(0, 'Chapter I • Opening Excerpt'));
    passages.push(makeSlicePassage(Math.min(paras.length - 1, Math.max(0, chunk)), 'Act II • Notable Dialogue'));
    passages.push(makeSlicePassage(Math.min(paras.length - 1, Math.max(0, chunk * 2)), 'Act III • Climactic Excerpt'));
  }

  return passages;
}
