'use client';

import React from 'react';
import { Globe, Check, BookOpen } from 'lucide-react';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { getReaderTheme } from '@/config/reader-themes';
import type { BookTranslationOption } from '@/hooks/queries/useBookTranslations';
import { ReaderDrawerShell } from './ReaderDrawerShell';

export interface ReaderLanguageDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  translations?: BookTranslationOption[];
  onSelectTranslation?: (bookId: number) => void;
  theme?: ReaderTheme;
}

export const ReaderLanguageDrawer: React.FC<ReaderLanguageDrawerProps> = ({
  isOpen,
  onClose,
  translations = [],
  onSelectTranslation,
  theme = 'light',
}) => {
  const activeTheme = getReaderTheme(theme);

  const titleContent = (
    <div>
      <h3 className="font-serif font-bold text-sm leading-tight truncate">
        Languages & Translations
      </h3>
      <p className={`text-[10px] font-mono truncate mt-0.5 ${activeTheme.textMuted}`}>
        {translations.length} Archival {translations.length === 1 ? 'Edition' : 'Editions'}
      </p>
    </div>
  );

  return (
    <ReaderDrawerShell
      isOpen={isOpen}
      onClose={onClose}
      title={titleContent}
      titleIcon={<Globe className={`w-4 h-4 shrink-0 ${activeTheme.iconAccent}`} />}
      theme={theme}
      ariaLabel="Language Editions & Translations"
      closeAriaLabel="Close Language Editions Drawer"
      backdropTestId="language-backdrop"
      role="dialog"
    >
      <div className="flex-1 overflow-y-auto space-y-5 pr-1 -mr-1 [scrollbar-width:thin]">
        {/* ARCHIVAL PUBLIC DOMAIN EDITIONS */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 px-1">
            <BookOpen className={`w-3.5 h-3.5 shrink-0 ${activeTheme.iconAccent}`} />
            <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-foreground">
              Archival Editions ({translations.length})
            </h4>
          </div>

          <div className="space-y-1.5">
            {translations.length === 0 ? (
              <div className={`text-center py-3 text-xs font-mono rounded-lg border ${activeTheme.border} ${activeTheme.pill} ${activeTheme.textMuted}`}>
                No other archival editions available in Gutenberg.
              </div>
            ) : (
              translations.map((t) => (
                <button
                  key={`${t.languageCode}-${t.bookId}`}
                  type="button"
                  onClick={() => {
                    onClose();
                    if (!t.isCurrent && onSelectTranslation) {
                      onSelectTranslation(t.bookId);
                    }
                  }}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-mono transition-colors cursor-pointer border ${
                    t.isCurrent
                      ? `${activeTheme.drawerActive} font-bold`
                      : `${activeTheme.pill} ${activeTheme.drawerHover}`
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`uppercase text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          t.isCurrent
                            ? theme === 'sepia'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-primary-500/15 dark:bg-primary-500/25 text-primary-600 dark:text-primary-400 border-primary-500/30 dark:border-primary-500/40'
                            : `${activeTheme.border} ${activeTheme.pill}`
                        }`}
                      >
                        {t.languageCode}
                      </span>
                      <span className="truncate font-medium">{t.languageLabel}</span>
                    </div>
                    <span className={`text-[10px] truncate block mt-0.5 ${activeTheme.textMuted}`}>
                      {t.title} (#{t.bookId})
                    </span>
                  </div>
                  {t.isCurrent && (
                    <Check
                      className={`w-4 h-4 shrink-0 ${
                        theme === 'sepia' ? 'text-amber-500' : 'text-primary'
                      }`}
                    />
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* NATIVE BROWSER TRANSLATION GUIDANCE */}
        <div className={`p-3 rounded-lg border ${activeTheme.border} ${activeTheme.pill} space-y-1.5`}>
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-foreground">
            <Globe className="w-3.5 h-3.5 text-primary" />
            <span>Looking for other languages?</span>
          </div>
          <p className={`text-[11px] font-sans leading-relaxed ${activeTheme.textMuted}`}>
            Project Gutenberg hosts authentic historical public domain translations. For on-the-fly modern translation, use your browser&apos;s built-in translation feature (available in Chrome, Safari, Firefox, and Edge).
          </p>
        </div>
      </div>
    </ReaderDrawerShell>
  );
};
