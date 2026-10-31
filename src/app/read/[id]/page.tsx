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
import { resolveBookMetadata } from '@/lib/book-metadata';
import { areAnnotationsOverlapping, pairOverlappingAnnotations } from '@/lib/reader-annotator';
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
import { useReaderDrawers } from '@/hooks/reader/useReaderDrawers';
import { useReaderSpeech } from '@/hooks/reader/useReaderSpeech';
import { useReaderSession } from '@/hooks/reader/useReaderSession';
import { useReaderHabitTelemetry } from '@/hooks/reader/useReaderHabitTelemetry';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useShallow } from 'zustand/react/shallow';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import {
  useHydratedAnnotations,
  type HighlightColor,
  type Annotation,
  type FellowAnnotation,
} from '@/stores/useAnnotationStore';
import { useHydratedFellowship } from '@/stores/useFellowshipStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBookshelfStore, useBookRating, useReadingStatus } from '@/stores/useBookshelfStore';
import { StarRating } from '@/components/ui/StarRating';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Trophy } from 'lucide-react';
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
    setFontSize,
    setLineHeight,
    setFontFamily,
    setTheme,
    setBrightness,
  } = useHydratedReader();

  // Persistent User Preferences
  const {
    speechRate,
    setSpeechRate,
    speechVoiceURI,
    setSpeechVoiceURI,
    speechAutoPageAdvance,
    speechHighlightEnabled,
  } = usePreferencesStore(
    useShallow((s) => ({
      speechRate: s.speechRate,
      setSpeechRate: s.setSpeechRate,
      speechVoiceURI: s.speechVoiceURI,
      setSpeechVoiceURI: s.setSpeechVoiceURI,
      speechAutoPageAdvance: s.speechAutoPageAdvance,
      speechHighlightEnabled: s.speechHighlightEnabled,
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
  const [readingMode, setReadingMode] = useState<'paginated' | 'scroll'>('paginated');
  const [columnWidth, setColumnWidth] = useState<'narrow' | 'normal' | 'wide'>('wide');

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

  // Re-fetch fellow annotations when opening annotations drawer to capture any live fellow notes
  useEffect(() => {
    if (isAnnotationsOpen && user?.id && numericId > 0 && !isOffline) {
      void fetchFellowAnnotationsForBook(numericId, user.id);
    }
  }, [isAnnotationsOpen, user?.id, numericId, isOffline, fetchFellowAnnotationsForBook]);

  const [annotationToDelete, setAnnotationToDelete] = useState<Annotation | null>(null);
  const [selectionPopover, setSelectionPopover] = useState<{
    isOpen: boolean;
    selectedText: string;
    position: { top: number; left: number; bottom?: number } | null;
    activeAnnotation: Annotation | null;
    fellowAnnotation: FellowAnnotation | null;
    isFellowOnly: boolean;
  }>({
    isOpen: false,
    selectedText: '',
    position: null,
    activeAnnotation: null,
    fellowAnnotation: null,
    isFellowOnly: false,
  });

  const [isImmersiveBarsHidden, setIsImmersiveBarsHidden] = useState(false);

  // Dismiss floating text selection popover whenever a reader drawer is toggled
  const handleToggleDrawer = useCallback(
    (drawer: Parameters<typeof toggleDrawer>[0]) => {
      setIsImmersiveBarsHidden(false);
      setSelectionPopover((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
      toggleDrawer(drawer);
    },
    [toggleDrawer]
  );

  const handleTapReaderSurface = useCallback(() => {
    if (activeDrawer || selectionPopover.isOpen) return;
    setIsImmersiveBarsHidden((prev) => !prev);
  }, [activeDrawer, selectionPopover.isOpen]);

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

  // Queries
  const { data: contentText, isLoading: isContentLoading, isError: isContentError, error: contentError, refetch } = useBookContent(undefined, numericId);
  const { data: booksData } = useBooks(
    {
      ids: numericId > 0 ? String(numericId) : '',
      page: 1,
      copyright: false,
      includeRestrictedMetadata: true,
    },
    { enabled: !isOffline && numericId > 0 }
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
      const foundIdx = chapter?.pages?.findIndex((p) => p.includes(selectedText)) ?? -1;
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
    volumeProgress,
    syncSymposiumProgress,
    booksData,
    resolvedIdentity,
    refetch,
    updateBookMetadata,
  });

  const handleTextSelected = useCallback(
    (selection: { text: string; position: { top: number; left: number; bottom?: number } }) => {
      const trimmed = selection.text.trim();
      const matchesPassage = (a: { selectedText: string }) => {
        const candidate = a.selectedText.trim();
        return candidate.includes(trimmed) || trimmed.includes(candidate);
      };
      const ownMatch = activeChapterAnnotations.find(matchesPassage) || null;
      const fellowMatch = activeChapterFellowAnnotations.find(matchesPassage) || null;
      setSelectionPopover({
        isOpen: true,
        selectedText: selection.text,
        position: selection.position,
        activeAnnotation: ownMatch,
        fellowAnnotation: fellowMatch,
        isFellowOnly: false,
      });
    },
    [activeChapterAnnotations, activeChapterFellowAnnotations]
  );

  const handleSelectAnnotation = useCallback(
    (
      annotation: Annotation | FellowAnnotation,
      position?: { top: number; left: number; bottom?: number },
      overlappingFellow?: FellowAnnotation
    ) => {
      if (typeof window === 'undefined') return;
      const isFellowClicked = 'isFellow' in annotation && annotation.isFellow === true;
      const ownAnn = isFellowClicked
        ? activeChapterAnnotations.find((a) => areAnnotationsOverlapping(a, annotation)) || null
        : (annotation as Annotation);
      const fellowAnn = isFellowClicked
        ? (annotation as FellowAnnotation)
        : overlappingFellow ||
          activeChapterFellowAnnotations.find((fa) => areAnnotationsOverlapping(annotation, fa)) ||
          null;
      setSelectionPopover({
        isOpen: true,
        selectedText: annotation.selectedText,
        position: position || { top: 140, left: window.innerWidth / 2 },
        activeAnnotation: ownAnn,
        fellowAnnotation: fellowAnn,
        isFellowOnly: Boolean(fellowAnn && !ownAnn),
      });
    },
    [activeChapterAnnotations, activeChapterFellowAnnotations]
  );

  const saveNewBookAnnotation = useCallback(
    async (params: {
      chapterIndex: number;
      chapterPage: number;
      selectedText: string;
      color: HighlightColor;
      note?: string;
    }) => {
      await addAnnotation(
        {
          bookId: numericId,
          bookTitle: resolvedIdentity.title,
          bookAuthor: resolvedIdentity.author,
          ...params,
        },
        user?.id
      );
    },
    [addAnnotation, numericId, resolvedIdentity.title, resolvedIdentity.author, user?.id]
  );

  const handleSelectColor = useCallback(
    async (color: HighlightColor) => {
      if (selectionPopover.activeAnnotation) {
        await updateAnnotationColor(
          selectionPopover.activeAnnotation.id,
          color,
          user?.id
        );
      } else {
        await saveNewBookAnnotation({
          chapterIndex: activeChapterIndex,
          chapterPage: currentChapterPage,
          selectedText: selectionPopover.selectedText,
          color,
        });
      }
      setSelectionPopover((prev) => ({ ...prev, isOpen: false }));
    },
    [
      selectionPopover.activeAnnotation,
      selectionPopover.selectedText,
      activeChapterIndex,
      currentChapterPage,
      updateAnnotationColor,
      saveNewBookAnnotation,
      user?.id,
    ]
  );

  const handleSaveNote = useCallback(
    async (note: string) => {
      if (selectionPopover.activeAnnotation) {
        await updateAnnotationNote(selectionPopover.activeAnnotation.id, note, user?.id);
      } else {
        await saveNewBookAnnotation({
          chapterIndex: activeChapterIndex,
          chapterPage: currentChapterPage,
          selectedText: selectionPopover.selectedText,
          color: 'yellow',
          note,
        });
      }
      setSelectionPopover((prev) => ({ ...prev, isOpen: false }));
    },
    [
      selectionPopover.activeAnnotation,
      selectionPopover.selectedText,
      updateAnnotationNote,
      saveNewBookAnnotation,
      activeChapterIndex,
      currentChapterPage,
      user?.id,
    ]
  );

  const handleDeleteAnnotation = useCallback(() => {
    if (selectionPopover.activeAnnotation) {
      setAnnotationToDelete(selectionPopover.activeAnnotation);
    }
    setSelectionPopover((prev) => ({ ...prev, isOpen: false }));
  }, [selectionPopover.activeAnnotation]);

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
        onBack={() => {
          if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
          } else {
            router.push(ROUTES.HOME);
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
        }}
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
        onThemeChange={setTheme}
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
        onThemeChange={setTheme}
        isTocOpen={isTocOpen}
        isControlsOpen={isControlsOpen}
        isSearchOpen={isSearchOpen}
        isSpeechOpen={isSpeechOpen}
        isAnnotationsOpen={isAnnotationsOpen}
        isTranslationsOpen={isTranslationsOpen}
        isHidden={areBarsHidden}
      />

      {/* Floating Appearance & Typography Controls Popover */}
      <ReaderControls
        isOpen={isControlsOpen}
        onClose={closeDrawer}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        lineHeight={lineHeight}
        onLineHeightChange={setLineHeight}
        fontFamily={fontFamily}
        onFontFamilyChange={setFontFamily}
        theme={theme}
        onThemeChange={setTheme}
        brightness={brightness}
        onBrightnessChange={setBrightness}
        readingMode={readingMode}
        onReadingModeChange={setReadingMode}
        columnWidth={columnWidth}
        onColumnWidthChange={setColumnWidth}
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
        onClose={() => setSelectionPopover((prev) => ({ ...prev, isOpen: false }))}
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
      <Modal
        isOpen={isCompletionModalOpen}
        onClose={dismissCompletionModal}
        title="Volume Finished!"
        maxWidth="md"
      >
        <div className="p-6 space-y-5 text-center" data-testid="volume-completion-modal">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Trophy className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h3 className="font-serif font-bold text-lg text-foreground">
              Congratulations!
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
              You have completed reading <span className="font-semibold text-foreground">&ldquo;{bookTitle}&rdquo;</span>.
              Your reading status has been updated to <span className="font-mono text-emerald-500 font-medium">Finished</span>.
            </p>
          </div>

          <div className="pt-2 pb-1 space-y-2 flex flex-col items-center">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
              Leave a Rating
            </span>
            <StarRating
              value={bookRating}
              onChange={(newRating) => setBookRating(numericId, newRating, user?.id)}
              size="lg"
              showLabel
              aria-label={`Rate ${bookTitle}`}
            />
          </div>

          <div className="flex items-center justify-center gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                router.push(ROUTES.BOOKSHELF);
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }
              }}
              className="text-xs font-mono uppercase"
            >
              My Bookshelf
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={dismissCompletionModal}
              className="text-xs font-mono uppercase"
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

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
