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
import { findCanonicalTextSpan } from '@/lib/reader-annotator';
import { useHasMounted } from '@/hooks/useHasMounted';

export interface ResumeNotice {
  chapterTitle: string;
  page: number;
  row?: number;
}

export interface PinnedBookmarkCoordinate {
  chapterIndex: number;
  chapterPage: number;
  globalPage: number;
  bookmarkRow: number;
  bookmarkText?: string;
  lastReadAt?: string;
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
  setBookmarkRow: (
    row: number,
    bookmarkText?: string,
    options?: { isLayoutSync?: boolean }
  ) => void;
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
  const storedPosition = useReaderStore((s) =>
    numericId > 0 ? s.readingPositions[numericId] : undefined
  );

  const internalHasMounted = useHasMounted();
  const isMounted = hasMounted ?? internalHasMounted;

  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [currentChapterPage, setCurrentChapterPage] = useState(1);
  const [pinnedBookmark, setPinnedBookmark] = useState<PinnedBookmarkCoordinate | null>(null);
  const [resumeNotice, setResumeNotice] = useState<ResumeNotice | null>(null);
  const hasRestoredPositionRef = useRef(false);
  const isRestoringPositionRef = useRef(false);
  const hasUserModifiedSessionRef = useRef(false);
  const restoredPositionRef = useRef<{
    chapterIndex: number;
    chapterPage: number;
    bookmarkRow: number;
    bookmarkText?: string;
    lastReadAt?: string;
  } | null>(null);

  const activeChapter = chaptersWithPagination[activeChapterIndex] || chaptersWithPagination[0];
  const activeChapterPageCount = activeChapter?.pageCount || 1;
  const currentGlobalPage = (activeChapter?.startPageNumber || 1) + (currentChapterPage - 1);

  const isViewingPinnedPage = Boolean(
    pinnedBookmark &&
      pinnedBookmark.chapterIndex === activeChapterIndex &&
      pinnedBookmark.chapterPage === currentChapterPage
  );
  const bookmarkRow = isViewingPinnedPage && pinnedBookmark ? pinnedBookmark.bookmarkRow : 0;
  const bookmarkText =
    isViewingPinnedPage && pinnedBookmark ? pinnedBookmark.bookmarkText : undefined;

  const setBookmarkRow = useCallback(
    (
      row: number,
      nextBookmarkText?: string,
      options?: { isLayoutSync?: boolean }
    ) => {
      const clampedRow = Math.max(0, Math.round(row));
      if (!options?.isLayoutSync) {
        hasUserModifiedSessionRef.current = true;
      }
      if (clampedRow === 0) {
        restoredPositionRef.current = null;
        setPinnedBookmark(null);
      } else if (options?.isLayoutSync) {
        const trimmed = nextBookmarkText?.trim();
        const resolvedText = trimmed && trimmed.length > 0 ? trimmed : undefined;
        if (restoredPositionRef.current) {
          restoredPositionRef.current = {
            ...restoredPositionRef.current,
            bookmarkRow: clampedRow,
            bookmarkText: resolvedText ?? restoredPositionRef.current.bookmarkText,
          };
        }
        setPinnedBookmark((prev) => ({
          chapterIndex: prev?.chapterIndex ?? activeChapterIndex,
          chapterPage: prev?.chapterPage ?? currentChapterPage,
          globalPage: prev?.globalPage ?? currentGlobalPage,
          bookmarkRow: clampedRow,
          bookmarkText: resolvedText ?? prev?.bookmarkText,
          lastReadAt: prev?.lastReadAt ?? restoredPositionRef.current?.lastReadAt,
        }));
      } else if (nextBookmarkText !== undefined) {
        restoredPositionRef.current = null;
        const trimmed = nextBookmarkText.trim();
        const resolvedText = trimmed.length > 0 ? trimmed : undefined;
        setPinnedBookmark({
          chapterIndex: activeChapterIndex,
          chapterPage: currentChapterPage,
          globalPage: currentGlobalPage,
          bookmarkRow: clampedRow,
          bookmarkText: resolvedText,
        });
      } else {
        setPinnedBookmark((prev) => {
          const isSamePageAsPrev =
            Boolean(prev) &&
            prev!.chapterIndex === activeChapterIndex &&
            prev!.chapterPage === currentChapterPage;
          return {
            chapterIndex: activeChapterIndex,
            chapterPage: currentChapterPage,
            globalPage: currentGlobalPage,
            bookmarkRow: clampedRow,
            bookmarkText: isSamePageAsPrev ? prev?.bookmarkText : undefined,
            lastReadAt: isSamePageAsPrev ? prev?.lastReadAt : undefined,
          };
        });
      }
      setResumeNotice((prev) =>
        prev && clampedRow > 0 ? { ...prev, row: clampedRow + 1 } : prev
      );
    },
    [activeChapterIndex, currentChapterPage, currentGlobalPage]
  );

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

    const resolveSavedCoordinate = (pos: {
      chapterIndex: number;
      chapterPage: number;
      globalPage?: number;
      bookmarkRow?: number;
      bookmarkText?: string;
      lastReadAt?: string;
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
        if (findCanonicalTextSpan(candidateSlice, savedText) === null) {
          const foundIdx = targetChap.pages.findIndex(
            (p) => findCanonicalTextSpan(p, savedText) !== null
          );
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

      return {
        clampedChap,
        clampedPage,
        savedGlobalPage,
        savedRow,
        savedText,
        targetChap,
      };
    };

    const restoreToPosition = (
      pos: {
        chapterIndex: number;
        chapterPage: number;
        globalPage?: number;
        bookmarkRow?: number;
        bookmarkText?: string;
        lastReadAt?: string;
      },
      seededPinnedOverride?: PinnedBookmarkCoordinate | null
    ) => {
      const {
        clampedChap,
        clampedPage,
        savedGlobalPage,
        savedRow,
        savedText,
        targetChap,
      } = resolveSavedCoordinate(pos);

      const nextPinned: PinnedBookmarkCoordinate | null =
        seededPinnedOverride !== undefined
          ? seededPinnedOverride
          : savedRow > 0
            ? {
                chapterIndex: clampedChap,
                chapterPage: clampedPage,
                globalPage: savedGlobalPage,
                bookmarkRow: savedRow,
                bookmarkText: savedText,
                lastReadAt: pos.lastReadAt,
              }
            : null;

      isRestoringPositionRef.current = true;
      queueMicrotask(() => {
        isRestoringPositionRef.current = false;
        restoredPositionRef.current = nextPinned
          ? {
              chapterIndex: nextPinned.chapterIndex,
              chapterPage: nextPinned.chapterPage,
              bookmarkRow: nextPinned.bookmarkRow,
              bookmarkText: nextPinned.bookmarkText,
              lastReadAt: nextPinned.lastReadAt,
            }
          : {
              chapterIndex: clampedChap,
              chapterPage: clampedPage,
              bookmarkRow: 0,
              bookmarkText: undefined,
              lastReadAt: pos.lastReadAt,
            };
        setActiveChapterIndex(clampedChap);
        setCurrentChapterPage(clampedPage);
        setPinnedBookmark(nextPinned);
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
      let existingPinned: PinnedBookmarkCoordinate | null = null;
      const existingPos = getReadingPosition(numericId);
      if (
        existingPos &&
        ((existingPos.bookmarkRow ?? 0) > 0 || Boolean(existingPos.bookmarkText))
      ) {
        const resolved = resolveSavedCoordinate(existingPos);
        if (resolved.savedRow > 0) {
          existingPinned = {
            chapterIndex: resolved.clampedChap,
            chapterPage: resolved.clampedPage,
            globalPage: resolved.savedGlobalPage,
            bookmarkRow: resolved.savedRow,
            bookmarkText: resolved.savedText,
            lastReadAt: existingPos.lastReadAt,
          };
        }
      }
      return restoreToPosition(initialPosition, existingPinned);
    }

    // When volume is completed/finished, start fresh from Chapter 0, Page 1 with archival completion notice
    if (readingStatus === 'finished') {
      isRestoringPositionRef.current = true;
      queueMicrotask(() => {
        isRestoringPositionRef.current = false;
        restoredPositionRef.current = null;
        setActiveChapterIndex(0);
        setCurrentChapterPage(1);
        setPinnedBookmark(null);
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
    let cleanupRestoreTimer: (() => void) | undefined;
    if (localPos) {
      cleanupRestoreTimer = applyPosition(localPos);
    }

    const currentUserId = useAuthStore.getState().user?.id;
    if (currentUserId) {
      const localTime = localPos?.lastReadAt ? new Date(localPos.lastReadAt).getTime() : 0;
      useReaderStore
        .getState()
        .restoreReadingPositionFromCloud(numericId, currentUserId)
        .then((remotePos) => {
          if (!remotePos) return;
          const remoteTime = remotePos.lastReadAt ? new Date(remotePos.lastReadAt).getTime() : 0;
          const isRemoteNewer = !localPos || remoteTime > localTime;
          const hasRemoteBookmarkEnrichment =
            Boolean(localPos) &&
            remoteTime >= localTime &&
            !localPos?.bookmarkText &&
            Boolean(remotePos.bookmarkText);
          if (isRemoteNewer || hasRemoteBookmarkEnrichment) {
            cleanupRestoreTimer?.();
            cleanupRestoreTimer = applyPosition(remotePos);
          }
        });
    }

    return () => {
      cleanupRestoreTimer?.();
    };
  }, [isMounted, numericId, chaptersWithPagination, getReadingPosition, readingStatus, initialPosition]);

  // Adopt newer cross-device position when syncWithCloud updates the store prior to user navigation
  useEffect(() => {
    if (
      !hasRestoredPositionRef.current ||
      isRestoringPositionRef.current ||
      hasUserModifiedSessionRef.current ||
      !storedPosition ||
      readingStatus === 'finished' ||
      initialPosition ||
      chaptersWithPagination.length === 0
    ) {
      return;
    }
    const currentRestored = restoredPositionRef.current;
    const hasMeaningfulStoredPosition =
      storedPosition.chapterIndex > 0 ||
      storedPosition.chapterPage > 1 ||
      (storedPosition.bookmarkRow ?? 0) > 0 ||
      Boolean(storedPosition.bookmarkText);
    if (!currentRestored && !hasMeaningfulStoredPosition) return;

    const incomingTime = storedPosition.lastReadAt
      ? new Date(storedPosition.lastReadAt).getTime()
      : 0;
    const currentTime = currentRestored?.lastReadAt
      ? new Date(currentRestored.lastReadAt).getTime()
      : pinnedBookmark?.lastReadAt
        ? new Date(pinnedBookmark.lastReadAt).getTime()
        : 0;
    const isIncomingNewer = !currentRestored ? hasMeaningfulStoredPosition : incomingTime > currentTime;
    const isBookmarkTextEnriched =
      Boolean(currentRestored) &&
      incomingTime >= currentTime &&
      !currentRestored?.bookmarkText &&
      Boolean(storedPosition.bookmarkText);

    if (isIncomingNewer || isBookmarkTextEnriched) {
      const clampedChap = Math.min(
        Math.max(0, storedPosition.chapterIndex),
        chaptersWithPagination.length - 1
      );
      const targetChap = chaptersWithPagination[clampedChap];
      const savedText = storedPosition.bookmarkText?.trim() || undefined;
      let clampedPage = Math.min(Math.max(1, storedPosition.chapterPage), targetChap.pageCount);
      if (savedText && Array.isArray(targetChap.pages) && targetChap.pages.length > 0) {
        const candidateSlice = targetChap.pages[clampedPage - 1] || '';
        if (findCanonicalTextSpan(candidateSlice, savedText) === null) {
          const foundIdx = targetChap.pages.findIndex(
            (p) => findCanonicalTextSpan(p, savedText) !== null
          );
          if (foundIdx !== -1) {
            clampedPage = foundIdx + 1;
          }
        }
      }
      const savedRow = Math.max(0, storedPosition.bookmarkRow ?? (savedText ? 1 : 0));
      const savedGlobalPage =
        clampedPage !== storedPosition.chapterPage
          ? targetChap.startPageNumber + (clampedPage - 1)
          : storedPosition.globalPage || targetChap.startPageNumber + (clampedPage - 1);

      restoredPositionRef.current = {
        chapterIndex: clampedChap,
        chapterPage: clampedPage,
        bookmarkRow: savedRow,
        bookmarkText: savedRow > 0 ? savedText : undefined,
        lastReadAt: storedPosition.lastReadAt,
      };
      queueMicrotask(() => {
        setActiveChapterIndex(clampedChap);
        setCurrentChapterPage(clampedPage);
        setPinnedBookmark(
          savedRow > 0
            ? {
                chapterIndex: clampedChap,
                chapterPage: clampedPage,
                globalPage: savedGlobalPage,
                bookmarkRow: savedRow,
                bookmarkText: savedText,
                lastReadAt: storedPosition.lastReadAt,
              }
            : null
        );
        setResumeNotice({
          chapterTitle:
            targetChap.displayTitle ||
            targetChap.title ||
            (clampedChap > 0 ? `Chapter ${clampedChap}` : 'Start'),
          page: savedGlobalPage,
          ...(savedRow > 0 ? { row: savedRow + 1 } : {}),
        });
      });
    }
  }, [storedPosition, readingStatus, initialPosition, chaptersWithPagination, pinnedBookmark?.lastReadAt]);

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
      !pinnedBookmark ||
      pinnedBookmark.bookmarkRow <= 0 ||
      !pinnedBookmark.bookmarkText ||
      pinnedBookmark.chapterIndex !== activeChapterIndex ||
      !activeChapter?.content
    ) {
      return;
    }
    const pages =
      activeChapter.pages ||
      paginateChapterContent(activeChapter.content, getCharsPerPage(fontSize));
    const targetText = pinnedBookmark.bookmarkText;
    const candidateSlice = pages[pinnedBookmark.chapterPage - 1] || '';
    if (findCanonicalTextSpan(candidateSlice, targetText) === null) {
      const matchingPageIdx = pages.findIndex(
        (p) => findCanonicalTextSpan(p, targetText) !== null
      );
      if (matchingPageIdx !== -1) {
        const resolvedPage = matchingPageIdx + 1;
        const resolvedGlobal = (activeChapter.startPageNumber || 1) + matchingPageIdx;
        const wasOnPinnedPage = currentChapterPage === pinnedBookmark.chapterPage;
        if (!hasUserModifiedSessionRef.current && restoredPositionRef.current) {
          restoredPositionRef.current = {
            ...restoredPositionRef.current,
            chapterPage: resolvedPage,
          };
        }
        queueMicrotask(() => {
          setPinnedBookmark((prev) =>
            prev
              ? { ...prev, chapterPage: resolvedPage, globalPage: resolvedGlobal }
              : null
          );
          if (wasOnPinnedPage && resolvedPage !== currentChapterPage) {
            setCurrentChapterPage(resolvedPage);
          }
        });
      }
    }
  }, [readingMode, pinnedBookmark, activeChapterIndex, activeChapter, fontSize, currentChapterPage]);

  // Global Page & Progress Calculations
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

  // Sync Progress & Exact Position to Store (Gated by Page-3+ or Bookmark Engagement)
  useEffect(() => {
    if (numericId > 0 && totalVolumePages > 0) {
      const isEngagedReading =
        currentGlobalPage >= 3 ||
        currentChapterPage >= 3 ||
        activeChapterIndex > 0 ||
        Boolean(pinnedBookmark) ||
        readingStatus === 'finished' ||
        Boolean(getReadingPosition(numericId));

      if (isEngagedReading) {
        if (readingStatus !== 'finished') {
          if (!pinnedBookmark || currentGlobalPage >= pinnedBookmark.globalPage) {
            setProgress(numericId, volumeProgress);
          }
        }
        if (hasRestoredPositionRef.current && !isRestoringPositionRef.current) {
          const currentUserId = useAuthStore.getState().user?.id;
          const existingStored = getReadingPosition(numericId);

          if (pinnedBookmark) {
            const restored = restoredPositionRef.current;
            const isSameAsRestored =
              Boolean(restored) &&
              restored!.chapterIndex === pinnedBookmark.chapterIndex &&
              restored!.chapterPage === pinnedBookmark.chapterPage &&
              restored!.bookmarkText === pinnedBookmark.bookmarkText;

            if (isSameAsRestored) {
              if (restored!.bookmarkRow === pinnedBookmark.bookmarkRow) {
                if (
                  existingStored &&
                  existingStored.chapterIndex === pinnedBookmark.chapterIndex &&
                  existingStored.chapterPage === pinnedBookmark.chapterPage &&
                  (existingStored.bookmarkRow ?? 0) === pinnedBookmark.bookmarkRow &&
                  existingStored.bookmarkText === pinnedBookmark.bookmarkText
                ) {
                  return;
                }
                if (
                  !hasUserModifiedSessionRef.current &&
                  existingStored &&
                  existingStored.chapterIndex === pinnedBookmark.chapterIndex &&
                  existingStored.chapterPage === pinnedBookmark.chapterPage &&
                  existingStored.bookmarkText === pinnedBookmark.bookmarkText
                ) {
                  return;
                }
              } else {
                restored!.bookmarkRow = pinnedBookmark.bookmarkRow;
                if (
                  !hasUserModifiedSessionRef.current &&
                  existingStored &&
                  existingStored.chapterIndex === pinnedBookmark.chapterIndex &&
                  existingStored.chapterPage === pinnedBookmark.chapterPage &&
                  existingStored.bookmarkText === pinnedBookmark.bookmarkText
                ) {
                  return;
                }
              }
            } else {
              restoredPositionRef.current = null;
            }

            if (
              existingStored &&
              existingStored.chapterIndex === pinnedBookmark.chapterIndex &&
              existingStored.chapterPage === pinnedBookmark.chapterPage &&
              (existingStored.bookmarkRow ?? 0) === pinnedBookmark.bookmarkRow &&
              existingStored.bookmarkText === pinnedBookmark.bookmarkText
            ) {
              return;
            }

            saveReadingPosition(
              numericId,
              {
                chapterIndex: pinnedBookmark.chapterIndex,
                chapterPage: pinnedBookmark.chapterPage,
                globalPage: pinnedBookmark.globalPage,
                bookmarkRow: pinnedBookmark.bookmarkRow,
                ...(pinnedBookmark.bookmarkText
                  ? { bookmarkText: pinnedBookmark.bookmarkText }
                  : {}),
                lastReadAt:
                  isSameAsRestored && restored?.lastReadAt
                    ? restored.lastReadAt
                    : new Date().toISOString(),
              },
              currentUserId
            );
            return;
          }

          const restored = restoredPositionRef.current;
          const isSamePageAsRestored =
            Boolean(restored) &&
            restored!.chapterIndex === activeChapterIndex &&
            restored!.chapterPage === currentChapterPage &&
            restored!.bookmarkRow === 0;

          if (
            isSamePageAsRestored &&
            existingStored &&
            existingStored.chapterIndex === activeChapterIndex &&
            existingStored.chapterPage === currentChapterPage &&
            !existingStored.bookmarkRow &&
            !existingStored.bookmarkText
          ) {
            return;
          }
          if (!isSamePageAsRestored) {
            restoredPositionRef.current = null;
          }

          saveReadingPosition(
            numericId,
            {
              chapterIndex: activeChapterIndex,
              chapterPage: currentChapterPage,
              globalPage: currentGlobalPage,
              lastReadAt:
                isSamePageAsRestored && restored?.lastReadAt
                  ? restored.lastReadAt
                  : new Date().toISOString(),
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
    pinnedBookmark,
    setProgress,
    saveReadingPosition,
    getReadingPosition,
  ]);

  // Navigation Handlers
  const handlePrevPage = useCallback(() => {
    hasUserModifiedSessionRef.current = true;
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
    hasUserModifiedSessionRef.current = true;
    if (currentChapterPage < activeChapterPageCount) {
      setCurrentChapterPage((p) => p + 1);
    } else if (activeChapterIndex < chaptersWithPagination.length - 1) {
      setActiveChapterIndex((idx) => idx + 1);
      setCurrentChapterPage(1);
    }
  }, [currentChapterPage, activeChapterPageCount, activeChapterIndex, chaptersWithPagination.length]);

  const handleSelectChapter = useCallback((index: number) => {
    hasUserModifiedSessionRef.current = true;
    setActiveChapterIndex(index);
    setCurrentChapterPage(1);
  }, []);

  const handleRestart = useCallback(() => {
    hasUserModifiedSessionRef.current = true;
    setActiveChapterIndex(0);
    setCurrentChapterPage(1);
    setPinnedBookmark(null);
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
    hasUserModifiedSessionRef.current = true;
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

  const jumpTo = useCallback((chapterIndex: number, page: number) => {
    setActiveChapterIndex(chapterIndex);
    setCurrentChapterPage(page);
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
