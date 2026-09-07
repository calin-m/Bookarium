import type { Annotation } from '@/stores/useAnnotationStore';

export interface AnnotationSpan {
  start: number;
  end: number;
  annotation: Annotation;
}

/**
 * Computes non-overlapping text spans for annotations within a given text string.
 * Handles multiple occurrences of highlighted text and guarantees ascending, non-overlapping intervals.
 */
export function computeAnnotationSpans(
  text: string,
  annotations: Annotation[]
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

  const spans: AnnotationSpan[] = [];
  for (const ann of matchingAnnotations) {
    let searchStart = 0;
    while (searchStart < text.length) {
      const idx = text.indexOf(ann.selectedText, searchStart);
      if (idx === -1) break;
      spans.push({ start: idx, end: idx + ann.selectedText.length, annotation: ann });
      searchStart = idx + ann.selectedText.length;
    }
  }

  spans.sort((a, b) => a.start - b.start || a.end - b.end);

  const cleanSpans: AnnotationSpan[] = [];
  let lastEnd = 0;
  for (const span of spans) {
    if (span.start >= lastEnd) {
      cleanSpans.push(span);
      lastEnd = span.end;
    }
  }

  return cleanSpans;
}

