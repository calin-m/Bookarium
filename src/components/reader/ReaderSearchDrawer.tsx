'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import type { ChapterSection } from '@/lib/gutenberg-parser';
import { searchInBook, type BookSearchMatch } from '@/lib/in-book-search';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { getReaderTheme } from '@/config/reader-themes';
import { READER_GESTURE_CONFIG } from '@/config/reader-config';
import { ReaderDrawerShell } from './ReaderDrawerShell';

export interface ReaderSearchDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chapters: ChapterSection[];
  fontSize?: number;
  onSelectMatch: (chapterIndex: number, page: number) => void;
  bookTitle?: string;
  theme?: ReaderTheme;
}

export const ReaderSearchDrawer: React.FC<ReaderSearchDrawerProps> = ({
  isOpen,
  onClose,
  chapters,
  fontSize = 18,
  onSelectMatch,
  bookTitle,
  theme = 'light',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const activeTheme = getReaderTheme(theme);

  // Auto-focus search input when drawer opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, READER_GESTURE_CONFIG.AUTO_FOCUS_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const searchResults = useMemo(() => {
    return searchInBook(chapters, searchQuery, fontSize);
  }, [chapters, searchQuery, fontSize]);

  const titleContent = (
    <div>
      <h3 className="font-serif font-bold text-sm leading-tight truncate">
        Search in Volume
      </h3>
      {bookTitle && (
        <p className={`text-[10px] font-mono truncate max-w-[220px] mt-0.5 ${activeTheme.textMuted}`}>
          {bookTitle}
        </p>
      )}
    </div>
  );

  return (
    <ReaderDrawerShell
      isOpen={isOpen}
      onClose={onClose}
      title={titleContent}
      titleIcon={
        <Search className={`w-4 h-4 shrink-0 ${activeTheme.iconAccent}`} />
      }
      theme={theme}
      ariaLabel="Search in Volume"
      closeAriaLabel="Close Search"
      backdropTestId="search-backdrop"
      role="dialog"
    >

            {/* Search Input Bar (Standardized Padding & Vertical Centering) */}
            <div className="relative flex items-center mb-3">
              <Search className={`w-3.5 h-3.5 absolute left-3 pointer-events-none ${activeTheme.textMuted}`} />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search phrase, character, or quote..."
                className={`w-full h-9 pl-9 pr-8 py-2 text-xs font-mono rounded-lg border ${activeTheme.border} ${
                  theme === 'sepia' ? activeTheme.pill : 'bg-background/50'
                } focus:outline-hidden focus:ring-2 focus:ring-primary/40 transition-all leading-normal placeholder:text-muted-foreground`}
                data-testid="in-book-search-input"
                aria-label="Search book text"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    if (inputRef.current) inputRef.current.value = '';
                  }}
                  className={`absolute right-2.5 p-1 rounded-full ${activeTheme.textMuted} hover:text-foreground cursor-pointer transition-colors`}
                  aria-label="Clear search query"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Results Metadata Summary */}
            {searchQuery.trim().length >= 2 && (
              <div className={`flex items-center justify-between text-[11px] font-mono mb-2 px-1 ${activeTheme.textMuted}`}>
                <span>
                  {searchResults.totalMatches > 0
                    ? `${searchResults.totalMatches} match${searchResults.totalMatches === 1 ? '' : 'es'} across ${searchResults.matchedChapterCount} chapter${searchResults.matchedChapterCount === 1 ? '' : 's'}`
                    : 'No occurrences found'}
                </span>
              </div>
            )}

            {/* Search Match List */}
            <div className={`flex-1 overflow-y-auto space-y-2 pr-1 ${activeTheme.scrollbarClass}`}>
              {searchQuery.trim().length < 2 ? (
                <div className={`py-8 text-center text-xs font-mono ${activeTheme.textMuted}`}>
                  Type at least 2 characters to search across this volume.
                </div>
              ) : searchResults.matches.length === 0 ? (
                <div className={`py-8 text-center text-xs font-mono ${activeTheme.textMuted}`}>
                  No matches found for &ldquo;{searchQuery}&rdquo;.
                </div>
              ) : (
                searchResults.matches.map((match: BookSearchMatch) => (
                  <button
                    key={match.id}
                    type="button"
                    onClick={() => {
                      onSelectMatch(match.chapterIndex, match.chapterPage);
                      onClose();
                    }}
                    className={`w-full text-left p-2.5 rounded-lg border ${activeTheme.border} ${
                      theme === 'sepia' ? 'hover:bg-[#402a1d]' : 'hover:bg-primary/5'
                    } transition-all group cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary`}
                    data-testid={`search-match-${match.id}`}
                  >
                    {/* Chapter & Page Metadata Header */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-[11px] font-mono font-semibold truncate ${
                        theme === 'sepia' ? 'text-[#f59e0b]' : 'text-primary'
                      }`}>
                        {match.chapterDisplayTitle}
                      </span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded shrink-0 border ${
                        theme === 'sepia'
                          ? 'border-[#462e22] bg-[#402a1d] text-[#cbb39d]'
                          : `${activeTheme.border} bg-muted ${activeTheme.textMuted}`
                      }`}>
                        p. {match.globalPage}
                      </span>
                    </div>

                    {/* Excerpt Snippet with Highlight */}
                    <p className="text-xs font-serif leading-relaxed text-foreground line-clamp-3">
                      <span className="opacity-80">{match.snippetBefore}</span>
                      <mark className={`px-0.5 rounded-xs font-semibold ${
                        theme === 'sepia'
                          ? 'bg-amber-500/30 text-[#fef6eb]'
                          : 'bg-primary/25 dark:bg-primary/40 text-foreground'
                      }`}>
                        {match.matchedText}
                      </mark>
                      <span className="opacity-80">{match.snippetAfter}</span>
                    </p>
                  </button>
                ))
              )}
            </div>
    </ReaderDrawerShell>
  );
};
