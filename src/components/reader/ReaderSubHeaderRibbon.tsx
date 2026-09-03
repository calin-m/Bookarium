'use client';

import React from 'react';
import { X, Info, BookOpen, Sparkles } from 'lucide-react';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { getReaderTheme } from '@/config/reader-themes';

export interface ResumeNoticeData {
  chapterTitle: string;
  page: number;
}

export interface ReaderSubHeaderRibbonProps {
  bookId?: string | number;
  progress: number;
  totalChapters: number;
  currentChapterIndex: number;
  theme?: ReaderTheme;
  resumeNotice?: ResumeNoticeData | null;
  onRestart?: () => void;
  onDismissResume?: () => void;
  onOpenInfoModal?: () => void;
}

/**
 * Sub-header ribbon component rendering either the transient session resume notification
 * or the default archival volume info, section counter, and progress pill.
 */
export const ReaderSubHeaderRibbon: React.FC<ReaderSubHeaderRibbonProps> = ({
  bookId,
  progress,
  totalChapters,
  currentChapterIndex,
  theme = 'light',
  resumeNotice,
  onRestart,
  onDismissResume,
  onOpenInfoModal,
}) => {
  const activeTheme = getReaderTheme(theme);

  if (resumeNotice) {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="resume-notice"
        className="w-full px-4 sm:px-6 md:px-8 py-1.5 border-t border-primary-500/30 flex items-center justify-between gap-3 text-xs font-mono bg-primary-500/10 text-foreground animate-in fade-in slide-in-from-top-1 duration-200"
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
    );
  }

  return (
    <div
      className={`w-full px-4 sm:px-6 md:px-8 py-1.5 border-t ${activeTheme.border} flex items-center justify-center text-[10px] font-mono transition-colors duration-theme ${activeTheme.header}`}
    >
      <div className="flex items-center justify-center gap-2 min-w-0 flex-nowrap whitespace-nowrap">
        {bookId && (
          <button
            type="button"
            onClick={onOpenInfoModal}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shadow-xs transition-all cursor-pointer select-none active:scale-95 shrink-0 ${
              theme === 'sepia'
                ? 'border border-amber-500/30 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 hover:border-amber-500/50'
                : 'border border-primary-500/30 dark:border-primary-500/40 text-primary-600 dark:text-primary-400 bg-primary-500/10 hover:bg-primary-500/20 hover:border-primary-500/60'
            }`}
            title="View Gutenberg Public Domain Archive Information"
            aria-label="View Gutenberg Archive Volume Info"
          >
            <Info className="w-3 h-3 opacity-80 shrink-0" />
            <span className="hidden sm:inline">Gutenberg </span>
            <span>#{bookId}</span>
          </button>
        )}

        <span className={`opacity-40 shrink-0 ${activeTheme.textMuted}`}>•</span>

        {/* Section Micro-Pill */}
        <div
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono shrink-0 ${activeTheme.pill}`}
          title={`Current Section: Chapter ${currentChapterIndex + 1} of ${totalChapters}`}
        >
          <BookOpen className="w-3 h-3 opacity-75 shrink-0" />
          <span className="hidden sm:inline">Section </span>
          <span>
            {currentChapterIndex + 1}/{totalChapters}
          </span>
        </div>

        <span className={`opacity-40 shrink-0 ${activeTheme.textMuted}`}>•</span>

        {/* Progress Micro-Pill */}
        <div
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono shrink-0 ${activeTheme.pill}`}
          title={`Overall Volume Progress: ${Math.round(progress)}%`}
        >
          <Sparkles
            className={`w-3 h-3 shrink-0 ${
              theme === 'sepia' ? 'text-amber-500' : 'text-primary-500'
            }`}
          />
          <span>{Math.round(progress)}%</span>
          <span className="hidden sm:inline"> Progress</span>
        </div>
      </div>
    </div>
  );
};
