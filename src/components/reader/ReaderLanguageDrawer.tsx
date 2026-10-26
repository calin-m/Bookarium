'use client';

import React from 'react';
import { Globe, Check, BookOpen, WifiOff } from 'lucide-react';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { getReaderTheme } from '@/config/reader-themes';
import type { BookTranslationOption } from '@/hooks/queries/useBookTranslations';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useOfflineBooks } from '@/hooks/useOfflineBooks';
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
  const { isOffline } = useNetworkStatus();
  const { isBookOffline } = useOfflineBooks();

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
              translations.map((t) => {
                const isEditionOffline = isBookOffline(t.bookId);
                const isUnavailableOffline = isOffline && !t.isCurrent && !isEditionOffline;

                return (
                  <button
                    key={`${t.languageCode}-${t.bookId}`}
                    type="button"
                    disabled={isUnavailableOffline}
                    onClick={() => {
                      if (isUnavailableOffline) return;
                      onClose();
                      if (!t.isCurrent && onSelectTranslation) {
                        onSelectTranslation(t.bookId);
                      }
                    }}
                    className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-mono transition-colors border ${
                      isUnavailableOffline
                        ? 'opacity-60 cursor-not-allowed border-dashed border-border'
                        : 'cursor-pointer'
                    } ${
                      t.isCurrent
                        ? `${activeTheme.drawerActive} font-bold`
                        : `${activeTheme.pill} ${activeTheme.drawerHover}`
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
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

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isUnavailableOffline && (
                        <span
                          data-testid={`translation-offline-badge-${t.bookId}`}
                          className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold"
                        >
                          <WifiOff className="w-2.5 h-2.5" />
                          <span>Not Downloaded</span>
                        </span>
                      )}
                      {!t.isCurrent && !isUnavailableOffline && isEditionOffline && (
                        <span
                          data-testid={`translation-downloaded-badge-${t.bookId}`}
                          className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold"
                        >
                          <span>Downloaded</span>
                        </span>
                      )}
                      {t.isCurrent && (
                        <Check
                          className={`w-4 h-4 shrink-0 ${
                            theme === 'sepia' ? 'text-amber-500' : 'text-primary'
                          }`}
                        />
                      )}
                    </div>
                  </button>
                );
              })
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
