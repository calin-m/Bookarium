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
  // Derive stable book content identity to manage worker lifecycle
  const bookIdentity = useMemo(() => {
    if (!contentText) return '';
    return `${contentText.length}-${contentText.slice(0, 32)}`;
  }, [contentText]);

  // Derive stable pagination request hash including font size
  const currentContentHash = useMemo(() => {
    if (!contentText) return '';
    return `${bookIdentity}-${fontSize}`;
  }, [bookIdentity, contentText, fontSize]);

  const [workerResult, setWorkerResult] = useState<{
    bookHash: string;
    rawChapters: ChapterSection[];
    chaptersWithPagination: ChapterSection[];
    totalVolumePages: number;
  } | null>(null);

  const [workerFailed, setWorkerFailed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return typeof window.Worker === 'undefined';
  });
  const workerRef = useRef<Worker | null>(null);
  const prevBookIdentityRef = useRef<string>('');

  // Lazy synchronous fallback for SSR, test environments, or when worker fails
  const syncFallback = useMemo(() => {
    const isUnsupported = typeof window === 'undefined' || typeof window.Worker === 'undefined';
    if (!isUnsupported && !workerFailed) {
      return { rawChapters: [], chaptersWithPagination: [], totalVolumePages: 0 };
    }
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
  }, [contentText, fontSize, workerFailed]);

  useEffect(() => {
    if (!contentText || !currentContentHash) {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      return;
    }

    // Terminate and respawn only if the book content text changed
    const bookChanged = prevBookIdentityRef.current !== bookIdentity;
    prevBookIdentityRef.current = bookIdentity;

    if (bookChanged && workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    let worker = workerRef.current;
    if (!worker) {
      worker = workerFactory();
      if (!worker) {
        queueMicrotask(() => {
          setWorkerFailed(true);
        });
        return;
      }
      workerRef.current = worker;
    }

    let isSubscribed = true;
    const requestId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    worker.onmessage = (event: MessageEvent) => {
      if (!isSubscribed) return;
      const data = event.data;
      if (data && data.id === requestId) {
        setWorkerResult({
          bookHash: currentContentHash,
          rawChapters: data.rawChapters,
          chaptersWithPagination: data.chaptersWithPagination,
          totalVolumePages: data.totalVolumePages,
        });
        setWorkerFailed(false);
      }
    };

    worker.onerror = () => {
      if (isSubscribed) {
        setWorkerFailed(true);
      }
    };

    try {
      worker.postMessage({
        id: requestId,
        contentText,
        fontSize,
      });
    } catch {
      if (isSubscribed) {
        queueMicrotask(() => {
          setWorkerFailed(true);
        });
      }
    }

    return () => {
      isSubscribed = false;
    };
  }, [bookIdentity, currentContentHash, contentText, fontSize, workerFactory]);

  // Clean up worker on component unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const hasMatchingResult = workerResult && workerResult.bookHash === currentContentHash;
  const isProcessing = Boolean(contentText && !hasMatchingResult && !workerFailed);

  // Return worker result if it precisely matches the active book content hash
  if (hasMatchingResult) {
    return {
      rawChapters: workerResult.rawChapters,
      chaptersWithPagination: workerResult.chaptersWithPagination,
      totalVolumePages: workerResult.totalVolumePages,
      isProcessing: false,
    };
  }

  // Graceful fallback for SSR, initial async load, or worker error
  return {
    rawChapters: syncFallback.rawChapters,
    chaptersWithPagination: syncFallback.chaptersWithPagination,
    totalVolumePages: syncFallback.totalVolumePages,
    isProcessing,
  };
}
