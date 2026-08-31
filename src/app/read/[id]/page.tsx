'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBookContent } from '@/hooks/queries/useBookContent';
import { useBooks } from '@/hooks/queries/useBooks';
import { useReaderStore } from '@/stores/useReaderStore';
import {
  parseGutenbergChapters,
  getCharsPerPage,
  calculateVolumePageSpread,
  extractGutenbergHeaderMetadata,
  paginateChapterContent,
  type ChapterSection,
} from '@/lib/gutenberg-parser';
import { READER_THEMES } from '@/config/reader-themes';
import { ReaderHeader } from '@/components/reader/ReaderHeader';
import { ReaderFooter } from '@/components/reader/ReaderFooter';
import { ReaderTocDrawer } from '@/components/reader/ReaderTocDrawer';
import { ReaderControls } from '@/components/reader/ReaderControls';
import { ReaderSurface } from '@/components/reader/ReaderSurface';

export default function BookReaderPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params?.id;
  const bookId = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';
  const numericId = parseInt(bookId, 10) || 0;

  // Global Reader Store
  const currentBook = useReaderStore((s) => s.currentBook);
  const fontSize = useReaderStore((s) => s.fontSize);
  const lineHeight = useReaderStore((s) => s.lineHeight);
  const fontFamily = useReaderStore((s) => s.fontFamily);
  const theme = useReaderStore((s) => s.theme);
  const setFontSize = useReaderStore((s) => s.setFontSize);
  const setLineHeight = useReaderStore((s) => s.setLineHeight);
  const setFontFamily = useReaderStore((s) => s.setFontFamily);
  const setTheme = useReaderStore((s) => s.setTheme);
  const setProgress = useReaderStore((s) => s.setProgress);

  // Local Reader State
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [currentChapterPage, setCurrentChapterPage] = useState(1);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isControlsOpen, setIsControlsOpen] = useState(false);
  const [readingMode, setReadingMode] = useState<'paginated' | 'scroll'>('paginated');
  const [columnWidth, setColumnWidth] = useState<'narrow' | 'normal' | 'wide'>('wide');

  // Queries
  const { data: contentText, isLoading: isContentLoading, isError: isContentError, refetch } = useBookContent(undefined, numericId);
  const { data: booksData } = useBooks({ ids: numericId > 0 ? String(numericId) : '', page: 1, copyright: false });
  
  // Multi-tier metadata resolution: Client Store -> API Result -> Raw Gutenberg Header Extraction
  const extractedMeta = useMemo(() => {
    return extractGutenbergHeaderMetadata(contentText);
  }, [contentText]);

  const bookMeta = (currentBook?.id === numericId ? currentBook : undefined) || booksData?.results?.find((b) => b.id === numericId);
  const bookTitle = bookMeta?.title || extractedMeta.title || (numericId > 0 ? `Gutenberg Volume #${numericId}` : 'Public Domain Classic');
  const bookAuthor = bookMeta?.authors?.[0]?.name || extractedMeta.author || 'Classic Masterwork';

  // Parse Chapters and Volume Spread
  const rawChapters = useMemo<ChapterSection[]>(() => {
    return parseGutenbergChapters(contentText);
  }, [contentText]);

  const { chaptersWithPagination, totalVolumePages } = useMemo(() => {
    return calculateVolumePageSpread(rawChapters, fontSize);
  }, [rawChapters, fontSize]);

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
  const volumeProgress = Math.min(100, Math.max(0, (currentGlobalPage / totalVolumePages) * 100));

  // Sync Progress to Store
  useEffect(() => {
    if (numericId > 0 && totalVolumePages > 0) {
      setProgress(numericId, volumeProgress);
    }
  }, [numericId, volumeProgress, totalVolumePages, setProgress]);

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

  const activeTheme = READER_THEMES[theme] || READER_THEMES.light;

  return (
    <div className={`h-screen flex flex-col overflow-hidden select-none transition-colors duration-200 ${activeTheme.surface}`}>
      
      {/* Top Navigation & Toolbar */}
      <ReaderHeader
        title={bookTitle}
        author={bookAuthor}
        bookId={bookId}
        progress={volumeProgress}
        onBack={() => router.push('/')}
        isTocOpen={isTocOpen}
        onToggleToc={() => {
          setIsTocOpen((prev) => {
            if (!prev) setIsControlsOpen(false);
            return !prev;
          });
        }}
        isControlsOpen={isControlsOpen}
        onToggleControls={() => {
          setIsControlsOpen((prev) => {
            if (!prev) setIsTocOpen(false);
            return !prev;
          });
        }}
        totalChapters={chaptersWithPagination.length || 1}
        currentChapterIndex={activeChapterIndex}
        theme={theme}
        onThemeChange={setTheme}
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
        onClose={() => setIsControlsOpen(false)}
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
        onClose={() => setIsTocOpen(false)}
        chapters={chaptersWithPagination}
        activeChapterIndex={activeChapterIndex}
        onSelectChapter={handleSelectChapter}
        bookTitle={bookMeta?.title}
        theme={theme}
      />

    </div>
  );
}
