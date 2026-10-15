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
}

/**
 * Computes non-overlapping text spans for annotations within a given text string.
 * Handles multiple occurrences of highlighted text, guarantees ascending intervals,
 * and preserves both selfAnnotation and fellowAnnotation when a user and Fellow Scholar
 * highlight overlapping text.
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

  const spans: AnnotationSpan[] = [];
  for (const ann of matchingAnnotations) {
    const isFellow = isFellowAnnotation(ann);
    let searchStart = 0;
    while (searchStart < text.length) {
      const idx = text.indexOf(ann.selectedText, searchStart);
      if (idx === -1) break;
      spans.push({
        start: idx,
        end: idx + ann.selectedText.length,
        annotation: ann,
        selfAnnotation: isFellow ? undefined : ann,
        fellowAnnotation: isFellow ? ann : undefined,
      });
      searchStart = idx + ann.selectedText.length;
    }
  }

  spans.sort((a, b) => a.start - b.start || a.end - b.end);

  const cleanSpans: AnnotationSpan[] = [];
  let lastEnd = 0;
  for (const span of spans) {
    if (span.start >= lastEnd) {
      cleanSpans.push({ ...span });
      lastEnd = span.end;
    } else if (cleanSpans.length > 0) {
      const prev = cleanSpans[cleanSpans.length - 1];
      if (!prev.selfAnnotation && span.selfAnnotation) {
        prev.selfAnnotation = span.selfAnnotation;
        prev.annotation = span.selfAnnotation;
      } else if (!prev.fellowAnnotation && span.fellowAnnotation) {
        prev.fellowAnnotation = span.fellowAnnotation;
      }
    }
  }

  return cleanSpans;
}

