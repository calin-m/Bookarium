'use client';

import React from 'react';
import { Type, Sun, Moon, Coffee, AlignLeft, Columns, Undo2, RotateCcw } from 'lucide-react';
import type { ReaderTheme, ReaderFontFamily } from '@/stores/useReaderStore';
import { getReaderTheme } from '@/config/reader-themes';
import { READER_FONT_CONFIG } from '@/config/reader-config';
import { ReaderDrawerShell } from './ReaderDrawerShell';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Switch } from '@/components/ui/Switch';

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
          <SegmentedControl<ReaderTheme>
            value={theme}
            onChange={onThemeChange}
            className="grid grid-cols-3 gap-2"
            optionClassName="p-2 rounded-lg border flex items-center justify-center gap-1.5 transition-colors"
            inactiveClassName={`${activeTheme.pill} ${activeTheme.inactivePill}`}
            options={[
              {
                value: 'light',
                icon: <Sun className="w-3.5 h-3.5 text-amber-500" />,
                label: 'Light',
                activeClassName: `${activeTheme.activePill} border-primary-600 font-bold shadow-xs`,
              },
              {
                value: 'sepia',
                icon: <Coffee className="w-3.5 h-3.5 text-amber-700" />,
                label: 'Sepia',
                activeClassName: `${activeTheme.activePill} border-[#f59e0b] font-bold shadow-xs`,
              },
              {
                value: 'dark',
                icon: <Moon className="w-3.5 h-3.5 text-indigo-400" />,
                label: 'Dark',
                activeClassName: `${activeTheme.activePill} border-primary-500 font-bold shadow-xs`,
              },
            ]}
          />
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
          <SegmentedControl<number>
            value={brightness}
            onChange={(b) => onBrightnessChange?.(b)}
            className="grid grid-cols-3 gap-1 mt-1.5"
            optionClassName="py-0.5 rounded text-[9px] font-mono border transition-colors"
            activeClassName={`${activeTheme.activePill} ${
              theme === 'sepia' ? 'border-[#f59e0b]' : 'border-primary-600'
            } font-bold`}
            inactiveClassName={`${activeTheme.pill} ${activeTheme.inactivePill}`}
            options={READER_FONT_CONFIG.PRESET_BRIGHTNESS.map((b) => ({
              value: b,
              label: `${b}%`,
            }))}
          />
        </div>

        {/* Font Family */}
        <div>
          <label className={`block ${activeTheme.textMuted} mb-2 uppercase tracking-wider text-[10px]`}>
            Typeface
          </label>
          <SegmentedControl<ReaderFontFamily>
            value={fontFamily}
            onChange={onFontFamilyChange}
            className="grid grid-cols-3 gap-2"
            optionClassName="p-2 rounded-lg border text-sm capitalize transition-colors"
            activeClassName={`${activeTheme.activePill} ${
              theme === 'sepia' ? 'border-[#f59e0b]' : 'border-primary-600 dark:border-primary-500/70'
            } font-bold shadow-xs`}
            inactiveClassName={`${activeTheme.pill} ${activeTheme.inactivePill}`}
            options={(['serif', 'sans', 'mono'] as const).map((fam) => ({
              value: fam,
              label: fam.charAt(0).toUpperCase() + fam.slice(1),
              ariaLabel: `Font family ${fam}`,
              className: fam === 'serif' ? 'font-serif' : fam === 'mono' ? 'font-mono' : 'font-sans',
            }))}
          />
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
            <SegmentedControl<number>
              value={fontSize}
              onChange={onFontSizeChange}
              emitAriaPressed={false}
              className="grid grid-cols-3 gap-1 mt-1.5"
              optionClassName="py-0.5 rounded text-[9px] font-mono border transition-colors"
              activeClassName={`${activeTheme.activePill} ${
                theme === 'sepia' ? 'border-[#f59e0b]' : 'border-primary-600'
              } font-bold`}
              inactiveClassName={`${activeTheme.pill} ${activeTheme.inactivePill}`}
              options={READER_FONT_CONFIG.PRESET_SIZES.map((s) => ({
                value: s,
                label: `${s}px`,
              }))}
            />
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
            <SegmentedControl<number>
              value={lineHeight}
              onChange={onLineHeightChange}
              emitAriaPressed={false}
              className="grid grid-cols-3 gap-1 mt-1.5"
              optionClassName="py-0.5 rounded text-[9px] font-mono border transition-colors"
              activeClassName={`${activeTheme.activePill} ${
                theme === 'sepia' ? 'border-[#f59e0b]' : 'border-primary-600'
              } font-bold`}
              inactiveClassName={`${activeTheme.pill} ${activeTheme.inactivePill}`}
              options={[1.4, 1.8, 2.2].map((lh) => ({
                value: lh,
                label: lh,
              }))}
            />
          </div>
        </div>

        {/* Reading Mode & Page Width */}
        <div className={`pt-3 border-t ${activeTheme.border} grid grid-cols-2 gap-3`}>
          <div>
            <label className={`block ${activeTheme.textMuted} mb-1.5 uppercase text-[10px]`}>Paging</label>
            <SegmentedControl<'paginated' | 'scroll'>
              value={readingMode}
              onChange={onReadingModeChange}
              className="grid grid-cols-2 gap-1"
              optionClassName="p-1.5 rounded text-[11px] border flex items-center justify-center gap-1 transition-colors"
              activeClassName={`${activeTheme.activePill} ${
                theme === 'sepia' ? 'border-[#f59e0b]' : 'border-primary-600 dark:border-primary-500/70'
              } font-bold shadow-xs`}
              inactiveClassName={`${activeTheme.pill} ${activeTheme.inactivePill}`}
              options={[
                { value: 'paginated', icon: <Columns className="w-3 h-3" />, label: 'Page' },
                { value: 'scroll', icon: <AlignLeft className="w-3 h-3" />, label: 'Scroll' },
              ]}
            />
          </div>

          <div>
            <label className={`block ${activeTheme.textMuted} mb-1.5 uppercase text-[10px]`}>Width</label>
            <SegmentedControl<'narrow' | 'normal' | 'wide'>
              value={columnWidth}
              onChange={onColumnWidthChange}
              className="grid grid-cols-3 gap-1"
              optionClassName="py-1.5 px-1 rounded text-[10px] sm:text-[11px] font-mono border capitalize text-center transition-colors"
              activeClassName={`${activeTheme.activePill} ${
                theme === 'sepia' ? 'border-[#f59e0b]' : 'border-primary-600 dark:border-primary-500/70'
              } font-bold shadow-xs`}
              inactiveClassName={`${activeTheme.pill} ${activeTheme.inactivePill}`}
              options={(['narrow', 'normal', 'wide'] as const).map((w) => ({
                value: w,
                label: w.charAt(0).toUpperCase() + w.slice(1),
              }))}
            />
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
            <Switch
              mode="button"
              checked={exitBookmarkReminderEnabled}
              onCheckedChange={onExitBookmarkReminderChange}
              ariaLabel="Toggle Exit Bookmark Prompt"
              dataTestId="reader-toggle-exit-bookmark-prompt"
              className={
                exitBookmarkReminderEnabled
                  ? theme === 'sepia'
                    ? 'bg-[#f59e0b]'
                    : 'bg-primary'
                  : 'bg-muted-foreground/30'
              }
            />
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
