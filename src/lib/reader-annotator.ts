/**
 * @module
 * @scope Canonical text span matching (`findAllCanonicalTextSpans`), dual-band self+fellow overlap interval slicing, word/sentence/paragraph selection boundary helpers, and highlight reconciliation utilities.
 * @invariant Execute an `O(N)` exact `indexOf` fast path first before falling back to `buildCanonicalIndexMap` (`--` <-> `—`, `_italic_`, whitespace, curly <-> straight quote equivalence) so saved annotations and bookmarks remain resilient across typography updates.
 * @invariant Slice overlapping personal and fellow marginalia into non-overlapping `AnnotationSpan` segments while filtering PII (`isFellowAnnotation`) cleanly, honoring `priorityAnnotationId` precedence during live crop previews, and keeping adjusted selections word-aligned and clamped cleanly within `[MIN_ADJUSTED_SELECTION_LENGTH, MAX_ADJUSTED_SELECTION_LENGTH]`.
 * @rationale Character-index-mapped canonical search and pure boundary-snapping helpers prevent annotation orphaning across reflow changes and keep interactive highlight resizing deterministic and zero-DOM.
 * @adr ADR-019, ADR-059, ADR-060, ADR-080
 */

import type { Annotation, FellowAnnotation } from '@/stores/useAnnotationStore';

export const MIN_ADJUSTED_SELECTION_LENGTH = 2;
export const MAX_ADJUSTED_SELECTION_LENGTH = 5000;

export type AnyAnnotation = Annotation | FellowAnnotation;

export function isFellowAnnotation(ann: AnyAnnotation): ann is FellowAnnotation {
  return Boolean((ann as FellowAnnotation).isFellow);
}

export interface AnnotationSpan {
  start: number;
  end: number;
  annotation: AnyAnnotation;
  selfAnnotation?: Annotation;
  fellowAnnotation?: FellowAnnotation;
  isFellowEnd?: boolean;
}

export interface UnifiedAnnotationItem {
  annotation: AnyAnnotation;
  selfAnnotation?: Annotation;
  pairedFellowAnnotation?: FellowAnnotation;
}

export type SourcePairedAnnotation = AnyAnnotation & {
  pairedFellowAnnotation?: FellowAnnotation;
  matchingOwnAnnotation?: Annotation;
};

export interface SharedQuoteSegments {
  isExact: boolean;
  fullQuote: string;
  overlapText?: string;
  beforeText?: string;
  afterText?: string;
}

interface CanonicalIndexMap {
  canonical: string;
  normToRawStart: number[];
  normToRawEnd: number[];
}

function isAlphanumericChar(ch: string | undefined): boolean {
  return Boolean(ch && /[A-Za-z0-9]/.test(ch));
}

/**
 * Builds a character-index-mapped canonical representation of `input` that:
 * 1. Collapses contiguous whitespace (`\s+`, including `\n` hard wraps) to a single `' '`.
 * 2. Equates ASCII double-hyphens (`--`), em-dashes (`—`), and en-dashes (`–`) to `'-'`.
 * 3. Strips Gutenberg `_italic_` emphasis boundary underscores while preserving `snake_case` and `____` blanks.
 * 4. Normalizes curly quotes (`“`/`”` -> `"`, `‘`/`’` -> `'`).
 */
function buildCanonicalIndexMap(input: string): CanonicalIndexMap {
  const chars: string[] = [];
  const normToRawStart: number[] = [];
  const normToRawEnd: number[] = [];

  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    // 1. Contiguous whitespace -> single ' '
    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < len && /\s/.test(input[j])) {
        j++;
      }
      chars.push(' ');
      normToRawStart.push(i);
      normToRawEnd.push(j);
      i = j;
      continue;
    }

    // 2. Dash equivalence: '--' (when not part of '---') and '—' / '–' -> '-'
    if (ch === '—' || ch === '–') {
      chars.push('-');
      normToRawStart.push(i);
      normToRawEnd.push(i + 1);
      i += 1;
      continue;
    }
    if (
      ch === '-' &&
      input[i + 1] === '-' &&
      input[i - 1] !== '-' &&
      input[i + 2] !== '-'
    ) {
      chars.push('-');
      normToRawStart.push(i);
      normToRawEnd.push(i + 2);
      i += 2;
      continue;
    }

    // 3. Gutenberg _italic_ boundary underscore stripping
    if (ch === '_') {
      const prev = input[i - 1];
      const next = input[i + 1];
      const isMultiUnderscore = prev === '_' || next === '_';
      const isSnakeCase = isAlphanumericChar(prev) && isAlphanumericChar(next);
      if (!isMultiUnderscore && !isSnakeCase) {
        i += 1;
        continue;
      }
    }

    // 4. Curly vs. straight quote normalization
    if (ch === '“' || ch === '”') {
      chars.push('"');
      normToRawStart.push(i);
      normToRawEnd.push(i + 1);
      i += 1;
      continue;
    }
    if (ch === '‘' || ch === '’') {
      chars.push("'");
      normToRawStart.push(i);
      normToRawEnd.push(i + 1);
      i += 1;
      continue;
    }

    chars.push(ch);
    normToRawStart.push(i);
    normToRawEnd.push(i + 1);
    i += 1;
  }

  return {
    canonical: chars.join(''),
    normToRawStart,
    normToRawEnd,
  };
}

/**
 * Finds all occurrences of `needle` inside `haystack`, using an `O(N)` exact `indexOf` fast path
 * and falling back to a character-index-mapped canonical search (`--` <-> `—`, `_italic_`, `\n` <-> `' '`,
 * curly <-> straight quotes) so legacy annotations and bookmarks never break when parser typography evolves.
 */
export function findAllCanonicalTextSpans(
  haystack: string,
  needle: string,
  options?: { allowBoundaryPartial?: boolean }
): Array<{ start: number; end: number }> {
  if (!haystack || !needle) return [];

  // 1. O(N) Exact Fast Path
  const exactSpans: Array<{ start: number; end: number }> = [];
  let searchStart = 0;
  while (searchStart <= haystack.length - needle.length) {
    const idx = haystack.indexOf(needle, searchStart);
    if (idx === -1) break;
    exactSpans.push({ start: idx, end: idx + needle.length });
    searchStart = idx + needle.length;
  }
  if (exactSpans.length > 0) {
    return exactSpans;
  }

  const trimmedNeedle = needle.trim();
  if (!trimmedNeedle) return [];

  if (trimmedNeedle !== needle) {
    let trimmedStart = 0;
    while (trimmedStart <= haystack.length - trimmedNeedle.length) {
      const idx = haystack.indexOf(trimmedNeedle, trimmedStart);
      if (idx === -1) break;
      exactSpans.push({ start: idx, end: idx + trimmedNeedle.length });
      trimmedStart = idx + trimmedNeedle.length;
    }
    if (exactSpans.length > 0) {
      return exactSpans;
    }
  }

  // 2. Canonical Index-Mapped Fallback
  const haystackMap = buildCanonicalIndexMap(haystack);
  const needleMap = buildCanonicalIndexMap(trimmedNeedle);
  const cleanNeedle = needleMap.canonical.trim();
  if (!cleanNeedle || !haystackMap.canonical) return [];

  const canonicalSpans: Array<{ start: number; end: number }> = [];
  let normSearchPos = 0;
  while (normSearchPos <= haystackMap.canonical.length - cleanNeedle.length) {
    const normIdx = haystackMap.canonical.indexOf(cleanNeedle, normSearchPos);
    if (normIdx === -1) break;
    const normEndIdx = normIdx + cleanNeedle.length - 1;
    const rawStart = haystackMap.normToRawStart[normIdx];
    const rawEnd = haystackMap.normToRawEnd[normEndIdx];
    if (rawStart !== undefined && rawEnd !== undefined && rawEnd > rawStart) {
      canonicalSpans.push({ start: rawStart, end: rawEnd });
    }
    normSearchPos = normIdx + Math.max(1, cleanNeedle.length);
  }

  // 3. Page-Boundary Straddling Fallback (when a multi-sentence highlight spans across virtual page breaks)
  const minBoundaryOverlap = 12;
  if (
    canonicalSpans.length === 0 &&
    options?.allowBoundaryPartial &&
    cleanNeedle.length >= 16
  ) {
    const haystackStart = haystackMap.canonical.startsWith(' ') ? 1 : 0;
    const haystackEnd = haystackMap.canonical.endsWith(' ')
      ? haystackMap.canonical.length - 1
      : haystackMap.canonical.length;
    const haystackTrimmed = haystackMap.canonical.slice(haystackStart, haystackEnd);
    const maxCheck = Math.min(cleanNeedle.length - 1, haystackTrimmed.length);

    if (maxCheck >= minBoundaryOverlap) {
      // Check if prefix of needle matches suffix of current page text (highlight starts at bottom of page)
      for (let len = maxCheck; len >= minBoundaryOverlap; len--) {
        if (haystackTrimmed.endsWith(cleanNeedle.slice(0, len))) {
          const normStartIdx = haystackEnd - len;
          const normEndIdx = haystackEnd - 1;
          const rawStart = haystackMap.normToRawStart[normStartIdx];
          const rawEnd = haystackMap.normToRawEnd[normEndIdx];
          if (rawStart !== undefined && rawEnd !== undefined && rawEnd > rawStart) {
            canonicalSpans.push({ start: rawStart, end: rawEnd });
          }
          break;
        }
      }

      // Check if suffix of needle matches prefix of current page text (highlight finishes at top of page)
      if (canonicalSpans.length === 0) {
        for (let len = maxCheck; len >= minBoundaryOverlap; len--) {
          if (haystackTrimmed.startsWith(cleanNeedle.slice(cleanNeedle.length - len))) {
            const normStartIdx = haystackStart;
            const normEndIdx = haystackStart + len - 1;
            const rawStart = haystackMap.normToRawStart[normStartIdx];
            const rawEnd = haystackMap.normToRawEnd[normEndIdx];
            if (rawStart !== undefined && rawEnd !== undefined && rawEnd > rawStart) {
              canonicalSpans.push({ start: rawStart, end: rawEnd });
            }
            break;
          }
        }
      }
    }
  }

  return canonicalSpans;
}

/**
 * Returns the first canonical `{ start, end }` span of `needle` inside `haystack`, or `null` if not found.
 */
export function findCanonicalTextSpan(
  haystack: string,
  needle: string,
  options?: { allowBoundaryPartial?: boolean }
): { start: number; end: number } | null {
  const spans = findAllCanonicalTextSpans(haystack, needle, options);
  return spans.length > 0 ? spans[0] : null;
}

/**
 * Checks whether a personal annotation and fellow annotation belong to the same
 * volume, section, and share an overlapping or matching passage of text.
 */
export function areAnnotationsOverlapping(
  a: { bookId: number; chapterIndex: number; selectedText: string; chapterPage?: number },
  b: { bookId: number; chapterIndex: number; selectedText: string; chapterPage?: number }
): boolean {
  if (a.bookId !== b.bookId || a.chapterIndex !== b.chapterIndex) {
    return false;
  }
  const textA = a.selectedText.trim();
  const textB = b.selectedText.trim();
  if (!textA || !textB) return false;

  if (textA === textB || textA.includes(textB) || textB.includes(textA)) {
    return true;
  }

  if (findCanonicalTextSpan(textA, textB) !== null || findCanonicalTextSpan(textB, textA) !== null) {
    return true;
  }

  // Handle case-insensitive minor whitespace or sentence punct variations
  const cleanA = buildCanonicalIndexMap(textA.toLowerCase()).canonical.trim();
  const cleanB = buildCanonicalIndexMap(textB.toLowerCase()).canonical.trim();
  if (!cleanA || !cleanB) return false;
  if (cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA)) {
    return true;
  }

  // Check partial prefix/suffix overlap (>= 12 canonical chars) when two highlights intersect without containment
  const minOverlap = 12;
  if (cleanA.length >= minOverlap && cleanB.length >= minOverlap) {
    const maxCheck = Math.min(cleanA.length, cleanB.length);
    for (let len = maxCheck; len >= minOverlap; len--) {
      if (cleanA.endsWith(cleanB.slice(0, len)) || cleanB.endsWith(cleanA.slice(0, len))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Finds the first personal annotation that overlaps or matches a given fellow annotation.
 */
export function findMatchingOwnAnnotation(
  ownAnnotations: Annotation[],
  fellow: FellowAnnotation
): Annotation | undefined {
  return ownAnnotations.find((own) => areAnnotationsOverlapping(own, fellow));
}

/**
 * Computes presentation segments for a shared quote passage so that partial overlaps
 * render the encompassing quote with the overlapping sub-phrase highlighted inside it.
 */
export function computeSharedQuoteSegments(
  ownText: string,
  fellowText?: string | null
): SharedQuoteSegments {
  if (!fellowText) {
    return { isExact: true, fullQuote: ownText };
  }
  const trimmedOwn = ownText.trim();
  const trimmedFellow = fellowText.trim();

  if (trimmedOwn === trimmedFellow) {
    return { isExact: true, fullQuote: ownText };
  }

  const fellowInOwn = findCanonicalTextSpan(ownText, trimmedFellow);
  if (fellowInOwn) {
    if (fellowInOwn.start === 0 && fellowInOwn.end === ownText.length) {
      return { isExact: true, fullQuote: ownText };
    }
    return {
      isExact: false,
      fullQuote: ownText,
      overlapText: ownText.slice(fellowInOwn.start, fellowInOwn.end),
      beforeText: ownText.slice(0, fellowInOwn.start),
      afterText: ownText.slice(fellowInOwn.end),
    };
  }

  const ownInFellow = findCanonicalTextSpan(fellowText, trimmedOwn);
  if (ownInFellow) {
    if (ownInFellow.start === 0 && ownInFellow.end === fellowText.length) {
      return { isExact: true, fullQuote: fellowText };
    }
    return {
      isExact: false,
      fullQuote: fellowText,
      overlapText: fellowText.slice(ownInFellow.start, ownInFellow.end),
      beforeText: fellowText.slice(0, ownInFellow.start),
      afterText: fellowText.slice(ownInFellow.end),
    };
  }

  return { isExact: true, fullQuote: ownText };
}

/**
 * Pairs personal and fellow annotations into unified entries for 'All' source filter view.
 * When both scholars marked the same or overlapping text, they merge into one item
 * with `pairedFellowAnnotation` attached, preventing duplicate cards.
 */
export function pairOverlappingAnnotations(
  ownAnnotations: Annotation[],
  fellowAnnotations: FellowAnnotation[]
): UnifiedAnnotationItem[] {
  const consumedFellowIds = new Set<string>();
  const unifiedList: UnifiedAnnotationItem[] = [];

  for (const own of ownAnnotations) {
    const match = fellowAnnotations.find(
      (fa) => !consumedFellowIds.has(fa.id) && areAnnotationsOverlapping(own, fa)
    );

    if (match) {
      consumedFellowIds.add(match.id);
      unifiedList.push({
        annotation: own,
        selfAnnotation: own,
        pairedFellowAnnotation: match,
      });
    } else {
      unifiedList.push({
        annotation: own,
        selfAnnotation: own,
      });
    }
  }

  for (const fellow of fellowAnnotations) {
    if (!consumedFellowIds.has(fellow.id)) {
      unifiedList.push({
        annotation: fellow,
        pairedFellowAnnotation: undefined,
      });
    }
  }

  return unifiedList;
}

/**
 * Filters and pairs personal and fellow annotations according to the active marginalia source filter
 * ('all' | 'mine' | 'fellows'), attaching overlapping `pairedFellowAnnotation` or `matchingOwnAnnotation`
 * metadata so cards across the Notebook and Reader Drawer render consistent unified state.
 */
export function filterAndPairAnnotationsBySource(
  ownAnnotations: Annotation[],
  fellowAnnotations: FellowAnnotation[],
  sourceFilter: 'all' | 'mine' | 'fellows',
  precomputedPaired?: UnifiedAnnotationItem[]
): SourcePairedAnnotation[] {
  if (sourceFilter === 'mine') {
    return ownAnnotations.map((ann) => ({
      ...ann,
      pairedFellowAnnotation: fellowAnnotations.find((fa) =>
        areAnnotationsOverlapping(ann, fa)
      ),
    }));
  }
  if (sourceFilter === 'fellows') {
    return fellowAnnotations.map((fa) => ({
      ...fa,
      matchingOwnAnnotation: findMatchingOwnAnnotation(ownAnnotations, fa),
    }));
  }
  const paired =
    precomputedPaired ?? pairOverlappingAnnotations(ownAnnotations, fellowAnnotations);
  return paired.map((item) => {
    if (item.pairedFellowAnnotation) {
      return {
        ...item.annotation,
        pairedFellowAnnotation: item.pairedFellowAnnotation,
      };
    }
    return {
      ...item.annotation,
      matchingOwnAnnotation: isFellowAnnotation(item.annotation)
        ? findMatchingOwnAnnotation(ownAnnotations, item.annotation)
        : undefined,
    };
  });
}

/**
 * Computes non-overlapping text spans for annotations within a given text string.
 * Handles multiple occurrences of highlighted text, guarantees ascending intervals,
 * and splits intervals at exact boundaries so that overlapping self and fellow annotations
 * render with layered dual-highlight styles while preserving single badge attribution.
 */
export function computeAnnotationSpans(
  text: string,
  annotations: AnyAnnotation[],
  options?: { priorityAnnotationId?: string }
): AnnotationSpan[] {
  if (!text || !annotations || annotations.length === 0) {
    return [];
  }

  // 1. Build disjoint non-overlapping intervals for self-annotations, giving live adjust preview precedence
  const rawSelfSpans: Array<{
    start: number;
    end: number;
    annotation: Annotation;
    isPriority: boolean;
  }> = [];
  const selfAnnotations = annotations.filter((a): a is Annotation => !isFellowAnnotation(a));
  const priorityId = options?.priorityAnnotationId;
  for (const ann of selfAnnotations) {
    if (!ann.selectedText) continue;
    const isPriority = Boolean(priorityId && ann.id === priorityId);
    const matches = findAllCanonicalTextSpans(text, ann.selectedText, { allowBoundaryPartial: true });
    for (const m of matches) {
      rawSelfSpans.push({
        start: m.start,
        end: m.end,
        annotation: ann,
        isPriority,
      });
    }
  }

  const candidateSelfSpans: Array<{ start: number; end: number; annotation: Annotation }> = [];
  if (priorityId) {
    const prioritySpans = rawSelfSpans
      .filter((s) => s.isPriority)
      .sort((a, b) => a.start - b.start || a.end - b.end);
    let lastPriorityEnd = 0;
    for (const p of prioritySpans) {
      if (p.start >= lastPriorityEnd) {
        candidateSelfSpans.push({ start: p.start, end: p.end, annotation: p.annotation });
        lastPriorityEnd = p.end;
      }
    }
    const nonPrioritySpans = rawSelfSpans
      .filter((s) => !s.isPriority)
      .sort((a, b) => a.start - b.start || a.end - b.end);
    for (const s of nonPrioritySpans) {
      const overlapsPriority = candidateSelfSpans.some(
        (acc) => s.start < acc.end && s.end > acc.start
      );
      if (!overlapsPriority) {
        candidateSelfSpans.push({ start: s.start, end: s.end, annotation: s.annotation });
      }
    }
  } else {
    for (const s of rawSelfSpans) {
      candidateSelfSpans.push({ start: s.start, end: s.end, annotation: s.annotation });
    }
  }

  candidateSelfSpans.sort((a, b) => a.start - b.start || a.end - b.end);
  const selfSpans: Array<{ start: number; end: number; annotation: Annotation }> = [];
  let lastSelfEnd = 0;
  for (const s of candidateSelfSpans) {
    if (s.start >= lastSelfEnd) {
      selfSpans.push(s);
      lastSelfEnd = s.end;
    }
  }

  // 2. Build disjoint non-overlapping intervals for fellow-annotations
  const rawFellowSpans: Array<{ start: number; end: number; annotation: FellowAnnotation }> = [];
  const fellowAnnotations = annotations.filter(isFellowAnnotation);
  for (const ann of fellowAnnotations) {
    if (!ann.selectedText) continue;
    const matches = findAllCanonicalTextSpans(text, ann.selectedText, { allowBoundaryPartial: true });
    for (const m of matches) {
      rawFellowSpans.push({
        start: m.start,
        end: m.end,
        annotation: ann,
      });
    }
  }
  rawFellowSpans.sort((a, b) => a.start - b.start || a.end - b.end);
  const fellowSpans: typeof rawFellowSpans = [];
  let lastFellowEnd = 0;
  for (const f of rawFellowSpans) {
    if (f.start >= lastFellowEnd) {
      fellowSpans.push(f);
      lastFellowEnd = f.end;
    }
  }

  if (selfSpans.length === 0 && fellowSpans.length === 0) {
    return [];
  }

  // 3. Fast-path: if either group is empty, return the other directly
  if (fellowSpans.length === 0) {
    return selfSpans.map((s) => ({
      start: s.start,
      end: s.end,
      annotation: s.annotation,
      selfAnnotation: s.annotation,
    }));
  }
  if (selfSpans.length === 0) {
    return fellowSpans.map((f) => ({
      start: f.start,
      end: f.end,
      annotation: f.annotation,
      fellowAnnotation: f.annotation,
      isFellowEnd: true,
    }));
  }

  // 4. Collect all interval boundary points
  const pointsSet = new Set<number>();
  for (const s of selfSpans) {
    pointsSet.add(s.start);
    pointsSet.add(s.end);
  }
  for (const f of fellowSpans) {
    pointsSet.add(f.start);
    pointsSet.add(f.end);
  }
  const sortedPoints = Array.from(pointsSet).sort((a, b) => a - b);

  // 5. Partition into elementary non-overlapping spans
  const resultSpans: AnnotationSpan[] = [];
  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const segStart = sortedPoints[i];
    const segEnd = sortedPoints[i + 1];

    const sMatch = selfSpans.find((s) => s.start <= segStart && s.end >= segEnd);
    const fMatch = fellowSpans.find((f) => f.start <= segStart && f.end >= segEnd);

    if (sMatch || fMatch) {
      resultSpans.push({
        start: segStart,
        end: segEnd,
        annotation: sMatch ? sMatch.annotation : fMatch!.annotation,
        selfAnnotation: sMatch?.annotation,
        fellowAnnotation: fMatch?.annotation,
        isFellowEnd: fMatch ? fMatch.end === segEnd : false,
      });
    }
  }

  return resultSpans;
}

const LITERARY_ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'rev',
  'st',
  'capt',
  'col',
  'gen',
  'lt',
  'sgt',
  'hon',
  'esq',
  'jr',
  'sr',
  'no',
  'vol',
  'ch',
  'fig',
  'p',
  'pp',
  'vs',
  'etc',
  'eg',
  'ie',
]);

function isWordTokenSeparator(text: string, idx: number): boolean {
  if (idx < 0 || idx >= text.length) return true;
  const ch = text[idx];
  if (/[\s\u2014\u2013]/.test(ch)) return true;
  if (ch === '-' && (text[idx - 1] === '-' || text[idx + 1] === '-')) {
    return true;
  }
  return false;
}

function isSentenceClosingWrapper(ch: string | undefined): boolean {
  return Boolean(ch && /["'”’)\]]/.test(ch));
}

function isAbbreviationDot(text: string, dotIdx: number): boolean {
  if (text[dotIdx] !== '.') return false;
  let cursor = dotIdx - 1;
  while (cursor >= 0 && /[A-Za-z.]/.test(text[cursor])) {
    cursor--;
  }
  const token = text
    .slice(cursor + 1, dotIdx)
    .toLowerCase()
    .replace(/\./g, '');
  if (!token) return false;
  if (token.length === 1 && /[A-Za-z]/.test(text[dotIdx - 1])) {
    return true;
  }
  return LITERARY_ABBREVIATIONS.has(token);
}

function isSentenceTerminalAt(text: string, idx: number): boolean {
  const ch = text[idx];
  if (ch !== '.' && ch !== '!' && ch !== '?') return false;
  // Ellipsis (`...`) continues across both forward and backward boundary scans
  if (ch === '.' && (text[idx - 1] === '.' || text[idx + 1] === '.')) return false;
  if (ch === '.' && isAbbreviationDot(text, idx)) return false;

  let after = idx + 1;
  while (after < text.length && isSentenceClosingWrapper(text[after])) {
    after++;
  }
  return after >= text.length || /\s/.test(text[after]);
}

function trimSpanWhitespace(
  text: string,
  start: number,
  end: number
): { start: number; end: number } {
  let s = Math.max(0, Math.min(start, text.length));
  let e = Math.max(s, Math.min(end, text.length));
  while (s < e && /\s/.test(text[s])) s++;
  while (e > s && /\s/.test(text[e - 1])) e--;
  return { start: s, end: e };
}

/**
 * Resolves initial `[start, end)` character offsets and chapter/page occurrence count
 * for an existing annotation inside `chapterText`.
 */
export function resolveInitialSelectionOffsets(
  chapterText: string,
  selectedText: string,
  occurrenceHint = 0
): { start: number; end: number; occurrenceCount: number } | null {
  const trimmed = selectedText?.trim() || '';
  if (!trimmed || !chapterText) return null;

  const spans = findAllCanonicalTextSpans(chapterText, trimmed);
  if (spans.length === 0) return null;

  const clampedIdx = Math.max(0, Math.min(occurrenceHint, spans.length - 1));
  const chosen = spans[clampedIdx];
  return {
    start: chosen.start,
    end: chosen.end,
    occurrenceCount: spans.length,
  };
}

/**
 * Returns how many canonical matches `spanText` produces inside `text`.
 */
export function countSpanOccurrencesInText(text: string, spanText: string): number {
  const trimmed = spanText?.trim() || '';
  if (!trimmed || !text) return 0;
  return findAllCanonicalTextSpans(text, trimmed).length;
}

/**
 * Snaps a raw character offset to whole-word/token boundaries in `text`
 * without leaving dangling whitespace or slicing words mid-syllable.
 */
export function snapOffsetToWordBoundary(
  text: string,
  offset: number,
  edge: 'start' | 'end'
): number {
  if (!text) return 0;
  const len = text.length;

  if (edge === 'start') {
    let idx = Math.max(0, Math.min(offset, len - 1));
    if (isWordTokenSeparator(text, idx)) {
      let forward = idx;
      while (forward < len && isWordTokenSeparator(text, forward)) {
        forward++;
      }
      if (forward < len) {
        idx = forward;
      } else {
        let backward = idx;
        while (backward > 0 && isWordTokenSeparator(text, backward)) {
          backward--;
        }
        idx = backward;
      }
    }
    while (idx > 0 && !isWordTokenSeparator(text, idx - 1)) {
      idx--;
    }
    return idx;
  }

  let probe = offset >= len ? len - 1 : Math.max(0, offset);
  if (offset > 0 && offset < len && isWordTokenSeparator(text, offset)) {
    probe = offset - 1;
  }
  if (isWordTokenSeparator(text, probe)) {
    let backward = probe;
    while (backward > 0 && isWordTokenSeparator(text, backward)) {
      backward--;
    }
    if (!isWordTokenSeparator(text, backward)) {
      probe = backward;
    } else {
      let forward = probe;
      while (forward < len && isWordTokenSeparator(text, forward)) {
        forward++;
      }
      if (forward >= len) return len;
      probe = forward;
    }
  }
  let end = probe + 1;
  while (end < len && !isWordTokenSeparator(text, end)) {
    end++;
  }
  return end;
}

/**
 * Steps either the `start` or `end` boundary cleanly left or right by one whole word
 * while preserving `[MIN_ADJUSTED_SELECTION_LENGTH, maxLength]` bounds.
 */
export function stepSelectionBoundaryByWord(
  text: string,
  currentStart: number,
  currentEnd: number,
  edge: 'start' | 'end',
  direction: -1 | 1,
  maxLength = MAX_ADJUSTED_SELECTION_LENGTH
): { start: number; end: number } {
  if (!text) return { start: currentStart, end: currentEnd };
  const len = text.length;

  if (edge === 'start') {
    if (direction === -1) {
      let cursor = currentStart - 1;
      while (cursor >= 0 && isWordTokenSeparator(text, cursor)) {
        cursor--;
      }
      if (cursor < 0) return { start: currentStart, end: currentEnd };
      const nextStart = snapOffsetToWordBoundary(text, cursor, 'start');
      if (
        currentEnd - nextStart <= maxLength &&
        text.slice(nextStart, currentEnd).trim().length >= MIN_ADJUSTED_SELECTION_LENGTH
      ) {
        return { start: nextStart, end: currentEnd };
      }
      return { start: currentStart, end: currentEnd };
    }

    let cursor = currentStart;
    while (cursor < currentEnd && !isWordTokenSeparator(text, cursor)) {
      cursor++;
    }
    while (cursor < currentEnd && isWordTokenSeparator(text, cursor)) {
      cursor++;
    }
    if (cursor >= currentEnd) return { start: currentStart, end: currentEnd };
    const nextStart = snapOffsetToWordBoundary(text, cursor, 'start');
    if (
      nextStart < currentEnd &&
      text.slice(nextStart, currentEnd).trim().length >= MIN_ADJUSTED_SELECTION_LENGTH
    ) {
      return { start: nextStart, end: currentEnd };
    }
    return { start: currentStart, end: currentEnd };
  }

  if (direction === -1) {
    let cursor = currentEnd - 1;
    while (cursor > currentStart && isWordTokenSeparator(text, cursor)) {
      cursor--;
    }
    while (cursor > currentStart && !isWordTokenSeparator(text, cursor)) {
      cursor--;
    }
    while (cursor > currentStart && isWordTokenSeparator(text, cursor)) {
      cursor--;
    }
    if (cursor <= currentStart) return { start: currentStart, end: currentEnd };
    const nextEnd = snapOffsetToWordBoundary(text, cursor, 'end');
    if (
      nextEnd > currentStart &&
      nextEnd < currentEnd &&
      text.slice(currentStart, nextEnd).trim().length >= MIN_ADJUSTED_SELECTION_LENGTH
    ) {
      return { start: currentStart, end: nextEnd };
    }
    return { start: currentStart, end: currentEnd };
  }

  let cursor = currentEnd;
  while (cursor < len && isWordTokenSeparator(text, cursor)) {
    cursor++;
  }
  if (cursor >= len) return { start: currentStart, end: currentEnd };
  const nextEnd = snapOffsetToWordBoundary(text, cursor, 'end');
  if (
    nextEnd > currentEnd &&
    nextEnd - currentStart <= maxLength &&
    text.slice(currentStart, nextEnd).trim().length >= MIN_ADJUSTED_SELECTION_LENGTH
  ) {
    return { start: currentStart, end: nextEnd };
  }
  return { start: currentStart, end: currentEnd };
}

function findSentenceStartBefore(text: string, fromOffset: number): number {
  let cursor = Math.max(0, Math.min(fromOffset, text.length));
  while (cursor > 0) {
    if (text[cursor - 1] === '\n' && text[cursor - 2] === '\n') {
      break;
    }
    if (cursor - 1 < fromOffset && isSentenceTerminalAt(text, cursor - 1)) {
      let after = cursor;
      while (after < fromOffset && isSentenceClosingWrapper(text[after])) {
        after++;
      }
      if (after <= fromOffset) {
        cursor = after;
        break;
      }
    }
    cursor--;
  }
  while (cursor < text.length && /\s/.test(text[cursor])) {
    cursor++;
  }
  return cursor;
}

function findSentenceEndAfter(text: string, fromOffset: number): number {
  let cursor = Math.max(0, Math.min(fromOffset, text.length));
  while (cursor < text.length) {
    if (text[cursor] === '\n' && text[cursor + 1] === '\n') {
      break;
    }
    if (isSentenceTerminalAt(text, cursor)) {
      let end = cursor + 1;
      while (end < text.length && isSentenceClosingWrapper(text[end])) {
        end++;
      }
      return end;
    }
    cursor++;
  }
  while (cursor > 0 && /\s/.test(text[cursor - 1])) {
    cursor--;
  }
  return cursor;
}

function clampExpandedSpanToMaxLength(
  text: string,
  base: { start: number; end: number },
  targetStart: number,
  targetEnd: number,
  maxLength: number
): { start: number; end: number } {
  const trimmed = trimSpanWhitespace(text, targetStart, targetEnd);
  if (trimmed.end - trimmed.start <= maxLength) {
    if (text.slice(trimmed.start, trimmed.end).trim().length < MIN_ADJUSTED_SELECTION_LENGTH) {
      return base;
    }
    return trimmed;
  }

  // When paragraph/sentence exceeds maxLength (e.g. Scroll mode or 5k ceiling), expand up to maxLength around base
  const minAllowedStart = Math.max(trimmed.start, base.end - maxLength);
  let candStart = trimmed.start;
  if (candStart < minAllowedStart) {
    candStart = Math.min(base.start, snapOffsetToWordBoundary(text, minAllowedStart, 'start'));
    if (base.end - candStart > maxLength) {
      candStart = Math.min(base.start, minAllowedStart);
    }
  }

  const maxAllowedEnd = Math.min(trimmed.end, candStart + maxLength);
  let candEnd = maxAllowedEnd;
  if (candEnd < trimmed.end) {
    const latestSentenceEnd = findSentenceStartBefore(text, maxAllowedEnd);
    const snappedWordEnd =
      maxAllowedEnd > candStart && !isWordTokenSeparator(text, maxAllowedEnd)
        ? snapOffsetToWordBoundary(text, Math.max(candStart, maxAllowedEnd - 1), 'start')
        : snapOffsetToWordBoundary(text, Math.max(candStart, maxAllowedEnd - 1), 'end');
    if (latestSentenceEnd > base.end && latestSentenceEnd <= maxAllowedEnd) {
      candEnd = latestSentenceEnd;
    } else if (snappedWordEnd >= base.end && snappedWordEnd <= maxAllowedEnd) {
      candEnd = snappedWordEnd;
    }
  }

  const finalSpan = trimSpanWhitespace(text, Math.min(candStart, base.start), Math.max(candEnd, base.end));
  if (
    finalSpan.end - finalSpan.start > maxLength ||
    text.slice(finalSpan.start, finalSpan.end).trim().length < MIN_ADJUSTED_SELECTION_LENGTH
  ) {
    return base;
  }
  return finalSpan;
}

/**
 * Expands `[start, end)` to cover the enclosing sentence(s) safely around Gutenberg
 * abbreviations and paragraph breaks. When `[start, end)` already aligns with sentence
 * bounds, extends `end` to append the next sentence (clamped cleanly within `maxLength`).
 */
export function expandSpanToSentenceBounds(
  text: string,
  start: number,
  end: number,
  maxLength = MAX_ADJUSTED_SELECTION_LENGTH
): { start: number; end: number } {
  if (!text) return { start, end };
  const clamped = trimSpanWhitespace(text, start, Math.max(start + 1, end));
  const sentStart = findSentenceStartBefore(text, clamped.start);
  let sentEnd = findSentenceEndAfter(text, Math.max(clamped.start, clamped.end - 1));

  if (sentStart === clamped.start && sentEnd <= clamped.end) {
    let nextProbe = clamped.end;
    while (nextProbe < text.length && /\s/.test(text[nextProbe])) {
      nextProbe++;
    }
    if (nextProbe < text.length) {
      sentEnd = findSentenceEndAfter(text, nextProbe);
    }
  }

  return clampExpandedSpanToMaxLength(text, clamped, sentStart, sentEnd, maxLength);
}

function findParagraphBreakBefore(text: string, fromOffset: number): number {
  let cursor = Math.max(0, Math.min(fromOffset, text.length));
  while (cursor > 0) {
    if (text[cursor - 1] === '\n') {
      let check = cursor - 2;
      while (
        check >= 0 &&
        (text[check] === '\r' || text[check] === ' ' || text[check] === '\t')
      ) {
        check--;
      }
      if (check >= 0 && text[check] === '\n') {
        break;
      }
    }
    cursor--;
  }
  while (cursor < text.length && /\s/.test(text[cursor])) {
    cursor++;
  }
  return cursor;
}

function findParagraphBreakAfter(text: string, fromOffset: number): number {
  let cursor = Math.max(0, Math.min(fromOffset, text.length));
  while (cursor < text.length) {
    if (text[cursor] === '\n') {
      let next = cursor + 1;
      while (
        next < text.length &&
        (text[next] === '\r' || text[next] === ' ' || text[next] === '\t')
      ) {
        next++;
      }
      if (next < text.length && text[next] === '\n') {
        break;
      }
    }
    cursor++;
  }
  while (cursor > 0 && /\s/.test(text[cursor - 1])) {
    cursor--;
  }
  return cursor;
}

/**
 * Expands `[start, end)` to trimmed paragraph boundaries (`\n\n` or whitespace-padded blank lines).
 * When already paragraph-aligned, appends the following paragraph (clamped cleanly within `maxLength`).
 */
export function expandSpanToParagraphBounds(
  text: string,
  start: number,
  end: number,
  maxLength = MAX_ADJUSTED_SELECTION_LENGTH
): { start: number; end: number } {
  if (!text) return { start, end };
  const clamped = trimSpanWhitespace(text, start, Math.max(start + 1, end));
  const paraStart = findParagraphBreakBefore(text, clamped.start);
  let paraEnd = findParagraphBreakAfter(text, Math.max(clamped.start, clamped.end - 1));

  if (paraStart === clamped.start && paraEnd <= clamped.end) {
    let nextProbe = clamped.end;
    while (nextProbe < text.length && /\s/.test(text[nextProbe])) {
      nextProbe++;
    }
    if (nextProbe < text.length) {
      paraEnd = findParagraphBreakAfter(text, nextProbe);
    }
  }

  return clampExpandedSpanToMaxLength(text, clamped, paraStart, paraEnd, maxLength);
}
