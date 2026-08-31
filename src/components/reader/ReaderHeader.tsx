'use client';

import React from 'react';
import { ArrowLeft, BookOpen, List, Sliders, Sparkles, Sun, Moon, Coffee } from 'lucide-react';
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
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
  lineHeight?: number;
  onLineHeightChange?: (height: number) => void;
  readingMode?: 'paginated' | 'scroll';
  onReadingModeChange?: (mode: 'paginated' | 'scroll') => void;
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
  fontSize,
  onFontSizeChange,
  lineHeight,
  onLineHeightChange,
  readingMode,
  onReadingModeChange,
  onThemeChange,
}) => {
  const activeTheme = READER_THEMES[theme] || READER_THEMES.light;

  return (
    <header
      className={`sticky top-0 z-30 shrink-0 border-b transition-colors duration-200 ${activeTheme.header}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
        
        {/* Left: Back Link & Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className={`p-2 -ml-2 rounded-lg border transition-all ${activeTheme.button}`}
            aria-label="Back to Catalog"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0 flex flex-col justify-center">
            <h1 className="text-sm sm:text-base font-serif font-bold truncate">
              {title || `Volume #${bookId}`}
            </h1>
            <p className={`text-[11px] font-mono truncate ${activeTheme.textMuted}`}>
              {author || 'Public Domain Classic'}
            </p>
          </div>
        </div>

        {/* Center: Reading Progress & Chapter Tracker */}
        <div className="hidden lg:flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono ${activeTheme.pill}`}>
            <BookOpen className="w-3.5 h-3.5 opacity-80" />
            <span>
              Section {currentChapterIndex + 1} of {totalChapters}
            </span>
          </div>

          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono ${activeTheme.activePill}`}>
            <Sparkles className="w-3.5 h-3.5 text-primary-500" />
            <span>{Math.round(progress)}% Volume Progress</span>
          </div>
        </div>

        {/* Right: Quick Controls & Modals */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          
          {/* Quick Reading Mode Switcher (Desktop) */}
          {readingMode && onReadingModeChange && (
            <div className={`hidden md:flex items-center rounded-lg p-0.5 border text-xs ${activeTheme.pill}`}>
              <button
                type="button"
                onClick={() => onReadingModeChange('paginated')}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-all ${
                  readingMode === 'paginated'
                    ? activeTheme.activePill
                    : activeTheme.inactivePill
                }`}
              >
                Pages
              </button>
              <button
                type="button"
                onClick={() => onReadingModeChange('scroll')}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-all ${
                  readingMode === 'scroll'
                    ? activeTheme.activePill
                    : activeTheme.inactivePill
                }`}
              >
                Scroll
              </button>
            </div>
          )}

          {/* Quick Font Size Adjusters (Desktop) */}
          {fontSize !== undefined && onFontSizeChange && (
            <div className={`hidden md:flex items-center rounded-lg p-0.5 border text-xs ${activeTheme.pill}`}>
              <button
                type="button"
                onClick={() => onFontSizeChange(Math.max(fontSize - 2, 12))}
                className={`px-2 py-1 font-mono text-[11px] hover:text-primary-600 transition-colors`}
                aria-label="Decrease Font Size"
              >
                A-
              </button>
              <span className={`px-1 font-mono text-[10px] ${activeTheme.textMuted}`}>
                {fontSize}px
              </span>
              <button
                type="button"
                onClick={() => onFontSizeChange(Math.min(fontSize + 2, 36))}
                className={`px-2 py-1 font-mono text-[11px] hover:text-primary-600 transition-colors`}
                aria-label="Increase Font Size"
              >
                A+
              </button>
            </div>
          )}

          {/* Quick Line Height Toggle (Desktop) */}
          {lineHeight !== undefined && onLineHeightChange && (
            <div className={`hidden lg:flex items-center rounded-lg p-0.5 border text-xs ${activeTheme.pill}`}>
              <button
                type="button"
                onClick={() => {
                  const nextLh = lineHeight <= 1.4 ? 1.8 : lineHeight <= 1.8 ? 2.2 : 1.4;
                  onLineHeightChange(nextLh);
                }}
                className={`px-2 py-1 font-mono text-[11px] hover:text-primary-600 transition-colors flex items-center gap-1`}
                aria-label="Toggle Line Spacing Preset"
                title="Cycle Line Height: Compact (1.4) → Standard (1.8) → Spacious (2.2)"
              >
                <span className="text-[10px] uppercase text-muted-foreground">↕</span>
                <span>{lineHeight}</span>
              </button>
            </div>
          )}

          {/* Quick Theme Switchers (Desktop) */}
          {onThemeChange && (
            <div className={`hidden sm:flex items-center rounded-lg p-0.5 border text-xs ${activeTheme.pill}`}>
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
              <span className={`text-[10px] opacity-70`}>
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
