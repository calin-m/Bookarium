import { GUTENBERG_PARSER_CONFIG, type ChapterSection, type DynamicBookPassage } from './types';
import { parseGutenbergChapters } from './segmentation';

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

  // Bound analysis window to prevent main thread blocking on massive books
  const sampleText =
    rawText.length > GUTENBERG_PARSER_CONFIG.PASSAGE_SCAN_BYTES
      ? rawText.slice(0, GUTENBERG_PARSER_CONFIG.PASSAGE_SCAN_BYTES)
      : rawText;
  const chapters = parseGutenbergChapters(sampleText);
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
        if (
          p.length < GUTENBERG_PARSER_CONFIG.MIN_PARAGRAPH_LENGTH ||
          p.length > GUTENBERG_PARSER_CONFIG.MAX_PARAGRAPH_LENGTH
        )
          return false;
        if (/^(chapter|book|canto|act|scene|part|volume)\s+[0-9ivxlcdm]+/i.test(p)) return false;
        if (/^table of contents/i.test(p)) return false;
        return true;
      });
  };

  const findQuotesInParagraphs = (paras: string[]): string[] => {
    return paras.filter((p) => /["'“][^"'”]{15,}["'”]/.test(p));
  };

  const safeCleanQuote = (
    text: string | undefined | null,
    maxLen: number = GUTENBERG_PARSER_CONFIG.DEFAULT_QUOTE_MAX_LEN,
    fallback: string = ''
  ): string => {
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

