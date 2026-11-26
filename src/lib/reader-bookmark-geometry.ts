/**
 * @module
 * @scope DOM `Range` row-geometry engine measuring per-line bookmark placement (`extractRowTextFromElement`), duplicate-line reflow resolution (`resolveTextRowSpanInElement`), and interactive highlight crop handle hit-testing (`resolveTextOffsetFromClientPoint`, `measureSelectionEndpointRects`).
 * @invariant Exclude injected `[data-testid="fellow-highlight-badge"]` DOM superscripts inside `collectContentTextSegments` (`TreeWalker`) so character offsets stay aligned with pure canonical page text (`buildSourceToDomOffsetMap`).
 * @invariant Binary-search rendered character bounding rectangles (`measureCharRect`), resolve vertical row-snapped drag points via visual line grouping (`DEFAULT_ROW_Y_TOLERANCE_PX`), and disambiguate duplicate phrases on the same page by shortest row distance to `fallbackRow` with relative ratio tiebreaking.
 * @rationale Separating pure DOM `Range` geometry from React components allows reflow-resilient multi-row bookmark snapping and row-snapping crop handles to remain fast and deterministically unit-tested.
 * @adr ADR-068, ADR-080
 */

import { findAllCanonicalTextSpans } from './reader-annotator';

export interface TextNodeSegment {
  node: Text;
  start: number;
  end: number;
}

/**
 * Walks all text nodes inside `root`, excluding fellow scholar badge superscripts
 * (`[data-testid="fellow-highlight-badge"]`), and returns contiguous character offset segments.
 */
export function collectContentTextSegments(root: HTMLElement): TextNodeSegment[] {
  if (typeof document === 'undefined' || typeof document.createTreeWalker !== 'function') {
    return [];
  }
  const segments: TextNodeSegment[] = [];
  let offset = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (parent?.closest('[data-testid="fellow-highlight-badge"]')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let current = walker.nextNode() as Text | null;
  while (current) {
    const len = current.nodeValue?.length ?? 0;
    if (len > 0) {
      segments.push({
        node: current,
        start: offset,
        end: offset + len,
      });
      offset += len;
    }
    current = walker.nextNode() as Text | null;
  }
  return segments;
}

/**
 * Measures the bounding client rectangle of the character at `charIdx` across text node segments.
 */
export function measureCharRect(segments: TextNodeSegment[], charIdx: number): DOMRect | null {
  if (typeof document === 'undefined' || typeof document.createRange !== 'function') {
    return null;
  }
  for (const seg of segments) {
    if (charIdx >= seg.start && charIdx < seg.end) {
      try {
        const range = document.createRange();
        const localOffset = charIdx - seg.start;
        range.setStart(seg.node, localOffset);
        range.setEnd(seg.node, localOffset + 1);
        const rect = range.getBoundingClientRect();
        if (rect && (rect.height > 0 || rect.width > 0 || rect.top !== 0 || rect.bottom !== 0)) {
          return rect;
        }
        return null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Finds the occurrence of `needle` inside `haystack` whose relative offset is closest to `targetRatio` (0..1).
 */
export function findBestTextMatch(
  haystack: string,
  needle: string,
  targetRatio: number
): { start: number; end: number } | null {
  const trimmed = needle.trim();
  if (!trimmed || !haystack) return null;

  const spans = findAllCanonicalTextSpans(haystack, trimmed);
  if (spans.length === 0) return null;

  let bestMatch: { start: number; end: number; distance: number } | null = null;
  const totalLen = Math.max(1, haystack.length);

  for (const span of spans) {
    const ratio = span.start / totalLen;
    const distance = Math.abs(ratio - targetRatio);
    if (!bestMatch || distance < bestMatch.distance) {
      bestMatch = {
        start: span.start,
        end: span.end,
        distance,
      };
    }
  }

  return bestMatch ? { start: bestMatch.start, end: bestMatch.end } : null;
}

/**
 * Binary-searches character bounding boxes in `el` to extract the text snippet rendered on `targetRow`.
 */
export function extractRowTextFromElement(
  el: HTMLElement | null,
  contentToDisplay: string,
  targetRow: number,
  computeRowFromClientY: (clientY: number) => number
): string | undefined {
  if (targetRow <= 0 || !contentToDisplay || !el) return undefined;

  const segments = collectContentTextSegments(el);
  const totalChars = segments.length > 0 ? segments[segments.length - 1].end : 0;
  if (totalChars <= 0) return undefined;

  const getCharRow = (charIdx: number): number | null => {
    const rect = measureCharRect(segments, charIdx);
    if (!rect) return null;
    return computeRowFromClientY(rect.top + rect.height / 2);
  };

  if (getCharRow(0) === null) return undefined;

  let lo = 0;
  let hi = totalChars - 1;
  let firstIdx = totalChars;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = getCharRow(mid);
    if (r === null) return undefined;
    if (r >= targetRow) {
      firstIdx = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  lo = 0;
  hi = totalChars - 1;
  let lastIdx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = getCharRow(mid);
    if (r === null) return undefined;
    if (r <= targetRow) {
      lastIdx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (firstIdx <= lastIdx && firstIdx < totalChars && lastIdx >= 0) {
    const extracted = contentToDisplay.slice(firstIdx, lastIdx + 1).trim();
    if (extracted.length > 0) return extracted;
  }

  if (firstIdx < totalChars) {
    const nearestRow = getCharRow(firstIdx);
    if (nearestRow !== null) {
      let endIdx = firstIdx;
      while (endIdx + 1 < totalChars && getCharRow(endIdx + 1) === nearestRow) {
        endIdx++;
      }
      const fallbackSlice = contentToDisplay.slice(firstIdx, endIdx + 1).trim();
      if (fallbackSlice.length > 0) return fallbackSlice;
    }
  }

  return undefined;
}

/**
 * Resolves the current rendered `{ startRow, endRow }` span of `textToFind` inside `el`.
 * When `textToFind` appears multiple times on the same page, selects the occurrence whose
 * rendered `startRow` is closest to `fallbackRow` (with relative page ratio as tiebreaker).
 */
export function resolveTextRowSpanInElement(
  el: HTMLElement | null,
  contentToDisplay: string,
  textToFind: string,
  fallbackRow: number,
  maxRows: number,
  computeRowFromClientY: (clientY: number) => number
): { startRow: number; endRow: number } | null {
  const trimmed = textToFind?.trim() || '';
  if (!trimmed || !contentToDisplay || !el) return null;

  const segments = collectContentTextSegments(el);
  const totalChars = segments.length > 0 ? segments[segments.length - 1].end : 0;
  if (totalChars <= 0) return null;

  const occurrences = findAllCanonicalTextSpans(contentToDisplay, trimmed);
  if (occurrences.length === 0) return null;

  const safeMaxRows = Math.max(1, maxRows);
  const targetRatio = Math.min(1, Math.max(0, fallbackRow / safeMaxRows));
  const totalLen = Math.max(1, contentToDisplay.length);

  let bestSpan: {
    startRow: number;
    endRow: number;
    rowDistance: number;
    ratioDistance: number;
  } | null = null;

  for (const occ of occurrences) {
    const startRect = measureCharRect(segments, occ.start);
    const endRect = measureCharRect(segments, Math.max(occ.start, occ.end - 1));
    if (!startRect || !endRect) continue;

    const startRow = Math.max(
      1,
      computeRowFromClientY(startRect.top + startRect.height / 2)
    );
    const endRow = Math.max(
      startRow,
      computeRowFromClientY(endRect.top + endRect.height / 2)
    );
    const rowDistance = Math.abs(startRow - fallbackRow);
    const ratioDistance = Math.abs(occ.start / totalLen - targetRatio);

    if (
      !bestSpan ||
      rowDistance < bestSpan.rowDistance ||
      (rowDistance === bestSpan.rowDistance && ratioDistance < bestSpan.ratioDistance)
    ) {
      bestSpan = { startRow, endRow, rowDistance, ratioDistance };
    }
  }

  return bestSpan ? { startRow: bestSpan.startRow, endRow: bestSpan.endRow } : null;
}

const DEFAULT_ROW_Y_TOLERANCE_PX = 4;

export interface SourceDomOffsetMap {
  sourceToDom: number[];
  domToSource: number[];
  domTotalChars: number;
}

/**
 * Aligns canonical `sourceText` character positions 1:1 with concatenated DOM
 * `TextNodeSegment` offsets (skipping whitespace stripped by HTML layout cleanly).
 */
export function buildSourceToDomOffsetMap(
  sourceText: string,
  segments: TextNodeSegment[]
): SourceDomOffsetMap {
  const domText = segments.map((s) => s.node.nodeValue ?? '').join('');
  const domTotalChars = domText.length;
  const sourceLen = sourceText.length;
  const sourceToDom = new Array<number>(sourceLen + 1).fill(domTotalChars);
  const domToSource = new Array<number>(domTotalChars + 1).fill(sourceLen);

  if (domText === sourceText) {
    for (let i = 0; i <= sourceLen; i++) {
      sourceToDom[i] = i;
      domToSource[i] = i;
    }
    return { sourceToDom, domToSource, domTotalChars };
  }

  let i = 0;
  let j = 0;
  while (i < sourceLen && j < domTotalChars) {
    if (sourceText[i] === domText[j]) {
      sourceToDom[i] = j;
      domToSource[j] = i;
      i++;
      j++;
    } else if (/\s/.test(sourceText[i])) {
      sourceToDom[i] = j;
      i++;
    } else if (/\s/.test(domText[j])) {
      domToSource[j] = i;
      j++;
    } else {
      sourceToDom[i] = j;
      domToSource[j] = i;
      i++;
      j++;
    }
  }
  while (i <= sourceLen) {
    sourceToDom[i] = Math.min(j, domTotalChars);
    i++;
  }
  while (j <= domTotalChars) {
    domToSource[j] = Math.min(i, sourceLen);
    j++;
  }

  return { sourceToDom, domToSource, domTotalChars };
}

function measureNearestCharRect(
  segments: TextNodeSegment[],
  totalChars: number,
  approxIdx: number,
  maxRadius = 10
): { idx: number; rect: DOMRect } | null {
  if (totalChars <= 0) return null;
  const clamped = Math.max(0, Math.min(approxIdx, totalChars - 1));
  const direct = measureCharRect(segments, clamped);
  if (direct) return { idx: clamped, rect: direct };

  for (let d = 1; d <= maxRadius; d++) {
    if (clamped + d < totalChars) {
      const right = measureCharRect(segments, clamped + d);
      if (right) return { idx: clamped + d, rect: right };
    }
    if (clamped - d >= 0) {
      const left = measureCharRect(segments, clamped - d);
      if (left) return { idx: clamped - d, rect: left };
    }
  }
  return null;
}

function findDomRowBounds(
  segments: TextNodeSegment[],
  totalChars: number,
  anchorIdx: number,
  targetMidY: number
): { rowStart: number; rowEnd: number } {
  let lo = 0;
  let hi = anchorIdx;
  let rowStart = anchorIdx;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const probed = measureNearestCharRect(segments, totalChars, mid, 4);
    if (!probed) break;
    const midY = probed.rect.top + probed.rect.height / 2;
    if (Math.abs(midY - targetMidY) <= DEFAULT_ROW_Y_TOLERANCE_PX) {
      rowStart = Math.min(rowStart, probed.idx);
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  lo = anchorIdx;
  hi = totalChars - 1;
  let rowEnd = anchorIdx;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const probed = measureNearestCharRect(segments, totalChars, mid, 4);
    if (!probed) break;
    const midY = probed.rect.top + probed.rect.height / 2;
    if (Math.abs(midY - targetMidY) <= DEFAULT_ROW_Y_TOLERANCE_PX) {
      rowEnd = Math.max(rowEnd, probed.idx);
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return { rowStart: Math.min(rowStart, rowEnd), rowEnd: Math.max(rowStart, rowEnd) };
}

function pickClosestXInRow(
  segments: TextNodeSegment[],
  rowStart: number,
  rowEnd: number,
  clientX: number
): number {
  let bestIdx = rowStart;
  let bestDist = Infinity;

  for (let idx = rowStart; idx <= rowEnd; idx++) {
    const rect = measureCharRect(segments, idx);
    if (!rect) continue;
    const centerX = rect.left + rect.width / 2;
    const dist =
      clientX >= rect.left && clientX <= rect.right
        ? 0
        : Math.abs(clientX - centerX);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = idx;
    }
  }

  return bestIdx;
}

function tryCaretDomOffset(
  segments: TextNodeSegment[],
  clientX: number,
  clientY: number
): number | null {
  if (typeof document === 'undefined') return null;

  type CaretPosDoc = Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const doc = document as CaretPosDoc;

  let hitNode: Node | null = null;
  let hitOffset = 0;

  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(clientX, clientY);
    if (pos) {
      hitNode = pos.offsetNode;
      hitOffset = pos.offset;
    }
  } else if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(clientX, clientY);
    if (range) {
      hitNode = range.startContainer;
      hitOffset = range.startOffset;
    }
  }

  if (!hitNode) return null;

  for (const seg of segments) {
    if (seg.node === hitNode) {
      const clampedLocal = Math.max(0, Math.min(hitOffset, seg.end - seg.start - 1));
      const candidateIdx = seg.start + clampedLocal;
      const rect = measureCharRect(segments, candidateIdx);
      if (rect) {
        const rectMidY = rect.top + rect.height / 2;
        if (
          Math.abs(rectMidY - clientY) <= Math.max(8, rect.height * 0.7) &&
          clientX >= rect.left - 8 &&
          clientX <= rect.right + 8
        ) {
          return candidateIdx;
        }
      }
      return null;
    }
  }

  return null;
}

/**
 * Resolves the DOM character offset inside `container` closest to `(clientX, clientY)`
 * by snapping vertically to the closest visual row and horizontally to the nearest glyph midpoint.
 */
export function resolveTextOffsetFromClientPoint(
  container: HTMLElement | null,
  clientX: number,
  clientY: number
): number | null {
  if (!container) return null;
  const segments = collectContentTextSegments(container);
  const totalChars = segments.length > 0 ? segments[segments.length - 1].end : 0;
  if (totalChars <= 0) return null;

  const caretHit = tryCaretDomOffset(segments, clientX, clientY);
  if (caretHit !== null) {
    return caretHit;
  }

  // Binary-search visual row closest to clientY
  let lo = 0;
  let hi = totalChars - 1;
  let lowerCandidate: { idx: number; midY: number } | null = null;
  let upperCandidate: { idx: number; midY: number } | null = null;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const probed = measureNearestCharRect(segments, totalChars, mid, 12);
    if (!probed) break;
    const midY = probed.rect.top + probed.rect.height / 2;
    if (midY >= clientY) {
      lowerCandidate = { idx: probed.idx, midY };
      hi = mid - 1;
    } else {
      upperCandidate = { idx: probed.idx, midY };
      lo = mid + 1;
    }
  }

  let chosen = lowerCandidate || upperCandidate;
  if (lowerCandidate && upperCandidate) {
    chosen =
      Math.abs(clientY - upperCandidate.midY) < Math.abs(lowerCandidate.midY - clientY)
        ? upperCandidate
        : lowerCandidate;
  }
  if (!chosen) {
    const first = measureNearestCharRect(segments, totalChars, 0, totalChars);
    if (!first) return null;
    chosen = { idx: first.idx, midY: first.rect.top + first.rect.height / 2 };
  }

  const { rowStart, rowEnd } = findDomRowBounds(segments, totalChars, chosen.idx, chosen.midY);
  return pickClosestXInRow(segments, rowStart, rowEnd, clientX);
}

/**
 * Steps a DOM offset vertically by one rendered row (`-1` up / `1` down), keeping
 * horizontal alignment near `anchorClientX` (used for keyboard arrow handle nudging).
 */
export function stepDomOffsetByRow(
  container: HTMLElement | null,
  currentDomOffset: number,
  rowDelta: -1 | 1,
  anchorClientX?: number
): number | null {
  if (!container) return null;
  const segments = collectContentTextSegments(container);
  const totalChars = segments.length > 0 ? segments[segments.length - 1].end : 0;
  if (totalChars <= 0) return null;

  const current = measureNearestCharRect(segments, totalChars, currentDomOffset, 12);
  if (!current) return null;

  const curMidY = current.rect.top + current.rect.height / 2;
  const targetX = anchorClientX ?? current.rect.left + current.rect.width / 2;
  const { rowStart, rowEnd } = findDomRowBounds(segments, totalChars, current.idx, curMidY);

  if (rowDelta === -1) {
    let scan = rowStart - 1;
    while (scan >= 0) {
      const rect = measureCharRect(segments, scan);
      if (rect && curMidY - (rect.top + rect.height / 2) > DEFAULT_ROW_Y_TOLERANCE_PX) {
        const prevMidY = rect.top + rect.height / 2;
        const prevRow = findDomRowBounds(segments, totalChars, scan, prevMidY);
        return pickClosestXInRow(segments, prevRow.rowStart, prevRow.rowEnd, targetX);
      }
      scan--;
    }
    return current.idx;
  }

  let scan = rowEnd + 1;
  while (scan < totalChars) {
    const rect = measureCharRect(segments, scan);
    if (rect && rect.top + rect.height / 2 - curMidY > DEFAULT_ROW_Y_TOLERANCE_PX) {
      const nextMidY = rect.top + rect.height / 2;
      const nextRow = findDomRowBounds(segments, totalChars, scan, nextMidY);
      return pickClosestXInRow(segments, nextRow.rowStart, nextRow.rowEnd, targetX);
    }
    scan++;
  }
  return current.idx;
}

/**
 * Measures the bounding client rects for the first and last visible glyphs of
 * `[startOffset, endOffset)` (in canonical `sourceText` coordinates).
 */
export function measureSelectionEndpointRects(
  container: HTMLElement | null,
  sourceText: string,
  startOffset: number,
  endOffset: number
): { startRect: DOMRect; endRect: DOMRect } | null {
  if (!container || !sourceText || endOffset <= startOffset) return null;
  const segments = collectContentTextSegments(container);
  const totalDomChars = segments.length > 0 ? segments[segments.length - 1].end : 0;
  if (totalDomChars <= 0) return null;

  const { sourceToDom } = buildSourceToDomOffsetMap(sourceText, segments);

  let visStart = Math.max(0, startOffset);
  let visEnd = Math.min(sourceText.length - 1, endOffset - 1);
  while (visStart < visEnd && /\s/.test(sourceText[visStart])) visStart++;
  while (visEnd > visStart && /\s/.test(sourceText[visEnd])) visEnd--;

  const domStart = Math.min(totalDomChars - 1, Math.max(0, sourceToDom[visStart] ?? 0));
  const domEnd = Math.min(totalDomChars - 1, Math.max(domStart, sourceToDom[visEnd] ?? totalDomChars - 1));

  let startRect = measureCharRect(segments, domStart);
  if (!startRect) {
    for (let k = domStart + 1; k <= Math.min(domEnd, domStart + 6); k++) {
      startRect = measureCharRect(segments, k);
      if (startRect) break;
    }
  }

  let endRect = measureCharRect(segments, domEnd);
  if (!endRect) {
    for (let k = domEnd - 1; k >= Math.max(domStart, domEnd - 6); k--) {
      endRect = measureCharRect(segments, k);
      if (endRect) break;
    }
  }

  if (!startRect || !endRect) return null;
  return { startRect, endRect };
}

