'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  X,
  Sun,
  Moon,
  Coffee,
  ZoomIn,
  ZoomOut,
  BookOpen,
  Bookmark,
  Clock,
  Sparkles,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useReaderStore, type ReaderFontFamily } from '@/stores/useReaderStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useBookContent } from '@/hooks/queries/useBookContent';
import { extractBookFormats } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export type ReaderWidth = 'compact' | 'comfortable' | 'wide';

export const BookReaderModal: React.FC = () => {
  const currentBook = useReaderStore((s) => s.currentBook);
  const isOpen = useReaderStore((s) => s.isOpen);
  const closeReader = useReaderStore((s) => s.closeReader);
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
  const isSaved = useBookshelfStore((s) => (currentBook ? s.isBookSaved(currentBook.id) : false));
  const toggleSave = useBookshelfStore((s) => s.toggleSaveBook);

  const [readerWidth, setReaderWidth] = useState<ReaderWidth>('comfortable');
  const [dropCap, setDropCap] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  const formats = currentBook ? extractBookFormats(currentBook.formats) : {};
  const { data: bookContent, isLoading } = useBookContent(formats.txt, currentBook?.id);

  // Track recent book & restore progress
  useEffect(() => {
    if (currentBook && isOpen) {
      addRecentBook(currentBook);
      const savedProgress = getProgress(currentBook.id);
      if (containerRef.current && savedProgress > 0) {
        const scrollTarget = (savedProgress / 100) * containerRef.current.scrollHeight;
        containerRef.current.scrollTop = scrollTarget;
      }
    }
  }, [currentBook, isOpen, addRecentBook, getProgress]);

  // Handle scroll progress
  const handleScroll = () => {
    if (!containerRef.current || !currentBook) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const totalScroll = scrollHeight - clientHeight;
    if (totalScroll > 0) {
      const pct = Math.round((scrollTop / totalScroll) * 100);
      setProgress(currentBook.id, pct);
    }
  };

  // Estimated reading time calculation (200 words per minute average reading speed)
  const readingStats = useMemo(() => {
    if (!bookContent) return { words: 0, minutes: 0 };
    const wordCount = bookContent.trim().split(/\s+/).length;
    const minutes = Math.max(1, Math.round(wordCount / 200));
    return { words: wordCount, minutes };
  }, [bookContent]);

  if (!isOpen || !currentBook) return null;

  const currentProgress = getProgress(currentBook.id);

  const themeStyles = {
    light: 'bg-[#faf8f5] text-[#1c1917]',
    dark: 'bg-[#121110] text-[#f5f5f4]',
    sepia: 'bg-[#f5eedb] text-[#3e2d1e]',
  };

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

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      data-testid="reader-modal"
    >
      {/* Pinned Bookmark Ribbon on Corner */}
      <button
        type="button"
        onClick={() => toggleSave(currentBook)}
        className={`absolute top-0 right-16 sm:right-24 z-30 w-7 h-10 rounded-b-md flex items-end justify-center pb-1.5 shadow-md transition-all ${
          isSaved
            ? 'bg-amber-600 dark:bg-amber-500 text-white translate-y-0'
            : 'bg-stone-300 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:translate-y-1'
        }`}
        aria-label={isSaved ? 'Bookmarked' : 'Add bookmark'}
      >
        <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
      </button>

      {/* Floating Minimalist Reader Toolbar */}
      <header className="w-full bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-b border-stone-200/90 dark:border-stone-800 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-sm z-20 transition-all">
        <div className="flex items-center gap-3 min-w-0">
          <BookOpen className="w-4 h-4 text-primary-600 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-serif font-bold text-stone-900 dark:text-stone-100 truncate">
              {currentBook.title}
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-stone-500 font-mono">
              <span className="truncate">
                {currentBook.authors.map((a) => a.name.split(',')[0]).join(', ') || 'Public Domain'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-stone-400" />
                ~{readingStats.minutes} min read
              </span>
              <span>•</span>
              <span>{currentProgress}% read</span>
            </div>
          </div>
        </div>

        {/* Reader Customization Settings */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* Font size */}
          <div className="flex items-center bg-stone-100 dark:bg-stone-800/90 rounded-lg p-0.5 border border-stone-200/80 dark:border-stone-700/80">
            <button
              type="button"
              onClick={() => setFontSize(Math.max(12, fontSize - 2))}
              className="p-1 hover:text-primary-600 rounded text-xs transition-colors"
              aria-label="Decrease font size"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[11px] font-mono font-medium">{fontSize}px</span>
            <button
              type="button"
              onClick={() => setFontSize(Math.min(36, fontSize + 2))}
              className="p-1 hover:text-primary-600 rounded text-xs transition-colors"
              aria-label="Increase font size"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Font family */}
          <div className="flex items-center bg-stone-100 dark:bg-stone-800/90 rounded-lg p-0.5 border border-stone-200/80 dark:border-stone-700/80 text-xs">
            {(['serif', 'sans', 'mono'] as ReaderFontFamily[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFontFamily(f)}
                className={`px-2 py-0.5 rounded capitalize font-medium text-[11px] transition-all ${
                  fontFamily === f
                    ? 'bg-white dark:bg-stone-700 text-primary-600 shadow-sm'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Width Presets */}
          <div className="hidden md:flex items-center bg-stone-100 dark:bg-stone-800/90 rounded-lg p-0.5 border border-stone-200/80 dark:border-stone-700/80 text-xs">
            <button
              type="button"
              onClick={() => setReaderWidth('compact')}
              className={`p-1 rounded transition-all ${readerWidth === 'compact' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-500'}`}
              aria-label="Compact margin"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setReaderWidth('comfortable')}
              className={`p-1 rounded transition-all ${readerWidth === 'comfortable' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-500'}`}
              aria-label="Comfortable margin"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Theme Switcher */}
          <div className="flex items-center bg-stone-100 dark:bg-stone-800/90 rounded-lg p-0.5 border border-stone-200/80 dark:border-stone-700/80">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`p-1 rounded transition-all ${
                theme === 'light' ? 'bg-white text-amber-600 shadow-sm' : 'text-stone-500'
              }`}
              aria-label="Light reader theme"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTheme('sepia')}
              className={`p-1 rounded transition-all ${
                theme === 'sepia' ? 'bg-[#f5eedb] text-[#753b14] shadow-sm' : 'text-stone-500'
              }`}
              aria-label="Sepia reader theme"
            >
              <Coffee className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-1 rounded transition-all ${
                theme === 'dark' ? 'bg-stone-950 text-amber-400 shadow-sm' : 'text-stone-500'
              }`}
              aria-label="Dark reader theme"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={closeReader}
            aria-label="Close reader"
            className="h-7 w-7 rounded-lg"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Reading Progress Indicator */}
      <div className="w-full bg-stone-200/80 dark:bg-stone-800 h-1 z-20">
        <div
          className="bg-primary-600 dark:bg-primary-500 h-full transition-all duration-150"
          style={{ width: `${currentProgress}%` }}
        />
      </div>

      {/* Reading Surface */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto p-6 sm:p-12 md:p-20 transition-colors duration-200 ${themeStyles[theme]}`}
        data-testid="reader-surface"
      >
        <div className={`${widthStyles[readerWidth]} mx-auto space-y-8`}>
          {/* Editorial Book Title Header */}
          <div className="text-center pb-10 border-b border-stone-300/40 dark:border-stone-800 space-y-3">
            <div className="inline-flex items-center gap-1 text-[11px] uppercase font-mono tracking-widest text-amber-700 dark:text-amber-400">
              <Sparkles className="w-3 h-3" /> Project Gutenberg Edition
            </div>
            <h1 className="font-serif text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
              {currentBook.title}
            </h1>
            <p className="font-serif italic text-sm sm:text-base opacity-80">
              By {currentBook.authors.map((a) => a.name.split(',').reverse().join(' ').trim()).join(', ') || 'Anonymous'}
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-4 animate-pulse py-12">
              <div className="h-4 bg-stone-300/50 dark:bg-stone-800 rounded w-full" />
              <div className="h-4 bg-stone-300/50 dark:bg-stone-800 rounded w-5/6" />
              <div className="h-4 bg-stone-300/50 dark:bg-stone-800 rounded w-4/5" />
              <div className="h-4 bg-stone-300/50 dark:bg-stone-800 rounded w-full" />
            </div>
          ) : (
            <article
              className={`whitespace-pre-wrap ${fontStyles[fontFamily]} ${
                dropCap ? 'reader-drop-cap' : ''
              } transition-all duration-150 leading-relaxed antialiased`}
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: lineHeight,
              }}
            >
              {bookContent}
            </article>
          )}

          {/* Reader Colophon End */}
          {!isLoading && bookContent && (
            <div className="pt-12 mt-12 border-t border-stone-300/40 dark:border-stone-800 text-center font-serif text-xs opacity-60">
              <p>❦ End of Public Domain Text ❦</p>
              <p className="font-mono text-[10px] mt-1">Free from copyright restrictions under CC0 / Gutenberg Public Domain.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
