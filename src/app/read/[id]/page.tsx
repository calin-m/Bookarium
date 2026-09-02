'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBookContent } from '@/hooks/queries/useBookContent';
import { useBooks } from '@/hooks/queries/useBooks';
import { useBookTranslations } from '@/hooks/queries/useBookTranslations';
import { useReaderStore } from '@/stores/useReaderStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useHasMounted } from '@/hooks/useHasMounted';
import {
  parseGutenbergChapters,
  getCharsPerPage,
  calculateVolumePageSpread,
  extractGutenbergHeaderMetadata,
  paginateChapterContent,
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
import { ReaderSurface } from '@/components/reader/ReaderSurface';
import { useReaderDrawers } from '@/hooks/reader/useReaderDrawers';
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
  const setProgress = useReaderStore((s) => s.setProgress);
  const saveReadingPosition = useReaderStore((s) => s.saveReadingPosition);
  const getReadingPosition = useReaderStore((s) => s.getReadingPosition);

  // Local Reader State
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [currentChapterPage, setCurrentChapterPage] = useState(1);
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
  const [resumeNotice, setResumeNotice] = useState<{ chapterTitle: string; page: number } | null>(null);
  const hasRestoredPositionRef = React.useRef(false);

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

  // Exact Page Bookmarking: Auto-Resume Position from Store
  useEffect(() => {
    if (hasRestoredPositionRef.current || !hasMounted || numericId <= 0 || chaptersWithPagination.length === 0) {
      return;
    }
    const savedPos = getReadingPosition(numericId);
    if (savedPos && (savedPos.chapterIndex > 0 || savedPos.chapterPage > 1)) {
      const clampedChap = Math.min(Math.max(0, savedPos.chapterIndex), chaptersWithPagination.length - 1);
      const targetChap = chaptersWithPagination[clampedChap];
      const maxPage = targetChap?.pageCount || 1;
      const clampedPage = Math.min(Math.max(1, savedPos.chapterPage), maxPage);

      queueMicrotask(() => {
        setActiveChapterIndex(clampedChap);
        setCurrentChapterPage(clampedPage);
        setResumeNotice({
          chapterTitle: targetChap?.displayTitle || targetChap?.title || `Chapter ${clampedChap + 1}`,
          page: clampedPage,
        });
      });

      // Auto-hide resume notice after 4 seconds
      const timer = setTimeout(() => {
        setResumeNotice(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
    hasRestoredPositionRef.current = true;
  }, [hasMounted, numericId, chaptersWithPagination, getReadingPosition]);

  const activeChapter = chaptersWithPagination[activeChapterIndex] || chaptersWithPagination[0];
  const activeChapterPageCount = activeChapter?.pageCount || 1;

  // Retrieve Current Page Text for Paginated Mode
  const currentPageText = useMemo(() => {
    if (!activeChapter?.content) return '';
    if (readingMode === 'scroll') return activeChapter.content;

    const pages = activeChapter.pages || paginateChapterContent(activeChapter.content, getCharsPerPage(fontSize));
    return pages[currentChapterPage - 1] || pages[0] || '';
  }, [activeChapter, currentChapterPage, fontSize, readingMode]);

  // Global Page & Progress Calculations
  const currentGlobalPage = (activeChapter?.startPageNumber || 1) + (currentChapterPage - 1);
  const volumeProgress =
    currentGlobalPage <= 1 || totalVolumePages <= 1
      ? 0
      : Math.min(100, Math.max(0, Math.round(((currentGlobalPage - 1) / (totalVolumePages - 1)) * 100)));

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
  }, [numericId, volumeProgress, totalVolumePages, activeChapterIndex, currentChapterPage, currentGlobalPage, setProgress, saveReadingPosition]);

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

  const handleSelectSearchMatch = useCallback((chapterIndex: number, page: number) => {
    setActiveChapterIndex(chapterIndex);
    setCurrentChapterPage(page);
    closeDrawer();
  }, [closeDrawer]);

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
        totalChapters={chaptersWithPagination.length || 1}
        currentChapterIndex={activeChapterIndex}
        theme={theme}
        onThemeChange={setTheme}
        resumeNotice={resumeNotice}
        onRestart={() => {
          setActiveChapterIndex(0);
          setCurrentChapterPage(1);
          setResumeNotice(null);
        }}
        onDismissResume={() => setResumeNotice(null)}
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
      />

    </div>
  );
}
