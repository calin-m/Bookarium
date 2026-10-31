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

  let searchIndex = 0;
  let bestMatch: { start: number; end: number; distance: number } | null = null;
  const totalLen = Math.max(1, haystack.length);

  while (searchIndex <= haystack.length - trimmed.length) {
    const found = haystack.indexOf(trimmed, searchIndex);
    if (found === -1) break;
    const ratio = found / totalLen;
    const distance = Math.abs(ratio - targetRatio);
    if (!bestMatch || distance < bestMatch.distance) {
      bestMatch = {
        start: found,
        end: found + trimmed.length,
        distance,
      };
    }
    searchIndex = found + 1;
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
 */
export function resolveTextRowSpanInElement(
  el: HTMLElement | null,
  contentToDisplay: string,
  textToFind: string,
  fallbackRow: number,
  maxRows: number,
  computeRowFromClientY: (clientY: number) => number
): { startRow: number; endRow: number } | null {
  if (!textToFind || !contentToDisplay || !el) return null;

  const segments = collectContentTextSegments(el);
  const totalChars = segments.length > 0 ? segments[segments.length - 1].end : 0;
  if (totalChars <= 0) return null;

  const safeMaxRows = Math.max(1, maxRows);
  const targetRatio = Math.min(1, Math.max(0, fallbackRow / safeMaxRows));
  const match = findBestTextMatch(contentToDisplay, textToFind, targetRatio);
  if (!match) return null;

  const startRect = measureCharRect(segments, match.start);
  const endRect = measureCharRect(segments, Math.max(match.start, match.end - 1));
  if (!startRect || !endRect) return null;

  const startRow = Math.max(
    1,
    computeRowFromClientY(startRect.top + startRect.height / 2)
  );
  const endRow = Math.max(
    startRow,
    computeRowFromClientY(endRect.top + endRect.height / 2)
  );

  return { startRow, endRow };
}

