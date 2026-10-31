'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type { GutendexBook, GutendexResponse, ReadingStatus } from '@/types/book.types';
import {
  type ResolvedBookIdentity,
  isPlaceholderTitle,
  hasAuthorLifespans,
} from '@/lib/book-metadata';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import type { SymposiumSessionRow } from '@/types/database.types';
import { useReadingTimer } from '@/hooks/useReadingTimer';
import { SITE_CONFIG } from '@/config/site-config';

export interface UseReaderHabitTelemetryParams {
  numericId: number;
  userId?: string;
  isContentLoading: boolean;
  isContentError: boolean;
  contentText?: string;
  isPlayingTTS: boolean;
  isAtEnd: boolean;
  readingStatus?: ReadingStatus | null;
  setReadingStatus: (bookId: number, status: ReadingStatus, userId?: string) => void;
  symposiums: SymposiumSessionRow[];
  activeChapterIndex: number;
  volumeProgress: number;
  syncSymposiumProgress: (
    bookId: number,
    chapterIndex: number,
    progress: number
  ) => void | Promise<void>;
  booksData?: GutendexResponse;
  resolvedIdentity: ResolvedBookIdentity;
  refetch: () => unknown;
  updateBookMetadata: (bookId: number, bookTitle: string, bookAuthor: string) => void;
}

export function useReaderHabitTelemetry({
  numericId,
  userId,
  isContentLoading,
  isContentError,
  contentText,
  isPlayingTTS,
  isAtEnd,
  readingStatus,
  setReadingStatus,
  symposiums,
  activeChapterIndex,
  volumeProgress,
  syncSymposiumProgress,
  booksData,
  resolvedIdentity,
  refetch,
  updateBookMetadata,
}: UseReaderHabitTelemetryParams) {
  // Auto-heal missing or placeholder metadata on any stored annotations for this volume
  useEffect(() => {
    if (numericId > 0 && resolvedIdentity.title && !isPlaceholderTitle(resolvedIdentity.title)) {
      updateBookMetadata(numericId, resolvedIdentity.title, resolvedIdentity.author);
    }
  }, [numericId, resolvedIdentity.title, resolvedIdentity.author, updateBookMetadata]);

  // Synchronize document.title with authentic resolved book identity for client transitions
  useEffect(() => {
    if (resolvedIdentity.title && !isPlaceholderTitle(resolvedIdentity.title)) {
      const authorSuffix = resolvedIdentity.displayAuthor
        ? ` by ${resolvedIdentity.displayAuthor}`
        : '';
      document.title = `${resolvedIdentity.title}${authorSuffix} | ${SITE_CONFIG.NAME}`;
    }
  }, [resolvedIdentity.title, resolvedIdentity.displayAuthor]);

  // Persist authentic resolved book identity into recentBooks and warm reader store
  const autoRetriedBookIdRef = useRef<number | null>(null);
  const initializedBookIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (numericId <= 0) return;

    const existingRecent = useBookshelfStore.getState().recentBooks.find((b) => b.id === numericId);
    const existingRecentHasLifespans = hasAuthorLifespans(existingRecent?.authors);
    const resolvedHasLifespans = hasAuthorLifespans(resolvedIdentity.authors);

    if (booksData?.results?.[0]) {
      const apiBook = booksData.results[0];
      const apiBookHasLifespans = hasAuthorLifespans(apiBook.authors);
      const needsEnrichment =
        initializedBookIdRef.current !== numericId ||
        (!existingRecentHasLifespans && apiBookHasLifespans);

      if (needsEnrichment) {
        initializedBookIdRef.current = numericId;
        useBookshelfStore.getState().addRecentBook(apiBook);
        useReaderStore.getState().openReader(apiBook);
        useBookshelfStore.getState().enrichSavedBooks([apiBook]);
        useReaderStore.getState().enrichReadingPositions([apiBook]);
      }
      if (isContentError && autoRetriedBookIdRef.current !== numericId && apiBookHasLifespans) {
        autoRetriedBookIdRef.current = numericId;
        void refetch();
      }
    } else if (
      resolvedIdentity.title &&
      !isPlaceholderTitle(resolvedIdentity.title) &&
      (!existingRecent || isPlaceholderTitle(existingRecent.title)) &&
      (initializedBookIdRef.current !== numericId ||
        (resolvedHasLifespans && !existingRecentHasLifespans))
    ) {
      initializedBookIdRef.current = numericId;
      const bookObj: GutendexBook = {
        id: numericId,
        title: resolvedIdentity.title,
        authors: resolvedIdentity.authors?.length
          ? resolvedIdentity.authors
          : resolvedIdentity.author
          ? [{ name: resolvedIdentity.author, birth_year: null, death_year: null }]
          : [],
        translators: resolvedIdentity.translators || [],
        subjects: resolvedIdentity.primarySubject ? [resolvedIdentity.primarySubject] : [],
        bookshelves: [],
        languages: resolvedIdentity.languages || ['en'],
        copyright: false,
        media_type: 'Text',
        formats: {
          'image/jpeg': `https://www.gutenberg.org/cache/epub/${numericId}/pg${numericId}.cover.medium.jpg`,
          'application/epub+zip': `https://www.gutenberg.org/ebooks/${numericId}.epub3.images`,
        },
        download_count: 0,
      };
      useBookshelfStore.getState().addRecentBook(bookObj);
      useReaderStore.getState().openReader(bookObj);
      if (resolvedHasLifespans) {
        useBookshelfStore.getState().enrichSavedBooks([bookObj]);
        useReaderStore.getState().enrichReadingPositions([bookObj]);
      }
    }
  }, [numericId, booksData, resolvedIdentity, isContentError, refetch]);

  // Active Symposium & Companion Progress Derivation
  const activeSymposium = useMemo(
    () =>
      symposiums.find(
        (s) => s.book_id === numericId && (s.status === 'active' || s.status === 'completed')
      ) || null,
    [symposiums, numericId]
  );

  const symposiumCompanion = useMemo(() => {
    if (!activeSymposium) return null;
    const isHost = userId ? activeSymposium.host_id === userId : true;
    const username = isHost
      ? activeSymposium.fellow_username || 'fellow'
      : activeSymposium.host_username || 'fellow';
    const displayName = isHost
      ? activeSymposium.fellow_display_name || username
      : activeSymposium.host_display_name || username;
    const progress = isHost
      ? activeSymposium.fellow_progress
      : activeSymposium.host_progress;
    const currentChapterIndex = isHost
      ? activeSymposium.fellow_chapter
      : activeSymposium.host_chapter;
    return { username, displayName, progress, currentChapterIndex };
  }, [activeSymposium, userId]);

  const [isMilestoneDismissed, setIsMilestoneDismissed] = useState(false);
  const symposiumMilestoneNotice = useMemo(() => {
    if (!symposiumCompanion || isMilestoneDismissed) return null;
    if (symposiumCompanion.progress >= 25) {
      return {
        username: symposiumCompanion.username,
        displayName: symposiumCompanion.displayName,
        chapterIndex: symposiumCompanion.currentChapterIndex,
        progress: symposiumCompanion.progress,
      };
    }
    return null;
  }, [symposiumCompanion, isMilestoneDismissed]);

  // Synchronize reading progress with active Literary Symposium session
  useEffect(() => {
    if (activeSymposium && activeSymposium.status === 'active' && numericId > 0) {
      void syncSymposiumProgress(numericId, activeChapterIndex, volumeProgress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- narrowed to scalar fields to avoid infinite cycles
  }, [
    activeSymposium?.id,
    activeSymposium?.status,
    numericId,
    volumeProgress,
    activeChapterIndex,
    syncSymposiumProgress,
  ]);

  const [isCompletionDismissed, setIsCompletionDismissed] = useState(false);
  const isCompletionModalOpen = isAtEnd && !isCompletionDismissed;

  // Auto-transition to 'currently_reading' when reader begins a book
  useEffect(() => {
    if (numericId > 0 && !isContentLoading && contentText) {
      if (!readingStatus || readingStatus === 'want_to_read') {
        setReadingStatus(numericId, 'currently_reading', userId);
      }
    }
  }, [numericId, isContentLoading, contentText, readingStatus, setReadingStatus, userId]);

  // Auto-update reading status to 'finished' when reaching the final page
  useEffect(() => {
    if (isAtEnd && readingStatus !== 'finished' && numericId > 0) {
      setReadingStatus(numericId, 'finished', userId);
    }
  }, [isAtEnd, readingStatus, numericId, userId, setReadingStatus]);

  // Idle-aware authentic reading & listening telemetry (Milestone 3 Habits & Streaks)
  useReadingTimer({
    bookId: numericId > 0 ? numericId : undefined,
    enabled: !isContentLoading && !isContentError && !!contentText,
    userId,
    isPlayingTTS,
  });

  return {
    activeSymposium,
    symposiumCompanion,
    symposiumMilestoneNotice,
    dismissSymposiumMilestone: () => setIsMilestoneDismissed(true),
    isCompletionModalOpen,
    dismissCompletionModal: () => setIsCompletionDismissed(true),
  };
}
