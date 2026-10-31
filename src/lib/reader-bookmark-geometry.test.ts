import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  collectContentTextSegments,
  measureCharRect,
  findBestTextMatch,
  extractRowTextFromElement,
  resolveTextRowSpanInElement,
} from './reader-bookmark-geometry';

describe('reader-bookmark-geometry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('collectContentTextSegments', () => {
    it('collects contiguous text segments while excluding fellow scholar highlight badges', () => {
      const root = document.createElement('div');
      const p1 = document.createElement('span');
      p1.textContent = 'Call me Ishmael. ';
      const mark = document.createElement('mark');
      mark.appendChild(document.createTextNode('Some years ago'));
      const badge = document.createElement('sup');
      badge.setAttribute('data-testid', 'fellow-highlight-badge');
      badge.textContent = '@melville';
      mark.appendChild(badge);
      root.appendChild(p1);
      root.appendChild(mark);

      const segments = collectContentTextSegments(root);
      expect(segments).toHaveLength(2);
      expect(segments[0].start).toBe(0);
      expect(segments[0].end).toBe(17);
      expect(segments[1].start).toBe(17);
      expect(segments[1].end).toBe(31);
    });
  });

  describe('findBestTextMatch', () => {
    it('returns null when needle or haystack is empty or needle is not found', () => {
      expect(findBestTextMatch('', 'needle', 0.5)).toBeNull();
      expect(findBestTextMatch('haystack', '   ', 0.5)).toBeNull();
      expect(findBestTextMatch('haystack', 'missing', 0.5)).toBeNull();
    });

    it('selects the occurrence closest to targetRatio when needle appears multiple times', () => {
      const text = 'Alpha Beta Gamma. Middle text here. Alpha Beta Gamma.';
      const early = findBestTextMatch(text, 'Alpha Beta Gamma', 0.05);
      expect(early).toEqual({ start: 0, end: 16 });

      const late = findBestTextMatch(text, 'Alpha Beta Gamma', 0.9);
      expect(late).toEqual({ start: 36, end: 52 });
    });
  });

  describe('measureCharRect, extractRowTextFromElement, and resolveTextRowSpanInElement', () => {
    it('extracts row text and resolves row spans using range bounding rects', () => {
      const root = document.createElement('div');
      const text = 'First row content here. Second row content here. Third row content here.';
      root.textContent = text;

      Range.prototype.getBoundingClientRect = vi.fn(function (this: Range) {
        const offset = this.startOffset;
        const row = offset < 24 ? 1 : offset < 49 ? 2 : 3;
        return {
          top: row * 28,
          bottom: row * 28 + 20,
          left: 0,
          right: 100,
          width: 100,
          height: 20,
          x: 0,
          y: row * 28,
          toJSON: () => ({}),
        } as DOMRect;
      });

      const segments = collectContentTextSegments(root);
      const rect = measureCharRect(segments, 30);
      expect(rect?.top).toBe(56);
      expect(measureCharRect(segments, 999)).toBeNull();

      const computeRow = (clientY: number) => Math.floor(clientY / 28);
      const row2Text = extractRowTextFromElement(root, text, 2, computeRow);
      expect(row2Text).toBe('Second row content here.');

      const span = resolveTextRowSpanInElement(
        root,
        text,
        'Second row content here.',
        2,
        10,
        computeRow
      );
      expect(span).toEqual({ startRow: 2, endRow: 2 });
    });

    it('returns undefined or null gracefully when targetRow <= 0 or range measurement is empty', () => {
      const root = document.createElement('div');
      root.textContent = 'Sample line';
      const computeRow = () => 1;

      expect(extractRowTextFromElement(root, 'Sample line', 0, computeRow)).toBeUndefined();
      expect(extractRowTextFromElement(null, 'Sample line', 1, computeRow)).toBeUndefined();
      expect(resolveTextRowSpanInElement(null, 'Sample line', 'Sample', 1, 5, computeRow)).toBeNull();
    });
  });
});
