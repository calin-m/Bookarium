import { GUTENBERG_PARSER_CONFIG, type ChapterSection, type DynamicBookPassage } from './types';
import { parseGutenbergChapters } from './segmentation';

/**
 * Dynamically extracts authentic passages and literary quotes directly from raw Gutenberg book text.
 */
export function extractDynamicBookPassages(
  rawText: string | undefined | null,
  book: { id: number; title: string; authors?: { name: string }[]; subjects?: string[] }
): DynamicBookPassage[] {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 50) {
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
      !ch.displayTitle.toLowerCase().includes('preamble') &&
      !ch.displayTitle.toLowerCase().includes('license') &&
      !ch.displayTitle.toLowerCase().includes('colophon')
  );

  const nonTrivialChapters = narrativeChapters.filter((ch) => ch.content.trim().length > 300);
  const targetChapters =
    nonTrivialChapters.length > 0
      ? nonTrivialChapters
      : narrativeChapters.length > 0
      ? narrativeChapters
      : chapters;
  if (targetChapters.length === 0) return [];

  const cleanParagraphs = (content: string): string[] => {
    return content
      .split(/\n\s*\n+/)
      .map((rawP) => {
        // Strip leading chapter/book heading if reflow merged it into the paragraph
        const withoutHeading = rawP.replace(
          /^\s*(?:(?:CHAPTER|Chapter|BOOK|Book|ACT|Act|SCENE|Scene|CANTO|Canto|PART|Part|STORY|Story|TALE|Tale|SECTION|Section)\s+(?:[IVXLCDM\d]+|[A-Za-z]+)\b(?::\s*[^\n.!?]{1,60})?\s*)/i,
          ''
        );
        return withoutHeading.replace(/\s+/g, ' ').trim();
      })
      .filter((p) => {
        if (/^\*\*\*\s*(?:start|end) of/i.test(p)) return false;
        // Exclude headings, roman numerals, short index lines, and license artifacts
        if (
          p.length < GUTENBERG_PARSER_CONFIG.MIN_PARAGRAPH_LENGTH ||
          p.length > GUTENBERG_PARSER_CONFIG.MAX_PARAGRAPH_LENGTH
        )
          return false;
        if (/^(chapter|book|canto|act|scene|part|volume)\s+[0-9ivxlcdm]+/i.test(p)) return false;
        if (/^table of contents/i.test(p)) return false;
        // Exclude Distributed Proofreading, Transcriber, and Illustration metadata common in Newest Releases
        if (/\b(?:distributed proofreading|proofreading team|transcriber(?:'s)? note|pgdp\.net|produced by)\b/i.test(p)) return false;
        if (/^\[(?:illustration|frontispiece)/i.test(p)) return false;
        if (/^this (?:ebook|file|text) was (?:produced|prepared)/i.test(p)) return false;

        // Exclude ASCII divider rules, horizontal borders, and repeated symbol lines (e.g. -------, _______, =======, * * * *)
        if (/[-_=*~]{4,}/.test(p)) return false;
        if (/^[\s*\-_~=\.#\/\\|:;+]{3,}$/.test(p)) return false;
        if (/_{3,}/.test(p)) return false;

        // Exclude publication, copyright, printing, and legal colophons (e.g. "Copyright 1927", "Printed in...")
        if (/\b(?:copyright\s+(?:\d{4}|\(c\)|©|by)|all rights reserved|published by|printed in (?:the|great britain|usa|america)|first published|first edition|library of congress)\b/i.test(p)) return false;
        if (/^(?:footnotes?|references?|bibliography)\b/i.test(p)) return false;
        if (/^\[(?:\d+|footnote|\*+)\]/i.test(p)) return false;

        // Alphabetic Letter Floor & Density Guard:
        // Real narrative prose/dialogue requires at least 25 letters and >= 50% alphabetic density
        const letters = p.match(/[\p{L}]/gu) || [];
        if (letters.length < GUTENBERG_PARSER_CONFIG.MIN_PASSAGE_LETTERS) return false;
        const nonWhitespace = p.replace(/\s+/g, '');
        if (nonWhitespace.length > 0 && letters.length / nonWhitespace.length < GUTENBERG_PARSER_CONFIG.MIN_ALPHABETIC_DENSITY) {
          return false;
        }

        return true;
      });
  };

  const findQuotesInParagraphs = (paras: string[]): string[] => {
    return paras.filter((p) => {
      const quoteMatches = p.match(/["'“][^"'”]{15,}["'”]/g);
      if (!quoteMatches) return false;
      return quoteMatches.some((q) => {
        const letters = q.match(/[\p{L}]/gu) || [];
        return letters.length >= GUTENBERG_PARSER_CONFIG.MIN_QUOTE_LETTERS && !/_{3,}/.test(q);
      });
    });
  };

  const safeCleanQuote = (text: string, maxLen: number): string => {
    const trimmed = text.replace(/^[\s*\-_~=\.#\/\\|:;+]+|[\s*\-_~=\.#\/\\|:;+]+$/g, '').trim();
    if (!trimmed) return '';
    const withQuotes = trimmed.startsWith('“') || trimmed.startsWith('"') ? trimmed : `“${trimmed}”`;
    return withQuotes.length > maxLen ? `${withQuotes.slice(0, maxLen - 1).trim()}…”` : withQuotes;
  };

  const buildPassageFromParagraphs = (
    paras: string[],
    rawFallbackContent: string,
    chapterLabel: string,
    commentary: string
  ): DynamicBookPassage => {
    const used = new Set<string>();
    const markUsed = (text: string | undefined): string | undefined => {
      if (!text) return undefined;
      used.add(text.trim().toLowerCase());
      return text;
    };

    const firstPara =
      paras[0] ||
      cleanParagraphs(rawFallbackContent)[0] ||
      `${book.title}, preserved in the Project Gutenberg archive.`;
    markUsed(firstPara);

    const quotes = findQuotesInParagraphs(paras).filter(
      (q) => !used.has(q.trim().toLowerCase())
    );

    const nextDistinct = (): string | undefined => {
      const q = quotes.shift();
      if (q && !used.has(q.trim().toLowerCase())) {
        return markUsed(q);
      }
      const p = paras.find((cand) => !used.has(cand.trim().toLowerCase()));
      if (p) {
        return markUsed(p);
      }
      return undefined;
    };

    const excerptCandidate = nextDistinct() || firstPara;
    const secQuoteCandidate = nextDistinct();
    const leftQuote2Candidate = nextDistinct();
    const rightQuote2Candidate = nextDistinct();
    const tertQuoteCandidate = nextDistinct();

    return {
      chapterLabel,
      openingLine: safeCleanQuote(firstPara, 280),
      secondaryQuote: secQuoteCandidate ? safeCleanQuote(secQuoteCandidate, 200) : undefined,
      leftPageQuote2: leftQuote2Candidate ? safeCleanQuote(leftQuote2Candidate, 190) : undefined,
      quoteExcerpt: safeCleanQuote(excerptCandidate, 260),
      rightPageQuote2: rightQuote2Candidate ? safeCleanQuote(rightQuote2Candidate, 200) : undefined,
      tertiaryQuote: tertQuoteCandidate ? safeCleanQuote(tertQuoteCandidate, 160) : undefined,
      commentary,
    };
  };

  const createPassageFromChapter = (
    chapter: ChapterSection,
    fallbackIndex: number,
    labelPrefix: string
  ): DynamicBookPassage => {
    const label = chapter.displayTitle
      ? `${labelPrefix} • ${chapter.displayTitle}`
      : `${labelPrefix} • Chapter ${fallbackIndex}`;
    return buildPassageFromParagraphs(
      cleanParagraphs(chapter.content),
      chapter.content,
      label,
      `Dynamically extracted from the authentic unabridged text (ID #${book.id}).`
    );
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
  } else {
    // For single un-segmented texts, create 3 passages from different paragraph offsets
    const paras = cleanParagraphs(targetChapters[0].content);
    const chunk = Math.max(1, Math.floor(paras.length / 3));

    const makeSlicePassage = (startPara: number, label: string): DynamicBookPassage => {
      const slice =
        paras.length > 0 ? paras.slice(startPara, startPara + chunk) : [];
      return buildPassageFromParagraphs(
        slice,
        targetChapters[0].content,
        `${label} • ${book.title}`,
        `Preserved in the Project Gutenberg archive (ID #${book.id}).`
      );
    };

    passages.push(makeSlicePassage(0, 'Chapter I • Opening Excerpt'));
    passages.push(makeSlicePassage(Math.min(paras.length - 1, Math.max(0, chunk)), 'Act II • Notable Dialogue'));
    passages.push(makeSlicePassage(Math.min(paras.length - 1, Math.max(0, chunk * 2)), 'Act III • Climactic Excerpt'));
  }

  return passages;
}

