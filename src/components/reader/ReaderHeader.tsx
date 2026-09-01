'use client';

import React, { useState } from 'react';
import { ArrowLeft, BookOpen, ExternalLink, Info, List, Sliders, Sparkles, Sun, Moon, Coffee, ShieldCheck, X } from 'lucide-react';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { getReaderTheme } from '@/config/reader-themes';
import { FEATURED_HERO_BOOKS } from '@/config/featured-books';
import { isPlaceholderAuthor } from '@/lib/book-metadata';

export interface ResumeNoticeData {
  chapterTitle: string;
  page: number;
}

export interface ReaderHeaderProps {
  title: string;
  author: string;
  bookId: string | number;
  progress: number;
  onBack: () => void;
  isTocOpen: boolean;
  onToggleToc: () => void;
  isControlsOpen: boolean;
  onToggleControls: () => void;
  theme?: ReaderTheme;
  totalChapters?: number;
  currentChapterIndex?: number;
  onThemeChange?: (theme: ReaderTheme) => void;
  resumeNotice?: ResumeNoticeData | null;
  onRestart?: () => void;
  onDismissResume?: () => void;
}

export const ReaderHeader: React.FC<ReaderHeaderProps> = ({
  title,
  author,
  bookId,
  progress,
  onBack,
  isTocOpen,
  onToggleToc,
  isControlsOpen,
  onToggleControls,
  theme = 'light',
  totalChapters = 1,
  currentChapterIndex = 0,
  onThemeChange,
  resumeNotice,
  onRestart,
  onDismissResume,
}) => {
  const [isInfoCardOpen, setIsInfoCardOpen] = useState(false);
  const activeTheme = getReaderTheme(theme);

  const numericId = typeof bookId === 'number' ? bookId : parseInt(String(bookId), 10);
  const featuredFixture = !isNaN(numericId) && numericId > 0
    ? FEATURED_HERO_BOOKS.find((f) => f.id === numericId)
    : undefined;

  const displayTitle = (
    title ||
    featuredFixture?.title ||
    (bookId ? `Volume #${bookId}` : 'Public Domain Classic')
  )
    .replace(/\s+/g, ' ')
    .trim();

  const resolvedAuthor = (!isPlaceholderAuthor(author) ? author : '') || featuredFixture?.author || '';
  const displayAuthor = resolvedAuthor.replace(/\s+/g, ' ').trim();

  return (
    <>
      <header
        className={`sticky top-0 z-30 shrink-0 border-b transition-colors duration-200 ${activeTheme.header}`}
      >
        {/* Main Header Bar: Title, Author, Navigation & Global Controls */}
        <div className="w-full px-4 sm:px-6 md:px-8 py-3 sm:py-3.5 min-h-[3.75rem] sm:min-h-[4rem] flex items-center justify-between gap-3 sm:gap-4">
          
          {/* Left: Back Button & Book Title / Author */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={onBack}
              className={`p-2 rounded-lg border shrink-0 transition-all cursor-pointer active:scale-95 shadow-2xs ${activeTheme.button}`}
              aria-label="Back to Catalog"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="min-w-0 flex-1 flex flex-col justify-center overflow-hidden">
              <h1
                className="text-sm sm:text-base font-serif font-bold truncate text-foreground leading-tight"
                title={displayTitle}
              >
                {displayTitle}
              </h1>
              {displayAuthor && (
                <span className={`text-xs font-mono truncate ${activeTheme.textMuted}`} title={displayAuthor}>
                  by {displayAuthor}
                </span>
              )}
            </div>
          </div>

          {/* Right: Contents Drawer, Typography Controls & Outermost Theme Switcher */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            
            {/* Table of Contents Drawer Toggle */}
            <button
              type="button"
              onClick={onToggleToc}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer active:scale-95 ${
                isTocOpen ? activeTheme.activePill : activeTheme.button
              }`}
              aria-label="Table of Contents"
              aria-expanded={isTocOpen}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Contents</span>
              {totalChapters > 1 && (
                <span className="text-[10px] opacity-70">
                  ({currentChapterIndex + 1}/{totalChapters})
                </span>
              )}
            </button>

            {/* Detailed Typography & Appearance Controls Popover */}
            <button
              type="button"
              onClick={onToggleControls}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer active:scale-95 ${
                isControlsOpen ? activeTheme.activePill : activeTheme.button
              }`}
              aria-label="Typography & Theme Controls"
              aria-expanded={isControlsOpen}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Aa</span>
            </button>

            {/* 3-Way Universal Theme Switcher (Light -> Sepia -> Dark) matching Navbar */}
            {onThemeChange && (
              <button
                type="button"
                onClick={() => {
                  if (theme === 'light') onThemeChange('sepia');
                  else if (theme === 'sepia') onThemeChange('dark');
                  else onThemeChange('light');
                }}
                aria-label={`Current theme: ${theme}. Click to switch theme.`}
                title={`Current theme: ${theme === 'light' ? 'Light' : theme === 'sepia' ? 'Sepia' : 'Dark'}. Click to cycle theme.`}
                className={`p-2 rounded-lg border shrink-0 transition-all cursor-pointer active:scale-95 shadow-2xs ${activeTheme.button}`}
              >
                {theme === 'light' ? (
                  <Sun className="w-4 h-4 text-amber-500" />
                ) : theme === 'sepia' ? (
                  <Coffee className="w-4 h-4 text-amber-500" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-400" />
                )}
              </button>
            )}

          </div>

        </div>

        {/* Sub-Header Ribbon: Integrated Resume Notice or Default Metadata Ribbon */}
        {resumeNotice ? (
          <div
            role="status"
            aria-live="polite"
            data-testid="resume-notice"
            className="w-full px-4 sm:px-6 md:px-8 py-2 border-t border-primary-500/30 flex items-center justify-between gap-3 text-xs font-mono bg-primary-500/10 text-foreground animate-in fade-in slide-in-from-top-1 duration-200"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse shrink-0" />
              <span className="truncate font-medium">
                Resumed at {resumeNotice.chapterTitle}, Page {resumeNotice.page}
              </span>
            </div>
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              {onRestart && (
                <button
                  type="button"
                  onClick={onRestart}
                  className="text-primary-600 dark:text-primary-400 hover:underline font-mono text-[11px] uppercase tracking-wider font-bold cursor-pointer"
                >
                  Restart
                </button>
              )}
              {onDismissResume && (
                <button
                  type="button"
                  onClick={onDismissResume}
                  aria-label="Dismiss resume notice"
                  className="text-muted-foreground hover:text-foreground font-bold p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className={`w-full px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 border-t border-border/40 flex items-center justify-center text-[10px] sm:text-xs font-mono transition-colors duration-200 ${activeTheme.header}`}>
            <div className="flex items-center justify-center gap-2 sm:gap-2.5 min-w-0 flex-wrap">
              {bookId && (
                <button
                  type="button"
                  onClick={() => setIsInfoCardOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border border-primary-500/30 dark:border-primary-500/40 text-primary-600 dark:text-primary-400 bg-primary-500/10 hover:bg-primary-500/20 hover:border-primary-500/60 shadow-xs transition-all cursor-pointer select-none active:scale-95 shrink-0"
                  title="View Gutenberg Public Domain Archive Information"
                  aria-label="View Gutenberg Archive Volume Info"
                >
                  <Info className="w-2.5 h-2.5 opacity-80 shrink-0" />
                  <span>Gutenberg #{bookId}</span>
                </button>
              )}

              <span className={`opacity-40 shrink-0 ${activeTheme.textMuted}`}>•</span>

              {/* Section Micro-Pill */}
              <div
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] sm:text-[11px] font-mono shrink-0 ${activeTheme.pill}`}
                title={`Current Section: Chapter ${currentChapterIndex + 1} of ${totalChapters}`}
              >
                <BookOpen className="w-3 h-3 opacity-75" />
                <span>
                  Section {currentChapterIndex + 1}/{totalChapters}
                </span>
              </div>

              <span className={`opacity-40 shrink-0 ${activeTheme.textMuted}`}>•</span>

              {/* Progress Micro-Pill */}
              <div
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] sm:text-[11px] font-mono shrink-0 ${activeTheme.pill}`}
                title={`Overall Volume Progress: ${Math.round(progress)}%`}
              >
                <Sparkles className="w-3 h-3 text-primary-500" />
                <span>{Math.round(progress)}% Progress</span>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Gutenberg Archive Metadata Modal */}
      {isInfoCardOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsInfoCardOpen(false)}
        >
          <div
            className="relative w-full max-w-md p-6 rounded-2xl bg-card border border-border shadow-2xl text-card-foreground space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/30 dark:border-primary-500/40">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Public Domain Masterwork</span>
                </div>
                <h3 className="text-lg font-serif font-bold text-foreground">
                  {displayTitle}
                </h3>
                <p className="text-sm font-mono text-muted-foreground">
                  by {displayAuthor}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsInfoCardOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label="Close Information Modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50 text-xs font-mono space-y-2">
              <div className="flex justify-between items-center py-1 border-b border-border/30">
                <span className="text-muted-foreground">Gutenberg Volume ID:</span>
                <span className="font-bold text-foreground">#{bookId}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/30">
                <span className="text-muted-foreground">License / Status:</span>
                <span className="text-success font-medium">Public Domain (Zero Copyright)</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Archive Host:</span>
                <span className="text-foreground">Project Gutenberg</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              {bookId && (
                <a
                  href={`https://www.gutenberg.org/ebooks/${bookId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-primary hover:underline"
                >
                  <span>View on Gutenberg.org</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                type="button"
                onClick={() => setIsInfoCardOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-mono transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
