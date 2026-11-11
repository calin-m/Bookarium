import type { Annotation, FellowAnnotation } from '@/stores/useAnnotationStore';

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
  annotations: AnyAnnotation[]
): AnnotationSpan[] {
  if (!text || !annotations || annotations.length === 0) {
    return [];
  }

  // 1. Build disjoint non-overlapping intervals for self-annotations (prioritizing earlier matches)
  const rawSelfSpans: Array<{ start: number; end: number; annotation: Annotation }> = [];
  const selfAnnotations = annotations.filter((a): a is Annotation => !isFellowAnnotation(a));
  for (const ann of selfAnnotations) {
    if (!ann.selectedText) continue;
    const matches = findAllCanonicalTextSpans(text, ann.selectedText, { allowBoundaryPartial: true });
    for (const m of matches) {
      rawSelfSpans.push({
        start: m.start,
        end: m.end,
        annotation: ann,
      });
    }
  }
  rawSelfSpans.sort((a, b) => a.start - b.start || a.end - b.end);
  const selfSpans: typeof rawSelfSpans = [];
  let lastSelfEnd = 0;
  for (const s of rawSelfSpans) {
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
