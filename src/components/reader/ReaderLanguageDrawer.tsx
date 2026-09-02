'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Globe, Check } from 'lucide-react';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { getReaderTheme } from '@/config/reader-themes';
import { useHasMounted } from '@/hooks/useHasMounted';
import type { BookTranslationOption } from '@/hooks/queries/useBookTranslations';

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
  const hasMounted = useHasMounted();

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!hasMounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Fluid Backdrop Fade */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9998] bg-transparent"
            onClick={onClose}
            aria-hidden="true"
            data-testid="language-backdrop"
          />

          {/* Fluid Spring Drawer Panel */}
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={`fixed top-[6.25rem] sm:top-20 inset-x-3 sm:inset-x-auto sm:right-6 w-auto max-w-sm sm:w-80 mx-auto sm:mx-0 z-[9999] max-h-[calc(100dvh-7rem)] rounded-xl ${activeTheme.drawerBg} border ${activeTheme.border} shadow-2xl p-4 sm:p-4.5 flex flex-col origin-top sm:origin-top-right`}
            role="dialog"
            aria-modal="true"
            aria-label="Language Editions & Translations"
          >
            {/* Header */}
            <div className={`flex items-center justify-between pb-3 mb-3 border-b ${activeTheme.border}`}>
              <div className="flex items-center gap-2 min-w-0">
                <Globe
                  className={`w-4 h-4 shrink-0 ${
                    theme === 'sepia' ? 'text-amber-500' : 'text-primary-600 dark:text-primary-400'
                  }`}
                />
                <div className="min-w-0">
                  <h3 className="font-serif font-bold text-sm leading-tight truncate">
                    Language Editions
                  </h3>
                  <p className={`text-[10px] font-mono truncate mt-0.5 ${activeTheme.textMuted}`}>
                    {translations.length} {translations.length === 1 ? 'Edition' : 'Editions'} Available
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer active:scale-95 ${activeTheme.button}`}
                aria-label="Close Language Editions Drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

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
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
