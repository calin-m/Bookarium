'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  Info,
  List,
  Search,
  Sliders,
  Sparkles,
  Sun,
  Moon,
  Coffee,
  ShieldCheck,
  Check,
  X,
  Share2,
} from 'lucide-react';
import { useReaderStore, type ReaderTheme } from '@/stores/useReaderStore';
import { getReaderTheme } from '@/config/reader-themes';
import { FEATURED_HERO_BOOKS } from '@/config/featured-books';
import { isPlaceholderAuthor } from '@/lib/book-metadata';
import type { BookTranslationOption } from '@/hooks/queries/useBookTranslations';
import { SITE_CONFIG } from '@/config/site-config';
import { useHasMounted } from '@/hooks/useHasMounted';

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
        className={`sticky top-0 z-[10000] shrink-0 border-b transition-colors duration-200 ${activeTheme.header}`}
      >
        {/* Main Header Bar: Title, Author, Navigation & Global Controls */}
        <div className="w-full px-4 sm:px-6 md:px-8 py-3 sm:py-3.5 min-h-[3.75rem] sm:min-h-[4rem] flex items-center justify-between gap-3 sm:gap-4 relative">
          
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
                className="text-sm sm:text-base font-serif font-bold truncate text-foreground leading-tight select-text"
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
            {translations && translations.length > 0 && onToggleTranslations && (
              <button
                type="button"
                onClick={onToggleTranslations}
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer active:scale-95 ${
                  isTranslationsOpen ? activeTheme.activePill : activeTheme.button
                }`}
                aria-label="Language Editions & Translations"
                aria-expanded={isTranslationsOpen}
                title="View available language editions and translations"
                data-testid="lang-dropdown-button"
              >
                <Globe
                  className={`w-3.5 h-3.5 shrink-0 ${
                    theme === 'sepia'
                      ? isTranslationsOpen
                        ? 'text-[#2b1d16]'
                        : 'text-amber-500'
                      : 'text-primary'
                  }`}
                />
                <span className="hidden sm:inline">
                  {translations.find((t) => t.isCurrent)?.languageCode.toUpperCase() || 'EN'}
                </span>
                {translations.length > 1 && (
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
              {translations && translations.length > 0 && onToggleTranslations && (
                <button
                  type="button"
                  onClick={onToggleTranslations}
                  className={`p-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer active:scale-95 shrink-0 ${
                    isTranslationsOpen ? activeTheme.activePill : activeTheme.button
                  }`}
                  aria-label="Language Editions & Translations"
                  aria-expanded={isTranslationsOpen}
                  title="View available language editions and translations"
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
          <div className={`w-full px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 border-t ${activeTheme.border} flex items-center justify-center text-[10px] sm:text-xs font-mono transition-colors duration-200 ${activeTheme.header}`}>
            <div className="flex items-center justify-center gap-2 sm:gap-2.5 min-w-0 flex-wrap">
              {bookId && (
                <button
                  type="button"
                  onClick={() => setIsInfoCardOpen(true)}
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold shadow-xs transition-all cursor-pointer select-none active:scale-95 shrink-0 ${
                    theme === 'sepia'
                      ? 'border border-amber-500/30 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 hover:border-amber-500/50'
                      : 'border border-primary-500/30 dark:border-primary-500/40 text-primary-600 dark:text-primary-400 bg-primary-500/10 hover:bg-primary-500/20 hover:border-primary-500/60'
                  }`}
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
                <Sparkles className={`w-3 h-3 ${theme === 'sepia' ? 'text-amber-500' : 'text-primary-500'}`} />
                <span>{Math.round(progress)}% Progress</span>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Gutenberg Archive Metadata Modal */}
      <AnimatePresence>
        {isInfoCardOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setIsInfoCardOpen(false)}
          >
            {/* Fluid Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Fluid Modal Surface */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={`relative w-full max-w-md p-6 rounded-2xl border shadow-2xl space-y-4 z-10 ${activeTheme.drawerBg} border ${activeTheme.border}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                    theme === 'sepia'
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/30 dark:border-primary-500/40'
                  }`}>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Public Domain Masterwork</span>
                  </div>
                  <h3 className="text-lg font-serif font-bold text-inherit">
                    {displayTitle}
                  </h3>
                  <p className={`text-sm font-mono ${activeTheme.textMuted}`}>
                    by {displayAuthor}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsInfoCardOpen(false)}
                  className={`p-1.5 rounded-lg ${activeTheme.textMuted} hover:text-inherit transition-colors cursor-pointer`}
                  aria-label="Close Information Modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className={`p-3.5 rounded-xl border text-xs font-mono space-y-2 ${activeTheme.pill} border ${activeTheme.border}`}>
                <div className={`flex justify-between items-center py-1 border-b ${activeTheme.border}`}>
                  <span className={activeTheme.textMuted}>Gutenberg Volume ID:</span>
                  <span className="font-bold text-inherit">#{bookId}</span>
                </div>
                <div className={`flex justify-between items-center py-1 border-b ${activeTheme.border}`}>
                  <span className={activeTheme.textMuted}>License / Status:</span>
                  <span className={`font-medium ${theme === 'sepia' ? 'text-amber-400' : 'text-emerald-400 dark:text-emerald-400'}`}>
                    Public Domain (Zero Copyright)
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className={activeTheme.textMuted}>Archive Host:</span>
                  <span className="text-inherit">Project Gutenberg</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                {bookId && (
                  <a
                    href={SITE_CONFIG.GUTENBERG_EBOOK(bookId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 text-xs font-mono hover:underline ${
                      theme === 'sepia' ? 'text-amber-500' : 'text-primary'
                    }`}
                  >
                    <span>View on Gutenberg.org</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setIsInfoCardOpen(false)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer border ${activeTheme.button}`}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
