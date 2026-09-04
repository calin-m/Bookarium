'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBookContent } from '@/hooks/queries/useBookContent';
import { useBooks } from '@/hooks/queries/useBooks';
import { useBookTranslations } from '@/hooks/queries/useBookTranslations';
import { usePageTranslation } from '@/hooks/queries/usePageTranslation';
import { useReaderStore } from '@/stores/useReaderStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useHasMounted } from '@/hooks/useHasMounted';
import {
  extractGutenbergHeaderMetadata,
} from '@/lib/gutenberg-parser';
import { useGutenbergParserWorker } from '@/hooks/reader/useGutenbergParserWorker';
import { getReaderTheme } from '@/config/reader-themes';
import { resolveBookMetadata, isPlaceholderTitle } from '@/lib/book-metadata';
import { ReaderHeader } from '@/components/reader/ReaderHeader';
import { ReaderFooter } from '@/components/reader/ReaderFooter';
import { ReaderTocDrawer } from '@/components/reader/ReaderTocDrawer';
import { ReaderSearchDrawer } from '@/components/reader/ReaderSearchDrawer';
import { ReaderControls } from '@/components/reader/ReaderControls';
import { ReaderLanguageDrawer } from '@/components/reader/ReaderLanguageDrawer';
import { ReaderSpeechBar } from '@/components/reader/ReaderSpeechBar';
import { ReaderSurface } from '@/components/reader/ReaderSurface';
import { TextHighlightPopover } from '@/components/reader/TextHighlightPopover';
import { ReaderAnnotationsDrawer } from '@/components/reader/ReaderAnnotationsDrawer';
import { useReaderDrawers } from '@/hooks/reader/useReaderDrawers';
import { useReaderSpeech } from '@/hooks/reader/useReaderSpeech';
import { useReaderSession } from '@/hooks/reader/useReaderSession';
import { useShallow } from 'zustand/react/shallow';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { useHydratedAnnotations, type HighlightColor, type Annotation } from '@/stores/useAnnotationStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBookshelfStore, useBookRating, useReadingStatus } from '@/stores/useBookshelfStore';
import { StarRating } from '@/components/ui/StarRating';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, Trash2, Trophy } from 'lucide-react';
import { ROUTES } from '@/config/routes';

export default function BookReaderPage() {
  const params = useParams();
  const router = useRouter();
  const hasMounted = useHasMounted();
  const rawId = params?.id;
  const bookId = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';
  const numericId = parseInt(bookId, 10) || 0;

  // Global Reader Store (Guarded with useHasMounted for zero SSR hydration mismatch)
  const rawCurrentBook = useReaderStore((s) => s.currentBook);
  const currentBook = hasMounted ? rawCurrentBook : null;
  const rawFontSize = useReaderStore((s) => s.fontSize);
  const fontSize = hasMounted ? rawFontSize : 18;
  const rawLineHeight = useReaderStore((s) => s.lineHeight);
  const lineHeight = hasMounted ? rawLineHeight : 1.75;
  const rawFontFamily = useReaderStore((s) => s.fontFamily);
  const fontFamily = hasMounted ? rawFontFamily : 'serif';
  const rawTheme = useReaderStore((s) => s.theme);
  const theme = hasMounted ? rawTheme : 'light';
  const setFontSize = useReaderStore((s) => s.setFontSize);
  const setLineHeight = useReaderStore((s) => s.setLineHeight);
  const setFontFamily = useReaderStore((s) => s.setFontFamily);
  const setTheme = useReaderStore((s) => s.setTheme);

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
    isTocOpen,
    isSearchOpen,
    isControlsOpen,
    isTranslationsOpen,
    toggleDrawer,
    closeDrawer,
  } = useReaderDrawers();
  const [readingMode, setReadingMode] = useState<'paginated' | 'scroll'>('paginated');
  const [columnWidth, setColumnWidth] = useState<'narrow' | 'normal' | 'wide'>('wide');
  const [dynamicTargetLanguage, setDynamicTargetLanguage] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<'translated' | 'bilingual'>('translated');

  // Annotations & Highlights Management
  const {
    annotations,
    addAnnotation,
    updateAnnotationColor,
    updateAnnotationNote,
    deleteAnnotation,
    syncWithCloud,
    updateBookMetadata,
  } = useHydratedAnnotations();
  const user = useAuthStore((s) => s.user);

  // Sync annotations on load if authenticated
  useEffect(() => {
    if (user?.id) {
      syncWithCloud(user.id);
    }
  }, [user?.id, syncWithCloud]);

  const [isAnnotationsOpen, setIsAnnotationsOpen] = useState(false);
  const [annotationToDelete, setAnnotationToDelete] = useState<Annotation | null>(null);
  const [selectionPopover, setSelectionPopover] = useState<{
    isOpen: boolean;
    selectedText: string;
    position: { top: number; left: number; bottom?: number } | null;
    activeAnnotation: Annotation | null;
  }>({
    isOpen: false,
    selectedText: '',
    position: null,
    activeAnnotation: null,
  });

  const bookAnnotations = useMemo(() => {
    return annotations.filter((a) => a.bookId === numericId);
  }, [numericId, annotations]);

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
        toggleDrawer('search');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleDrawer]);

  // Queries
  const { data: contentText, isLoading: isContentLoading, isError: isContentError, refetch } = useBookContent(undefined, numericId);
  const { data: booksData } = useBooks({ ids: numericId > 0 ? String(numericId) : '', page: 1, copyright: false });
  
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

  // Auto-heal missing or placeholder metadata on any stored annotations for this volume
  useEffect(() => {
    if (numericId > 0 && resolvedIdentity.title && !isPlaceholderTitle(resolvedIdentity.title)) {
      updateBookMetadata(numericId, resolvedIdentity.title, resolvedIdentity.author);
    }
  }, [numericId, resolvedIdentity.title, resolvedIdentity.author, updateBookMetadata]);

  const bookTitle = resolvedIdentity.title;
  const bookAuthor = resolvedIdentity.author;

  // Language & International Translations
  const { translations, isLoading: isTranslationsLoading } = useBookTranslations(
    bookTitle,
    bookAuthor,
    numericId,
    resolvedIdentity.languages
  );

  // Parse Chapters and Volume Spread via Web Worker
  const { chaptersWithPagination, totalVolumePages } = useGutenbergParserWorker(
    contentText,
    fontSize
  );

  const {
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
  } = useReaderSession({
    numericId,
    hasMounted,
    chaptersWithPagination,
    totalVolumePages,
    fontSize,
    readingMode,
  });

  const activeChapterAnnotations = useMemo(() => {
    return bookAnnotations.filter((a) => a.chapterIndex === activeChapterIndex);
  }, [bookAnnotations, activeChapterIndex]);

  const handleSelectSearchMatch = useCallback((chapterIndex: number, page: number) => {
    setActiveChapterIndex(chapterIndex);
    setCurrentChapterPage(page);
    closeDrawer();
  }, [closeDrawer, setActiveChapterIndex, setCurrentChapterPage]);

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

  // Personal Curation: Reading Status & Ratings
  const readingStatus = useReadingStatus(numericId);
  const bookRating = useBookRating(numericId);
  const setReadingStatus = useBookshelfStore((s) => s.setReadingStatus);
  const setBookRating = useBookshelfStore((s) => s.setBookRating);
  const [isCompletionDismissed, setIsCompletionDismissed] = useState(false);
  const isAtEnd = isNextDisabled && chaptersWithPagination.length > 0;
  const isCompletionModalOpen = isAtEnd && !isCompletionDismissed;

  // Auto-transition to 'currently_reading' when reader begins a book
  useEffect(() => {
    if (numericId > 0 && !isContentLoading && contentText) {
      if (!readingStatus || readingStatus === 'want_to_read') {
        setReadingStatus(numericId, 'currently_reading', user?.id);
      }
    }
  }, [numericId, isContentLoading, contentText, readingStatus, setReadingStatus, user?.id]);

  // Auto-update reading status to 'finished' when reaching the final page
  useEffect(() => {
    if (isAtEnd && readingStatus !== 'finished' && numericId > 0) {
      setReadingStatus(numericId, 'finished', user?.id);
    }
  }, [isAtEnd, readingStatus, numericId, user?.id, setReadingStatus]);

  const activeTheme = getReaderTheme(theme);

  const [isSpeechOpen, setIsSpeechOpen] = useState(false);

  // Active reading content
  const rawPageText = readingMode === 'paginated' ? currentPageText : (activeChapter?.content || '');

  // Dynamic On-Demand Page Translation
  const {
    translatedText,
    segments: translationSegments,
    isLoading: isTranslating,
  } = usePageTranslation({
    text: rawPageText,
    targetLanguage: dynamicTargetLanguage,
    bookId: numericId,
    chapterIndex: activeChapterIndex,
    pageIndex: currentChapterPage,
  });

  // Derive text to speak: if translated, speak translatedText in the target language!
  const textToRead = translatedText || rawPageText;
  const speechLanguage = dynamicTargetLanguage || resolvedIdentity.languages?.[0] || 'en';

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

  const handleTextSelected = useCallback(
    (selection: { text: string; position: { top: number; left: number; bottom?: number } }) => {
      const trimmed = selection.text.trim();
      const existing = bookAnnotations.find(
        (a) =>
          a.selectedText.trim() === trimmed ||
          a.selectedText === selection.text ||
          a.selectedText.trim().includes(trimmed) ||
          trimmed.includes(a.selectedText.trim())
      );
      setSelectionPopover({
        isOpen: true,
        selectedText: selection.text,
        position: selection.position,
        activeAnnotation: existing || null,
      });
    },
    [bookAnnotations]
  );

  const handleSelectAnnotation = useCallback(
    (annotation: Annotation, position?: { top: number; left: number; bottom?: number }) => {
      if (typeof window === 'undefined') return;
      setSelectionPopover({
        isOpen: true,
        selectedText: annotation.selectedText,
        position: position || { top: 140, left: window.innerWidth / 2 },
        activeAnnotation: annotation,
      });
    },
    []
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
        await addAnnotation(
          {
            bookId: numericId,
            bookTitle: resolvedIdentity.title,
            bookAuthor: resolvedIdentity.author,
            chapterIndex: activeChapterIndex,
            chapterPage: currentChapterPage,
            selectedText: selectionPopover.selectedText,
            color,
          },
          user?.id
        );
      }
      setSelectionPopover((prev) => ({ ...prev, isOpen: false }));
    },
    [
      selectionPopover.activeAnnotation,
      selectionPopover.selectedText,
      numericId,
      resolvedIdentity.title,
      resolvedIdentity.author,
      activeChapterIndex,
      currentChapterPage,
      updateAnnotationColor,
      addAnnotation,
      user?.id,
    ]
  );

  const handleSaveNote = useCallback(
    async (note: string) => {
      if (selectionPopover.activeAnnotation) {
        await updateAnnotationNote(selectionPopover.activeAnnotation.id, note, user?.id);
      } else {
        await addAnnotation(
          {
            bookId: numericId,
            bookTitle: resolvedIdentity.title,
            bookAuthor: resolvedIdentity.author,
            chapterIndex: activeChapterIndex,
            chapterPage: currentChapterPage,
            selectedText: selectionPopover.selectedText,
            color: 'yellow',
            note,
          },
          user?.id
        );
      }
      setSelectionPopover((prev) => ({ ...prev, isOpen: false }));
    },
    [
      selectionPopover.activeAnnotation,
      selectionPopover.selectedText,
      updateAnnotationNote,
      addAnnotation,
      numericId,
      resolvedIdentity.title,
      resolvedIdentity.author,
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
  }, [selectionPopover]);

  return (
    <div className={`h-[100dvh] flex flex-col overflow-hidden transition-colors duration-theme ${activeTheme.surface}`}>
      
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
        }}
        isTocOpen={isTocOpen}
        onToggleToc={() => toggleDrawer('toc')}
        isSearchOpen={isSearchOpen}
        onToggleSearch={() => toggleDrawer('search')}
        isControlsOpen={isControlsOpen}
        onToggleControls={() => toggleDrawer('controls')}
        isTranslationsOpen={isTranslationsOpen}
        onToggleTranslations={() => toggleDrawer('translations')}
        isSpeechOpen={isSpeechOpen}
        onToggleSpeech={() => {
          setIsSpeechOpen((prev) => {
            const next = !prev;
            if (!next && speech.isPlaying) {
              speech.stop();
            } else if (next && !speech.isPlaying) {
              speech.play(0);
            }
            return next;
          });
        }}
        isAnnotationsOpen={isAnnotationsOpen}
        onToggleAnnotations={() => setIsAnnotationsOpen((prev) => !prev)}
        annotationsCount={bookAnnotations.length}
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
        dynamicTargetLanguage={dynamicTargetLanguage}
        displayMode={displayMode}
      />

      {/* Main Editorial Reading Canvas */}
      <ReaderSurface
        theme={theme}
        fontFamily={fontFamily}
        fontSize={fontSize}
        lineHeight={lineHeight}
        columnWidth={columnWidth}
        readingMode={readingMode}
        chapter={activeChapter}
        currentPageText={currentPageText}
        chapterPage={currentChapterPage}
        activeChapterIndex={activeChapterIndex}
        totalChapters={chaptersWithPagination.length || 1}
        isLoading={isContentLoading}
        isError={isContentError}
        onRetry={() => refetch()}
        bookTitle={bookTitle}
        bookAuthor={bookAuthor}
        onPreviousPage={handlePrevPage}
        onNextPage={handleNextPage}
        onFontSizeChange={setFontSize}
        highlightedSentence={isSpeechOpen && speech.isPlaying && speechHighlightEnabled ? speech.currentSentence : undefined}
        translatedText={translatedText}
        translationSegments={translationSegments}
        displayMode={displayMode}
        isTranslating={isTranslating}
        annotations={activeChapterAnnotations}
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
        dynamicTargetLanguage={dynamicTargetLanguage}
        onSelectDynamicLanguage={setDynamicTargetLanguage}
        displayMode={displayMode}
        onSelectDisplayMode={setDisplayMode}
        isTranslating={isTranslating}
      />

      {/* Floating Read Aloud Audio Narration Mini-Bar */}
      <ReaderSpeechBar
        isOpen={isSpeechOpen}
        onClose={() => {
          speech.stop();
          setIsSpeechOpen(false);
        }}
        isPlaying={speech.isPlaying}
        isPaused={speech.isPaused}
        currentSentenceIndex={speech.currentSentenceIndex}
        totalSentences={speech.totalSentences}
        rate={speech.rate}
        availableVoices={speech.availableVoices}
        naturalVoices={speech.naturalVoices}
        standardVoices={speech.standardVoices}
        selectedVoice={speech.selectedVoice}
        onPlay={() => speech.play()}
        onPause={() => speech.pause()}
        onResume={() => speech.resume()}
        onSkipNext={() => speech.skipNext()}
        onSkipPrev={() => speech.skipPrev()}
        onRateChange={speech.setRate}
        onVoiceChange={speech.setVoice}
        theme={theme}
        bookTitle={bookTitle}
        currentPage={currentChapterPage}
        totalPages={activeChapterPageCount}
        isPrevDisabled={isPrevDisabled}
        isNextDisabled={isNextDisabled}
      />

      {/* Text Highlight & Annotations Floating Contextual Popover */}
      <TextHighlightPopover
        isOpen={selectionPopover.isOpen}
        selectedText={selectionPopover.selectedText}
        position={selectionPopover.position}
        activeColor={selectionPopover.activeAnnotation?.color}
        existingNote={selectionPopover.activeAnnotation?.note}
        existingAnnotationId={selectionPopover.activeAnnotation?.id}
        onSelectColor={handleSelectColor}
        onSaveNote={handleSaveNote}
        onDelete={handleDeleteAnnotation}
        onClose={() => setSelectionPopover((prev) => ({ ...prev, isOpen: false }))}
        theme={theme}
      />

      {/* Slide-out Annotations & Highlights Drawer */}
      <ReaderAnnotationsDrawer
        isOpen={isAnnotationsOpen}
        onClose={() => setIsAnnotationsOpen(false)}
        annotations={bookAnnotations}
        bookTitle={bookTitle}
        theme={theme}
        onJumpToAnnotation={(chapterIdx, page) => {
          setActiveChapterIndex(chapterIdx);
          setCurrentChapterPage(page);
        }}
        onDeleteAnnotation={(id) => deleteAnnotation(id, user?.id)}
        onUpdateNote={(id, note) => updateAnnotationNote(id, note, user?.id)}
      />

      {/* Delete Single Annotation Confirmation Modal */}
      <Modal
        isOpen={annotationToDelete !== null}
        onClose={() => setAnnotationToDelete(null)}
        title="Delete Saved Note & Highlight?"
        maxWidth="md"
      >
        <div className="p-6 space-y-5" data-testid="delete-single-note-dialog">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-foreground text-sm sm:text-base">
                Are you sure you want to delete this saved quote?
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                This will remove this highlight and any attached personal reflection from your library. This action cannot be undone.
              </p>
              {annotationToDelete && (
                <div className="mt-2 p-3 rounded-lg bg-muted/40 border border-border/50 text-xs">
                  <p className="font-serif italic text-foreground/90 line-clamp-3">
                    &ldquo;{annotationToDelete.selectedText}&rdquo;
                  </p>
                  {annotationToDelete.note && (
                    <p className="mt-1.5 pt-1.5 border-t border-border/40 font-sans text-muted-foreground line-clamp-2">
                      <span className="font-mono text-[10px] uppercase text-primary mr-1">Note:</span>
                      {annotationToDelete.note}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAnnotationToDelete(null)}
              className="text-xs font-mono uppercase"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={async () => {
                if (annotationToDelete) {
                  await deleteAnnotation(annotationToDelete.id, user?.id);
                  setAnnotationToDelete(null);
                }
              }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent text-xs font-mono uppercase gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Note
            </Button>
          </div>
        </div>
      </Modal>

      {/* Volume Completion Modal */}
      <Modal
        isOpen={isCompletionModalOpen}
        onClose={() => setIsCompletionDismissed(true)}
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
              onClick={() => router.push(ROUTES.BOOKSHELF)}
              className="text-xs font-mono uppercase"
            >
              My Bookshelf
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCompletionDismissed(true)}
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
