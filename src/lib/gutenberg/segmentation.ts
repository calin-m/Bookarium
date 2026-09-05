import { GUTENBERG_PARSER_CONFIG, type ChapterSection } from './types';
import { reflowGutenbergParagraphs } from './reflow';

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
  const normalizeHeadingId = (title: string): string => {
    const match = title
      .trim()
      .match(
        /^(?:CHAPTER|Chapter|BOOK|Book|PART|Part|ACT|Act|SCENE|Scene|CANTO|Canto|SECTION|Section)\s+([IVXLCDM\d]+)/i
      );
    if (match) {
      return match[0].toLowerCase().replace(/\s+/, ' ');
    }
    const romanMatch = title.trim().match(/^([IVXLCDM]{1,8})\b/i);
    if (romanMatch) {
      return romanMatch[1].toLowerCase();
    }
    return title.toLowerCase().trim().replace(/\s+/g, ' ').slice(0, 15);
  };

  const tocSubtitles = new Map<string, string>();

  const recordSubtitle = (rawTitle: string) => {
    const match = rawTitle
      .trim()
      .match(
        /^(?:CHAPTER|Chapter|BOOK|Book|PART|Part|ACT|Act|SCENE|Scene|CANTO|Canto|SECTION|Section)\s+[IVXLCDM\d]+[:\s\-\.]+(.+)$/i
      );
    if (match && match[1]?.trim()) {
      const norm = normalizeHeadingId(rawTitle);
      const sub = match[1]
        .replace(/\s+(?:\.{2,}|\d+|[IVXLCDM]+)\s*$/i, '')
        .trim();
      if (sub.length >= 2 && sub.length < 100 && !tocSubtitles.has(norm)) {
        const formattedSub = sub
          .toLowerCase()
          .replace(/(?:^|\s)\S/g, (a) => a.toUpperCase())
          .replace(/\b(And|Of|The|In|A|An|Or|For|With|To|At|By|From)\b/g, (mText, p1, offset) =>
            offset === 0 ? mText : mText.toLowerCase()
          );
        tocSubtitles.set(norm, formattedSub);
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
  const validMatches: { index: number; title: string; displayTitle?: string }[] = [];
  for (let i = 0; i < rawMatches.length; i++) {
    const item = rawMatches[i];
    const prevItem = rawMatches[i - 1];
    const nextItem = rawMatches[i + 1];

    const isVeryShort = item.bodyLength < GUTENBERG_PARSER_CONFIG.TOC_MAX_HEADING_LENGTH;
    const isInsideTOCCluster =
      (prevItem && prevItem.bodyLength < GUTENBERG_PARSER_CONFIG.TOC_MAX_HEADING_LENGTH) ||
      (nextItem && nextItem.bodyLength < GUTENBERG_PARSER_CONFIG.TOC_MAX_HEADING_LENGTH);

    const currentNorm = normalizeHeadingId(item.title);
    const hasLaterDuplicate = rawMatches.some(
      (other, idx) => idx > i && normalizeHeadingId(other.title) === currentNorm
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

    let displayTitle = (current.displayTitle || current.title).replace(/\n+/g, ' — ');
    const norm = normalizeHeadingId(current.title);
    const subtitle = tocSubtitles.get(norm);
    if (subtitle && !displayTitle.includes(':')) {
      const prefixMatch = displayTitle.match(
        /^(?:CHAPTER|Chapter|BOOK|Book|PART|Part|ACT|Act|SCENE|Scene|CANTO|Canto|SECTION|Section)\s+[IVXLCDM\d]+/i
      );
      if (prefixMatch) {
        const cleanPrefix = prefixMatch[0]
          .toLowerCase()
          .replace(/^[a-z]/, (c) => c.toUpperCase());
        displayTitle = `${cleanPrefix}: ${subtitle}`;
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

