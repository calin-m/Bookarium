'use client';

import React from 'react';
import { Type, Sun, Moon, Coffee, AlignLeft, Columns, Undo2, RotateCcw } from 'lucide-react';
import type { ReaderTheme, ReaderFontFamily } from '@/stores/useReaderStore';
import { getReaderTheme } from '@/config/reader-themes';
import { READER_FONT_CONFIG } from '@/config/reader-config';
import { ReaderDrawerShell } from './ReaderDrawerShell';

export interface ReaderControlsProps {
  isOpen: boolean;
  onClose: () => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  lineHeight: number;
  onLineHeightChange: (height: number) => void;
  fontFamily: ReaderFontFamily;
  onFontFamilyChange: (family: ReaderFontFamily) => void;
  theme: ReaderTheme;
  onThemeChange: (theme: ReaderTheme) => void;
  brightness?: number;
  onBrightnessChange?: (brightness: number) => void;
  readingMode: 'paginated' | 'scroll';
  onReadingModeChange: (mode: 'paginated' | 'scroll') => void;
  columnWidth: 'narrow' | 'normal' | 'wide';
  onColumnWidthChange: (width: 'narrow' | 'normal' | 'wide') => void;
  hasCustomDefaults?: boolean;
  isAtCustomDefaults?: boolean;
  isAtFactoryDefaults?: boolean;
  onRevertToCustomDefaults?: () => void;
  onResetToFactoryDefaults?: () => void;
  exitBookmarkReminderEnabled?: boolean;
  onExitBookmarkReminderChange?: (enabled: boolean) => void;
}

export const ReaderControls: React.FC<ReaderControlsProps> = ({
  isOpen,
  onClose,
  fontSize,
  onFontSizeChange,
  lineHeight,
  onLineHeightChange,
  fontFamily,
  onFontFamilyChange,
  theme,
  onThemeChange,
  brightness = READER_FONT_CONFIG.DEFAULT_BRIGHTNESS,
  onBrightnessChange,
  readingMode,
  onReadingModeChange,
  columnWidth,
  onColumnWidthChange,
  hasCustomDefaults = false,
  isAtCustomDefaults = false,
  isAtFactoryDefaults = false,
  onRevertToCustomDefaults,
  onResetToFactoryDefaults,
  exitBookmarkReminderEnabled = true,
  onExitBookmarkReminderChange,
}) => {
  const activeTheme = getReaderTheme(theme);

  return (
    <ReaderDrawerShell
      isOpen={isOpen}
      onClose={onClose}
      title="Typography & Reading Mode"
      titleIcon={
        <Type className={`w-4 h-4 ${activeTheme.iconAccent}`} />
      }
      theme={theme}
      ariaLabel="Reading Controls"
      closeAriaLabel="Close Appearance Controls"
      backdropTestId="controls-backdrop"
      className="overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="region"
    >

      <div className="space-y-3 text-xs font-mono">
        {/* Surface Theme */}
        <div>
          <label className={`block ${activeTheme.textMuted} mb-1.5 uppercase tracking-wider text-[10px]`}>
            Reading Surface
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onThemeChange('light')}
              aria-pressed={theme === 'light'}
              className={`p-2 rounded-lg border flex items-center justify-center gap-1.5 transition-colors ${
                theme === 'light'
                  ? `${activeTheme.activePill} border-primary-600 font-bold shadow-xs`
                  : `${activeTheme.pill} ${activeTheme.inactivePill}`
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" /> Light
            </button>
            <button
              type="button"
              onClick={() => onThemeChange('sepia')}
              aria-pressed={theme === 'sepia'}
              className={`p-2 rounded-lg border flex items-center justify-center gap-1.5 transition-colors ${
                theme === 'sepia'
                  ? `${activeTheme.activePill} border-[#f59e0b] font-bold shadow-xs`
                  : `${activeTheme.pill} ${activeTheme.inactivePill}`
              }`}
            >
              <Coffee className="w-3.5 h-3.5 text-amber-700" /> Sepia
            </button>
            <button
              type="button"
              onClick={() => onThemeChange('dark')}
              aria-pressed={theme === 'dark'}
              className={`p-2 rounded-lg border flex items-center justify-center gap-1.5 transition-colors ${
                theme === 'dark'
                  ? `${activeTheme.activePill} border-primary-500 font-bold shadow-xs`
                  : `${activeTheme.pill} ${activeTheme.inactivePill}`
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-indigo-400" /> Dark
            </button>
          </div>
        </div>

        {/* Page Brightness (Google Play Books Style) */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label
              htmlFor="reader-brightness-slider"
              className={`flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider ${activeTheme.textMuted}`}
            >
              <Sun className="w-3 h-3 text-amber-500" />
              Page Brightness
            </label>
            <span
              data-testid="reader-brightness-value"
              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${activeTheme.border} ${activeTheme.pill}`}
            >
              {brightness}%
            </span>
          </div>
          <input
            id="reader-brightness-slider"
            type="range"
            min={READER_FONT_CONFIG.MIN_BRIGHTNESS}
            max={READER_FONT_CONFIG.MAX_BRIGHTNESS}
            step="5"
            value={brightness}
            onChange={(e) => onBrightnessChange?.(Number(e.target.value))}
            aria-label="Page brightness percentage"
            aria-valuemin={READER_FONT_CONFIG.MIN_BRIGHTNESS}
            aria-valuemax={READER_FONT_CONFIG.MAX_BRIGHTNESS}
            aria-valuenow={brightness}
            className={`w-full cursor-pointer h-1.5 rounded-lg ${
              theme === 'sepia'
                ? 'accent-amber-500 bg-[#462e22]'
                : 'accent-primary-600 bg-stone-200 dark:bg-stone-700'
            }`}
          />
          <div className="grid grid-cols-3 gap-1 mt-1.5">
            {READER_FONT_CONFIG.PRESET_BRIGHTNESS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => onBrightnessChange?.(b)}
                aria-pressed={brightness === b}
                className={`py-0.5 rounded text-[9px] font-mono border transition-colors ${
                  brightness === b
                    ? `${activeTheme.activePill} ${theme === 'sepia' ? 'border-[#f59e0b]' : 'border-primary-600'} font-bold`
                    : `${activeTheme.pill} ${activeTheme.inactivePill}`
                }`}
              >
                {b}%
              </button>
            ))}
          </div>
        </div>

        {/* Font Family */}
        <div>
          <label className={`block ${activeTheme.textMuted} mb-2 uppercase tracking-wider text-[10px]`}>
            Typeface
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['serif', 'sans', 'mono'] as const).map((fam) => (
              <button
                key={fam}
                type="button"
                onClick={() => onFontFamilyChange(fam)}
                aria-pressed={fontFamily === fam}
                aria-label={`Font family ${fam}`}
                className={`p-2 rounded-lg border text-sm capitalize transition-colors ${
                  fam === 'serif' ? 'font-serif' : fam === 'mono' ? 'font-mono' : 'font-sans'
                } ${
                  fontFamily === fam
                    ? `${activeTheme.activePill} ${theme === 'sepia' ? 'border-[#f59e0b]' : 'border-primary-600 dark:border-primary-500/70'} font-bold shadow-xs`
                    : `${activeTheme.pill} ${activeTheme.inactivePill}`
                }`}
              >
                {fam.charAt(0).toUpperCase() + fam.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Font Size & Line Height Sliders */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className={`text-[10px] uppercase font-bold tracking-wider ${activeTheme.textMuted}`}>Size</span>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${activeTheme.border} ${activeTheme.pill}`}>
                {fontSize}px
              </span>
            </div>
            <input
              type="range"
              min={READER_FONT_CONFIG.MIN_SIZE}
              max={READER_FONT_CONFIG.MAX_SIZE}
              step="1"
              value={fontSize}
              onChange={(e) => onFontSizeChange(Number(e.target.value))}
              aria-label="Font size in pixels"
              aria-valuemin={READER_FONT_CONFIG.MIN_SIZE}
              aria-valuemax={READER_FONT_CONFIG.MAX_SIZE}
              aria-valuenow={fontSize}
              className={`w-full cursor-pointer h-1.5 rounded-lg ${
                theme === 'sepia'
                  ? 'accent-amber-500 bg-[#462e22]'
                  : 'accent-primary-600 bg-stone-200 dark:bg-stone-700'
              }`}
            />
            <div className="grid grid-cols-3 gap-1 mt-1.5">
              {READER_FONT_CONFIG.PRESET_SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onFontSizeChange(s)}
                  className={`py-0.5 rounded text-[9px] font-mono border transition-colors ${
                    fontSize === s
                      ? `${activeTheme.activePill} ${theme === 'sepia' ? 'border-[#f59e0b]' : 'border-primary-600'} font-bold`
                      : `${activeTheme.pill} ${activeTheme.inactivePill}`
                  }`}
                >
                  {s}px
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className={`text-[10px] uppercase font-bold tracking-wider ${activeTheme.textMuted}`}>Line Spacing</span>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${activeTheme.border} ${activeTheme.pill}`}>
                {lineHeight}
              </span>
            </div>
            <input
              type="range"
              min="1.2"
              max="2.6"
              step="0.1"
              value={lineHeight}
              onChange={(e) => onLineHeightChange(Number(e.target.value))}
              aria-label="Line height spacing"
              aria-valuemin={1.2}
              aria-valuemax={2.6}
              aria-valuenow={lineHeight}
              className={`w-full cursor-pointer h-1.5 rounded-lg ${
                theme === 'sepia'
                  ? 'accent-amber-500 bg-[#462e22]'
                  : 'accent-primary-600 bg-stone-200 dark:bg-stone-700'
              }`}
            />
            <div className="grid grid-cols-3 gap-1 mt-1.5">
              {[1.4, 1.8, 2.2].map((lh) => (
                <button
                  key={lh}
                  type="button"
                  onClick={() => onLineHeightChange(lh)}
                  className={`py-0.5 rounded text-[9px] font-mono border transition-colors ${
                    lineHeight === lh
                      ? `${activeTheme.activePill} ${theme === 'sepia' ? 'border-[#f59e0b]' : 'border-primary-600'} font-bold`
                      : `${activeTheme.pill} ${activeTheme.inactivePill}`
                  }`}
                >
                  {lh}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Reading Mode & Page Width */}
        <div className={`pt-3 border-t ${activeTheme.border} grid grid-cols-2 gap-3`}>
          <div>
            <label className={`block ${activeTheme.textMuted} mb-1.5 uppercase text-[10px]`}>Paging</label>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => onReadingModeChange('paginated')}
                aria-pressed={readingMode === 'paginated'}
                className={`p-1.5 rounded text-[11px] border flex items-center justify-center gap-1 transition-colors ${
                  readingMode === 'paginated'
                    ? `${activeTheme.activePill} ${theme === 'sepia' ? 'border-[#f59e0b]' : 'border-primary-600 dark:border-primary-500/70'} font-bold shadow-xs`
                    : `${activeTheme.pill} ${activeTheme.inactivePill}`
                }`}
              >
                <Columns className="w-3 h-3" /> Page
              </button>
              <button
                type="button"
                onClick={() => onReadingModeChange('scroll')}
                aria-pressed={readingMode === 'scroll'}
                className={`p-1.5 rounded text-[11px] border flex items-center justify-center gap-1 transition-colors ${
                  readingMode === 'scroll'
                    ? `${activeTheme.activePill} ${theme === 'sepia' ? 'border-[#f59e0b]' : 'border-primary-600 dark:border-primary-500/70'} font-bold shadow-xs`
                    : `${activeTheme.pill} ${activeTheme.inactivePill}`
                }`}
              >
                <AlignLeft className="w-3 h-3" /> Scroll
              </button>
            </div>
          </div>

          <div>
            <label className={`block ${activeTheme.textMuted} mb-1.5 uppercase text-[10px]`}>Width</label>
            <div className="grid grid-cols-3 gap-1">
              {(['narrow', 'normal', 'wide'] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => onColumnWidthChange(w)}
                  aria-pressed={columnWidth === w}
                  className={`py-1.5 px-1 rounded text-[10px] sm:text-[11px] font-mono border capitalize text-center transition-colors ${
                    columnWidth === w
                      ? `${activeTheme.activePill} ${theme === 'sepia' ? 'border-[#f59e0b]' : 'border-primary-600 dark:border-primary-500/70'} font-bold shadow-xs`
                      : `${activeTheme.pill} ${activeTheme.inactivePill}`
                  }`}
                >
                  {w.charAt(0).toUpperCase() + w.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Reading Behavior & Exit Reminder */}
        {onExitBookmarkReminderChange && (
          <div className={`pt-3 border-t ${activeTheme.border} flex items-center justify-between gap-3`}>
            <div>
              <span className="block font-medium text-[11px] text-foreground">
                Exit Bookmark Prompt
              </span>
              <span className={`block text-[10px] ${activeTheme.textMuted} leading-tight`}>
                Remind to set line ribbon or keep in Bookmarks when closing
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={exitBookmarkReminderEnabled}
              aria-label="Toggle Exit Bookmark Prompt"
              data-testid="reader-toggle-exit-bookmark-prompt"
              onClick={() => onExitBookmarkReminderChange(!exitBookmarkReminderEnabled)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                exitBookmarkReminderEnabled
                  ? theme === 'sepia' ? 'bg-[#f59e0b]' : 'bg-primary'
                  : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  exitBookmarkReminderEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        )}

        {/* Preset & Factory Reset Footer */}
        {(onRevertToCustomDefaults || onResetToFactoryDefaults) && (
          <div className={`pt-3 border-t ${activeTheme.border} flex items-center justify-between gap-2`}>
            {hasCustomDefaults && onRevertToCustomDefaults && (
              <button
                type="button"
                data-testid="reader-revert-custom-defaults-btn"
                onClick={onRevertToCustomDefaults}
                disabled={isAtCustomDefaults}
                className={`flex-1 py-1.5 px-2.5 rounded-lg border text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default ${activeTheme.pill} ${activeTheme.inactivePill}`}
              >
                <Undo2 className="w-3 h-3 shrink-0" />
                <span>My Default</span>
              </button>
            )}
            {onResetToFactoryDefaults && (
              <button
                type="button"
                data-testid="reader-reset-factory-defaults-btn"
                onClick={onResetToFactoryDefaults}
                disabled={isAtFactoryDefaults}
                className={`flex-1 py-1.5 px-2.5 rounded-lg border text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default ${activeTheme.pill} ${activeTheme.inactivePill}`}
              >
                <RotateCcw className="w-3 h-3 shrink-0" />
                <span>Factory Reset</span>
              </button>
            )}
          </div>
        )}
      </div>
    </ReaderDrawerShell>
  );
};
