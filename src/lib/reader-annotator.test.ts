import { describe, it, expect } from 'vitest';
import { computeAnnotationSpans } from './reader-annotator';
import type { Annotation } from '@/stores/useAnnotationStore';

describe('computeAnnotationSpans', () => {
  const createAnnotation = (id: string, text: string): Annotation => ({
    id,
    bookId: 1,
    chapterIndex: 0,
    chapterPage: 1,
    selectedText: text,
    color: 'yellow',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  });

  it('returns empty array when text or annotations are empty', () => {
    expect(computeAnnotationSpans('', [])).toEqual([]);
    expect(computeAnnotationSpans('Hello world', [])).toEqual([]);
    expect(computeAnnotationSpans('', [createAnnotation('1', 'test')])).toEqual([]);
  });

  it('returns empty array when no annotations match the text', () => {
    const text = 'Call me Ishmael.';
    const annotations = [createAnnotation('1', 'Ahab')];
    expect(computeAnnotationSpans(text, annotations)).toEqual([]);
  });

  it('matches single annotation with exact coordinates', () => {
    const text = 'Call me Ishmael.';
    const annotations = [createAnnotation('1', 'Ishmael')];
    const spans = computeAnnotationSpans(text, annotations);

    expect(spans).toHaveLength(1);
    expect(spans[0].start).toBe(8);
    expect(spans[0].end).toBe(15);
    expect(spans[0].annotation.id).toBe('1');
  });

  it('sorts multiple disjoint annotations in start order', () => {
    const text = 'The quick brown fox jumps over the lazy dog.';
    const annotations = [
      createAnnotation('2', 'lazy dog'),
      createAnnotation('1', 'quick brown'),
    ];
    const spans = computeAnnotationSpans(text, annotations);

    expect(spans).toHaveLength(2);
    expect(spans[0].annotation.id).toBe('1');
    expect(spans[0].start).toBe(4);
    expect(spans[0].end).toBe(15);

    expect(spans[1].annotation.id).toBe('2');
    expect(spans[1].start).toBe(35);
    expect(spans[1].end).toBe(43);
  });

  it('resolves overlapping annotations by prioritizing earlier non-overlapping spans', () => {
    const text = 'Pride and Prejudice and Zombies';
    // 'and Prejudice' (start: 5, end: 18)
    // 'Prejudice and' (start: 10, end: 23) -> overlaps with previous, should be dropped
    const annotations = [
      createAnnotation('1', 'and Prejudice'),
      createAnnotation('2', 'Prejudice and'),
    ];
    const spans = computeAnnotationSpans(text, annotations);

    expect(spans).toHaveLength(1);
    expect(spans[0].annotation.id).toBe('1');
    expect(spans[0].start).toBe(6);
    expect(spans[0].end).toBe(19);
  });

  it('captures multiple occurrences of the same phrase', () => {
    const text = 'to be or not to be';
    const annotations = [createAnnotation('1', 'to be')];
    const spans = computeAnnotationSpans(text, annotations);

    expect(spans).toHaveLength(2);
    expect(spans[0].start).toBe(0);
    expect(spans[0].end).toBe(5);
    expect(spans[1].start).toBe(13);
    expect(spans[1].end).toBe(18);
  });
});

