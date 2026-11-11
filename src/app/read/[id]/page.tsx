'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useBookContent } from '@/hooks/queries/useBookContent';
import { useBooks } from '@/hooks/queries/useBooks';
import { useBookTranslations } from '@/hooks/queries/useBookTranslations';
import { useReaderStore, useHydratedReader } from '@/stores/useReaderStore';
import { useThemeStore } from '@/stores/useThemeStore';
import {
  extractGutenbergHeaderMetadata,
} from '@/lib/gutenberg-parser';
import { useGutenbergParserWorker } from '@/hooks/reader/useGutenbergParserWorker';
import { getReaderTheme } from '@/config/reader-themes';
import {
  resolveBookMetadata,
  hasAuthorLifespans,
  isPlaceholderTitle,
} from '@/lib/book-metadata';
import {
  findCanonicalTextSpan,
  pairOverlappingAnnotations,
} from '@/lib/reader-annotator';
import { ReaderHeader } from '@/components/reader/ReaderHeader';
import { ReaderFooter } from '@/components/reader/ReaderFooter';
import { ReaderTocDrawer } from '@/components/reader/ReaderTocDrawer';
import { ReaderSearchDrawer } from '@/components/reader/ReaderSearchDrawer';
import { ReaderControls } from '@/components/reader/ReaderControls';
import { ReaderLanguageDrawer } from '@/components/reader/ReaderLanguageDrawer';
import { ReaderSpeechBar } from '@/components/reader/ReaderSpeechBar';
import { ReaderSurface } from '@/components/reader/ReaderSurface';
import { ReaderLoadingView } from '@/components/reader/ReaderLoadingView';
import { TextHighlightPopover } from '@/components/reader/TextHighlightPopover';
import { ReaderAnnotationsDrawer } from '@/components/reader/ReaderAnnotationsDrawer';
import { DeleteAnnotationModal } from '@/components/reader/DeleteAnnotationModal';
import { VolumeCompletionModal } from '@/components/reader/VolumeCompletionModal';
import { ReaderExitBookmarkModal } from '@/components/reader/ReaderExitBookmarkModal';
import { useReaderDrawers } from '@/hooks/reader/useReaderDrawers';
import { useReaderSpeech } from '@/hooks/reader/useReaderSpeech';
import { useReaderSession } from '@/hooks/reader/useReaderSession';
import { useReaderHabitTelemetry } from '@/hooks/reader/useReaderHabitTelemetry';
import { useReaderAnnotationActions } from '@/hooks/reader/useReaderAnnotationActions';
import { useReaderExitBookmark } from '@/hooks/reader/useReaderExitBookmark';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useShallow } from 'zustand/react/shallow';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import {
  getFactoryPreferences,
  areReaderAppearancePreferencesEqual,
  resetReaderAppearanceToDefaults,
  schedulePreferencesCloudSync,
} from '@/lib/preferences-sync';
import { useHydratedAnnotations } from '@/stores/useAnnotationStore';
import { useHydratedFellowship } from '@/stores/useFellowshipStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBookshelfStore, useBookRating, useReadingStatus } from '@/stores/useBookshelfStore';
import { ROUTES } from '@/config/routes';

function BookReaderContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawId = params?.id;
  const paramBookId = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';
  const pathnameBookId =
    typeof window !== 'undefined'
      ? window.location.pathname.split('?')[0].match(/^\/read\/(\d+)(?:\/|$)/)?.[1] || ''
      : '';
  const bookId = pathnameBookId || paramBookId;
  const numericId = parseInt(bookId, 10) || 0;

  const urlChapter = searchParams.get('chapter');
  const urlPage = searchParams.get('page');
  const urlAnnotationId = searchParams.get('annotationId');
  const [activeAnnotationTargetId, setActiveAnnotationTargetId] = useState<string | null>(null);
  const targetAnnotationId = activeAnnotationTargetId || urlAnnotationId;

  // Hydrated Global Reader Store (Guarded with useHasMounted for zero SSR hydration mismatch)
  const {
    hasMounted,
    currentBook,
    fontSize,
    lineHeight,
    fontFamily,
    theme,
    brightness,
    readingMode,
    columnWidth,
    setFontSize,
    setLineHeight,
    setFontFamily,
    setTheme,
    setBrightness,
    setReadingMode,
    setColumnWidth,
  } = useHydratedReader();

  // Persistent User Preferences
  const {
    speechRate,
    setSpeechRate,
    speechVoiceURI,
    setSpeechVoiceURI,
    speechAutoPageAdvance,
    speechHighlightEnabled,
    customDefaults,
    exitBookmarkReminderEnabled,
    setExitBookmarkReminderEnabled,
  } = usePreferencesStore(
    useShallow((s) => ({
      speechRate: s.speechRate,
      setSpeechRate: s.setSpeechRate,
      speechVoiceURI: s.speechVoiceURI,
      setSpeechVoiceURI: s.setSpeechVoiceURI,
      speechAutoPageAdvance: s.speechAutoPageAdvance,
      speechHighlightEnabled: s.speechHighlightEnabled,
      customDefaults: s.customDefaults,
      exitBookmarkReminderEnabled: s.exitBookmarkReminderEnabled,
      setExitBookmarkReminderEnabled: s.setExitBookmarkReminderEnabled,
    }))
  );

  // Local Reader State
  const {
    activeDrawer,
    isTocOpen,
    isSearchOpen,
    isControlsOpen,
    isTranslationsOpen,
    isAnnotationsOpen,
    toggleDrawer,
    closeDrawer,
  } = useReaderDrawers();

  const currentReaderAppearance = useMemo(
    () => ({
      theme,
      fontFamily,
      fontSize,
      lineHeight,
      brightness,
      readingMode,
      columnWidth,
    }),
    [theme, fontFamily, fontSize, lineHeight, brightness, readingMode, columnWidth]
  );

  const isAtReaderFactoryDefaults = useMemo(
    () =>
      areReaderAppearancePreferencesEqual(currentReaderAppearance, getFactoryPreferences()),
    [currentReaderAppearance]
  );

  const isAtReaderCustomDefaults = useMemo(
    () =>
      Boolean(customDefaults) &&
      areReaderAppearancePreferencesEqual(currentReaderAppearance, customDefaults),
    [currentReaderAppearance, customDefaults]
  );

  // Annotations & Highlights Management
  const {
    annotations,
    fellowAnnotations,
    spoilerShieldEnabled,
    setSpoilerShieldEnabled,
    addAnnotation,
    updateAnnotationColor,
    updateAnnotationNote,
    deleteAnnotation,
    syncWithCloud,
    fetchFellowAnnotationsForBook,
    enrichFellowAnnotations,
    updateBookMetadata,
  } = useHydratedAnnotations();
  const {
    circles,
    symposiums,
    fetchFellowshipData,
    syncSymposiumProgress,
  } = useHydratedFellowship();
  const user = useAuthStore((s) => s.user);
  const { isOffline } = useNetworkStatus();

  // Sync annotations and fellowship symposium state on load if authenticated and online
  useEffect(() => {
    if (user?.id && !isOffline) {
      syncWithCloud(user.id);
      void useReaderStore.getState().syncWithCloud(user.id);
      const syncFellowshipAndMarginalia = async () => {
        await fetchFellowshipData(user.id);
        if (numericId > 0) {
          await fetchFellowAnnotationsForBook(numericId, user.id);
        }
        enrichFellowAnnotations();
      };
      void syncFellowshipAndMarginalia();
    }
  }, [
    user?.id,
    isOffline,
    numericId,
    syncWithCloud,
    fetchFellowshipData,
    fetchFellowAnnotationsForBook,
    enrichFellowAnnotations,
  ]);

  // Self-heal any cached 'fellow_scholar' marginalia when fellowship records hydrate or update
  useEffect(() => {
    if (fellowAnnotations.length > 0 && (symposiums.length > 0 || circles.length > 0)) {
      enrichFellowAnnotations();
    }
  }, [fellowAnnotations.length, symposiums, circles, enrichFellowAnnotations]);

  // Re-fetch latest own annotations & fellow annotations when opening annotations drawer
  useEffect(() => {
    if (isAnnotationsOpen && user?.id && !isOffline) {
      void syncWithCloud(user.id);
      if (numericId > 0) {
        void fetchFellowAnnotationsForBook(numericId, user.id);
      }
    }
  }, [isAnnotationsOpen, user?.id, numericId, isOffline, syncWithCloud, fetchFellowAnnotationsForBook]);

  const [isImmersiveBarsHidden, setIsImmersiveBarsHidden] = useState(false);

  const bookAnnotations = useMemo(() => {
    return annotations.filter((a) => a.bookId === numericId);
  }, [numericId, annotations]);

  const bookFellowAnnotations = useMemo(() => {
    return fellowAnnotations.filter((a) => a.bookId === numericId);
  }, [numericId, fellowAnnotations]);

  // Synchronize global application theme with reader theme on mount
  useEffect(() => {
    if (hasMounted) {
      const globalTheme = useThemeStore.getState().theme;
      const currentReaderTheme = useReaderStore.getState().theme;
      if (globalTheme && globalTheme !== currentReaderTheme) {
        useReaderStore.getState().setTheme(globalTheme);
      }
    }
  }, [hasMounted]);

  // Queries
  const { data: contentText, isLoading: isContentLoading, isError: isContentError, error: contentError, refetch } = useBookContent(undefined, numericId);
  const hasCompleteCurrentBook = Boolean(
    currentBook &&
      currentBook.id === numericId &&
      !isPlaceholderTitle(currentBook.title) &&
      hasAuthorLifespans(currentBook.authors)
  );
  const { data: booksData } = useBooks(
    {
      ids: numericId > 0 ? String(numericId) : '',
      page: 1,
      copyright: false,
      includeRestrictedMetadata: true,
    },
    { enabled: !isOffline && numericId > 0 && !hasCompleteCurrentBook }
  );

  // Multi-tier metadata resolution: Client Store -> Fixture -> API Result -> Raw Gutenberg Header Extraction
  const extractedMeta = useMemo(() => {
    return extractGutenbergHeaderMetadata(contentText);
  }, [contentText]);

  const resolvedIdentity = useMemo(() => {
    return resolveBookMetadata({
      id: numericId,
      currentBook,
      booksData,
      extractedMeta,
    });
  }, [numericId, currentBook, booksData, extractedMeta]);

  const bookTitle = resolvedIdentity.title;
  const bookAuthor = resolvedIdentity.author;

  // Language & International Translations
  const { translations, isLoading: isTranslationsLoading } = useBookTranslations(
    bookTitle,
    bookAuthor,
    numericId,
    resolvedIdentity.languages,
    !isOffline
  );

  // Parse Chapters and Volume Spread via Web Worker
  const { chaptersWithPagination, totalVolumePages } = useGutenbergParserWorker(
    contentText,
    fontSize
  );

  // Personal Curation: Reading Status & Ratings
  const readingStatus = useReadingStatus(numericId);
  const bookRating = useBookRating(numericId);
  const setReadingStatus = useBookshelfStore((s) => s.setReadingStatus);
  const setBookRating = useBookshelfStore((s) => s.setBookRating);

  const resolveReflowedAnnotationPage = useCallback(
    (chapterIndex: number, fallbackPage: number, selectedText: string): number => {
      const chapter = chaptersWithPagination[chapterIndex];
      const foundIdx =
        chapter?.pages?.findIndex(
          (p) => findCanonicalTextSpan(p, selectedText, { allowBoundaryPartial: true }) !== null
        ) ?? -1;
      return foundIdx !== -1 ? foundIdx + 1 : fallbackPage;
    },
    [chaptersWithPagination]
  );

  // Resolve dynamic initial position from URL params or targeted annotation (with font reflow healing)
  const initialPosition = useMemo(() => {
    if (urlAnnotationId) {
      const ann = annotations.find((a) => a.id === urlAnnotationId);
      if (ann) {
        return {
          chapterIndex: ann.chapterIndex,
          chapterPage: resolveReflowedAnnotationPage(
            ann.chapterIndex,
            ann.chapterPage,
            ann.selectedText
          ),
        };
      }
    }
    if (urlChapter !== null) {
      const parsedChap = parseInt(urlChapter, 10);
      const parsedPage = urlPage !== null ? parseInt(urlPage, 10) : 1;
      if (!isNaN(parsedChap)) {
        return {
          chapterIndex: Math.max(0, parsedChap),
          chapterPage: Math.max(1, isNaN(parsedPage) ? 1 : parsedPage),
        };
      }
    }
    return null;
  }, [urlAnnotationId, urlChapter, urlPage, annotations, resolveReflowedAnnotationPage]);

  const {
    activeChapterIndex,
    currentChapterPage,
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
  } = useReaderSession({
    numericId,
    hasMounted,
    chaptersWithPagination,
    totalVolumePages,
    fontSize,
    readingMode,
    readingStatus,
    initialPosition,
  });

  // Handle URL annotation navigation once chapters are populated
  useEffect(() => {
    if (!urlAnnotationId || chaptersWithPagination.length === 0) return;
    const ann = annotations.find((a) => a.id === urlAnnotationId);
    if (!ann) return;

    const targetPage = resolveReflowedAnnotationPage(
      ann.chapterIndex,
      ann.chapterPage,
      ann.selectedText
    );
    jumpTo(ann.chapterIndex, targetPage);
  }, [urlAnnotationId, chaptersWithPagination.length, annotations, resolveReflowedAnnotationPage, jumpTo]);

  const activeChapterAnnotations = useMemo(() => {
    return bookAnnotations.filter((a) => a.chapterIndex === activeChapterIndex);
  }, [bookAnnotations, activeChapterIndex]);

  const activeChapterFellowAnnotations = useMemo(() => {
    return bookFellowAnnotations.filter(
      (a) =>
        a.chapterIndex === activeChapterIndex &&
        (!spoilerShieldEnabled || a.chapterPage <= currentChapterPage)
    );
  }, [bookFellowAnnotations, activeChapterIndex, spoilerShieldEnabled, currentChapterPage]);

  const totalUnifiedAnnotationsCount = useMemo(() => {
    return pairOverlappingAnnotations(bookAnnotations, bookFellowAnnotations).length;
  }, [bookAnnotations, bookFellowAnnotations]);

  const {
    annotationToDelete,
    setAnnotationToDelete,
    selectionPopover,
    dismissSelectionPopover,
    handleTextSelected,
    handleSelectAnnotation,
    saveNewBookAnnotation,
    handleSelectColor,
    handleSaveNote,
    handleDeleteAnnotation,
  } = useReaderAnnotationActions({
    numericId,
    bookTitle: resolvedIdentity.title,
    bookAuthor: resolvedIdentity.author,
    userId: user?.id,
    activeChapterIndex,
    currentChapterPage,
    activeChapterAnnotations,
    activeChapterFellowAnnotations,
    addAnnotation,
    updateAnnotationColor,
    updateAnnotationNote,
  });

  // Dismiss floating text selection popover whenever a reader drawer is toggled
  const handleToggleDrawer = useCallback(
    (drawer: Parameters<typeof toggleDrawer>[0]) => {
      setIsImmersiveBarsHidden(false);
      dismissSelectionPopover();
      toggleDrawer(drawer);
    },
    [toggleDrawer, dismissSelectionPopover]
  );

  const handleTapReaderSurface = useCallback(() => {
    if (activeDrawer || selectionPopover.isOpen) return;
    setIsImmersiveBarsHidden((prev) => !prev);
  }, [activeDrawer, selectionPopover.isOpen]);

  // Keyboard shortcut: Ctrl+F / Cmd+F or '/' to toggle search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement;

      if ((e.key === 'f' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !isInput)) {
        e.preventDefault();
        handleToggleDrawer('search');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleDrawer]);

  const handleSelectSearchMatch = useCallback((chapterIndex: number, page: number) => {
    jumpTo(chapterIndex, page);
    closeDrawer();
  }, [closeDrawer, jumpTo]);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        handleNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevPage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevPage, handleNextPage]);

  const isPrevDisabled = activeChapterIndex === 0 && currentChapterPage === 1;
  const isNextDisabled =
    chaptersWithPagination.length > 0 &&
    activeChapterIndex === chaptersWithPagination.length - 1 &&
    currentChapterPage === activeChapterPageCount;

  const isAtEnd = isNextDisabled && chaptersWithPagination.length > 0;

  const activeTheme = getReaderTheme(theme);

  const [isSpeechOpen, setIsSpeechOpen] = useState(false);
  const areBarsHidden =
    isImmersiveBarsHidden && !activeDrawer && !isSpeechOpen && !selectionPopover.isOpen;

  // Active reading content
  const rawPageText = readingMode === 'paginated' ? currentPageText : (activeChapter?.content || '');

  const textToRead = rawPageText;
  const speechLanguage = resolvedIdentity.languages?.[0] || 'en';

  const speech = useReaderSpeech({
    text: textToRead,
    bookTitle,
    bookAuthor,
    language: speechLanguage,
    currentPage: currentChapterPage,
    totalPages: activeChapterPageCount,
    defaultRate: speechRate,
    preferredVoiceURI: speechVoiceURI,
    onRateChange: setSpeechRate,
    onVoiceChange: setSpeechVoiceURI,
    onPageComplete: () => {
      if (speechAutoPageAdvance && readingMode === 'paginated' && !isNextDisabled) {
        handleNextPage();
      }
    },
    onNextPage: handleNextPage,
    onPreviousPage: handlePrevPage,
  });

  const {
    activeSymposium,
    symposiumCompanion,
    symposiumMilestoneNotice,
    dismissSymposiumMilestone,
    isCompletionModalOpen,
    dismissCompletionModal,
  } = useReaderHabitTelemetry({
    numericId,
    userId: user?.id,
    isContentLoading,
    isContentError,
    contentText,
    isPlayingTTS: speech.isPlaying,
    isAtEnd,
    readingStatus,
    setReadingStatus,
    symposiums,
    activeChapterIndex,
    currentChapterPage,
    currentGlobalPage,
    bookmarkRow,
    bookmarkText,
    volumeProgress,
    syncSymposiumProgress,
    booksData,
    resolvedIdentity,
    refetch,
    updateBookMetadata,
  });

  const handleCloseAllDrawers = useCallback(() => {
    closeDrawer();
    dismissSelectionPopover();
  }, [closeDrawer, dismissSelectionPopover]);

  const {
    isExitModalOpen,
    closeExitModal,
    handleHeaderBack,
    handleConfirmBookmarkAndExit,
    handleConfirmExitWithoutSaving,
    isUnderThreshold,
  } = useReaderExitBookmark({
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
    userId: user?.id,
    isAnyDrawerOpen: Boolean(activeDrawer || selectionPopover.isOpen),
    closeAllDrawers: handleCloseAllDrawers,
    setReadingStatus,
    setBookmarkRow,
  });

  // Reset any residual outer window scroll when entering the full-viewport reader
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function' && window.scrollY > 0) {
      window.scrollTo(0, 0);
    }
  }, []);

  return (
    <div className={`fixed inset-0 h-[100dvh] w-full flex flex-col overflow-hidden overscroll-none transition-colors duration-theme ${activeTheme.surface}`}>
      
      {/* Top Navigation & Toolbar */}
      <ReaderHeader
        title={bookTitle}
        author={bookAuthor}
        bookId={bookId}
        progress={volumeProgress}
        onBack={handleHeaderBack}
        isTocOpen={isTocOpen}
        onToggleToc={() => handleToggleDrawer('toc')}
        isSearchOpen={isSearchOpen}
        onToggleSearch={() => handleToggleDrawer('search')}
        isControlsOpen={isControlsOpen}
        onToggleControls={() => handleToggleDrawer('controls')}
        isTranslationsOpen={isTranslationsOpen}
        onToggleTranslations={() => handleToggleDrawer('translations')}
        isSpeechOpen={isSpeechOpen}
        onToggleSpeech={() => {
          setIsSpeechOpen((prev) => {
            const next = !prev;
            if (next) {
              closeDrawer();
            }
            if (!next && speech.isPlaying) {
              speech.stop();
            } else if (next && !speech.isPlaying) {
              speech.play(0);
            }
            return next;
          });
        }}
        isAnnotationsOpen={isAnnotationsOpen}
        onToggleAnnotations={() => handleToggleDrawer('annotations')}
        annotationsCount={totalUnifiedAnnotationsCount}
        totalChapters={chaptersWithPagination.length || 1}
        currentChapterIndex={activeChapterIndex}
        theme={theme}
        onThemeChange={(nextTheme) => {
          setTheme(nextTheme);
          schedulePreferencesCloudSync(0);
        }}
        resumeNotice={resumeNotice}
        onRestart={handleRestart}
        onDismissResume={dismissResumeNotice}
        translations={translations}
        isTranslationsLoading={isTranslationsLoading}
        onSelectTranslation={(targetBookId) => {
          router.replace(ROUTES.READ(targetBookId));
        }}
        symposiumCompanion={symposiumCompanion}
        symposiumMilestoneNotice={symposiumMilestoneNotice}
        onDismissSymposiumMilestone={dismissSymposiumMilestone}
        isHidden={areBarsHidden}
      />

      {/* Main Editorial Reading Canvas */}
      <ReaderSurface
        theme={theme}
        brightness={brightness}
        fontFamily={fontFamily}
        fontSize={fontSize}
        lineHeight={lineHeight}
        columnWidth={columnWidth}
        readingMode={readingMode}
        chapter={activeChapter}
        currentPageText={currentPageText}
        chapterPage={currentChapterPage}
        bookmarkRow={bookmarkRow}
        bookmarkText={bookmarkText}
        onBookmarkRowChange={setBookmarkRow}
        activeChapterIndex={activeChapterIndex}
        totalChapters={chaptersWithPagination.length || 1}
        isLoading={isContentLoading}
        isError={isContentError}
        error={contentError}
        onRetry={() => refetch()}
        bookTitle={bookTitle}
        bookAuthor={bookAuthor}
        onPreviousPage={handlePrevPage}
        onNextPage={handleNextPage}
        onFontSizeChange={setFontSize}
        onTapSurface={handleTapReaderSurface}
        isSpeechOpen={isSpeechOpen}
        highlightedSentence={isSpeechOpen && speech.isPlaying && speechHighlightEnabled ? speech.currentSentence : undefined}
        annotations={[...activeChapterAnnotations, ...activeChapterFellowAnnotations]}
        targetAnnotationId={targetAnnotationId}
        onSelectAnnotation={handleSelectAnnotation}
        onTextSelected={handleTextSelected}
      />

      {/* Fixed Sticky 0-CLS Bottom Pagination Footer */}
      <ReaderFooter
        globalPage={currentGlobalPage}
        totalBookPages={totalVolumePages}
        chapterTitle={activeChapter?.displayTitle || activeChapter?.title || 'Volume'}
        chapterPage={currentChapterPage}
        chapterPageCount={activeChapterPageCount}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
        onPageJump={handlePageJump}
        isPrevDisabled={isPrevDisabled}
        isNextDisabled={isNextDisabled}
        readingMode={readingMode}
        theme={theme}
        currentChapterIndex={activeChapterIndex}
        totalChapters={chaptersWithPagination.length || 1}
        onSelectChapter={handleSelectChapter}
        onToggleToc={() => handleToggleDrawer('toc')}
        onToggleControls={() => handleToggleDrawer('controls')}
        onToggleSearch={() => handleToggleDrawer('search')}
        onToggleSpeech={() => {
          setIsImmersiveBarsHidden(false);
          setIsSpeechOpen((prev) => !prev);
        }}
        onToggleAnnotations={() => handleToggleDrawer('annotations')}
        onToggleTranslations={() => handleToggleDrawer('translations')}
        onThemeChange={(nextTheme) => {
          setTheme(nextTheme);
          schedulePreferencesCloudSync(0);
        }}
        isTocOpen={isTocOpen}
        isControlsOpen={isControlsOpen}
        isSearchOpen={isSearchOpen}
        isSpeechOpen={isSpeechOpen}
        isAnnotationsOpen={isAnnotationsOpen}
        isTranslationsOpen={isTranslationsOpen}
        isSelectionPopoverOpen={selectionPopover.isOpen}
        annotationsCount={totalUnifiedAnnotationsCount}
        isHidden={areBarsHidden}
      />

      {/* Floating Appearance & Typography Controls Popover */}
      <ReaderControls
        isOpen={isControlsOpen}
        onClose={closeDrawer}
        fontSize={fontSize}
        onFontSizeChange={(size) => {
          setFontSize(size);
          schedulePreferencesCloudSync();
        }}
        lineHeight={lineHeight}
        onLineHeightChange={(height) => {
          setLineHeight(height);
          schedulePreferencesCloudSync();
        }}
        fontFamily={fontFamily}
        onFontFamilyChange={(family) => {
          setFontFamily(family);
          schedulePreferencesCloudSync();
        }}
        theme={theme}
        onThemeChange={(nextTheme) => {
          setTheme(nextTheme);
          schedulePreferencesCloudSync();
        }}
        brightness={brightness}
        onBrightnessChange={(val) => {
          setBrightness(val);
          schedulePreferencesCloudSync();
        }}
        readingMode={readingMode}
        onReadingModeChange={(mode) => {
          setReadingMode(mode);
          schedulePreferencesCloudSync();
        }}
        columnWidth={columnWidth}
        onColumnWidthChange={(width) => {
          setColumnWidth(width);
          schedulePreferencesCloudSync();
        }}
        hasCustomDefaults={Boolean(customDefaults)}
        isAtCustomDefaults={isAtReaderCustomDefaults}
        isAtFactoryDefaults={isAtReaderFactoryDefaults}
        onRevertToCustomDefaults={() => {
          resetReaderAppearanceToDefaults('custom');
        }}
        onResetToFactoryDefaults={() => {
          resetReaderAppearanceToDefaults('factory');
        }}
        exitBookmarkReminderEnabled={exitBookmarkReminderEnabled}
        onExitBookmarkReminderChange={setExitBookmarkReminderEnabled}
      />

      {/* Slide-out Table of Contents Drawer */}
      <ReaderTocDrawer
        isOpen={isTocOpen}
        onClose={closeDrawer}
        chapters={chaptersWithPagination}
        activeChapterIndex={activeChapterIndex}
        onSelectChapter={handleSelectChapter}
        bookTitle={bookTitle}
        theme={theme}
      />

      {/* Slide-out In-Book Full-Text Search Drawer */}
      <ReaderSearchDrawer
        isOpen={isSearchOpen}
        onClose={closeDrawer}
        chapters={chaptersWithPagination}
        fontSize={fontSize}
        onSelectMatch={handleSelectSearchMatch}
        bookTitle={bookTitle}
        theme={theme}
      />

      {/* Slide-out Language Editions & Translations Drawer */}
      <ReaderLanguageDrawer
        isOpen={isTranslationsOpen}
        onClose={closeDrawer}
        translations={translations}
        onSelectTranslation={(targetBookId) => {
          router.replace(ROUTES.READ(targetBookId));
        }}
        theme={theme}
      />

      {/* Floating Read Aloud Audio Narration Mini-Bar */}
      <ReaderSpeechBar
        speech={speech}
        isOpen={isSpeechOpen}
        isDrawerOpen={Boolean(activeDrawer)}
        onClose={() => {
          speech.stop();
          setIsSpeechOpen(false);
        }}
        theme={theme}
        bookTitle={bookTitle}
        currentPage={currentChapterPage}
        totalPages={activeChapterPageCount}
        isPrevDisabled={isPrevDisabled}
        isNextDisabled={isNextDisabled}
      />

      {/* Text Highlight & Annotations Floating Contextual Popover */}
      <TextHighlightPopover
        isOpen={selectionPopover.isOpen && !activeDrawer}
        selectedText={selectionPopover.selectedText}
        position={selectionPopover.position}
        activeColor={selectionPopover.activeAnnotation?.color}
        existingNote={selectionPopover.activeAnnotation?.note}
        existingAnnotationId={selectionPopover.activeAnnotation?.id}
        fellowAnnotation={selectionPopover.fellowAnnotation}
        isFellowOnly={selectionPopover.isFellowOnly}
        onSelectColor={handleSelectColor}
        onSaveNote={handleSaveNote}
        onDelete={handleDeleteAnnotation}
        onClose={dismissSelectionPopover}
        theme={theme}
      />

      {/* Slide-out Annotations & Highlights Drawer */}
      <ReaderAnnotationsDrawer
        isOpen={isAnnotationsOpen}
        onClose={closeDrawer}
        annotations={bookAnnotations}
        fellowAnnotations={bookFellowAnnotations}
        hasActiveSymposium={Boolean(activeSymposium)}
        symposiumCompanionUsername={symposiumCompanion?.username}
        symposiumCompanionDisplayName={symposiumCompanion?.displayName}
        activeChapterIndex={activeChapterIndex}
        spoilerShieldEnabled={spoilerShieldEnabled}
        onToggleSpoilerShield={setSpoilerShieldEnabled}
        bookTitle={bookTitle}
        theme={theme}
        onJumpToAnnotation={(chapterIdx, page, annotationId) => {
          let targetPage = page;
          if (annotationId) {
            const ann =
              bookAnnotations.find((a) => a.id === annotationId) ||
              bookFellowAnnotations.find((a) => a.id === annotationId);
            if (ann) {
              targetPage = resolveReflowedAnnotationPage(chapterIdx, page, ann.selectedText);
            }
            setActiveAnnotationTargetId(annotationId);
          }
          jumpTo(chapterIdx, targetPage);
          closeDrawer();
        }}
        onDeleteAnnotation={(id) => deleteAnnotation(id, user?.id)}
        onUpdateNote={(id, note) => updateAnnotationNote(id, note, user?.id)}
        onSaveFellowAnnotation={async (fellow, noteText, color) => {
          await saveNewBookAnnotation({
            chapterIndex: fellow.chapterIndex,
            chapterPage: fellow.chapterPage,
            selectedText: fellow.selectedText,
            color: color || 'yellow',
            note: noteText,
          });
        }}
      />

      {/* Delete Single Annotation Confirmation Modal */}
      <DeleteAnnotationModal
        isOpen={annotationToDelete !== null}
        onClose={() => setAnnotationToDelete(null)}
        onConfirm={async () => {
          if (annotationToDelete) {
            await deleteAnnotation(annotationToDelete.id, user?.id);
            setAnnotationToDelete(null);
          }
        }}
        annotation={annotationToDelete}
      />

      {/* Volume Completion Modal */}
      <VolumeCompletionModal
        isOpen={isCompletionModalOpen}
        onClose={dismissCompletionModal}
        bookTitle={bookTitle}
        bookRating={bookRating}
        onRateChange={(newRating) => setBookRating(numericId, newRating, user?.id)}
        onOpenBookshelf={() => {
          router.push(ROUTES.BOOKSHELF);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
        }}
      />

      {/* Exit Bookmark Discovery & Reminder Modal */}
      <ReaderExitBookmarkModal
        isOpen={isExitModalOpen}
        onClose={closeExitModal}
        onConfirmExitWithoutSaving={handleConfirmExitWithoutSaving}
        onConfirmBookmarkAndExit={handleConfirmBookmarkAndExit}
        bookTitle={bookTitle}
        currentPage={currentGlobalPage}
        isUnderThreshold={isUnderThreshold}
        theme={theme}
        initialReminderEnabled={exitBookmarkReminderEnabled}
        onToggleReminder={setExitBookmarkReminderEnabled}
      />

    </div>
  );
}

export default function BookReaderPage() {
  return (
    <React.Suspense
      fallback={
        <div className="fixed inset-0 h-[100dvh] w-full flex flex-col overflow-hidden overscroll-none">
          <ReaderLoadingView activeTheme={getReaderTheme('light')} />
        </div>
      }
    >
      <BookReaderContent />
    </React.Suspense>
  );
}
