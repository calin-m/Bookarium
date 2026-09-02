'use client';

import React from 'react';
import { Globe, Check } from 'lucide-react';
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
        Language Editions
      </h3>
      <p className={`text-[10px] font-mono truncate mt-0.5 ${activeTheme.textMuted}`}>
        {translations.length} {translations.length === 1 ? 'Edition' : 'Editions'} Available
      </p>
    </div>
  );

  return (
    <ReaderDrawerShell
      isOpen={isOpen}
      onClose={onClose}
      title={titleContent}
      titleIcon={
        <Globe className={`w-4 h-4 shrink-0 ${activeTheme.iconAccent}`} />
      }
      theme={theme}
      ariaLabel="Language Editions & Translations"
      closeAriaLabel="Close Language Editions Drawer"
      backdropTestId="language-backdrop"
      className="sm:w-80"
      role="dialog"
    >

            {/* Translation Items List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 -mr-1 [scrollbar-width:thin]">
              {translations.length === 0 ? (
                <div className={`text-center py-6 text-xs font-mono ${activeTheme.textMuted}`}>
                  No other language editions available for this title.
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
                    className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-left text-xs font-mono transition-colors cursor-pointer border ${
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
                                : 'bg-primary/20 text-primary border-primary/40'
                              : `${activeTheme.border} ${activeTheme.pill}`
                          }`}
                        >
                          {t.languageCode}
                        </span>
                        <span className="truncate font-medium">{t.languageLabel}</span>
                      </div>
                      <span className={`text-[10px] truncate block mt-1 ${activeTheme.textMuted}`}>
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
    </ReaderDrawerShell>
  );
};
