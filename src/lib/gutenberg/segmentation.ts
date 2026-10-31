import { GUTENBERG_PARSER_CONFIG, type ChapterSection } from './types';
import { formatGutenbergTypography, reflowGutenbergParagraphs } from './reflow';

const SPELLED_NUMBER_PATTERN =
  '(?:THE\\s+)?(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY(?:-[A-Z]+)?|THIRTY(?:-[A-Z]+)?|FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH|THIRTEENTH|FOURTEENTH|FIFTEENTH|SIXTEENTH|SEVENTEENTH|EIGHTEENTH|NINETEENTH|TWENTIETH)';

const DIVISION_KEYWORD_PATTERN =
  '(?:CHAPTER|Chapter|BOOK|Book|ACT|Act|SCENE|Scene|CANTO|Canto|PART|Part|STORY|Story|TALE|Tale|SECTION|Section|STAVE|Stave|LETTER|Letter|ADVENTURE|Adventure|VOLUME|Volume|EPISODE|Episode|FIT|Fit)';

function normalizeHeadingComparisonText(input: string): string {
  return formatGutenbergTypography(input)
    .toLowerCase()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[.:;—\-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips the duplicate leading chapter heading line (and any standalone subtitle line already
 * absorbed into `chapter.displayTitle`) from the top of a rendered page or scroll section
 * when the Reader Surface already renders the `<h2>{chapter.displayTitle}</h2>` banner above it.
 * Keeps `chapter.content` unchanged during pagination and search indexing so page boundaries never shift.
 */
export function stripDuplicateLeadingChapterHeading(
  pageText: string,
  chapter?: Pick<ChapterSection, 'title' | 'displayTitle'> | null
): string {
  if (!pageText || !chapter) return pageText;
  const rawTitle = (chapter.title || '').trim();
  const displayTitle = (chapter.displayTitle || '').trim();
  if (!rawTitle && !displayTitle) return pageText;

  // Never strip synthetic preamble, unsegmented volume, or license section titles
  if (
    /^(?:Title\s*&\s*Preamble|Complete\s+Volume|Colophon\s*&\s*License|Project\s+Gutenberg\s+License)/i.test(
      displayTitle || rawTitle
    )
  ) {
    return pageText;
  }

  const blocks = pageText.split(/\n{2,}/);
  if (blocks.length < 2) return pageText;

  const firstBlockNorm = normalizeHeadingComparisonText(blocks[0]);
  const rawTitleNorm = normalizeHeadingComparisonText(rawTitle);
  const displayTitleNorm = normalizeHeadingComparisonText(displayTitle);

  const isFirstBlockDuplicate =
    Boolean(firstBlockNorm) &&
    (firstBlockNorm === rawTitleNorm ||
      firstBlockNorm === displayTitleNorm ||
      (rawTitleNorm.length >= 3 &&
        firstBlockNorm.startsWith(rawTitleNorm) &&
        firstBlockNorm.length <= rawTitleNorm.length + 80 &&
        !/[.!?]$/.test(blocks[0].trim())));

  if (!isFirstBlockDuplicate) {
    return pageText;
  }

  let sliceStart = 1;

  // Check if blocks[1] is a standalone subtitle that was already absorbed into `displayTitle` (after ": ")
  if (blocks.length >= 3 && displayTitle.includes(':')) {
    const colonIdx = displayTitle.indexOf(':');
    const subtitlePart = displayTitle.slice(colonIdx + 1).trim();
    const subtitleNorm = normalizeHeadingComparisonText(subtitlePart);
    const secondBlockNorm = normalizeHeadingComparisonText(blocks[1]);
    if (
      subtitleNorm.length >= 2 &&
      secondBlockNorm === subtitleNorm &&
      blocks[1].trim().length <= 95
    ) {
      sliceStart = 2;
    }
  }

  const remainder = blocks.slice(sliceStart).join('\n\n').trim();
  return remainder.length > 0 ? remainder : pageText;
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

  // 2. Strategy 1A: Identify primary chapter / major headings in mainBody
  // Matches:
  // 1. Explicit CHAPTER / BOOK / ACT / SCENE / CANTO / PART / STORY / TALE / SECTION + Roman/Arabic number/title
  // 2. Special literary sections (ETYMOLOGY, EXTRACTS, PREFACE, PROLOGUE, EPILOGUE, INTRODUCTION, etc.)
  // 3. Standalone or dotted Roman numerals optionally followed by a single-line subtitle (e.g. "\n\n  IV  \n\n" or "\n\n  I.\n  Introduction\n\n" as in The Time Machine, The Great Gatsby, Dorian Gray, etc.)
  const headingRegex = /(?:^|\n\s*\n)\s*(?:(?:(?:CHAPTER|Chapter|BOOK|Book|ACT|Act|SCENE|Scene|CANTO|Canto|PART|Part|STORY|Story|TALE|Tale|SECTION|Section)\s+([IVXLCDM\d]+[^\n]*))|(?:(?:ETYMOLOGY|EXTRACTS|PREFACE|PROLOGUE|EPILOGUE|INTRODUCTION)\b[^\n]*)|(?:([IVXLCDM]{1,8})\.?(?:(?=\n\s*\n)|\n[ \t]*([A-Za-z][^\n]{1,60})(?=\n\s*\n))))/g;
  const tocMatch = /(?:^|\n\n)(?:CONTENTS|TABLE OF CONTENTS|INDEX)\b/i.exec(mainBody);

  const rawMatches: { index: number; title: string; displayTitle?: string; bodyLength: number }[] = [];
  let m: RegExpExecArray | null;

  while ((m = headingRegex.exec(mainBody)) !== null) {
    const rawHeading = m[0].trim();
    const romanNumeral = m[2];
    const subtitle = m[3];
    let displayTitle = rawHeading;
    if (romanNumeral) {
      displayTitle = subtitle ? `Chapter ${romanNumeral}: ${subtitle.trim()}` : `Chapter ${romanNumeral}`;
    }
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

  // Harvest descriptive chapter subtitles from short TOC items if available
  const formatSubtitleText = (sub: string): string => {
    return sub
      .toLowerCase()
      .replace(/(?:^|\s)\S/g, (a) => a.toUpperCase())
      .replace(
        /\b(And|Of|The|In|On|A|An|Or|For|With|To|At|By|From|De|Et|La|Le|Du)\b/g,
        (mText, _p1, offset) => (offset === 0 ? mText : mText.toLowerCase())
      );
  };

  const normalizeHeadingId = (title: string): string => {
    const clean = title.trim();
    const keywordMatch = clean.match(
      new RegExp(`^${DIVISION_KEYWORD_PATTERN}\\s+(${SPELLED_NUMBER_PATTERN}|[IVXLCDM\\d]+)`, 'i')
    );
    if (keywordMatch) {
      const prefix = keywordMatch[0].split(/\s+/)[0].toLowerCase().slice(0, 2);
      const num = keywordMatch[1].toLowerCase().replace(/^the\s+/i, '').trim();
      return `${prefix}-${num}`;
    }

    const romanMatch = clean.match(/^([IVXLCDM]{1,8})\b/i);
    if (romanMatch) {
      return `ch-${romanMatch[1].toLowerCase()}`;
    }

    const arabicMatch = clean.match(/^(\d{1,4})\b/);
    if (arabicMatch) {
      return `ch-${arabicMatch[1]}`;
    }

    return clean.toLowerCase().replace(/\s+/g, ' ').slice(0, 15);
  };

  const tocSubtitles = new Map<string, string>();

  const recordSubtitle = (rawTitle: string) => {
    const clean = rawTitle.trim();
    if (!clean) return;

    // Pattern 1: Explicit keyword: "CHAPTER I: THE HIRED CAR", "STAVE I: MARLEY'S GHOST", or "CHAPTER ONE - THE BEGINNING"
    const keywordMatch = clean.match(
      new RegExp(
        `^${DIVISION_KEYWORD_PATTERN}\\s+(?:${SPELLED_NUMBER_PATTERN}|[IVXLCDM\\d]+)[:\\s\\-\\.]+(.+)$`,
        'i'
      )
    );
    if (keywordMatch && keywordMatch[1]?.trim()) {
      const norm = normalizeHeadingId(clean);
      const sub = keywordMatch[1].replace(/\s+(?:\.{2,}|\d+|[IVXLCDM]+)\s*$/i, '').trim();
      if (sub.length >= 2 && sub.length < 120 && !tocSubtitles.has(norm)) {
        tocSubtitles.set(norm, formatSubtitleText(sub));
        return;
      }
    }

    // Pattern 2: Front-matter TOC item: "I. THE HIRED CAR 1" or "1. Down the Rabbit-Hole ... 1"
    const tocItemMatch = clean.match(
      /^[ \t]*([IVXLCDM]{1,8}|\d{1,4})[\.\-\s]+([A-Za-z][^\n]+?)\s*(?:\.{2,}|\d+)?$/i
    );
    if (tocItemMatch && tocItemMatch[2]?.trim()) {
      const norm = normalizeHeadingId(clean);
      const sub = tocItemMatch[2].replace(/\s+(?:\.{2,}|\d+|[IVXLCDM]+)\s*$/i, '').trim();
      if (sub.length >= 2 && sub.length < 120 && !/^(?:page|chapter|\d+)$/i.test(sub) && !tocSubtitles.has(norm)) {
        tocSubtitles.set(norm, formatSubtitleText(sub));
      }
    }
  };

  if (tocMatch) {
    const tocSlice = mainBody.slice(
      tocMatch.index,
      tocMatch.index + GUTENBERG_PARSER_CONFIG.TOC_SEARCH_WINDOW_BYTES
    );
    for (const line of tocSlice.split('\n')) {
      recordSubtitle(line);
    }
  }

  for (let i = 0; i < rawMatches.length; i++) {
    const item = rawMatches[i];
    if (item.bodyLength < GUTENBERG_PARSER_CONFIG.TOC_MAX_HEADING_LENGTH) {
      recordSubtitle(item.title);
    }
  }

  // 3. Filter out Front-Matter Table of Contents lines
  const filterTocMatches = (
    candidates: { index: number; title: string; displayTitle?: string; bodyLength: number }[]
  ): { index: number; title: string; displayTitle?: string; bodyLength: number }[] => {
    const filtered: { index: number; title: string; displayTitle?: string; bodyLength: number }[] = [];
    for (let i = 0; i < candidates.length; i++) {
      const item = candidates[i];
      const prevItem = candidates[i - 1];
      const nextItem = candidates[i + 1];

      const isVeryShort = item.bodyLength < GUTENBERG_PARSER_CONFIG.TOC_MAX_HEADING_LENGTH;
      const isInsideTOCCluster =
        (prevItem && prevItem.bodyLength < GUTENBERG_PARSER_CONFIG.TOC_MAX_HEADING_LENGTH) ||
        (nextItem && nextItem.bodyLength < GUTENBERG_PARSER_CONFIG.TOC_MAX_HEADING_LENGTH);

      const currentNorm = normalizeHeadingId(item.title);
      const hasLaterDuplicate = candidates.some(
        (other, idx) => idx > i && normalizeHeadingId(other.title) === currentNorm
      );

      // Check if item is an analytical TOC synopsis with a later full-length chapter
      const isAnalyticalTocEntry = Boolean(
        tocMatch &&
          item.index >= tocMatch.index &&
          item.index < tocMatch.index + GUTENBERG_PARSER_CONFIG.TOC_SEARCH_WINDOW_BYTES &&
          item.bodyLength < GUTENBERG_PARSER_CONFIG.TOC_ANALYTICAL_MAX_LENGTH &&
          hasLaterDuplicate &&
          candidates.some(
            (other, idx) =>
              idx > i &&
              normalizeHeadingId(other.title) === currentNorm &&
              other.bodyLength > item.bodyLength * 2 &&
              other.bodyLength >= 2000
          )
      );

      if (
        (isVeryShort && hasLaterDuplicate) ||
        isAnalyticalTocEntry ||
        (isInsideTOCCluster &&
          isVeryShort &&
          tocMatch &&
          item.index < tocMatch.index + GUTENBERG_PARSER_CONFIG.TOC_SEARCH_WINDOW_BYTES &&
          item.bodyLength < GUTENBERG_PARSER_CONFIG.TOC_CLUSTER_BODY_THRESHOLD &&
          hasLaterDuplicate)
      ) {
        continue;
      }

      filtered.push(item);
    }
    return filtered;
  };

  const validMatches: { index: number; title: string; displayTitle?: string; bodyLength?: number }[] =
    filterTocMatches(rawMatches);

  // Strategy 1B: Fallback-only detector for spelled-out chapter numbers (CHAPTER ONE, BOOK THE FIRST)
  // and literary divisions (STAVE I, LETTER 1, ADVENTURE I, VOLUME I) when Strategy 1A found <= 1 match.
  // Because this only runs when validMatches.length <= 1, it guarantees zero chapter_index shift on
  // all volumes already segmented by Strategy 1A.
  if (validMatches.length <= 1) {
    const fallbackHeadingRegex = new RegExp(
      `(?:^|\\n\\s*\\n)\\s*(?:(?:${DIVISION_KEYWORD_PATTERN}\\s+${SPELLED_NUMBER_PATTERN}\\b[^\\n]*)|(?:(?:STAVE|Stave|LETTER|Letter|ADVENTURE|Adventure|VOLUME|Volume|EPISODE|Episode|FIT|Fit)\\s+(?:[IVXLCDM]{1,8}|\\d{1,4})\\b[^\\n]*))`,
      'g'
    );
    const fallbackRaw: { index: number; title: string; displayTitle?: string; bodyLength: number }[] = [];
    let fm: RegExpExecArray | null;
    while ((fm = fallbackHeadingRegex.exec(mainBody)) !== null) {
      const rawHeading = fm[0].trim();
      fallbackRaw.push({
        index: fm.index,
        title: rawHeading,
        displayTitle: rawHeading,
        bodyLength: 0,
      });
    }

    for (let i = 0; i < fallbackRaw.length; i++) {
      const start = fallbackRaw[i].index;
      const end = i + 1 < fallbackRaw.length ? fallbackRaw[i + 1].index : mainBody.length;
      fallbackRaw[i].bodyLength = end - start;
      if (fallbackRaw[i].bodyLength < GUTENBERG_PARSER_CONFIG.TOC_MAX_HEADING_LENGTH) {
        recordSubtitle(fallbackRaw[i].title);
      }
    }

    const fallbackFiltered = filterTocMatches(fallbackRaw).filter(
      (cand) => cand.bodyLength >= GUTENBERG_PARSER_CONFIG.TOC_MAX_HEADING_LENGTH
    );

    if (fallbackFiltered.length >= 2) {
      // Mid-book embedded letter guard: if only 2 LETTER headings appear deep inside an unsegmented novel,
      // do not let two embedded letters hijack the book's chapter structure.
      const isTwoEmbeddedLettersMidBook =
        fallbackFiltered.length === 2 &&
        fallbackFiltered.every((c) => /^letter\b/i.test(c.title)) &&
        fallbackFiltered[0].index > Math.max(800, mainBody.length * 0.25);

      if (!isTwoEmbeddedLettersMidBook) {
        validMatches.length = 0;
        validMatches.push(...fallbackFiltered);
      }
    }
  }

  // Strategy 2: If standard CHAPTER/BOOK regex found <= 2 matches, check for a structured Front-Matter TOC (e.g. short story anthologies)
  if (validMatches.length <= 2) {
    const tocHeadingRegex = /(?:^|\n\n)\s*(?:CONTENTS|TABLE OF CONTENTS|INDEX)\b\.?/i;
    const match = tocHeadingRegex.exec(mainBody);
    if (match) {
      const start = match.index + match[0].length;
      const tocSlice = mainBody.slice(start, start + GUTENBERG_PARSER_CONFIG.TOC_SLICE_BYTES);
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
          const regex = new RegExp(`(?:^|\\n\\n)\\s*(${escaped})(?:[^\n]{0,80})(?=\\n|$)`, 'i');
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

      // Exclude Gutenberg front/back legal & bibliographic notices and standalone LETTER headings (handled by Strategy 1B)
      const isExcluded =
        /^(?:THE\s+PROJECT\s+GUTENBERG|PROJECT\s+GUTENBERG|GUTENBERG|BIBLIOGRAPHY|SELECTED\s+BIBLIOGRAPHY|OTHER\s+TRANSLATIONS|RECOMMENDED\s+READING|ORIGINAL\s+TEXT|TRANSLATED\s+BY|EDITED\s+BY|PUBLISHED\s+BY|ILLUSTRATIONS|CONTENTS|TABLE\s+OF\s+CONTENTS|INDEX|PAGE|PART\s+OF|LETTER\s+(?:[IVXLCDM]+|\d+))\b/i.test(
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
          .replace(/\b(Et|And|Of|The|In|A|An|Or|For|With|To)\b/g, (match, _p1, offset) =>
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
      if (dist >= GUTENBERG_PARSER_CONFIG.ANTHOLOGY_MIN_DISTANCE_CHARS) {
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
      if (postBody.trim().length > 0) {
        sections.push({
          id: 1,
          title: 'Project Gutenberg License & Colophon',
          displayTitle: 'Colophon & License',
          content: reflowGutenbergParagraphs(postBody.trim()),
          startPageNumber: 1,
          pageCount: 1,
        });
      }
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
  const prefixTitleRegex = new RegExp(
    `^(${DIVISION_KEYWORD_PATTERN})\\s+(${SPELLED_NUMBER_PATTERN}|[IVXLCDM\\d]+)`,
    'i'
  );

  for (let i = 0; i < validMatches.length; i++) {
    const current = validMatches[i];
    const next = validMatches[i + 1];
    const rawContent = mainBody.slice(current.index, next ? next.index : mainBody.length).trim();

    let displayTitle = (current.displayTitle || current.title).replace(/\n+/g, ' — ');
    const norm = normalizeHeadingId(current.title);
    let subtitle = tocSubtitles.get(norm);

    // Body Subtitle: inspect lines immediately following heading for a standalone subtitle
    const bodyLines = rawContent.split(/\r?\n/).map((l) => l.trim());
    for (let j = 1; j < Math.min(6, bodyLines.length); j++) {
      const line = bodyLines[j];
      if (!line) continue;
      const nextLine = bodyLines[j + 1];
      const isCandidate =
        line.length >= 2 &&
        line.length <= 90 &&
        !/[.!?;:]$/.test(line) &&
        !/^["'“‘(]/.test(line) &&
        !/^(?:by|illustrated|transcribed|published|page|gutenberg)\b/i.test(line) &&
        (nextLine === '' || nextLine === undefined);

      if (isCandidate) {
        const bodySub = formatSubtitleText(line);
        if (
          !subtitle ||
          (bodySub.length > subtitle.length &&
            bodySub.toLowerCase().includes(subtitle.toLowerCase().slice(0, 15)))
        ) {
          subtitle = bodySub;
        }
        break;
      } else {
        break;
      }
    }

    if (subtitle && !displayTitle.includes(':')) {
      const prefixMatch = displayTitle.match(prefixTitleRegex);
      if (prefixMatch) {
        const keyword = prefixMatch[1]
          .toLowerCase()
          .replace(/^[a-z]/, (c) => c.toUpperCase());
        const numPart = prefixMatch[2].trim();
        const isRoman = /^[ivxlcdm]+$/i.test(numPart);
        const formattedNum = isRoman
          ? numPart.toUpperCase()
          : numPart
              .toLowerCase()
              .replace(/(?:^|\s|-)\S/g, (c) => c.toUpperCase());
        displayTitle = `${keyword} ${formattedNum}: ${subtitle}`;
      } else if (/^[IVXLCDM\d]+/i.test(displayTitle)) {
        const numMatch = displayTitle.match(/^[IVXLCDM\d]+/i)?.[0] || '';
        const formattedNum = /^[ivxlcdm]+$/i.test(numMatch) ? numMatch.toUpperCase() : numMatch;
        displayTitle = `Chapter ${formattedNum}: ${subtitle}`;
      }
    }

    sections.push({
      id: i + 1,
      title: current.title,
      displayTitle,
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
