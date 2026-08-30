'use client';

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Sun,
  Moon,
  Coffee,
  ZoomIn,
  ZoomOut,
  Bookmark,
  Clock,
  Sparkles,
  Maximize2,
  Minimize2,
  List,
  ChevronLeft,
  ChevronRight,
  Download,
  BookOpen,
  X,
  BookMarked,
  Scroll,
} from 'lucide-react';
import { useReaderStore, type ReaderFontFamily } from '@/stores/useReaderStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useBooks } from '@/hooks/queries/useBooks';
import { useBookContent } from '@/hooks/queries/useBookContent';
import { extractBookFormats } from '@/lib/utils';
import { DownloadDrawer } from '@/components/presentation/DownloadDrawer';
import type { GutendexBook } from '@/mocks/handlers';

export type ReaderWidth = 'compact' | 'comfortable' | 'wide';
export type ReadingMode = 'paginated' | 'scroll';

export interface ChapterSection {
  id: number;
  title: string;
  displayTitle: string;
  content: string;
  startPageNumber: number;
  pageCount: number;
}

export interface BookPage {
  globalPageNumber: number;
  chapterIndex: number;
  chapterTitle: string;
  displayTitle: string;
  pageInChapter: number;
  totalPagesInChapter: number;
  content: string;
}

/**
 * Intelligent Gutenberg Chapter & Section Parser
 * Detects real chapter bodies while distinguishing and preserving front-matter
 * Table of Contents (TOC) lists, prefaces, extracts, and closing license matter.
 */
export function parseGutenbergChapters(rawText: string | undefined | null): ChapterSection[] {
  if (!rawText) return [];
  const text = rawText.replace(/\r\n/g, '\n');

  // 1. Separate Gutenberg Start and End markers if present
  const startMarkerRegex = /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\*]*\*\*\*/i;
  const endMarkerRegex = /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\*]*\*\*\*/i;

  const startMatch = startMarkerRegex.exec(text);
  const endMatch = endMarkerRegex.exec(text);

  const bodyStart = startMatch ? startMatch.index + startMatch[0].length : 0;
  const bodyEnd = endMatch ? endMatch.index : text.length;

  const preBody = text.slice(0, bodyStart);
  const mainBody = text.slice(bodyStart, bodyEnd);
  const postBody = text.slice(bodyEnd);

  // 2. Identify candidate chapter / major headings in mainBody
  const headingRegex = /(?:^|\n\n)(?:(?:CHAPTER|Chapter|BOOK|Book|ACT|Act|SCENE|Scene|CANTO|Canto|PART|Part)\s+([IVXLCDM\d]+[^\n]*)|(?:ETYMOLOGY|EXTRACTS|PREFACE|PROLOGUE|EPILOGUE|INTRODUCTION)\b[^\n]*)/g;
  const tocMatch = /(?:^|\n\n)(?:CONTENTS|TABLE OF CONTENTS|INDEX)\b/i.exec(mainBody);

  const rawMatches: { index: number; title: string; bodyLength: number }[] = [];
  let m: RegExpExecArray | null;

  while ((m = headingRegex.exec(mainBody)) !== null) {
    rawMatches.push({
      index: m.index,
      title: m[0].trim(),
      bodyLength: 0,
    });
  }

  // Calculate distance to next heading
  for (let i = 0; i < rawMatches.length; i++) {
    const start = rawMatches[i].index;
    const end = i + 1 < rawMatches.length ? rawMatches[i + 1].index : mainBody.length;
    rawMatches[i].bodyLength = end - start;
  }

  // 3. Filter out Front-Matter Table of Contents lines
  const validMatches: { index: number; title: string }[] = [];
  for (let i = 0; i < rawMatches.length; i++) {
    const item = rawMatches[i];
    const prevItem = rawMatches[i - 1];
    const nextItem = rawMatches[i + 1];

    const isVeryShort = item.bodyLength < 180;
    const isInsideTOCCluster = (prevItem && prevItem.bodyLength < 180) || (nextItem && nextItem.bodyLength < 180);

    if (
      isVeryShort ||
      (isInsideTOCCluster &&
        tocMatch &&
        item.index < tocMatch.index + 9000 &&
        item.bodyLength < 25000 &&
        rawMatches.some(
          (other, idx) => idx > i && other.title.toLowerCase().slice(0, 10) === item.title.toLowerCase().slice(0, 10)
        ))
    ) {
      continue;
    }

    validMatches.push(item);
  }

  const sections: ChapterSection[] = [];

  // Preamble / Front Matter section
  const firstChapterIndex = validMatches.length > 0 ? validMatches[0].index : mainBody.length;
  const preambleContent = (preBody + mainBody.slice(0, firstChapterIndex)).trim();
  if (preambleContent.length > 0) {
    sections.push({
      id: 0,
      title: 'Title & Preamble',
      displayTitle: 'Title & Preamble',
      content: preambleContent,
      startPageNumber: 1,
      pageCount: 1,
    });
  }

  // Main story chapters
  for (let i = 0; i < validMatches.length; i++) {
    const start = validMatches[i].index;
    const end = i + 1 < validMatches.length ? validMatches[i + 1].index : mainBody.length;
    const rawTitle = validMatches[i].title;
    const cleanDisplayTitle = rawTitle.replace(/[\]\[]/g, '').trim();

    sections.push({
      id: sections.length,
      title: rawTitle,
      displayTitle: cleanDisplayTitle,
      content: mainBody.slice(start, end).trim(),
      startPageNumber: 1,
      pageCount: 1,
    });
  }

  // Legal End-Matter
  if (postBody.trim().length > 0) {
    sections.push({
      id: sections.length,
      title: 'Gutenberg License & Information',
      displayTitle: 'Gutenberg License & Information',
      content: postBody.trim(),
      startPageNumber: 1,
      pageCount: 1,
    });
  }

  return sections.length > 0
    ? sections
    : [
        {
          id: 0,
          title: 'Complete Text',
          displayTitle: 'Complete Text',
          content: text,
          startPageNumber: 1,
          pageCount: 1,
        },
      ];
}

export default function ReaderPage() {
  const params = useParams();
  const bookIdStr = Array.isArray(params.id) ? params.id[0] : params.id;
  const bookId = bookIdStr ? parseInt(bookIdStr, 10) : NaN;

  // Global store states
  const fontSize = useReaderStore((s) => s.fontSize);
  const setFontSize = useReaderStore((s) => s.setFontSize);
  const lineHeight = useReaderStore((s) => s.lineHeight);
  const fontFamily = useReaderStore((s) => s.fontFamily);
  const setFontFamily = useReaderStore((s) => s.setFontFamily);
  const theme = useReaderStore((s) => s.theme);
  const setTheme = useReaderStore((s) => s.setTheme);
  const setProgress = useReaderStore((s) => s.setProgress);
  const getProgress = useReaderStore((s) => s.getProgress);
  const addRecentBook = useBookshelfStore((s) => s.addRecentBook);
  const isSaved = useBookshelfStore((s) => (!isNaN(bookId) ? s.isBookSaved(bookId) : false));
  const toggleSave = useBookshelfStore((s) => s.toggleSaveBook);
  const savedBooks = useBookshelfStore((s) => s.savedBooks);

  // Local reader states
  const [readerWidth, setReaderWidth] = useState<ReaderWidth>('comfortable');
  const [readingMode, setReadingMode] = useState<ReadingMode>('paginated');
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [globalPage, setGlobalPage] = useState(1);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch book metadata if not already in local bookshelf
  const cachedBook = savedBooks.find((b) => b.id === bookId);
  const { data: booksData } = useBooks(
    !cachedBook && !isNaN(bookId) ? { ids: bookId } : {}
  );
  const currentBook: GutendexBook | undefined =
    cachedBook || booksData?.results?.find((b) => b.id === bookId) || booksData?.results?.[0];

  const formats = currentBook ? extractBookFormats(currentBook.formats) : {};
  const { data: rawBookContent } = useBookContent(
    formats.txt,
    !isNaN(bookId) ? bookId : currentBook?.id
  );

  // Derive title and author
  const displayTitle = useMemo(() => {
    if (currentBook?.title) return currentBook.title;
    if (rawBookContent) {
      const match = rawBookContent.slice(0, 500).match(/Title:\s*([^\r\n]+)/i);
      if (match) return match[1].trim();
    }
    return `Public Domain Volume #${bookId || ''}`;
  }, [currentBook, rawBookContent, bookId]);

  const displayAuthor = useMemo(() => {
    if (currentBook?.authors?.length) {
      return currentBook.authors.map((a) => a.name.split(',')[0]).join(', ');
    }
    if (rawBookContent) {
      const match = rawBookContent.slice(0, 500).match(/Author:\s*([^\r\n]+)/i);
      if (match) return match[1].trim();
    }
    return 'Public Domain';
  }, [currentBook, rawBookContent]);

  // Segment chapters using smart Gutenberg parser
  const rawChapters = useMemo(() => {
    return parseGutenbergChapters(rawBookContent);
  }, [rawBookContent]);

  // Comprehensive Book-Wide Pagination Matrix (All chapters paginated across entire book)
  const { chapters, allPages } = useMemo(() => {
    if (!rawChapters || rawChapters.length === 0) {
      return { chapters: [], allPages: [] };
    }

    const wordsPerPage = Math.max(140, Math.round(5600 / fontSize));
    const processedChapters: ChapterSection[] = [];
    const generatedPages: BookPage[] = [];

    for (let cIdx = 0; cIdx < rawChapters.length; cIdx++) {
      const ch = rawChapters[cIdx];
      const normalized = ch.content.replace(/\r\n/g, '\n');
      const paragraphs = normalized.split(/\n{2,}/);

      const chPages: string[] = [];
      let currentWords: string[] = [];
      let count = 0;

      for (const para of paragraphs) {
        const words = para.trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) continue;

        if (count + words.length > wordsPerPage && currentWords.length > 0) {
          chPages.push(currentWords.join('\n\n'));
          currentWords = [para.trim()];
          count = words.length;
        } else {
          currentWords.push(para.trim());
          count += words.length;
        }
      }

      if (currentWords.length > 0) {
        chPages.push(currentWords.join('\n\n'));
      }

      const finalChPages = chPages.length > 0 ? chPages : [ch.content];
      const startPageNumber = generatedPages.length + 1;

      processedChapters.push({
        ...ch,
        startPageNumber,
        pageCount: finalChPages.length,
      });

      for (let pIdx = 0; pIdx < finalChPages.length; pIdx++) {
        generatedPages.push({
          globalPageNumber: generatedPages.length + 1,
          chapterIndex: cIdx,
          chapterTitle: ch.title,
          displayTitle: ch.displayTitle,
          pageInChapter: pIdx + 1,
          totalPagesInChapter: finalChPages.length,
          content: finalChPages[pIdx],
        });
      }
    }

    return { chapters: processedChapters, allPages: generatedPages };
  }, [rawChapters, fontSize]);

  const totalBookPages = allPages.length;

  // Active page & chapter determination
  const activePage: BookPage | undefined = allPages[globalPage - 1] || allPages[0];
  const activeChapter = chapters[activePage?.chapterIndex ?? currentChapterIndex] || chapters[0];

  // Track recent book & restore saved reading progress
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (currentBook && totalBookPages > 0 && !hasRestoredRef.current) {
      hasRestoredRef.current = true;
      addRecentBook(currentBook);
      const savedProgress = getProgress(currentBook.id);
      if (savedProgress > 0) {
        if (readingMode === 'paginated') {
          const targetPage = Math.max(1, Math.min(totalBookPages, Math.round((savedProgress / 100) * totalBookPages)));
          requestAnimationFrame(() => {
            setGlobalPage(targetPage);
          });
        } else if (containerRef.current) {
          const scrollTarget = (savedProgress / 100) * containerRef.current.scrollHeight;
          containerRef.current.scrollTop = scrollTarget;
        }
      }
    }
  }, [currentBook, totalBookPages, addRecentBook, getProgress, readingMode]);

  // Sync reading progress percentage in paginated mode
  useEffect(() => {
    if (readingMode === 'paginated' && currentBook && totalBookPages > 0) {
      const pct = Math.min(100, Math.max(1, Math.round((globalPage / totalBookPages) * 100)));
      setProgress(currentBook.id, pct);
    }
  }, [globalPage, totalBookPages, readingMode, currentBook, setProgress]);

  // Handle scroll progress in scroll mode
  const handleScroll = () => {
    if (readingMode !== 'scroll' || !containerRef.current || !currentBook) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const totalScroll = scrollHeight - clientHeight;
    if (totalScroll > 0) {
      const pct = Math.round((scrollTop / totalScroll) * 100);
      setProgress(currentBook.id, pct);
    }
  };

  // Seamless Book-Wide Page Flipping
  const handleNextPage = useCallback(() => {
    if (globalPage < totalBookPages) {
      setGlobalPage((p) => p + 1);
      if (containerRef.current) containerRef.current.scrollTop = 0;
    }
  }, [globalPage, totalBookPages]);

  const handlePrevPage = useCallback(() => {
    if (globalPage > 1) {
      setGlobalPage((p) => p - 1);
      if (containerRef.current) containerRef.current.scrollTop = 0;
    }
  }, [globalPage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readingMode !== 'paginated') return;
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
  }, [readingMode, handleNextPage, handlePrevPage]);

  // Estimated reading time
  const readingStats = useMemo(() => {
    if (!rawBookContent) return { words: 0, minutes: 0 };
    const wordCount = rawBookContent.trim().split(/\s+/).length;
    const minutes = Math.max(1, Math.round(wordCount / 200));
    return { words: wordCount, minutes };
  }, [rawBookContent]);

  const handleSelectChapter = (chapterIndex: number) => {
    const targetChapter = chapters[chapterIndex];
    if (targetChapter) {
      setGlobalPage(targetChapter.startPageNumber);
      setCurrentChapterIndex(chapterIndex);
      setIsTocOpen(false);
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
      }
    }
  };

  // Cohesive full-theme style matrix for reading surface, headers, controls, and scrollbars
  const themeStyles = {
    light: {
      surface: 'bg-[#fcfbf9] text-[#1a1a1a]',
      header: 'bg-[#fcfbf9]/95 text-[#1a1a1a] border-stone-200/90 shadow-xs',
      pill: 'bg-stone-100 border-stone-200/90 text-stone-700',
      activePill: 'bg-white text-primary-600 shadow-xs font-bold',
      inactivePill: 'text-stone-600 hover:text-stone-900',
      button: 'bg-stone-50 border-stone-200/90 text-stone-700 hover:text-primary-600',
      border: 'border-stone-200/90',
      textMuted: 'text-stone-500',
      progressTrack: 'bg-stone-200/80',
      progressBar: 'bg-primary-600',
      drawerBg: 'bg-white border-stone-200 text-stone-900',
      drawerActive: 'bg-primary-50 text-primary-700 border-primary-500/40',
      drawerHover: 'hover:bg-stone-100 text-stone-700',
      scrollbarClass: 'reader-surface-light',
    },
    sepia: {
      surface: 'bg-[#f4ebd9] text-[#2c1d11]',
      header: 'bg-[#ede2cc]/95 text-[#2c1d11] border-[#d4c19c] shadow-xs',
      pill: 'bg-[#e2d3b7] border-[#ccb893] text-[#3f2b1c]',
      activePill: 'bg-[#f5eedb] text-[#78350f] shadow-xs font-bold',
      inactivePill: 'text-[#4e3624] hover:text-[#2c1d11]',
      button: 'bg-[#e2d3b7] border-[#ccb893] text-[#3f2b1c] hover:text-[#78350f]',
      border: 'border-[#ccb893]',
      textMuted: 'text-[#6e533c]',
      progressTrack: 'bg-[#d8c5a0]',
      progressBar: 'bg-[#854d0e]',
      drawerBg: 'bg-[#f4ebd9] border-[#ccb893] text-[#2c1d11]',
      drawerActive: 'bg-[#e8d7b9] text-[#78350f] border-[#b4986b]',
      drawerHover: 'hover:bg-[#eadecb] text-[#3f2b1c]',
      scrollbarClass: 'reader-surface-sepia',
    },
    dark: {
      surface: 'bg-[#0c0e12] text-[#e2e8f0]',
      header: 'bg-[#0c0e12]/95 text-[#e2e8f0] border-stone-800 shadow-xs',
      pill: 'bg-stone-900/90 border-stone-800 text-stone-300',
      activePill: 'bg-stone-800 text-primary-400 shadow-xs font-bold',
      inactivePill: 'text-stone-400 hover:text-stone-200',
      button: 'bg-stone-900 border-stone-800 text-stone-300 hover:text-primary-400',
      border: 'border-stone-800',
      textMuted: 'text-stone-400',
      progressTrack: 'bg-stone-800',
      progressBar: 'bg-primary-500',
      drawerBg: 'bg-[#0e1117] border-stone-800 text-stone-100',
      drawerActive: 'bg-stone-800/80 text-primary-400 border-primary-500/40',
      drawerHover: 'hover:bg-stone-800 text-stone-300',
      scrollbarClass: 'reader-surface-dark',
    },
  };

  const activeTheme = themeStyles[theme];

  const fontStyles = {
    serif: 'font-serif',
    sans: 'font-sans',
    mono: 'font-mono',
  };

  const widthStyles: Record<ReaderWidth, string> = {
    compact: 'max-w-xl',
    comfortable: 'max-w-3xl',
    wide: 'max-w-5xl',
  };

  const currentProgress = currentBook ? getProgress(currentBook.id) : 0;
  const isContentReady = Boolean(rawBookContent) && allPages.length > 0;

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${activeTheme.surface} transition-colors duration-200`}>
      {/* Top Floating Editorial Reader Toolbar (Inherits Active Theme) */}
      <header className={`shrink-0 z-40 w-full backdrop-blur-xl ${activeTheme.header} border-b px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 transition-colors duration-200`}>
        {/* Left Side: Back to Library & Book Title */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${activeTheme.button} text-xs font-mono font-bold uppercase transition-all shadow-xs`}
            aria-label="Back to Library"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Library</span>
          </Link>

          <div className={`h-4 w-[1px] ${activeTheme.border} bg-current opacity-20`} />

          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-serif font-bold truncate max-w-xs sm:max-w-md">
              {displayTitle}
            </h1>
            <div className={`flex items-center gap-2 text-[11px] font-mono ${activeTheme.textMuted}`}>
              <span className="truncate">
                {displayAuthor}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 opacity-70" />
                ~{readingStats.minutes} min
              </span>
              <span>•</span>
              <span>{currentProgress}% read</span>
            </div>
          </div>
        </div>

        {/* Right Side: Font Size, Mode, Typography & Themes */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap ml-auto">
          {/* Table of Contents Trigger */}
          {chapters.length > 1 && (
            <button
              type="button"
              onClick={() => setIsTocOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${activeTheme.button} text-xs font-mono font-bold transition-all shadow-xs`}
              aria-label="Table of Contents"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Chapters</span>
              <span className="text-[10px] opacity-60">({(activePage?.chapterIndex ?? 0) + 1}/{chapters.length})</span>
            </button>
          )}

          {/* Reading Mode Switcher (Pages vs Continuous Scroll) */}
          <div className={`flex items-center rounded-lg p-0.5 border ${activeTheme.pill} text-xs transition-colors`}>
            <button
              type="button"
              onClick={() => setReadingMode('paginated')}
              className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] font-mono transition-all ${
                readingMode === 'paginated'
                  ? activeTheme.activePill
                  : activeTheme.inactivePill
              }`}
              title="Simulated Book Pages (Flip Mode)"
              aria-label="Book Pages Mode"
            >
              <BookMarked className="w-3 h-3" />
              <span className="hidden sm:inline">Pages</span>
            </button>
            <button
              type="button"
              onClick={() => setReadingMode('scroll')}
              className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] font-mono transition-all ${
                readingMode === 'scroll'
                  ? activeTheme.activePill
                  : activeTheme.inactivePill
              }`}
              title="Continuous Scroll Mode"
              aria-label="Scroll Mode"
            >
              <Scroll className="w-3 h-3" />
              <span className="hidden sm:inline">Scroll</span>
            </button>
          </div>

          {/* Top Bar Font Size Control */}
          <div className={`flex items-center rounded-lg p-0.5 border ${activeTheme.pill} text-xs transition-colors`}>
            <button
              type="button"
              onClick={() => setFontSize(Math.max(12, fontSize - 2))}
              className="p-1 hover:opacity-100 opacity-70 rounded transition-opacity"
              aria-label="Decrease font size"
              title="Decrease Font Size"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-[11px] font-mono font-bold">
              {fontSize}px
            </span>
            <button
              type="button"
              onClick={() => setFontSize(Math.min(36, fontSize + 2))}
              className="p-1 hover:opacity-100 opacity-70 rounded transition-opacity"
              aria-label="Increase font size"
              title="Increase Font Size"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Typography Family Switcher */}
          <div className={`hidden sm:flex items-center rounded-lg p-0.5 border ${activeTheme.pill} text-xs transition-colors`}>
            {(['serif', 'sans', 'mono'] as ReaderFontFamily[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFontFamily(f)}
                className={`px-2 py-0.5 rounded capitalize font-medium text-[11px] transition-all ${
                  fontFamily === f
                    ? activeTheme.activePill
                    : activeTheme.inactivePill
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Reading Width Presets */}
          <div className={`hidden lg:flex items-center rounded-lg p-0.5 border ${activeTheme.pill} text-xs transition-colors`}>
            <button
              type="button"
              onClick={() => setReaderWidth('compact')}
              className={`p-1.5 rounded transition-all ${readerWidth === 'compact' ? activeTheme.activePill : activeTheme.inactivePill}`}
              aria-label="Compact margin"
              title="Compact Width"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setReaderWidth('comfortable')}
              className={`p-1.5 rounded transition-all ${readerWidth === 'comfortable' ? activeTheme.activePill : activeTheme.inactivePill}`}
              aria-label="Comfortable margin"
              title="Comfortable Width"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Theme Switcher */}
          <div className={`flex items-center rounded-lg p-0.5 border ${activeTheme.pill} transition-colors`}>
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`p-1.5 rounded transition-all ${
                theme === 'light' ? 'bg-white text-amber-600 shadow-xs' : activeTheme.inactivePill
              }`}
              aria-label="Light reader theme"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTheme('sepia')}
              className={`p-1.5 rounded transition-all ${
                theme === 'sepia' ? 'bg-[#f4ebd9] text-[#78350f] shadow-xs' : activeTheme.inactivePill
              }`}
              aria-label="Sepia reader theme"
            >
              <Coffee className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-1.5 rounded transition-all ${
                theme === 'dark' ? 'bg-stone-950 text-amber-400 shadow-xs' : activeTheme.inactivePill
              }`}
              aria-label="Dark reader theme"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bookmark Button */}
          {currentBook && (
            <button
              type="button"
              onClick={() => toggleSave(currentBook)}
              className={`p-2 rounded-lg border transition-all ${
                isSaved
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : `${activeTheme.button} ${activeTheme.textMuted} hover:text-amber-600`
              }`}
              aria-label={isSaved ? 'Remove Bookmark' : 'Add Bookmark'}
              title={isSaved ? 'Bookmarked to Shelf' : 'Bookmark to Shelf'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
            </button>
          )}

          {/* Download Drawer Trigger */}
          {currentBook && (
            <button
              type="button"
              onClick={() => setIsDownloadOpen(true)}
              className={`p-2 rounded-lg border transition-all ${activeTheme.button} ${activeTheme.textMuted} hover:text-primary-600 dark:hover:text-primary-400 shadow-xs`}
              aria-label="Download formats"
              title="Download Formats"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Top Reading Progress Bar */}
      <div className={`sticky top-[53px] z-30 w-full ${activeTheme.progressTrack} h-1`}>
        <div
          className={`${activeTheme.progressBar} h-full transition-all duration-150`}
          style={{ width: `${currentProgress}%` }}
        />
      </div>

      {/* Main Reading Surface */}
      <main
        ref={containerRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-scroll [scrollbar-gutter:stable] px-4 sm:px-8 md:px-16 pt-8 pb-20 flex flex-col justify-between ${activeTheme.scrollbarClass}`}
        data-testid="reader-surface"
      >
        <div className={`${widthStyles[readerWidth]} mx-auto w-full space-y-6 flex-1`}>
          
          {/* Top Book / Chapter Header */}
          <div>
            {globalPage === 1 && (
              <div className={`text-center pb-8 border-b ${activeTheme.border} space-y-2 mb-6 opacity-95`}>
                <div className="inline-flex items-center gap-1 text-[11px] uppercase font-mono tracking-widest font-bold opacity-80">
                  <Sparkles className="w-3 h-3" /> Project Gutenberg Public Domain Edition
                </div>
                <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
                  {displayTitle}
                </h1>
                <p className="font-serif italic text-base sm:text-lg opacity-80">
                  By {displayAuthor}
                </p>
              </div>
            )}

            {/* Chapter Header Indicator */}
            {chapters.length > 1 && (
              <div className={`flex items-center justify-between pb-4 mb-4 border-b ${activeTheme.border} text-xs font-mono opacity-80`}>
                <span className="uppercase tracking-wider font-bold">
                  {activePage?.displayTitle || activeChapter?.displayTitle}
                </span>
                {readingMode === 'paginated' && activePage && (
                  <span className={`text-[11px] px-2 py-0.5 rounded border ${activeTheme.pill}`}>
                    Chapter Page {activePage.pageInChapter} of {activePage.totalPagesInChapter}
                  </span>
                )}
              </div>
            )}

            {/* Book Content Rendering Area */}
            {!isContentReady ? (
              <div className="space-y-4 animate-pulse py-16 opacity-40">
                <div className="h-4 bg-current rounded w-full" />
                <div className="h-4 bg-current rounded w-5/6" />
                <div className="h-4 bg-current rounded w-4/5" />
                <div className="h-4 bg-current rounded w-full" />
                <div className="h-4 bg-current rounded w-3/4" />
              </div>
            ) : (
              <article
                className={`whitespace-pre-wrap ${fontStyles[fontFamily]} transition-all duration-150 leading-relaxed antialiased min-h-[420px]`}
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: lineHeight,
                }}
              >
                {readingMode === 'paginated'
                  ? activePage?.content || 'Page content unavailable.'
                  : activeChapter?.content || 'No text content available.'}
              </article>
            )}
          </div>
        </div>
      </main>

      {/* Thin Fixed / Sticky Editorial Bottom Pagination Footer Bar */}
      {isContentReady && (
        <footer className={`shrink-0 z-40 w-full backdrop-blur-xl ${activeTheme.header} border-t px-4 sm:px-8 py-2 flex items-center justify-between font-mono text-xs select-none shadow-sm transition-colors duration-200`}>
          {readingMode === 'paginated' ? (
            <div className="max-w-5xl mx-auto w-full flex items-center justify-between gap-4">
              {/* Prev Page Button */}
              <button
                type="button"
                disabled={globalPage <= 1}
                onClick={handlePrevPage}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${activeTheme.button} font-bold transition-all shadow-xs disabled:opacity-30 disabled:pointer-events-none`}
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Previous Page</span>
                <span className="sm:hidden">Prev</span>
              </button>

              {/* Book-Wide Global Page Jump / Position Indicator */}
              <div className="flex items-center gap-2">
                <span className={`${activeTheme.textMuted} hidden sm:inline`}>Page</span>
                <input
                  type="number"
                  min={1}
                  max={totalBookPages}
                  value={globalPage}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 1 && val <= totalBookPages) {
                      setGlobalPage(val);
                    }
                  }}
                  className={`w-14 text-center py-1 rounded-md border ${activeTheme.border} bg-transparent font-bold focus:outline-none focus:ring-1 focus:ring-primary-500`}
                  aria-label="Current Page Number"
                />
                <span className={activeTheme.textMuted}>of {totalBookPages}</span>
                <span className="hidden md:inline text-[10px] opacity-50 ml-2">
                  • ❦ Public Domain ❦
                </span>
              </div>

              {/* Next Page Button */}
              <button
                type="button"
                disabled={globalPage >= totalBookPages}
                onClick={handleNextPage}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold bg-primary-600 hover:bg-primary-700 text-white shadow-xs transition-all disabled:opacity-30 disabled:pointer-events-none"
                aria-label="Next Page"
              >
                <span className="hidden sm:inline">Next Page</span>
                <span className="sm:hidden">Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Continuous Scroll Mode Chapter Navigation */
            chapters.length > 1 && (
              <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
                <button
                  type="button"
                  disabled={currentChapterIndex === 0}
                  onClick={() => handleSelectChapter(currentChapterIndex - 1)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${activeTheme.button} font-bold transition-all shadow-xs disabled:opacity-30 disabled:pointer-events-none`}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Prev Chapter</span>
                  <span className="sm:hidden">Prev</span>
                </button>

                <span className={`font-bold ${activeTheme.textMuted}`}>
                  Chapter {currentChapterIndex + 1} of {chapters.length}
                </span>

                <button
                  type="button"
                  disabled={currentChapterIndex === chapters.length - 1}
                  onClick={() => handleSelectChapter(currentChapterIndex + 1)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${activeTheme.button} font-bold transition-all shadow-xs disabled:opacity-30 disabled:pointer-events-none`}
                >
                  <span className="hidden sm:inline">Next Chapter</span>
                  <span className="sm:hidden">Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          )}
        </footer>
      )}

      {/* Table of Contents Slide-Over Drawer (Inherits Active Theme) */}
      {isTocOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className={`w-full max-w-sm h-full ${activeTheme.drawerBg} border-l flex flex-col p-6 shadow-2xl animate-in slide-in-from-right duration-200 ${activeTheme.scrollbarClass}`}>
            <div className={`flex items-center justify-between pb-4 border-b ${activeTheme.border}`}>
              <div className="flex items-center gap-2 font-serif font-bold text-lg">
                <BookOpen className="w-5 h-5 opacity-80" />
                <span>Table of Contents</span>
              </div>
              <button
                type="button"
                onClick={() => setIsTocOpen(false)}
                className="p-1 rounded-lg hover:opacity-80 opacity-60 transition-opacity"
                aria-label="Close Table of Contents"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-1.5 font-mono text-xs">
              {chapters.map((ch, idx) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => handleSelectChapter(idx)}
                  className={`w-full text-left p-2.5 rounded-lg transition-all flex items-center justify-between ${
                    (activePage?.chapterIndex ?? currentChapterIndex) === idx
                      ? `${activeTheme.drawerActive} font-bold border`
                      : activeTheme.drawerHover
                  }`}
                >
                  <span className="truncate pr-2">{ch.displayTitle || ch.title}</span>
                  <span className="text-[10px] opacity-60 px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 font-mono">
                    p. {ch.startPageNumber}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Download Drawer Modal */}
      {currentBook && (
        <DownloadDrawer
          book={currentBook}
          isOpen={isDownloadOpen}
          onClose={() => setIsDownloadOpen(false)}
        />
      )}
    </div>
  );
}
