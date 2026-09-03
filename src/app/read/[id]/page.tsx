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
  parseGutenbergChapters,
  calculateVolumePageSpread,
  extractGutenbergHeaderMetadata,
  type ChapterSection,
} from '@/lib/gutenberg-parser';
import { getReaderTheme } from '@/config/reader-themes';
import { resolveBookMetadata } from '@/lib/book-metadata';
import { ReaderHeader } from '@/components/reader/ReaderHeader';
import { ReaderFooter } from '@/components/reader/ReaderFooter';
import { ReaderTocDrawer } from '@/components/reader/ReaderTocDrawer';
import { ReaderSearchDrawer } from '@/components/reader/ReaderSearchDrawer';
import { ReaderControls } from '@/components/reader/ReaderControls';
import { ReaderLanguageDrawer } from '@/components/reader/ReaderLanguageDrawer';
import { ReaderSpeechBar } from '@/components/reader/ReaderSpeechBar';
import { ReaderSurface } from '@/components/reader/ReaderSurface';
import { useReaderDrawers } from '@/hooks/reader/useReaderDrawers';
import { useReaderSpeech } from '@/hooks/reader/useReaderSpeech';
import { useReaderSession } from '@/hooks/reader/useReaderSession';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
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
  } = usePreferencesStore();

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

  const bookTitle = resolvedIdentity.title;
  const bookAuthor = resolvedIdentity.author;

  // Language & International Translations
  const { translations, isLoading: isTranslationsLoading } = useBookTranslations(
    bookTitle,
    bookAuthor,
    numericId,
    resolvedIdentity.languages
  );

  // Parse Chapters and Volume Spread
  const rawChapters = useMemo<ChapterSection[]>(() => {
    return parseGutenbergChapters(contentText);
  }, [contentText]);

  const { chaptersWithPagination, totalVolumePages } = useMemo(() => {
    return calculateVolumePageSpread(rawChapters, fontSize);
  }, [rawChapters, fontSize]);

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
    activeChapterIndex === chaptersWithPagination.length - 1 &&
    currentChapterPage === activeChapterPageCount;

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

    </div>
  );
}
