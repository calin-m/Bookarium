'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ChevronLeft,
  Globe,
  List,
  Search,
  Sliders,
  Sun,
  Moon,
  Coffee,
  Check,
  Share2,
  Headphones,
  Highlighter,
  Sparkles,
} from 'lucide-react';
import { useReaderStore, type ReaderTheme } from '@/stores/useReaderStore';
import { getReaderTheme } from '@/config/reader-themes';
import { FEATURED_HERO_BOOKS } from '@/config/featured-books';
import { isPlaceholderAuthor } from '@/lib/book-metadata';
import type { BookTranslationOption } from '@/hooks/queries/useBookTranslations';
import { resolveTranslationLanguage } from '@/config/translation-languages';
import { useHasMounted } from '@/hooks/useHasMounted';
import { GutenbergInfoModal } from './GutenbergInfoModal';
import { ReaderSubHeaderRibbon } from './ReaderSubHeaderRibbon';

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
  isSearchOpen?: boolean;
  onToggleSearch?: () => void;
  isControlsOpen: boolean;
  onToggleControls: () => void;
  isTranslationsOpen?: boolean;
  onToggleTranslations?: () => void;
  isSpeechOpen?: boolean;
  onToggleSpeech?: () => void;
  isAnnotationsOpen?: boolean;
  onToggleAnnotations?: () => void;
  annotationsCount?: number;
  theme?: ReaderTheme;
  totalChapters?: number;
  currentChapterIndex?: number;
  onThemeChange?: (theme: ReaderTheme) => void;
  resumeNotice?: ResumeNoticeData | null;
  onRestart?: () => void;
  onDismissResume?: () => void;
  translations?: BookTranslationOption[];
  isTranslationsLoading?: boolean;
  onSelectTranslation?: (bookId: number) => void;
  dynamicTargetLanguage?: string | null;
  displayMode?: 'translated' | 'bilingual';
}

export const ReaderHeader: React.FC<ReaderHeaderProps> = ({
  title,
  author,
  bookId,
  progress,
  onBack,
  isTocOpen,
  onToggleToc,
  isSearchOpen = false,
  onToggleSearch,
  isControlsOpen,
  onToggleControls,
  isTranslationsOpen = false,
  onToggleTranslations,
  isSpeechOpen = false,
  onToggleSpeech,
  isAnnotationsOpen = false,
  onToggleAnnotations,
  annotationsCount = 0,
  theme = 'light',
  totalChapters = 1,
  currentChapterIndex = 0,
  onThemeChange,
  resumeNotice,
  onRestart,
  onDismissResume,
  translations,
  isTranslationsLoading: _isTranslationsLoading,
  onSelectTranslation: _onSelectTranslation,
  dynamicTargetLanguage = null,
  displayMode = 'translated',
}) => {
  const hasMounted = useHasMounted();
  const [isInfoCardOpen, setIsInfoCardOpen] = useState(false);
  const rawIsMobileTrayOpen = useReaderStore((s) => s.isMobileTrayOpen);
  const isMobileTrayOpen = hasMounted ? rawIsMobileTrayOpen : false;
  const setMobileTrayOpen = useReaderStore((s) => s.setMobileTrayOpen);
  const toggleMobileTray = useReaderStore((s) => s.toggleMobileTray);
  const [isCopied, setIsCopied] = useState(false);
  const mobileTrayRef = useRef<HTMLDivElement | null>(null);
  const activeTheme = getReaderTheme(theme);

  const currentBookLang =
    translations?.find((t) => t.isCurrent)?.languageCode.toUpperCase() || 'EN';
  const isDynamicActive = Boolean(dynamicTargetLanguage);
  const dynamicLangUpper = dynamicTargetLanguage?.toUpperCase() || '';
  const activeLangInfo = dynamicTargetLanguage
    ? resolveTranslationLanguage(dynamicTargetLanguage)
    : null;

  const languageButtonLabel = isDynamicActive
    ? displayMode === 'bilingual'
      ? `${currentBookLang} ∥ ${dynamicLangUpper}`
      : dynamicLangUpper
    : currentBookLang;

  const languageButtonTitle = isDynamicActive
    ? displayMode === 'bilingual'
      ? `Bilingual Parallel: ${currentBookLang} ∥ ${activeLangInfo?.label || dynamicLangUpper}`
      : `Translated to ${activeLangInfo?.label || dynamicLangUpper} (AI Translation)`
    : `Language Editions & Translations (${currentBookLang})`;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileTrayOpen) {
        setMobileTrayOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileTrayOpen, setMobileTrayOpen]);

  const handleShare = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch {
        // Fallback gracefully if clipboard access is denied
      }
    }
  };

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
        className={`sticky top-0 z-[10000] shrink-0 border-b transition-colors duration-theme ${activeTheme.header}`}
      >
        {/* Main Header Bar: Title, Author, Navigation & Global Controls */}
        <div className="w-full px-4 sm:px-6 md:px-8 py-2.5 min-h-[3.5rem] flex items-center justify-between gap-3 sm:gap-4 relative">
          
          {/* Left: Back Button & Book Title / Author with Subtle Trailing Fade */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={onBack}
              className={`p-2 rounded-lg border shrink-0 transition-all cursor-pointer active:scale-95 shadow-2xs ${activeTheme.button}`}
              aria-label="Back to Catalog"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="relative min-w-0 flex-1 flex flex-col justify-center overflow-hidden select-text pr-2 [mask-image:linear-gradient(to_right,black_calc(100%-1.25rem),transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,black_calc(100%-1.25rem),transparent_100%)]">
              <h1
                className="text-sm font-serif font-bold truncate text-foreground leading-tight select-text"
                title={displayTitle}
              >
                {displayTitle}
              </h1>
              {displayAuthor && (
                <span className={`text-xs font-mono truncate select-text ${activeTheme.textMuted}`} title={displayAuthor}>
                  by {displayAuthor}
                </span>
              )}
            </div>
          </div>

          {/* Right: Desktop Direct Tool Row (Hidden on small mobile screens) */}
          <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 shrink-0">
            
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

            {/* In-Book Search Drawer Toggle */}
            {onToggleSearch && (
              <button
                type="button"
                onClick={onToggleSearch}
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer active:scale-95 ${
                  isSearchOpen ? activeTheme.activePill : activeTheme.button
                }`}
                aria-label="Search in Book"
                aria-expanded={isSearchOpen}
                title="Search phrase, character, or quote (Ctrl+F)"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Search</span>
              </button>
            )}

            {/* Read Aloud Narration Trigger */}
            {onToggleSpeech && (
              <button
                type="button"
                onClick={onToggleSpeech}
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer active:scale-95 ${
                  isSpeechOpen ? activeTheme.activePill : activeTheme.button
                }`}
                aria-label="Read Aloud Narration"
                aria-expanded={isSpeechOpen}
                title="Listen to book with Read Aloud text-to-speech"
              >
                <Headphones className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Listen</span>
              </button>
            )}

            {/* Notes & Highlights Trigger */}
            {onToggleAnnotations && (
              <button
                type="button"
                data-testid="reader-annotations-toggle-btn"
                onClick={onToggleAnnotations}
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer active:scale-95 ${
                  isAnnotationsOpen ? activeTheme.activePill : activeTheme.button
                }`}
                aria-label="Notes & Highlights"
                aria-expanded={isAnnotationsOpen}
                title="View notes and highlighted passages"
              >
                <Highlighter className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Notes</span>
                {annotationsCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-primary/10 text-primary">
                    {annotationsCount}
                  </span>
                )}
              </button>
            )}

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

            {/* Language & Translations Drawer Trigger */}
            {((translations && translations.length > 0) || isDynamicActive) && onToggleTranslations && (
              <button
                type="button"
                onClick={onToggleTranslations}
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer active:scale-95 ${
                  isTranslationsOpen ? activeTheme.activePill : activeTheme.button
                }`}
                aria-label="Language Editions & Translations"
                aria-expanded={isTranslationsOpen}
                title={languageButtonTitle}
                data-testid="lang-dropdown-button"
              >
                <div className="relative flex items-center justify-center">
                  <Globe
                    className={`w-3.5 h-3.5 shrink-0 ${
                      theme === 'sepia'
                        ? isTranslationsOpen
                          ? 'text-[#2b1d16]'
                          : 'text-amber-500'
                        : 'text-primary'
                    }`}
                  />
                  {isDynamicActive && (
                    <span
                      data-testid="lang-active-dot"
                      className="sm:hidden absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 ring-1 ring-background"
                    />
                  )}
                </div>
                <span className="hidden sm:inline font-bold">
                  {languageButtonLabel}
                </span>
                {isDynamicActive ? (
                  <Sparkles
                    data-testid="lang-sparkles-icon"
                    className="w-3 h-3 text-amber-400 shrink-0 animate-pulse"
                  />
                ) : (
                  translations && translations.length > 1 && (
                    <span
                      className={`text-[10px] px-1 py-0.2 rounded-full font-bold ${
                        theme === 'sepia'
                          ? isTranslationsOpen
                            ? 'bg-[#2b1d16]/20 text-[#2b1d16]'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-primary/10 text-primary'
                      }`}
                    >
                      {translations.length}
                    </span>
                  )
                )}
              </button>
            )}

            {/* 3-Way Universal Theme Switcher (Light -> Sepia -> Dark) */}
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

            {/* Share Book Direct Link Button */}
            <button
              type="button"
              onClick={handleShare}
              className={`p-2 rounded-lg border shrink-0 transition-all cursor-pointer active:scale-95 shadow-2xs ${
                isCopied
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                  : activeTheme.button
              }`}
              aria-label={isCopied ? 'Link Copied to Clipboard' : 'Share Book Link'}
              title={isCopied ? 'Link Copied!' : 'Share Book Link'}
              data-testid="reader-share-button"
            >
              {isCopied ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
            </button>

          </div>

          {/* Right: Mobile Sliding Tool Drawer with Integrated Traveling Pull Handle */}
          <div className="sm:hidden flex items-center">
            {/* Physical Sliding Drawer Pin-Docked to Right Margin */}
            <motion.div
              ref={mobileTrayRef}
              initial={false}
              animate={{
                x: isMobileTrayOpen ? 0 : 'calc(100% - 44px)',
              }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className={`absolute right-3 top-2.5 bottom-2.5 z-50 flex items-center gap-1.5 px-1.5 py-1 rounded-xl border shadow-xl ${activeTheme.drawerBg} border ${activeTheme.border}`}
              data-testid="mobile-action-tray"
            >
              {/* Physical Drawer Pull Handle (Travels with the drawer to the left of the tools) */}
              <button
                type="button"
                onClick={toggleMobileTray}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer active:scale-95 shrink-0 shadow-2xs ${activeTheme.button}`}
                aria-label={isMobileTrayOpen ? 'Hide Reader Controls' : 'Show Reader Controls'}
                aria-expanded={isMobileTrayOpen}
                data-testid="mobile-tray-toggle"
              >
                <ChevronLeft
                  className={`w-4 h-4 transition-transform duration-300 ${
                    isMobileTrayOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* 1. Contents button */}
              <button
                type="button"
                onClick={onToggleToc}
                className={`p-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer active:scale-95 shrink-0 ${
                  isTocOpen ? activeTheme.activePill : activeTheme.button
                }`}
                aria-label="Table of Contents"
                aria-expanded={isTocOpen}
              >
                <List className="w-4 h-4" />
              </button>

              {/* 2. Search button */}
              {onToggleSearch && (
                <button
                  type="button"
                  onClick={onToggleSearch}
                  className={`p-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer active:scale-95 shrink-0 ${
                    isSearchOpen ? activeTheme.activePill : activeTheme.button
                  }`}
                  aria-label="Search in Book"
                  aria-expanded={isSearchOpen}
                >
                  <Search className="w-4 h-4" />
                </button>
              )}

              {/* 2.5 Read Aloud Narration button */}
              {onToggleSpeech && (
                <button
                  type="button"
                  onClick={onToggleSpeech}
                  className={`p-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer active:scale-95 shrink-0 ${
                    isSpeechOpen ? activeTheme.activePill : activeTheme.button
                  }`}
                  aria-label="Read Aloud Narration"
                  aria-expanded={isSpeechOpen}
                  title="Listen to book with Read Aloud text-to-speech"
                >
                  <Headphones className="w-4 h-4" />
                </button>
              )}

              {/* 2.6 Notes & Highlights button */}
              {onToggleAnnotations && (
                <button
                  type="button"
                  data-testid="mobile-annotations-toggle-btn"
                  onClick={onToggleAnnotations}
                  className={`p-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer active:scale-95 shrink-0 ${
                    isAnnotationsOpen ? activeTheme.activePill : activeTheme.button
                  }`}
                  aria-label="Notes & Highlights"
                  aria-expanded={isAnnotationsOpen}
                >
                  <Highlighter className="w-4 h-4" />
                </button>
              )}

              {/* 3. Typography Aa button */}
              <button
                type="button"
                onClick={onToggleControls}
                className={`p-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer active:scale-95 shrink-0 ${
                  isControlsOpen ? activeTheme.activePill : activeTheme.button
                }`}
                aria-label="Typography & Theme Controls"
                aria-expanded={isControlsOpen}
              >
                <Sliders className="w-4 h-4" />
              </button>

              {/* 4. Language button */}
              {((translations && translations.length > 0) || isDynamicActive) && onToggleTranslations && (
                <button
                  type="button"
                  onClick={onToggleTranslations}
                  className={`p-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer active:scale-95 shrink-0 relative ${
                    isTranslationsOpen ? activeTheme.activePill : activeTheme.button
                  }`}
                  aria-label="Language Editions & Translations"
                  aria-expanded={isTranslationsOpen}
                  title={languageButtonTitle}
                  data-testid="mobile-lang-dropdown-button"
                >
                  <Globe
                    className={`w-4 h-4 shrink-0 ${
                      theme === 'sepia'
                        ? isTranslationsOpen
                          ? 'text-[#2b1d16]'
                          : 'text-amber-500'
                        : 'text-primary'
                    }`}
                  />
                  {isDynamicActive && (
                    <span
                      data-testid="mobile-lang-active-indicator"
                      className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400 ring-1 ring-background"
                    />
                  )}
                </button>
              )}

              {/* 5. Theme switcher */}
              {onThemeChange && (
                <button
                  type="button"
                  onClick={() => {
                    if (theme === 'light') onThemeChange('sepia');
                    else if (theme === 'sepia') onThemeChange('dark');
                    else onThemeChange('light');
                  }}
                  aria-label={`Current theme: ${theme}. Click to switch theme.`}
                  className={`p-1.5 rounded-lg border shrink-0 transition-all cursor-pointer active:scale-95 ${activeTheme.button}`}
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

              {/* 6. Share button */}
              <button
                type="button"
                onClick={handleShare}
                className={`p-1.5 rounded-lg border shrink-0 transition-all cursor-pointer active:scale-95 ${
                  isCopied
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                    : activeTheme.button
                }`}
                aria-label={isCopied ? 'Link Copied to Clipboard' : 'Share Book Link'}
              >
                {isCopied ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
              </button>
            </motion.div>
          </div>

        </div>

        {/* Sub-Header Ribbon: Integrated Resume Notice or Default Metadata Ribbon */}
        <ReaderSubHeaderRibbon
          bookId={bookId}
          progress={progress}
          totalChapters={totalChapters}
          currentChapterIndex={currentChapterIndex}
          theme={theme}
          resumeNotice={resumeNotice}
          onRestart={onRestart}
          onDismissResume={onDismissResume}
          onOpenInfoModal={() => setIsInfoCardOpen(true)}
        />
      </header>

      {/* Gutenberg Archive Metadata Modal */}
      <GutenbergInfoModal
        isOpen={isInfoCardOpen}
        onClose={() => setIsInfoCardOpen(false)}
        bookId={bookId}
        title={displayTitle}
        author={displayAuthor}
        theme={theme}
      />
    </>
  );
};
