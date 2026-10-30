'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useReaderStore, type BookReadingPosition } from '@/stores/useReaderStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import type { ReadingStatus } from '@/types/book.types';
import {
  getCharsPerPage,
  paginateChapterContent,
  type ChapterSection,
} from '@/lib/gutenberg-parser';
import { useHasMounted } from '@/hooks/useHasMounted';

export interface ResumeNotice {
  chapterTitle: string;
  page: number;
  row?: number;
}

export interface UseReaderSessionOptions {
  numericId: number;
  hasMounted?: boolean;
  chaptersWithPagination: ChapterSection[];
  totalVolumePages: number;
  fontSize: number;
  readingMode: 'paginated' | 'scroll';
  readingStatus?: ReadingStatus | null;
  initialPosition?: { chapterIndex: number; chapterPage: number } | null;
}

export interface UseReaderSessionReturn {
  activeChapterIndex: number;
  setActiveChapterIndex: React.Dispatch<React.SetStateAction<number>>;
  currentChapterPage: number;
  setCurrentChapterPage: React.Dispatch<React.SetStateAction<number>>;
  bookmarkRow: number;
  bookmarkText?: string;
  setBookmarkRow: (row: number, bookmarkText?: string) => void;
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
  jumpTo: (chapterIndex: number, page: number) => void;
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
  readingStatus,
  initialPosition,
}: UseReaderSessionOptions): UseReaderSessionReturn {
  const setProgress = useReaderStore((s) => s.setProgress);
  const saveReadingPosition = useReaderStore((s) => s.saveReadingPosition);
  const getReadingPosition = useReaderStore((s) => s.getReadingPosition);

  const internalHasMounted = useHasMounted();
  const isMounted = hasMounted ?? internalHasMounted;

  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [currentChapterPage, setCurrentChapterPage] = useState(1);
  const [bookmarkRow, setBookmarkRowState] = useState(0);
  const [bookmarkText, setBookmarkTextState] = useState<string | undefined>(undefined);
  const [resumeNotice, setResumeNotice] = useState<ResumeNotice | null>(null);
  const hasRestoredPositionRef = useRef(false);

  const setBookmarkRow = useCallback((row: number, nextBookmarkText?: string) => {
    const clampedRow = Math.max(0, Math.round(row));
    setBookmarkRowState(clampedRow);
    if (clampedRow === 0) {
      setBookmarkTextState(undefined);
    } else if (nextBookmarkText !== undefined) {
      const trimmed = nextBookmarkText.trim();
      setBookmarkTextState(trimmed.length > 0 ? trimmed : undefined);
    }
  }, []);

  // Auto-Resume Position from Store or Cloud
  useEffect(() => {
    if (
      hasRestoredPositionRef.current ||
      !isMounted ||
      numericId <= 0 ||
      chaptersWithPagination.length === 0
    ) {
      return;
    }
    hasRestoredPositionRef.current = true;

    const restoreToPosition = (pos: {
      chapterIndex: number;
      chapterPage: number;
      globalPage?: number;
      bookmarkRow?: number;
      bookmarkText?: string;
    }) => {
      const clampedChap = Math.min(
        Math.max(0, pos.chapterIndex),
        chaptersWithPagination.length - 1
      );
      const targetChap = chaptersWithPagination[clampedChap];
      const savedText = pos.bookmarkText?.trim() || undefined;
      let clampedPage = Math.min(Math.max(1, pos.chapterPage), targetChap.pageCount);
      if (savedText && Array.isArray(targetChap.pages) && targetChap.pages.length > 0) {
        const candidateSlice = targetChap.pages[clampedPage - 1] || '';
        if (!candidateSlice.includes(savedText)) {
          const foundIdx = targetChap.pages.findIndex((p) => p.includes(savedText));
          if (foundIdx !== -1) {
            clampedPage = foundIdx + 1;
          }
        }
      }
      const savedRow = Math.max(0, pos.bookmarkRow ?? (savedText ? 1 : 0));
      const savedGlobalPage =
        clampedPage !== pos.chapterPage
          ? targetChap.startPageNumber + (clampedPage - 1)
          : pos.globalPage || targetChap.startPageNumber + (clampedPage - 1);

      queueMicrotask(() => {
        setActiveChapterIndex(clampedChap);
        setCurrentChapterPage(clampedPage);
        setBookmarkRowState(savedRow);
        setBookmarkTextState(savedRow > 0 ? savedText : undefined);
        setResumeNotice({
          chapterTitle:
            targetChap.displayTitle ||
            targetChap.title ||
            (clampedChap > 0 ? `Chapter ${clampedChap}` : 'Start'),
          page: savedGlobalPage,
          ...(savedRow > 0 ? { row: savedRow + 1 } : {}),
        });
      });

      const timer = setTimeout(() => {
        setResumeNotice(null);
      }, 4000);
      return () => clearTimeout(timer);
    };

    // Direct initial position override (e.g. navigation from Notebook or URL params)
    if (initialPosition) {
      return restoreToPosition(initialPosition);
    }

    // When volume is completed/finished, start fresh from Chapter 0, Page 1 with archival completion notice
    if (readingStatus === 'finished') {
      queueMicrotask(() => {
        setActiveChapterIndex(0);
        setCurrentChapterPage(1);
        setBookmarkRowState(0);
        setBookmarkTextState(undefined);
        setResumeNotice({
          chapterTitle: 'Completed Volume (100%)',
          page: 1,
        });
      });

      const timer = setTimeout(() => {
        setResumeNotice(null);
      }, 4000);
      return () => clearTimeout(timer);
    }

    const applyPosition = (savedPos: BookReadingPosition) => {
      if (
        savedPos &&
        (savedPos.chapterIndex > 0 ||
          savedPos.chapterPage > 1 ||
          (savedPos.bookmarkRow ?? 0) > 0 ||
          Boolean(savedPos.bookmarkText))
      ) {
        return restoreToPosition(savedPos);
      }
    };

    const localPos = getReadingPosition(numericId);
    if (localPos) {
      return applyPosition(localPos);
    }

    const currentUserId = useAuthStore.getState().user?.id;
    if (currentUserId) {
      useReaderStore
        .getState()
        .restoreReadingPositionFromCloud(numericId, currentUserId)
        .then((remotePos) => {
          if (remotePos) {
            applyPosition(remotePos);
          }
        });
    }
  }, [isMounted, numericId, chaptersWithPagination, getReadingPosition, readingStatus, initialPosition]);

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

  // Follow bookmarkText across page boundaries when fontSize re-paginates the active chapter
  useEffect(() => {
    if (
      readingMode !== 'paginated' ||
      bookmarkRow <= 0 ||
      !bookmarkText ||
      !activeChapter?.content
    ) {
      return;
    }
    const pages =
      activeChapter.pages ||
      paginateChapterContent(activeChapter.content, getCharsPerPage(fontSize));
    const currentSlice = pages[currentChapterPage - 1] || '';
    if (!currentSlice.includes(bookmarkText)) {
      const matchingPageIdx = pages.findIndex((p) => p.includes(bookmarkText));
      if (matchingPageIdx !== -1 && matchingPageIdx + 1 !== currentChapterPage) {
        queueMicrotask(() => {
          setCurrentChapterPage(matchingPageIdx + 1);
        });
      }
    }
  }, [readingMode, bookmarkRow, bookmarkText, activeChapter, fontSize, currentChapterPage]);

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

  // Sync Progress & Exact Position to Store (Gated by Page-2+ or Bookmark Engagement)
  useEffect(() => {
    if (numericId > 0 && totalVolumePages > 0) {
      const isEngagedReading =
        currentGlobalPage > 1 ||
        activeChapterIndex > 0 ||
        currentChapterPage > 1 ||
        bookmarkRow > 0 ||
        volumeProgress > 0 ||
        readingStatus === 'finished' ||
        Boolean(getReadingPosition(numericId));

      if (isEngagedReading) {
        if (readingStatus !== 'finished') {
          setProgress(numericId, volumeProgress);
        }
        if (hasRestoredPositionRef.current) {
          const currentUserId = useAuthStore.getState().user?.id;
          saveReadingPosition(
            numericId,
            {
              chapterIndex: activeChapterIndex,
              chapterPage: currentChapterPage,
              globalPage: currentGlobalPage,
              ...(bookmarkRow > 0 ? { bookmarkRow } : {}),
              ...(bookmarkRow > 0 && bookmarkText ? { bookmarkText } : {}),
              lastReadAt: new Date().toISOString(),
            },
            currentUserId
          );
        }
      }
    }
  }, [
    numericId,
    readingStatus,
    volumeProgress,
    totalVolumePages,
    activeChapterIndex,
    currentChapterPage,
    currentGlobalPage,
    bookmarkRow,
    bookmarkText,
    setProgress,
    saveReadingPosition,
    getReadingPosition,
  ]);

  // Navigation Handlers
  const handlePrevPage = useCallback(() => {
    if (currentChapterPage > 1) {
      setCurrentChapterPage((p) => p - 1);
      setBookmarkRowState(0);
      setBookmarkTextState(undefined);
    } else if (activeChapterIndex > 0) {
      const prevChapterIndex = activeChapterIndex - 1;
      const prevChapter = chaptersWithPagination[prevChapterIndex];
      setActiveChapterIndex(prevChapterIndex);
      setCurrentChapterPage(prevChapter ? prevChapter.pageCount : 1);
      setBookmarkRowState(0);
      setBookmarkTextState(undefined);
    }
  }, [currentChapterPage, activeChapterIndex, chaptersWithPagination]);

  const handleNextPage = useCallback(() => {
    if (currentChapterPage < activeChapterPageCount) {
      setCurrentChapterPage((p) => p + 1);
      setBookmarkRowState(0);
      setBookmarkTextState(undefined);
    } else if (activeChapterIndex < chaptersWithPagination.length - 1) {
      setActiveChapterIndex((idx) => idx + 1);
      setCurrentChapterPage(1);
      setBookmarkRowState(0);
      setBookmarkTextState(undefined);
    }
  }, [currentChapterPage, activeChapterPageCount, activeChapterIndex, chaptersWithPagination.length]);

  const handleSelectChapter = useCallback((index: number) => {
    setActiveChapterIndex(index);
    setCurrentChapterPage(1);
    setBookmarkRowState(0);
    setBookmarkTextState(undefined);
  }, []);

  const handleRestart = useCallback(() => {
    setActiveChapterIndex(0);
    setCurrentChapterPage(1);
    setBookmarkRowState(0);
    setBookmarkTextState(undefined);
    setResumeNotice(null);
    if (numericId > 0) {
      const currentUserId = useAuthStore.getState().user?.id;
      useBookshelfStore
        .getState()
        .setReadingStatus(numericId, 'currently_reading', currentUserId);
      saveReadingPosition(
        numericId,
        {
          chapterIndex: 0,
          chapterPage: 1,
          globalPage: 1,
          lastReadAt: new Date().toISOString(),
        },
        currentUserId
      );
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
        setBookmarkRowState(0);
        setBookmarkTextState(undefined);
        return;
      }
      accumulatedPages += chap.pageCount;
    }
  }, [chaptersWithPagination]);

  const dismissResumeNotice = useCallback(() => {
    setResumeNotice(null);
  }, []);

  const jumpTo = useCallback((chapterIndex: number, page: number) => {
    setActiveChapterIndex(chapterIndex);
    setCurrentChapterPage(page);
    setBookmarkRowState(0);
    setBookmarkTextState(undefined);
  }, []);

  return {
    activeChapterIndex,
    setActiveChapterIndex,
    currentChapterPage,
    setCurrentChapterPage,
    bookmarkRow,
    bookmarkText,
    setBookmarkRow,
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
    jumpTo,
    handleRestart,
  };
}
