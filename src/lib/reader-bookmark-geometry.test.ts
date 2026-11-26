import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  collectContentTextSegments,
  measureCharRect,
  findBestTextMatch,
  extractRowTextFromElement,
  resolveTextRowSpanInElement,
  buildSourceToDomOffsetMap,
  resolveTextOffsetFromClientPoint,
  stepDomOffsetByRow,
  measureSelectionEndpointRects,
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

    it('disambiguates duplicate phrases on the same page by picking the occurrence closest to fallbackRow', () => {
      const root = document.createElement('div');
      const text = 'Yes, indeed. Middle paragraph filler text here. Yes, indeed.';
      root.textContent = text;

      Range.prototype.getBoundingClientRect = vi.fn(function (this: Range) {
        const offset = this.startOffset;
        const row = offset < 15 ? 2 : offset < 45 ? 5 : 9;
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

      const computeRow = (clientY: number) => Math.floor(clientY / 28);

      // When fallbackRow is near row 2, selects the first occurrence at row 2
      expect(
        resolveTextRowSpanInElement(root, text, 'Yes, indeed.', 3, 12, computeRow)
      ).toEqual({ startRow: 2, endRow: 2 });

      // When fallbackRow is near row 9, selects the second occurrence at row 9
      expect(
        resolveTextRowSpanInElement(root, text, 'Yes, indeed.', 8, 12, computeRow)
      ).toEqual({ startRow: 9, endRow: 9 });
    });

    it('resolves legacy bookmark_text containing -- dashes and _italic_ wrappers against reflowed content', () => {
      const root = document.createElement('div');
      const reflowedText =
        'Opening line. Some years ago—never mind how long precisely—having little money.';
      root.textContent = reflowedText;

      Range.prototype.getBoundingClientRect = vi.fn(function (this: Range) {
        const offset = this.startOffset;
        const row = offset >= 14 ? 4 : 1;
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

      const computeRow = (clientY: number) => Math.floor(clientY / 28);
      expect(
        resolveTextRowSpanInElement(
          root,
          reflowedText,
          'Some years ago--never mind how long _precisely_',
          3,
          10,
          computeRow
        )
      ).toEqual({ startRow: 4, endRow: 4 });
    });

    it('falls back to nearest row slice in extractRowTextFromElement when targetRow falls in an inter-line gap', () => {
      const root = document.createElement('div');
      const text = 'Row one text. Row three text.';
      root.textContent = text;

      Range.prototype.getBoundingClientRect = vi.fn(function (this: Range) {
        const offset = this.startOffset;
        const row = offset < 14 ? 1 : 3;
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

      const computeRow = (clientY: number) => Math.floor(clientY / 28);
      // Row 2 has no exact match (firstIdx falls on row 3, lastIdx falls on row 1 -> firstIdx > lastIdx)
      const fallback = extractRowTextFromElement(root, text, 2, computeRow);
      expect(fallback).toBe('Row three text.');

      // Zero-dimension rect returns null from measureCharRect
      Range.prototype.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            width: 0,
            height: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          }) as DOMRect
      );
      expect(measureCharRect(collectContentTextSegments(root), 0)).toBeNull();
    });

    it('resolves row-snapped DOM client points, steps vertically by row, and aligns source-to-DOM endpoint rects around fellow badges', () => {
      const root = document.createElement('div');
      const row1Text = 'Alpha beta gamma ';
      const row2Text = 'delta epsilon zeta.';
      const mark = document.createElement('mark');
      mark.appendChild(document.createTextNode(row1Text));
      const badge = document.createElement('sup');
      badge.setAttribute('data-testid', 'fellow-highlight-badge');
      badge.textContent = '@austen';
      mark.appendChild(badge);
      root.appendChild(mark);
      root.appendChild(document.createTextNode(row2Text));

      const sourceText = `${row1Text}${row2Text}`;
      const segments = collectContentTextSegments(root);
      const offsetMap = buildSourceToDomOffsetMap(sourceText, segments);
      expect(offsetMap.sourceToDom[0]).toBe(0);
      expect(offsetMap.sourceToDom[sourceText.length - 1]).toBe(sourceText.length - 1);

      const splitIdx = row1Text.length;
      Range.prototype.getBoundingClientRect = vi.fn(function (this: Range) {
        const nodeIdx = segments.findIndex((s) => s.node === this.startContainer);
        const globalOffset = (segments[nodeIdx]?.start ?? 0) + this.startOffset;
        const isRow2 = globalOffset >= splitIdx;
        const col = isRow2 ? globalOffset - splitIdx : globalOffset;
        const left = 20 + col * 10;
        const top = isRow2 ? 56 : 20;
        return {
          top,
          bottom: top + 20,
          left,
          right: left + 9,
          width: 9,
          height: 20,
          x: left,
          y: top,
          toJSON: () => ({}),
        } as DOMRect;
      });

      // Dragging vertically onto row 2 around X=85 (inside margin/inter-line space) snaps cleanly to row 2
      const hitRow2 = resolveTextOffsetFromClientPoint(root, 85, 65);
      expect(hitRow2).not.toBeNull();
      expect(hitRow2!).toBeGreaterThanOrEqual(splitIdx);

      // Stepping vertically from row 2 col 0 up to row 1 lands on row 1
      const steppedUp = stepDomOffsetByRow(root, splitIdx, -1, 24);
      expect(steppedUp).not.toBeNull();
      expect(steppedUp!).toBeLessThan(splitIdx);

      // Endpoint rect measurement skips trailing whitespace and excludes @austen badge
      const startOffset = sourceText.indexOf('beta');
      const endOffset = sourceText.indexOf('delta') + 'delta'.length;
      const rects = measureSelectionEndpointRects(root, sourceText, startOffset, endOffset);
      expect(rects).not.toBeNull();
      expect(rects!.startRect.top).toBe(20);
      expect(rects!.endRect.top).toBe(56);

      // Stepping downward from row 1 lands on row 2
      const steppedDown = stepDomOffsetByRow(root, 6, 1, 24);
      expect(steppedDown).not.toBeNull();
      expect(steppedDown!).toBeGreaterThanOrEqual(splitIdx);

      // Whitespace normalization fallback aligns stripped paragraph breaks cleanly
      const sourceWithGap = 'First para.\n\nSecond para.';
      const domEl = document.createElement('div');
      domEl.appendChild(document.createTextNode('First para.Second para.'));
      const gapMap = buildSourceToDomOffsetMap(sourceWithGap, collectContentTextSegments(domEl));
      expect(gapMap.sourceToDom[sourceWithGap.indexOf('Second')]).toBe(11);
      expect(gapMap.domToSource[11]).toBe(sourceWithGap.indexOf('Second'));

      // caretPositionFromPoint fast-path returns directly matched text offset
      const docWithCaret = document as Document & {
        caretPositionFromPoint?: (x: number, y: number) => CaretPosition | null;
      };
      const originalCaret = docWithCaret.caretPositionFromPoint;
      docWithCaret.caretPositionFromPoint = vi.fn(() => ({
        offsetNode: segments[0].node,
        offset: 6,
        getClientRect: () =>
          ({
            top: 20,
            bottom: 40,
            left: 80,
            right: 89,
            width: 9,
            height: 20,
            x: 80,
            y: 20,
            toJSON: () => ({}),
          }) as DOMRect,
      }));
      try {
        expect(resolveTextOffsetFromClientPoint(root, 84, 28)).toBe(6);
      } finally {
        docWithCaret.caretPositionFromPoint = originalCaret;
      }
    });
  });
});
