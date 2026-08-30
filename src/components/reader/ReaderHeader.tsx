'use client';

import React from 'react';
import { ArrowLeft, BookOpen, List, Sliders, Sparkles } from 'lucide-react';
import type { ReaderTheme } from '@/stores/useReaderStore';

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
  totalChapters = 1,
  currentChapterIndex = 0,
}) => {
  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-black/10 dark:border-white/10 bg-inherit/95 backdrop-blur-md transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
        
        {/* Left: Back Link & Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus:outline-hidden focus:ring-2 focus:ring-primary-500"
            aria-label="Back to Catalog"
          >
            <ArrowLeft className="w-5 h-5 text-stone-600 dark:text-stone-300" />
          </button>

          <div className="min-w-0 flex flex-col justify-center">
            <h1 className="text-sm sm:text-base font-serif font-bold text-stone-900 dark:text-stone-100 truncate">
              {title || `Volume #${bookId}`}
            </h1>
            <p className="text-[11px] font-mono text-stone-500 dark:text-stone-400 truncate">
              {author || 'Public Domain Classic'}
            </p>
          </div>
        </div>

        {/* Center: Reading Progress & Chapter Tracker */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-xs font-mono">
            <BookOpen className="w-3.5 h-3.5 text-primary-500" />
            <span className="text-stone-600 dark:text-stone-300">
              Section {currentChapterIndex + 1} of {totalChapters}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-50 dark:bg-primary-950/40 border border-primary-200/50 dark:border-primary-800/40 text-xs font-mono text-primary-700 dark:text-primary-300">
            <Sparkles className="w-3.5 h-3.5 text-primary-500" />
            <span>{Math.round(progress)}% Volume Progress</span>
          </div>
        </div>

        {/* Right: Drawer & Controls Triggers */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleToc}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
              isTocOpen
                ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-stone-700 dark:text-stone-200 border-black/10 dark:border-white/10'
            }`}
            aria-label="Table of Contents"
            aria-expanded={isTocOpen}
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Contents</span>
          </button>

          <button
            type="button"
            onClick={onToggleControls}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
              isControlsOpen
                ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-stone-700 dark:text-stone-200 border-black/10 dark:border-white/10'
            }`}
            aria-label="Typography & Theme Controls"
            aria-expanded={isControlsOpen}
          >
            <Sliders className="w-4 h-4" />
            <span className="hidden sm:inline">Appearance</span>
          </button>
        </div>

      </div>
    </header>
  );
};

