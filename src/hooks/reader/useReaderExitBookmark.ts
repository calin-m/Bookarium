'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useReaderStore, type BookReadingPosition } from '@/stores/useReaderStore';
import type { ReadingStatus } from '@/types/book.types';
import {
  stripDuplicateLeadingChapterHeading,
  type ChapterSection,
} from '@/lib/gutenberg-parser';
import { findCanonicalTextSpan } from '@/lib/reader-annotator';
import { extractRowTextFromElement } from '@/lib/reader-bookmark-geometry';
import { ROUTES } from '@/config/routes';

export interface HasBookmarkAheadParams {
  existingPos?: BookReadingPosition | null;
  activeChapterIndex: number;
  currentChapterPage: number;
  chaptersWithPagination?: ChapterSection[];
}

/**
 * Pure coordinate comparison checking if a saved bookmark exists further ahead
 * in the volume than the reader's current chapter and page position.
 * When `chaptersWithPagination` and `existingPos.bookmarkText` are provided,
 * resolves the exact reflowed page of the bookmarked passage on the active device
 * before comparing page coordinates.
 */
export function hasBookmarkAhead({
  existingPos,
  activeChapterIndex,
  currentChapterPage,
  chaptersWithPagination,
}: HasBookmarkAheadParams): boolean {
  if (!existingPos) return false;
  const hasBookmark =
    (existingPos.bookmarkRow ?? 0) > 0 || Boolean(existingPos.bookmarkText);
  if (!hasBookmark) return false;

  if (existingPos.chapterIndex > activeChapterIndex) {
    return true;
  }
  if (existingPos.chapterIndex < activeChapterIndex) {
    return false;
  }

  let effectiveBookmarkPage = existingPos.chapterPage ?? 1;
  const savedText = existingPos.bookmarkText?.trim();
  if (
    savedText &&
    chaptersWithPagination &&
    chaptersWithPagination.length > existingPos.chapterIndex
  ) {
    const targetChapter = chaptersWithPagination[existingPos.chapterIndex];
    if (Array.isArray(targetChapter?.pages) && targetChapter.pages.length > 0) {
      const clampedPage = Math.min(
        Math.max(1, effectiveBookmarkPage),
        targetChapter.pages.length
      );
      const candidateSlice = targetChapter.pages[clampedPage - 1] || '';
      if (findCanonicalTextSpan(candidateSlice, savedText) !== null) {
        effectiveBookmarkPage = clampedPage;
      } else {
        const foundIdx = targetChapter.pages.findIndex(
          (p) => findCanonicalTextSpan(p, savedText) !== null
        );
        if (foundIdx !== -1) {
          effectiveBookmarkPage = foundIdx + 1;
        }
      }
    }
  }

  return effectiveBookmarkPage > currentChapterPage;
}

export interface ShouldInterceptExitParams {
  isFinished: boolean;
  exitBookmarkReminderEnabled: boolean;
  hasBookmarkOnThisPage: boolean;
  hasBookmarkAhead: boolean;
}

/**
 * Pure decision engine checking whether to intercept reader exit with the
 * bookmark discovery reminder modal or perform immediate silent exit.
 */
export function shouldInterceptExit({
  isFinished,
  exitBookmarkReminderEnabled,
  hasBookmarkOnThisPage,
  hasBookmarkAhead,
}: ShouldInterceptExitParams): boolean {
  if (isFinished) return false;
  if (!exitBookmarkReminderEnabled) return false;
  if (hasBookmarkOnThisPage) return false;
  if (hasBookmarkAhead) return false;
  return true;
}

export interface UseReaderExitBookmarkOptions {
  numericId: number;
  activeChapterIndex: number;
  currentChapterPage: number;
  currentGlobalPage: number;
  bookmarkRow: number;
  bookmarkText?: string;
  currentPageText?: string;
  chaptersWithPagination?: ChapterSection[];
  readingStatus?: ReadingStatus | string | null;
  exitBookmarkReminderEnabled: boolean;
  userId?: string;
  isAnyDrawerOpen?: boolean;
  closeAllDrawers?: () => void;
  onExit?: () => void;
  setReadingStatus: (bookId: number, status: ReadingStatus, userId?: string) => void;
  setBookmarkRow: (row: number, bookmarkText?: string) => void;
}

export interface UseReaderExitBookmarkReturn {
  isExitModalOpen: boolean;
  setIsExitModalOpen: (open: boolean) => void;
  closeExitModal: () => void;
  handlePerformExit: () => void;
  handleHeaderBack: () => void;
  handleConfirmBookmarkAndExit: () => void;
  handleConfirmExitWithoutSaving: () => void;
  hasBookmarkAhead: boolean;
  isUnderThreshold: boolean;
}

export function useReaderExitBookmark({
  numericId,
  activeChapterIndex,
  currentChapterPage,
  currentGlobalPage,
  bookmarkRow,
  bookmarkText,
  currentPageText,
  chaptersWithPagination,
  readingStatus,
  exitBookmarkReminderEnabled,
  userId,
  isAnyDrawerOpen = false,
  closeAllDrawers,
  onExit,
  setReadingStatus,
  setBookmarkRow,
}: UseReaderExitBookmarkOptions): UseReaderExitBookmarkReturn {
  const router = useRouter();
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);

  const existingPos =
    numericId > 0 ? useReaderStore.getState().getReadingPosition(numericId) : null;

  const bookmarkAhead = hasBookmarkAhead({
    existingPos,
    activeChapterIndex,
    currentChapterPage,
    chaptersWithPagination,
  });

  const isUnderThreshold = (currentGlobalPage ?? 1) < 3 && activeChapterIndex === 0;

  const handlePerformExit = useCallback(() => {
    if (onExit) {
      onExit();
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(ROUTES.HOME);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [router, onExit]);

  const handleHeaderBack = useCallback(() => {
    if (isAnyDrawerOpen && closeAllDrawers) {
      closeAllDrawers();
      return;
    }

    const isFinished = readingStatus === 'finished';
    const hasBookmarkOnThisPage = (bookmarkRow ?? 0) > 0;
    const latestPos =
      numericId > 0 ? useReaderStore.getState().getReadingPosition(numericId) : null;
    const isAhead = hasBookmarkAhead({
      existingPos: latestPos,
      activeChapterIndex,
      currentChapterPage,
      chaptersWithPagination,
    });

    const shouldIntercept = shouldInterceptExit({
      isFinished,
      exitBookmarkReminderEnabled,
      hasBookmarkOnThisPage,
      hasBookmarkAhead: isAhead,
    });

    if (shouldIntercept) {
      setIsExitModalOpen(true);
    } else {
      handlePerformExit();
    }
  }, [
    isAnyDrawerOpen,
    closeAllDrawers,
    readingStatus,
    exitBookmarkReminderEnabled,
    bookmarkRow,
    numericId,
    activeChapterIndex,
    currentChapterPage,
    chaptersWithPagination,
    handlePerformExit,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (isExitModalOpen) {
        setIsExitModalOpen(false);
        return;
      }
      if (isAnyDrawerOpen && closeAllDrawers) {
        e.preventDefault();
        closeAllDrawers();
        return;
      }
      e.preventDefault();
      handleHeaderBack();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExitModalOpen, isAnyDrawerOpen, closeAllDrawers, handleHeaderBack]);

  const handleConfirmBookmarkAndExit = useCallback(() => {
    setIsExitModalOpen(false);
    if (numericId > 0) {
      const activeChapter = chaptersWithPagination?.[activeChapterIndex];
      const cleanedPageText = currentPageText
        ? currentChapterPage === 1 && activeChapter
          ? stripDuplicateLeadingChapterHeading(currentPageText, activeChapter)
          : currentPageText
        : '';

      let targetBookmarkRow = bookmarkRow > 0 ? bookmarkRow : 1;
      let targetBookmarkText = bookmarkText;

      if (bookmarkRow <= 0 && typeof document !== 'undefined') {
        const mainEl = document.querySelector<HTMLElement>('main[role="main"]');
        const contentEl = document.querySelector<HTMLElement>('[data-testid="reader-content-body"]');
        if (mainEl && contentEl && mainEl.scrollTop > 20) {
          const fontSize = parseFloat(contentEl.style.fontSize || '18') || 18;
          const lineHeight = parseFloat(contentEl.style.lineHeight || '1.75') || 1.75;
          const lineStepPx = Math.max(16, fontSize * lineHeight);
          const contentRectTop = contentEl.getBoundingClientRect().top;
          const mainRectTop = mainEl.getBoundingClientRect().top;
          const computeRow = (clientY: number) =>
            Math.max(1, Math.round((clientY - contentRectTop - lineStepPx / 2) / lineStepPx));
          const targetClientY =
            mainRectTop + Math.min(120, Math.max(40, (mainEl.clientHeight || 400) * 0.2));
          const scrolledRow = computeRow(targetClientY);
          if (scrolledRow > 1) {
            targetBookmarkRow = scrolledRow;
            if (!targetBookmarkText && cleanedPageText) {
              targetBookmarkText = extractRowTextFromElement(
                contentEl,
                cleanedPageText,
                scrolledRow,
                computeRow
              );
            }
          }
        }
      }

      if (!targetBookmarkText && cleanedPageText) {
        const nonEmptyLines = cleanedPageText
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        const selectedLine =
          targetBookmarkRow > 1 && nonEmptyLines.length > 1
            ? nonEmptyLines[Math.min(targetBookmarkRow - 1, nonEmptyLines.length - 1)]
            : nonEmptyLines[0];
        if (selectedLine) {
          targetBookmarkText = selectedLine.slice(0, 100);
        }
      }

      setBookmarkRow(targetBookmarkRow, targetBookmarkText);
      setReadingStatus(numericId, 'currently_reading', userId);

      useReaderStore.getState().saveReadingPosition(
        numericId,
        {
          chapterIndex: activeChapterIndex,
          chapterPage: currentChapterPage,
          globalPage: currentGlobalPage,
          bookmarkRow: targetBookmarkRow,
          ...(targetBookmarkText ? { bookmarkText: targetBookmarkText } : {}),
          lastReadAt: new Date().toISOString(),
        },
        userId,
        { immediateCloudSync: true }
      );
    }
    handlePerformExit();
  }, [
    numericId,
    userId,
    setReadingStatus,
    setBookmarkRow,
    activeChapterIndex,
    currentChapterPage,
    currentGlobalPage,
    bookmarkRow,
    bookmarkText,
    currentPageText,
    chaptersWithPagination,
    handlePerformExit,
  ]);

  const handleConfirmExitWithoutSaving = useCallback(() => {
    setIsExitModalOpen(false);
    handlePerformExit();
  }, [handlePerformExit]);

  const closeExitModal = useCallback(() => {
    setIsExitModalOpen(false);
  }, []);

  return {
    isExitModalOpen,
    setIsExitModalOpen,
    closeExitModal,
    handlePerformExit,
    handleHeaderBack,
    handleConfirmBookmarkAndExit,
    handleConfirmExitWithoutSaving,
    hasBookmarkAhead: bookmarkAhead,
    isUnderThreshold,
  };
}
