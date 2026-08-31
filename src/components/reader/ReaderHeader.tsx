'use client';

import React, { useState } from 'react';
import { ArrowLeft, ArrowLeftRight, BookOpen, List, Sliders, Sparkles, Sun, Moon, Coffee } from 'lucide-react';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { READER_THEMES } from '@/config/reader-themes';

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
}) => {
  const [isArchiveView, setIsArchiveView] = useState(false);
  const activeTheme = READER_THEMES[theme] || READER_THEMES.light;

  return (
    <header
      className={`sticky top-0 z-30 shrink-0 border-b transition-colors duration-200 ${activeTheme.header}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
        
        {/* Left: Back Link & Book Title/Author with Archive Toggle */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 sm:flex-initial max-w-full sm:max-w-md md:max-w-lg lg:max-w-xl">
          <button
            type="button"
            onClick={onBack}
            className={`p-2 -ml-2 rounded-lg border shrink-0 transition-all ${activeTheme.button}`}
            aria-label="Back to Catalog"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 min-w-0">
              <h1 className="text-sm sm:text-base font-serif font-bold truncate text-foreground">
                {isArchiveView ? `Gutenberg Volume #${bookId}` : (title || `Volume #${bookId}`)}
              </h1>
              {bookId && (
                <button
                  type="button"
                  onClick={() => setIsArchiveView((prev) => !prev)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border transition-all shrink-0 ${
                    isArchiveView
                      ? 'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                      : `${activeTheme.pill} hover:border-primary-500 hover:text-primary-600`
                  }`}
                  title={isArchiveView ? 'Switch to Literary Title & Author' : 'Switch to Gutenberg Archive Volume Info'}
                  aria-label={isArchiveView ? 'Switch to Literary Title & Author' : 'Switch to Gutenberg Archive Volume Info'}
                >
                  <ArrowLeftRight className="w-2.5 h-2.5 opacity-75" />
                  <span>Info</span>
                </button>
              )}
            </div>
            <p className={`text-[11px] sm:text-xs font-mono truncate ${activeTheme.textMuted}`}>
              {isArchiveView ? 'Project Gutenberg Public Domain Archive' : (author || 'Public Domain Classic')}
            </p>
          </div>
        </div>

        {/* Center: Clean Progress & Section Tracker */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono ${activeTheme.pill}`}>
            <BookOpen className="w-3.5 h-3.5 opacity-80" />
            <span>
              Section {currentChapterIndex + 1} of {totalChapters}
            </span>
            <span className="opacity-40">•</span>
            <Sparkles className="w-3.5 h-3.5 text-primary-500" />
            <span>{Math.round(progress)}% Progress</span>
          </div>
        </div>

        {/* Right: Theme Switcher, Table of Contents & Typography Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          
          {/* Quick Theme Switchers (Light / Sepia / Dark) */}
          {onThemeChange && (
            <div className={`flex items-center rounded-lg p-0.5 border text-xs ${activeTheme.pill}`}>
              <button
                type="button"
                onClick={() => onThemeChange('light')}
                className={`p-1.5 rounded transition-all ${
                  theme === 'light' ? activeTheme.activePill : activeTheme.inactivePill
                }`}
                title="Light Paper Theme"
                aria-label="Light Theme"
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
              </button>
              <button
                type="button"
                onClick={() => onThemeChange('sepia')}
                className={`p-1.5 rounded transition-all ${
                  theme === 'sepia' ? activeTheme.activePill : activeTheme.inactivePill
                }`}
                title="Sepia Warm Amber Theme"
                aria-label="Sepia Theme"
              >
                <Coffee className="w-3.5 h-3.5 text-amber-700" />
              </button>
              <button
                type="button"
                onClick={() => onThemeChange('dark')}
                className={`p-1.5 rounded transition-all ${
                  theme === 'dark' ? activeTheme.activePill : activeTheme.inactivePill
                }`}
                title="Dark Obsidian Theme"
                aria-label="Dark Theme"
              >
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
              </button>
            </div>
          )}

          {/* Table of Contents Drawer Toggle */}
          <button
            type="button"
            onClick={onToggleToc}
            className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
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
            className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
              isControlsOpen ? activeTheme.activePill : activeTheme.button
            }`}
            aria-label="Typography & Theme Controls"
            aria-expanded={isControlsOpen}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Aa</span>
          </button>
        </div>

      </div>
    </header>
  );
};
