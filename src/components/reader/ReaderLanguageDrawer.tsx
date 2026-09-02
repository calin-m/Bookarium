'use client';

import React from 'react';
import { Globe, Check, Sparkles, BookOpen, Columns, RotateCcw } from 'lucide-react';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { getReaderTheme } from '@/config/reader-themes';
import type { BookTranslationOption } from '@/hooks/queries/useBookTranslations';
import {
  POPULAR_TRANSLATION_LANGUAGES,
  ALL_TRANSLATION_LANGUAGES,
  resolveTranslationLanguage,
} from '@/config/translation-languages';
import { ReaderDrawerShell } from './ReaderDrawerShell';

export interface ReaderLanguageDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  translations?: BookTranslationOption[];
  onSelectTranslation?: (bookId: number) => void;
  theme?: ReaderTheme;
  dynamicTargetLanguage?: string | null;
  onSelectDynamicLanguage?: (languageCode: string | null) => void;
  displayMode?: 'translated' | 'bilingual';
  onSelectDisplayMode?: (mode: 'translated' | 'bilingual') => void;
  isTranslating?: boolean;
}

export const ReaderLanguageDrawer: React.FC<ReaderLanguageDrawerProps> = ({
  isOpen,
  onClose,
  translations = [],
  onSelectTranslation,
  theme = 'light',
  dynamicTargetLanguage = null,
  onSelectDynamicLanguage,
  displayMode = 'translated',
  onSelectDisplayMode,
  isTranslating = false,
}) => {
  const activeTheme = getReaderTheme(theme);
  const activeLangConfig = dynamicTargetLanguage
    ? resolveTranslationLanguage(dynamicTargetLanguage)
    : null;

  const titleContent = (
    <div>
      <h3 className="font-serif font-bold text-sm leading-tight truncate">
        Languages & Translations
      </h3>
      <p className={`text-[10px] font-mono truncate mt-0.5 ${activeTheme.textMuted}`}>
        {dynamicTargetLanguage
          ? `Translating to ${activeLangConfig?.label || dynamicTargetLanguage.toUpperCase()}`
          : `${translations.length} Archival ${translations.length === 1 ? 'Edition' : 'Editions'}`}
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
      className="sm:w-88"
      role="dialog"
    >
      <div className="flex-1 overflow-y-auto space-y-5 pr-1 -mr-1 [scrollbar-width:thin]">
        {/* TIER 1: ARCHIVAL PUBLIC DOMAIN EDITIONS */}
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
                              : 'bg-primary/20 text-primary border-primary/40'
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

        {/* TIER 2: INSTANT DYNAMIC TRANSLATION */}
        <div className="space-y-3 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-400 animate-pulse" />
              <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-foreground">
                Instant AI Translation
              </h4>
            </div>
            {dynamicTargetLanguage && (
              <button
                type="button"
                onClick={() => onSelectDynamicLanguage?.(null)}
                aria-label="Revert to original language"
                className="flex items-center gap-1 text-[10px] font-mono text-primary hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Original
              </button>
            )}
          </div>

          {/* Reading Display Mode Toggle */}
          {dynamicTargetLanguage && onSelectDisplayMode && (
            <div className="space-y-1.5 px-0.5">
              <label className={`text-[10px] font-mono block ${activeTheme.textMuted}`}>
                Reading Display Mode:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onSelectDisplayMode('translated')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-mono border transition-all cursor-pointer ${
                    displayMode === 'translated'
                      ? `${activeTheme.drawerActive} font-bold shadow-xs`
                      : `${activeTheme.pill} ${activeTheme.drawerHover}`
                  }`}
                >
                  <BookOpen className="w-3 h-3" />
                  Translated Only
                </button>
                <button
                  type="button"
                  onClick={() => onSelectDisplayMode('bilingual')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-mono border transition-all cursor-pointer ${
                    displayMode === 'bilingual'
                      ? `${activeTheme.drawerActive} font-bold shadow-xs`
                      : `${activeTheme.pill} ${activeTheme.drawerHover}`
                  }`}
                >
                  <Columns className="w-3 h-3" />
                  Bilingual Parallel
                </button>
              </div>
            </div>
          )}

          {/* Popular Quick-Pick Languages */}
          <div className="space-y-1.5 px-0.5">
            <label className={`text-[10px] font-mono block ${activeTheme.textMuted}`}>
              Popular Languages:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {POPULAR_TRANSLATION_LANGUAGES.map((lang) => {
                const isSelected = dynamicTargetLanguage === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      onSelectDynamicLanguage?.(isSelected ? null : lang.code);
                    }}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-mono text-left border transition-all cursor-pointer ${
                      isSelected
                        ? `${activeTheme.drawerActive} font-bold ring-1 ring-primary/50 shadow-xs`
                        : `${activeTheme.pill} ${activeTheme.drawerHover}`
                    }`}
                  >
                    <span className="text-sm shrink-0">{lang.flag}</span>
                    <span className="truncate">{lang.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Full Language Dropdown (100+ Languages) */}
          <div className="space-y-1.5 px-0.5 pt-1">
            <label className={`text-[10px] font-mono block ${activeTheme.textMuted}`}>
              All 100+ Languages:
            </label>
            <select
              value={dynamicTargetLanguage || ''}
              onChange={(e) => onSelectDynamicLanguage?.(e.target.value || null)}
              aria-label="Select translation language"
              className={`w-full py-2 px-3 text-xs font-mono rounded-lg border ${activeTheme.border} ${activeTheme.pill} text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer`}
            >
              <option value="">Choose a language to translate...</option>
              {ALL_TRANSLATION_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.label} ({lang.nativeLabel})
                </option>
              ))}
            </select>
          </div>

          {isTranslating && (
            <p className="text-[10px] font-mono text-primary animate-pulse text-center pt-1">
              Translating page content...
            </p>
          )}
        </div>
      </div>
    </ReaderDrawerShell>
  );
};
