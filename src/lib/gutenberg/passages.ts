import { GUTENBERG_PARSER_CONFIG, type ChapterSection, type DynamicBookPassage } from './types';
import { parseGutenbergChapters } from './segmentation';

/**
 * Dynamically extracts authentic passages and literary quotes directly from raw Gutenberg book text.
 */
export function extractDynamicBookPassages(
  rawText: string | undefined | null,
  book: { id: number; title: string; authors?: { name: string }[]; subjects?: string[] },
  maxPassages: number = 5
): DynamicBookPassage[] {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 50) {
    return [];
  }

  // Bound analysis window to prevent main thread blocking on massive books
  const scanLimit =
    maxPassages > 5
      ? Math.max(GUTENBERG_PARSER_CONFIG.PASSAGE_SCAN_BYTES, 900 * 1024)
      : GUTENBERG_PARSER_CONFIG.PASSAGE_SCAN_BYTES;
  const sampleText =
    rawText.length > scanLimit ? rawText.slice(0, scanLimit) : rawText;
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
    const cleaned = text
      .replace(/^[“"'\s*\-_~=\.#\/\\|:;+]+|[”"'\s*\-_~=\.#\/\\|:;+]+$/g, '')
      .trim();
    if (!cleaned) return '';

    const budget = Math.max(40, maxLen - 2);
    if (cleaned.length <= budget) {
      return `“${cleaned}”`;
    }

    const windowStr = cleaned.slice(0, budget);
    const minSentenceEnd = Math.max(45, Math.floor(budget * 0.4));

    // 1. Prefer ending at a natural sentence boundary (. ! ?) within the upper 60% of the budget
    let bestSentenceEnd = -1;
    const sentenceRegex = /[.!?]+(?=["'”’)\]]*(?:\s|$))/g;
    let match: RegExpExecArray | null;
    while ((match = sentenceRegex.exec(windowStr)) !== null) {
      const endPos = match.index + match[0].length;
      if (endPos >= minSentenceEnd) {
        bestSentenceEnd = endPos;
      }
    }

    if (bestSentenceEnd > 0) {
      const sentenceBody = windowStr
        .slice(0, bestSentenceEnd)
        .replace(/[“"']+$/g, '')
        .trim();
      return `“${sentenceBody}”`;
    }

    // 2. Fallback to nearest whole-word space boundary so a word is never sliced in half
    const wordSlice = cleaned.slice(0, budget - 1);
    const lastSpace = wordSlice.lastIndexOf(' ');
    const baseCut =
      lastSpace >= Math.floor(budget * 0.5) ? wordSlice.slice(0, lastSpace) : wordSlice;
    const tidyWord = baseCut.replace(/[,;:\-—–\s“"']+$/g, '').trim();
    return `“${tidyWord}…”`;
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
      openingLine: safeCleanQuote(firstPara, 220),
      secondaryQuote: secQuoteCandidate ? safeCleanQuote(secQuoteCandidate, 175) : undefined,
      leftPageQuote2: leftQuote2Candidate ? safeCleanQuote(leftQuote2Candidate, 140) : undefined,
      quoteExcerpt: safeCleanQuote(excerptCandidate, 220),
      rightPageQuote2: rightQuote2Candidate ? safeCleanQuote(rightQuote2Candidate, 175) : undefined,
      tertiaryQuote: tertQuoteCandidate ? safeCleanQuote(tertQuoteCandidate, 140) : undefined,
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

  if (maxPassages > 5) {
    const clampedMax = Math.min(20, Math.max(6, Math.floor(maxPassages)));
    const usedChapterIndices = new Set<number>();

    if (targetChapters.length >= clampedMax) {
      for (let i = 0; i < clampedMax; i++) {
        const chIdx = Math.floor((i * (targetChapters.length - 1)) / (clampedMax - 1));
        if (!usedChapterIndices.has(chIdx)) {
          usedChapterIndices.add(chIdx);
          passages.push(
            createPassageFromChapter(
              targetChapters[chIdx],
              chIdx + 1,
              `Passage ${passages.length + 1}`
            )
          );
        }
      }
    } else {
      targetChapters.forEach((ch, idx) => {
        passages.push(createPassageFromChapter(ch, idx + 1, `Chapter ${idx + 1}`));
      });

      const allParas = targetChapters.flatMap((ch) => cleanParagraphs(ch.content));
      const remaining = clampedMax - passages.length;
      if (remaining > 0 && allParas.length >= 6) {
        const chunk = Math.max(3, Math.floor(allParas.length / (remaining + 1)));
        for (let i = 1; i <= remaining; i++) {
          const startIdx = Math.min(allParas.length - 3, i * chunk);
          const slice = allParas.slice(startIdx, startIdx + Math.max(6, chunk));
          if (slice.length > 0) {
            passages.push(
              buildPassageFromParagraphs(
                slice,
                targetChapters[0].content,
                `Passage ${passages.length + 1} • ${book.title}`,
                `Dynamically extracted from the authentic unabridged text (ID #${book.id}).`
              )
            );
          }
        }
      }
    }

    return passages.slice(0, clampedMax);
  }

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

/**
 * Strips outer straight or curly quotation marks and surrounding whitespace so callers can
 * wrap quotes in a single canonical pair of typographic quotes without double-quoting.
 */
export function formatCleanQuote(text?: string): string {
  return (text || '').replace(/^[“"'\s]+|[”"'\s]+$/g, '').trim();
}

export interface SpreadQuoteLayoutOptions {
  title?: string;
  hasContentAdvisory?: boolean;
  hasCommentary?: boolean;
  cardHeight?: number;
}

export interface ResolvedSpreadQuoteLayout {
  leftQuotes: string[];
  rightQuotes: string[];
  coverQuote: string;
  leftLineClampClass: string;
  rightLineClampClass: string;
  coverLineClampClass: string;
}

/**
 * Deterministically selects and sizes quotes for the Left Page, Right Page, and Closed Front Cover
 * of an open 3D book spread based on character lengths and available vertical line budget.
 * Guarantees that every rendered quote fits within its page container without premature clipping,
 * promotes shorter tertiary candidates when a secondary candidate exceeds remaining space, and
 * prevents cross-page duplicate quotes.
 */
export function resolveSpreadQuoteLayout(
  passage: {
    openingLine?: string;
    secondaryQuote?: string;
    leftPageQuote2?: string;
    quoteExcerpt?: string;
    rightPageQuote2?: string;
    tertiaryQuote?: string;
  },
  options: SpreadQuoteLayoutOptions = {}
): ResolvedSpreadQuoteLayout {
  const CHARS_PER_LINE = 40;
  const BOX_OVERHEAD_LINES = 1.5;

  const estimateQuoteLines = (text: string): number =>
    Math.max(1, Math.ceil(text.length / CHARS_PER_LINE));

  const baseCapacity =
    typeof options.cardHeight === 'number' && options.cardHeight > 0 && options.cardHeight < 430
      ? 11.5
      : 13.5;

  const titleLen = (options.title || '').trim().length;
  const isLongTitle = titleLen > 36;
  const isVeryLongTitle = titleLen > 55;
  const titleOverhead = isVeryLongTitle ? 4.0 : isLongTitle ? 3.0 : 2.0;
  const advisoryOverhead = options.hasContentAdvisory ? 2.5 : 0;
  const leftBudget = baseCapacity - titleOverhead - advisoryOverhead;

  const seenOnLeft = new Set<string>();
  const leftCandidates: string[] = [];
  for (const raw of [passage.openingLine, passage.secondaryQuote, passage.leftPageQuote2]) {
    const cleaned = formatCleanQuote(raw);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (!seenOnLeft.has(key)) {
      seenOnLeft.add(key);
      leftCandidates.push(cleaned);
    }
  }

  const leftQuotes: string[] = [];
  let usedLeftLines = 0;

  if (leftCandidates.length > 0) {
    leftQuotes.push(leftCandidates[0]);
    usedLeftLines = estimateQuoteLines(leftCandidates[0]);

    for (let i = 1; i < leftCandidates.length; i++) {
      const cand = leftCandidates[i];
      const candLines = estimateQuoteLines(cand);

      if (leftQuotes.length === 1) {
        if (usedLeftLines + BOX_OVERHEAD_LINES + candLines <= leftBudget) {
          leftQuotes.push(cand);
          usedLeftLines += BOX_OVERHEAD_LINES + candLines;
        }
      } else if (leftQuotes.length === 2) {
        if (
          !isLongTitle &&
          !options.hasContentAdvisory &&
          leftQuotes.every((q) => q.length <= 120) &&
          cand.length <= 120 &&
          usedLeftLines + BOX_OVERHEAD_LINES + candLines <= leftBudget
        ) {
          leftQuotes.push(cand);
          usedLeftLines += BOX_OVERHEAD_LINES + candLines;
        }
      }
    }
  }

  const renderedLeftKeys = new Set(leftQuotes.map((q) => q.toLowerCase()));
  const commentaryOverhead = options.hasCommentary ? 1.5 : 0;
  const rightBudget = baseCapacity - commentaryOverhead;

  const seenOnRight = new Set<string>();
  const rightCandidates: string[] = [];
  const rawRightPool = [passage.quoteExcerpt, passage.rightPageQuote2, passage.tertiaryQuote];

  for (const raw of rawRightPool) {
    const cleaned = formatCleanQuote(raw);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (!seenOnRight.has(key) && !renderedLeftKeys.has(key)) {
      seenOnRight.add(key);
      rightCandidates.push(cleaned);
    }
  }

  // Fallback if all right-page quotes were identical to left-page quotes
  if (rightCandidates.length === 0) {
    const fallbackPrimary = formatCleanQuote(passage.quoteExcerpt || passage.openingLine);
    if (fallbackPrimary) {
      rightCandidates.push(fallbackPrimary);
    }
  }

  const rightQuotes: string[] = [];
  let usedRightLines = 0;

  if (rightCandidates.length > 0) {
    rightQuotes.push(rightCandidates[0]);
    usedRightLines = estimateQuoteLines(rightCandidates[0]);

    for (let i = 1; i < rightCandidates.length; i++) {
      const cand = rightCandidates[i];
      const candLines = estimateQuoteLines(cand);

      if (rightQuotes.length === 1) {
        if (usedRightLines + BOX_OVERHEAD_LINES + candLines <= rightBudget) {
          rightQuotes.push(cand);
          usedRightLines += BOX_OVERHEAD_LINES + candLines;
        }
      } else if (rightQuotes.length === 2) {
        if (
          rightQuotes.every((q) => q.length <= 120) &&
          cand.length <= 120 &&
          usedRightLines + BOX_OVERHEAD_LINES + candLines <= rightBudget
        ) {
          rightQuotes.push(cand);
          usedRightLines += BOX_OVERHEAD_LINES + candLines;
        }
      }
    }
  }

  // Closed Cover Quote Selection (Featured Book)
  const isLongCoverTitle = titleLen > 40;
  const coverCharBudget = isLongCoverTitle ? 130 : 180;
  const allCoverCandidates = [
    passage.quoteExcerpt,
    passage.openingLine,
    passage.secondaryQuote,
    passage.rightPageQuote2,
    passage.tertiaryQuote,
    passage.leftPageQuote2,
  ]
    .map((q) => formatCleanQuote(q))
    .filter(Boolean);

  const fittingCoverQuote = allCoverCandidates.find((q) => q.length <= coverCharBudget);
  const shortestCoverQuote =
    allCoverCandidates.length > 0
      ? [...allCoverCandidates].sort((a, b) => a.length - b.length)[0]
      : '';
  const coverQuote = fittingCoverQuote || shortestCoverQuote;

  const resolveClampClass = (count: number): string => {
    if (count <= 1) return 'line-clamp-8 sm:line-clamp-9';
    if (count === 2) return 'line-clamp-6 sm:line-clamp-7';
    return 'line-clamp-3 sm:line-clamp-4';
  };

  return {
    leftQuotes,
    rightQuotes,
    coverQuote,
    leftLineClampClass: resolveClampClass(leftQuotes.length),
    rightLineClampClass: resolveClampClass(rightQuotes.length),
    coverLineClampClass: isLongCoverTitle ? 'line-clamp-4' : 'line-clamp-5',
  };
}

