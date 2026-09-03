'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  parseGutenbergChapters,
  calculateVolumePageSpread,
  type ChapterSection,
} from '@/lib/gutenberg-parser';

export interface UseGutenbergParserWorkerReturn {
  rawChapters: ChapterSection[];
  chaptersWithPagination: ChapterSection[];
  totalVolumePages: number;
  isProcessing: boolean;
}

export function createGutenbergWorker(): Worker | null {
  if (typeof window === 'undefined' || typeof window.Worker === 'undefined') {
    return null;
  }
  try {
    return new window.Worker(new URL('../../workers/gutenberg.worker.ts', import.meta.url), {
      type: 'module',
    });
  } catch {
    return null;
  }
}

/**
 * Offloads heavy chapter segmentation and pagination calculations to a background Web Worker.
 * Automatically and seamlessly degrades to synchronous execution during SSR or in test environments.
 */
export function useGutenbergParserWorker(
  contentText: string | undefined | null,
  fontSize: number,
  workerFactory: () => Worker | null = createGutenbergWorker
): UseGutenbergParserWorkerReturn {
  // Synchronous baseline for SSR, JSDOM, and zero-flicker initial render
  const syncFallback = useMemo(() => {
    if (!contentText) {
      return { rawChapters: [], chaptersWithPagination: [], totalVolumePages: 0 };
    }
    const raw = parseGutenbergChapters(contentText);
    const spread = calculateVolumePageSpread(raw, fontSize);
    return {
      rawChapters: raw,
      chaptersWithPagination: spread.chaptersWithPagination,
      totalVolumePages: spread.totalVolumePages,
    };
  }, [contentText, fontSize]);

  const [workerResult, setWorkerResult] = useState<{
    id: string;
    rawChapters: ChapterSection[];
    chaptersWithPagination: ChapterSection[];
    totalVolumePages: number;
  } | null>(null);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!contentText) {
      return;
    }

    const worker = workerFactory();
    if (!worker) {
      return;
    }

    let isSubscribed = true;
    const requestId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent) => {
      if (!isSubscribed) return;
      const data = event.data;
      if (data && data.id === requestId) {
        setWorkerResult({
          id: data.id,
          rawChapters: data.rawChapters,
          chaptersWithPagination: data.chaptersWithPagination,
          totalVolumePages: data.totalVolumePages,
        });
      }
    };

    worker.onerror = () => {
      // Non-blocking worker error
    };

    try {
      worker.postMessage({
        id: requestId,
        contentText,
        fontSize,
      });
    } catch {
      // Worker dispatch failed
    }

    return () => {
      isSubscribed = false;
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [contentText, fontSize, workerFactory]);

  if (workerResult) {
    return {
      rawChapters: workerResult.rawChapters,
      chaptersWithPagination: workerResult.chaptersWithPagination,
      totalVolumePages: workerResult.totalVolumePages,
      isProcessing: false,
    };
  }

  return {
    rawChapters: syncFallback.rawChapters,
    chaptersWithPagination: syncFallback.chaptersWithPagination,
    totalVolumePages: syncFallback.totalVolumePages,
    isProcessing: false,
  };
}
