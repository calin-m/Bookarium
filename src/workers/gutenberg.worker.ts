/**
 * @module
 * @scope Background Web Worker off-loading `parseGutenbergChapters` and `calculateVolumePageSpread` off the UI main thread.
 * @invariant Guard `typeof self !== 'undefined'` cleanly for SSR/test compatibility, ignore malformed messages missing `id` or `contentText`, and swallow non-fatal parse exceptions rather than crashing the worker loop.
 * @rationale Parsing multi-megabyte classics like War and Peace off-thread preserves 60fps scrolling and zero main-thread jank when opening the Reader.
 * @adr ADR-014, ADR-017
 */

import { parseGutenbergChapters, calculateVolumePageSpread } from '@/lib/gutenberg-parser';

export interface GutenbergWorkerInput {
  id: string;
  contentText: string;
  fontSize: number;
}

export interface GutenbergWorkerOutput {
  id: string;
  rawChapters: ReturnType<typeof parseGutenbergChapters>;
  chaptersWithPagination: ReturnType<typeof calculateVolumePageSpread>['chaptersWithPagination'];
  totalVolumePages: number;
}

if (typeof self !== 'undefined') {
  self.onmessage = (event: MessageEvent<GutenbergWorkerInput>) => {
    const { id, contentText, fontSize } = event.data || {};
    if (!id || !contentText) return;

    try {
      const rawChapters = parseGutenbergChapters(contentText);
      const { chaptersWithPagination, totalVolumePages } = calculateVolumePageSpread(
        rawChapters,
        fontSize || 18
      );

      const response: GutenbergWorkerOutput = {
        id,
        rawChapters,
        chaptersWithPagination,
        totalVolumePages,
      };

      self.postMessage(response);
    } catch {
      // Non-blocking worker error handling
    }
  };
}

