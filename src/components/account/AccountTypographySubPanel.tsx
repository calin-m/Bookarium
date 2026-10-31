'use client';

import React from 'react';
import {
  Type,
  Sun,
  AlignLeft,
  Columns,
  Shield,
  Check,
} from 'lucide-react';
import { READER_FONT_CONFIG } from '@/config/reader-config';
import type { AppTheme } from '@/stores/useThemeStore';
import type {
  ReaderFontFamily,
  ReaderReadingMode,
  ReaderColumnWidth,
} from '@/stores/useReaderStore';

export interface AccountTypographySubPanelProps {
  theme: AppTheme;
  fontFamily: ReaderFontFamily;
  onFontFamilyChange: (family: ReaderFontFamily) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  lineHeight: number;
  onLineHeightChange: (height: number) => void;
  brightness: number;
  onBrightnessChange: (brightness: number) => void;
  readingMode: ReaderReadingMode;
  onReadingModeChange: (mode: ReaderReadingMode) => void;
  columnWidth: ReaderColumnWidth;
  onColumnWidthChange: (width: ReaderColumnWidth) => void;
  spoilerShieldEnabled: boolean;
  onSpoilerShieldChange: (enabled: boolean) => void;
}

const LINE_HEIGHT_PRESETS = [1.4, 1.75, 2.1] as const;

export const AccountTypographySubPanel: React.FC<AccountTypographySubPanelProps> = ({
  theme,
  fontFamily,
  onFontFamilyChange,
  fontSize,
  onFontSizeChange,
  lineHeight,
  onLineHeightChange,
  brightness,
  onBrightnessChange,
  readingMode,
  onReadingModeChange,
  columnWidth,
  onColumnWidthChange,
  spoilerShieldEnabled,
  onSpoilerShieldChange,
}) => {
  const fontClass =
    fontFamily === 'sans'
      ? 'font-sans'
      : fontFamily === 'mono'
        ? 'font-mono'
        : 'font-serif';

  const previewSurfaceClass =
    theme === 'dark'
      ? 'bg-[#12161f] text-[#e2e8f0] border-[#1e293b]'
      : theme === 'sepia'
        ? 'bg-[#f4ecd8] text-[#3d2b1f] border-[#d6c7b2]'
        : 'bg-[#fcfbf9] text-[#1c1917] border-[#e7e5e4]';

  return (
    <div className="space-y-6 pt-4 border-t border-border">
      {/* Section Header & Live Editorial Specimen Preview */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <label className="text-xs font-mono text-foreground font-bold flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Reader Typography & Layout Defaults</span>
          </label>
          <span
            data-testid="preferences-typography-summary"
            className="text-[11px] font-mono text-muted-foreground"
          >
            {fontFamily.toUpperCase()} • {fontSize}px • {lineHeight.toFixed(2)}x • {brightness}%
          </span>
        </div>

        {/* Live Specimen Preview */}
        <div
          data-testid="preferences-typography-preview"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight,
            filter: brightness < 100 ? `brightness(${brightness / 100})` : undefined,
          }}
          className={`p-4 rounded-xl border transition-all duration-150 ${previewSurfaceClass} ${fontClass}`}
        >
          <p className="select-none">
            &ldquo;It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.&rdquo;
          </p>
        </div>
      </div>

      {/* Typeface Family */}
      <div className="space-y-2">
        <label className="text-xs font-mono text-foreground font-bold block">
          Default Typeface
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              { id: 'serif', label: 'Serif', sampleClass: 'font-serif' },
              { id: 'sans', label: 'Sans', sampleClass: 'font-sans' },
              { id: 'mono', label: 'Mono', sampleClass: 'font-mono' },
            ] as const
          ).map((item) => {
            const isSelected = fontFamily === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onFontFamilyChange(item.id)}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${item.sampleClass} ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-primary shadow-xs'
                    : 'bg-muted/30 border-border hover:bg-muted text-muted-foreground'
                }`}
              >
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Font Size & Line Spacing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Font Size */}
        <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-foreground">Font Size</span>
            <span
              data-testid="preferences-font-size-value"
              className="text-[11px] font-mono font-bold text-primary"
            >
              {fontSize}px
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onFontSizeChange(Math.max(READER_FONT_CONFIG.MIN_SIZE, fontSize - 2))
              }
              disabled={fontSize <= READER_FONT_CONFIG.MIN_SIZE}
              aria-label="Decrease default font size"
              className="flex-1 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-mono font-bold text-foreground disabled:opacity-40 cursor-pointer transition-colors"
            >
              A-
            </button>
            <button
              type="button"
              onClick={() =>
                onFontSizeChange(Math.min(READER_FONT_CONFIG.MAX_SIZE, fontSize + 2))
              }
              disabled={fontSize >= READER_FONT_CONFIG.MAX_SIZE}
              aria-label="Increase default font size"
              className="flex-1 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-mono font-bold text-foreground disabled:opacity-40 cursor-pointer transition-colors"
            >
              A+
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {READER_FONT_CONFIG.PRESET_SIZES.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={fontSize === preset}
                onClick={() => onFontSizeChange(preset)}
                className={`py-1 rounded-md border text-[10px] font-mono transition-colors cursor-pointer ${
                  fontSize === preset
                    ? 'bg-primary/10 border-primary text-primary font-bold'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {preset}px
              </button>
            ))}
          </div>
        </div>

        {/* Line Spacing */}
        <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-foreground">Line Spacing</span>
            <span
              data-testid="preferences-line-height-value"
              className="text-[11px] font-mono font-bold text-primary"
            >
              {lineHeight.toFixed(2)}x
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onLineHeightChange(Math.max(1.2, Number((lineHeight - 0.1).toFixed(2))))
              }
              disabled={lineHeight <= 1.2}
              aria-label="Decrease default line spacing"
              className="flex-1 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-mono font-bold text-foreground disabled:opacity-40 cursor-pointer transition-colors"
            >
              Tighter
            </button>
            <button
              type="button"
              onClick={() =>
                onLineHeightChange(Math.min(2.6, Number((lineHeight + 0.1).toFixed(2))))
              }
              disabled={lineHeight >= 2.6}
              aria-label="Increase default line spacing"
              className="flex-1 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-mono font-bold text-foreground disabled:opacity-40 cursor-pointer transition-colors"
            >
              Wider
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {LINE_HEIGHT_PRESETS.map((preset) => {
              const isMatch = Math.abs(lineHeight - preset) < 0.03;
              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={isMatch}
                  onClick={() => onLineHeightChange(preset)}
                  className={`py-1 rounded-md border text-[10px] font-mono transition-colors cursor-pointer ${
                    isMatch
                      ? 'bg-primary/10 border-primary text-primary font-bold'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {preset}x
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Page Brightness */}
      <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="preferences-brightness-slider"
            className="text-xs font-mono font-bold text-foreground flex items-center gap-1.5"
          >
            <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Default Page Brightness</span>
          </label>
          <span
            data-testid="preferences-brightness-value"
            className="text-[11px] font-mono font-bold text-primary"
          >
            {brightness}%
          </span>
        </div>
        <input
          id="preferences-brightness-slider"
          type="range"
          min={READER_FONT_CONFIG.MIN_BRIGHTNESS}
          max={READER_FONT_CONFIG.MAX_BRIGHTNESS}
          step={5}
          value={brightness}
          onChange={(e) => onBrightnessChange(Number(e.target.value))}
          aria-label="Default Page Brightness"
          className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-amber-500 bg-border"
        />
        <div className="grid grid-cols-3 gap-1.5">
          {READER_FONT_CONFIG.PRESET_BRIGHTNESS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={brightness === preset}
              onClick={() => onBrightnessChange(preset)}
              className={`py-1 rounded-md border text-[10px] font-mono transition-colors cursor-pointer ${
                brightness === preset
                  ? 'bg-primary/10 border-primary text-primary font-bold'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {preset}%
            </button>
          ))}
        </div>
      </div>

      {/* Reading Flow Mode & Page Column Width */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Reading Mode */}
        <div className="space-y-2">
          <label className="text-xs font-mono text-foreground font-bold flex items-center gap-1.5">
            <AlignLeft className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Default Reading Flow</span>
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              aria-pressed={readingMode === 'paginated'}
              onClick={() => onReadingModeChange('paginated')}
              className={`p-2.5 rounded-xl border text-xs font-mono font-bold transition-colors cursor-pointer ${
                readingMode === 'paginated'
                  ? 'bg-primary/10 border-primary text-primary shadow-xs'
                  : 'bg-muted/30 border-border hover:bg-muted text-muted-foreground'
              }`}
            >
              Paged
            </button>
            <button
              type="button"
              aria-pressed={readingMode === 'scroll'}
              onClick={() => onReadingModeChange('scroll')}
              className={`p-2.5 rounded-xl border text-xs font-mono font-bold transition-colors cursor-pointer ${
                readingMode === 'scroll'
                  ? 'bg-primary/10 border-primary text-primary shadow-xs'
                  : 'bg-muted/30 border-border hover:bg-muted text-muted-foreground'
              }`}
            >
              Scroll
            </button>
          </div>
        </div>

        {/* Column Width */}
        <div className="space-y-2">
          <label className="text-xs font-mono text-foreground font-bold flex items-center gap-1.5">
            <Columns className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Default Page Width</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['narrow', 'normal', 'wide'] as const).map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={columnWidth === w}
                onClick={() => onColumnWidthChange(w)}
                className={`p-2.5 rounded-xl border text-xs font-mono font-bold capitalize transition-colors cursor-pointer ${
                  columnWidth === w
                    ? 'bg-primary/10 border-primary text-primary shadow-xs'
                    : 'bg-muted/30 border-border hover:bg-muted text-muted-foreground'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Symposium Spoiler Shield */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <label className="text-xs font-mono text-foreground font-bold flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Symposium Spoiler Shield</span>
          </label>
          <span className="text-[11px] font-mono text-muted-foreground">
            {spoilerShieldEnabled ? 'Spoiler Shield Active' : 'All Marginalia Visible'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            aria-pressed={spoilerShieldEnabled}
            onClick={() => onSpoilerShieldChange(true)}
            className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border text-left transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
              spoilerShieldEnabled
                ? 'bg-primary/10 border-primary text-foreground shadow-xs'
                : 'bg-card border-border hover:bg-muted/60 text-muted-foreground'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-mono font-bold text-foreground">
                Shield Active (Hide Ahead)
              </span>
              {spoilerShieldEnabled && <Check className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-[11px] font-sans text-muted-foreground leading-relaxed">
              Conceals Fellow Scholars&apos; shared highlights and notes located beyond your current chapter.
            </p>
          </button>

          <button
            type="button"
            aria-pressed={!spoilerShieldEnabled}
            onClick={() => onSpoilerShieldChange(false)}
            className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border text-left transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
              !spoilerShieldEnabled
                ? 'bg-primary/10 border-primary text-foreground shadow-xs'
                : 'bg-card border-border hover:bg-muted/60 text-muted-foreground'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-mono font-bold text-foreground">
                Show All Marginalia
              </span>
              {!spoilerShieldEnabled && <Check className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-[11px] font-sans text-muted-foreground leading-relaxed">
              Displays all shared Symposium notes throughout the book regardless of your current reading position.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};

