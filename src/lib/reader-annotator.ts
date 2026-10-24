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

export interface SharedQuoteSegments {
  isExact: boolean;
  fullQuote: string;
  overlapText?: string;
  beforeText?: string;
  afterText?: string;
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

  // Handle minor whitespace or sentence punct variations
  const cleanA = textA.toLowerCase().replace(/\s+/g, ' ');
  const cleanB = textB.toLowerCase().replace(/\s+/g, ' ');
  return cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA);
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

  if (ownText.includes(trimmedFellow)) {
    const idx = ownText.indexOf(trimmedFellow);
    return {
      isExact: false,
      fullQuote: ownText,
      overlapText: trimmedFellow,
      beforeText: ownText.slice(0, idx),
      afterText: ownText.slice(idx + trimmedFellow.length),
    };
  }

  if (fellowText.includes(trimmedOwn)) {
    const idx = fellowText.indexOf(trimmedOwn);
    return {
      isExact: false,
      fullQuote: fellowText,
      overlapText: trimmedOwn,
      beforeText: fellowText.slice(0, idx),
      afterText: fellowText.slice(idx + trimmedOwn.length),
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

  const matchingAnnotations = annotations.filter(
    (a) => a.selectedText && text.includes(a.selectedText)
  );

  if (matchingAnnotations.length === 0) {
    return [];
  }

  // 1. Build disjoint non-overlapping intervals for self-annotations (prioritizing earlier matches)
  const rawSelfSpans: Array<{ start: number; end: number; annotation: Annotation }> = [];
  const selfAnnotations = matchingAnnotations.filter((a): a is Annotation => !isFellowAnnotation(a));
  for (const ann of selfAnnotations) {
    let searchStart = 0;
    while (searchStart < text.length) {
      const idx = text.indexOf(ann.selectedText, searchStart);
      if (idx === -1) break;
      rawSelfSpans.push({
        start: idx,
        end: idx + ann.selectedText.length,
        annotation: ann,
      });
      searchStart = idx + ann.selectedText.length;
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
  const fellowAnnotations = matchingAnnotations.filter(isFellowAnnotation);
  for (const ann of fellowAnnotations) {
    let searchStart = 0;
    while (searchStart < text.length) {
      const idx = text.indexOf(ann.selectedText, searchStart);
      if (idx === -1) break;
      rawFellowSpans.push({
        start: idx,
        end: idx + ann.selectedText.length,
        annotation: ann,
      });
      searchStart = idx + ann.selectedText.length;
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

