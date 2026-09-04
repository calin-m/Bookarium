'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useReaderStore } from '@/stores/useReaderStore';
import {
  getCharsPerPage,
  paginateChapterContent,
  type ChapterSection,
} from '@/lib/gutenberg-parser';

export interface ResumeNotice {
  chapterTitle: string;
  page: number;
}

export interface UseReaderSessionOptions {
  numericId: number;
  hasMounted: boolean;
  chaptersWithPagination: ChapterSection[];
  totalVolumePages: number;
  fontSize: number;
  readingMode: 'paginated' | 'scroll';
}

export interface UseReaderSessionReturn {
  activeChapterIndex: number;
  setActiveChapterIndex: React.Dispatch<React.SetStateAction<number>>;
  currentChapterPage: number;
  setCurrentChapterPage: React.Dispatch<React.SetStateAction<number>>;
  activeChapter: ChapterSection | undefined;
  activeChapterPageCount: number;
  currentPageText: string;
  currentGlobalPage: number;
  volumeProgress: number;
  resumeNotice: ResumeNotice | null;
  dismissResumeNotice: () => void;
  handlePrevPage: () => void;
  handleNextPage: () => void;
  handleSelectChapter: (index: number) => void;
  handlePageJump: (targetPage: number) => void;
  handleRestart: () => void;
}

/**
 * Headless reader session management hook.
 * Encapsulates chapter pagination, auto-resuming stored reading positions,
 * progress persistence, and bidirectional page turning.
 */
export function useReaderSession({
  numericId,
  hasMounted,
  chaptersWithPagination,
  totalVolumePages,
  fontSize,
  readingMode,
}: UseReaderSessionOptions): UseReaderSessionReturn {
  const setProgress = useReaderStore((s) => s.setProgress);
  const saveReadingPosition = useReaderStore((s) => s.saveReadingPosition);
  const getReadingPosition = useReaderStore((s) => s.getReadingPosition);

  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [currentChapterPage, setCurrentChapterPage] = useState(1);
  const [resumeNotice, setResumeNotice] = useState<ResumeNotice | null>(null);
  const hasRestoredPositionRef = useRef(false);

  // Auto-Resume Position from Store
  useEffect(() => {
    if (
      hasRestoredPositionRef.current ||
      !hasMounted ||
      numericId <= 0 ||
      chaptersWithPagination.length === 0
    ) {
      return;
    }
    hasRestoredPositionRef.current = true;
    const savedPos = getReadingPosition(numericId);
    if (savedPos && (savedPos.chapterIndex > 0 || savedPos.chapterPage > 1)) {
      const clampedChap = Math.min(
        Math.max(0, savedPos.chapterIndex),
        chaptersWithPagination.length - 1
      );
      const targetChap = chaptersWithPagination[clampedChap];
      const maxPage = targetChap?.pageCount || 1;
      const clampedPage = Math.min(Math.max(1, savedPos.chapterPage), maxPage);

      queueMicrotask(() => {
        setActiveChapterIndex(clampedChap);
        setCurrentChapterPage(clampedPage);
        setResumeNotice({
          chapterTitle:
            targetChap?.displayTitle || targetChap?.title || `Chapter ${clampedChap + 1}`,
          page: clampedPage,
        });
      });

      // Auto-hide resume notice after 4 seconds
      const timer = setTimeout(() => {
        setResumeNotice(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [hasMounted, numericId, chaptersWithPagination, getReadingPosition]);

  const activeChapter = chaptersWithPagination[activeChapterIndex] || chaptersWithPagination[0];
  const activeChapterPageCount = activeChapter?.pageCount || 1;

  // Retrieve Current Page Text for Paginated Mode
  const currentPageText = useMemo(() => {
    if (!activeChapter?.content) return '';
    if (readingMode === 'scroll') return activeChapter.content;

    const pages =
      activeChapter.pages ||
      paginateChapterContent(activeChapter.content, getCharsPerPage(fontSize));
    return pages[currentChapterPage - 1] || pages[0] || '';
  }, [activeChapter, currentChapterPage, fontSize, readingMode]);

  // Global Page & Progress Calculations
  const currentGlobalPage = (activeChapter?.startPageNumber || 1) + (currentChapterPage - 1);
  const volumeProgress =
    currentGlobalPage <= 1 || totalVolumePages <= 1
      ? 0
      : Math.min(
          100,
          Math.max(
            0,
            Math.round(((currentGlobalPage - 1) / (totalVolumePages - 1)) * 100)
          )
        );

  // Sync Progress & Exact Position to Store
  useEffect(() => {
    if (numericId > 0 && totalVolumePages > 0) {
      setProgress(numericId, volumeProgress);
      if (hasRestoredPositionRef.current) {
        saveReadingPosition(numericId, {
          chapterIndex: activeChapterIndex,
          chapterPage: currentChapterPage,
          globalPage: currentGlobalPage,
          lastReadAt: new Date().toISOString(),
        });
      }
    }
  }, [
    numericId,
    volumeProgress,
    totalVolumePages,
    activeChapterIndex,
    currentChapterPage,
    currentGlobalPage,
    setProgress,
    saveReadingPosition,
  ]);

  // Navigation Handlers
  const handlePrevPage = useCallback(() => {
    if (currentChapterPage > 1) {
      setCurrentChapterPage((p) => p - 1);
    } else if (activeChapterIndex > 0) {
      const prevChapterIndex = activeChapterIndex - 1;
      const prevChapter = chaptersWithPagination[prevChapterIndex];
      setActiveChapterIndex(prevChapterIndex);
      setCurrentChapterPage(prevChapter ? prevChapter.pageCount : 1);
    }
  }, [currentChapterPage, activeChapterIndex, chaptersWithPagination]);

  const handleNextPage = useCallback(() => {
    if (currentChapterPage < activeChapterPageCount) {
      setCurrentChapterPage((p) => p + 1);
    } else if (activeChapterIndex < chaptersWithPagination.length - 1) {
      setActiveChapterIndex((idx) => idx + 1);
      setCurrentChapterPage(1);
    }
  }, [currentChapterPage, activeChapterPageCount, activeChapterIndex, chaptersWithPagination.length]);

  const handleSelectChapter = useCallback((index: number) => {
    setActiveChapterIndex(index);
    setCurrentChapterPage(1);
  }, []);

  const handleRestart = useCallback(() => {
    setActiveChapterIndex(0);
    setCurrentChapterPage(1);
    setResumeNotice(null);
    if (numericId > 0) {
      saveReadingPosition(numericId, {
        chapterIndex: 0,
        chapterPage: 1,
        globalPage: 1,
        lastReadAt: new Date().toISOString(),
      });
      setProgress(numericId, 0);
    }
  }, [numericId, saveReadingPosition, setProgress]);

  const handlePageJump = useCallback((targetPage: number) => {
    let accumulatedPages = 0;
    for (let i = 0; i < chaptersWithPagination.length; i++) {
      const chap = chaptersWithPagination[i];
      if (targetPage <= accumulatedPages + chap.pageCount) {
        setActiveChapterIndex(i);
        setCurrentChapterPage(Math.max(1, targetPage - accumulatedPages));
        return;
      }
      accumulatedPages += chap.pageCount;
    }
  }, [chaptersWithPagination]);

  const dismissResumeNotice = useCallback(() => {
    setResumeNotice(null);
  }, []);

  return {
    activeChapterIndex,
    setActiveChapterIndex,
    currentChapterPage,
    setCurrentChapterPage,
    activeChapter,
    activeChapterPageCount,
    currentPageText,
    currentGlobalPage,
    volumeProgress,
    resumeNotice,
    dismissResumeNotice,
    handlePrevPage,
    handleNextPage,
    handleSelectChapter,
    handlePageJump,
    handleRestart,
  };
}
