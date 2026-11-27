import React from 'react';
import type { ReaderThemeConfig } from '@/config/reader-themes';
import { isPlaceholderAuthor, isPlaceholderTitle } from '@/lib/book-metadata';

export interface ReaderLoadingViewProps {
  activeTheme: ReaderThemeConfig;
  bookTitle?: string;
  bookAuthor?: string;
  subjects?: string[];
  openingHook?: string;
}

export const ReaderLoadingView: React.FC<ReaderLoadingViewProps> = ({
  activeTheme,
  bookTitle,
  bookAuthor,
  subjects = [],
  openingHook,
}) => {
  const hasAuthenticTitle = Boolean(bookTitle && !isPlaceholderTitle(bookTitle));
  const hasAuthenticAuthor = Boolean(bookAuthor && !isPlaceholderAuthor(bookAuthor));
  const displaySubjects = subjects.slice(0, 3);

  return (
    <main
      className={`flex-1 flex flex-col items-center justify-center p-8 text-center ${activeTheme.surface}`}
      role="main"
      data-testid="reader-loading-view"
    >
      {hasAuthenticTitle ? (
        <div className="max-w-xl mb-6 space-y-2.5" data-testid="reader-loading-metadata">
          <p className={`text-[11px] font-mono uppercase tracking-[0.2em] ${activeTheme.textMuted}`}>
            Public Domain Digital Edition
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold leading-snug text-balance">
            {bookTitle}
          </h2>
          {hasAuthenticAuthor && (
            <p className={`font-serif italic text-sm sm:text-base ${activeTheme.textMuted}`}>
              by {bookAuthor}
            </p>
          )}
          {displaySubjects.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
              {displaySubjects.map((subject) => (
                <span
                  key={subject}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border border-border/60 ${activeTheme.textMuted}`}
                >
                  {subject}
                </span>
              ))}
            </div>
          )}
          {openingHook && (
            <blockquote
              className={`pt-2 font-serif italic text-xs sm:text-sm leading-relaxed ${activeTheme.textMuted}`}
            >
              “{openingHook}”
            </blockquote>
          )}
        </div>
      ) : null}

      <div className="w-12 h-12 rounded-full border-2 border-primary-500 border-t-transparent animate-spin mb-4" />
      <p className="font-serif text-base font-bold">
        Fetching Masterwork from Bookarium Archive...
      </p>
      <p className={`text-xs font-mono mt-1 ${activeTheme.textMuted}`}>
        Parsing typography AST, chapters, and volume pagination
      </p>
    </main>
  );
};
