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

