'use client';

import React from 'react';
import { X, Type, Sun, Moon, Coffee, AlignLeft, Columns } from 'lucide-react';
import type { ReaderTheme, ReaderFontFamily } from '@/stores/useReaderStore';

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
  readingMode: 'paginated' | 'scroll';
  onReadingModeChange: (mode: 'paginated' | 'scroll') => void;
  columnWidth: 'narrow' | 'normal' | 'wide';
  onColumnWidthChange: (width: 'narrow' | 'normal' | 'wide') => void;
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
  readingMode,
  onReadingModeChange,
  columnWidth,
  onColumnWidthChange,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="absolute top-16 right-4 sm:right-6 z-50 w-80 sm:w-96 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl p-5 text-stone-900 dark:text-stone-100 transition-all"
      role="region"
      aria-label="Reading Controls"
    >
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-200 dark:border-stone-800">
        <h3 className="font-serif font-bold text-sm flex items-center gap-2">
          <Type className="w-4 h-4 text-primary-600" /> Typography & Reading Mode
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
          aria-label="Close Appearance Controls"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4 text-xs font-mono">
        {/* Surface Theme */}
        <div>
          <label className="block text-stone-500 dark:text-stone-400 mb-2 uppercase tracking-wider text-[10px]">
            Reading Surface
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onThemeChange('light')}
              className={`p-2.5 rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                theme === 'light'
                  ? 'border-primary-600 bg-stone-100 text-stone-950 font-bold shadow-xs'
                  : 'border-stone-200 dark:border-stone-700 bg-white text-stone-700'
              }`}
            >
              <Sun className="w-3.5 h-3.5" /> Light
            </button>
            <button
              type="button"
              onClick={() => onThemeChange('sepia')}
              className={`p-2.5 rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                theme === 'sepia'
                  ? 'border-amber-700 bg-[#f4ebd9] text-[#2c1d11] font-bold shadow-xs'
                  : 'border-amber-200 bg-[#faf6ed] text-[#4a3525]'
              }`}
            >
              <Coffee className="w-3.5 h-3.5" /> Sepia
            </button>
            <button
              type="button"
              onClick={() => onThemeChange('dark')}
              className={`p-2.5 rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                theme === 'dark'
                  ? 'border-primary-500 bg-stone-950 text-white font-bold shadow-xs'
                  : 'border-stone-700 bg-stone-800 text-stone-300'
              }`}
            >
              <Moon className="w-3.5 h-3.5" /> Dark
            </button>
          </div>
        </div>

        {/* Font Family */}
        <div>
          <label className="block text-stone-500 dark:text-stone-400 mb-2 uppercase tracking-wider text-[10px]">
            Typeface
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onFontFamilyChange('serif')}
              className={`p-2 rounded-lg border font-serif text-sm transition-all ${
                fontFamily === 'serif'
                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-950/40 text-primary-900 dark:text-primary-100 font-bold'
                  : 'border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              Serif
            </button>
            <button
              type="button"
              onClick={() => onFontFamilyChange('sans')}
              className={`p-2 rounded-lg border font-sans text-sm transition-all ${
                fontFamily === 'sans'
                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-950/40 text-primary-900 dark:text-primary-100 font-bold'
                  : 'border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              Sans
            </button>
            <button
              type="button"
              onClick={() => onFontFamilyChange('mono')}
              className={`p-2 rounded-lg border font-mono text-sm transition-all ${
                fontFamily === 'mono'
                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-950/40 text-primary-900 dark:text-primary-100 font-bold'
                  : 'border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              Mono
            </button>
          </div>
        </div>

        {/* Font Size & Line Height Sliders */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-stone-500 uppercase">Size</span>
              <span className="text-[10px] font-bold">{fontSize}px</span>
            </div>
            <input
              type="range"
              min="14"
              max="28"
              step="1"
              value={fontSize}
              onChange={(e) => onFontSizeChange(Number(e.target.value))}
              className="w-full accent-primary-600"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-stone-500 uppercase">Line Height</span>
              <span className="text-[10px] font-bold">{lineHeight}</span>
            </div>
            <input
              type="range"
              min="1.4"
              max="2.4"
              step="0.1"
              value={lineHeight}
              onChange={(e) => onLineHeightChange(Number(e.target.value))}
              className="w-full accent-primary-600"
            />
          </div>
        </div>

        {/* Reading Mode & Page Width */}
        <div className="pt-3 border-t border-stone-200 dark:border-stone-800 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-stone-500 mb-1.5 uppercase text-[10px]">Paging</label>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => onReadingModeChange('paginated')}
                className={`p-1.5 rounded text-[11px] border flex items-center justify-center gap-1 ${
                  readingMode === 'paginated'
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-950/40 text-primary-800 dark:text-primary-200 font-bold'
                    : 'border-stone-200 dark:border-stone-700'
                }`}
              >
                <Columns className="w-3 h-3" /> Page
              </button>
              <button
                type="button"
                onClick={() => onReadingModeChange('scroll')}
                className={`p-1.5 rounded text-[11px] border flex items-center justify-center gap-1 ${
                  readingMode === 'scroll'
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-950/40 text-primary-800 dark:text-primary-200 font-bold'
                    : 'border-stone-200 dark:border-stone-700'
                }`}
              >
                <AlignLeft className="w-3 h-3" /> Scroll
              </button>
            </div>
          </div>

          <div>
            <label className="block text-stone-500 mb-1.5 uppercase text-[10px]">Width</label>
            <div className="grid grid-cols-3 gap-1">
              {(['narrow', 'normal', 'wide'] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => onColumnWidthChange(w)}
                  className={`p-1.5 rounded text-[10px] border capitalize text-center ${
                    columnWidth === w
                      ? 'border-primary-600 bg-primary-50 dark:bg-primary-950/40 text-primary-800 dark:text-primary-200 font-bold'
                      : 'border-stone-200 dark:border-stone-700'
                  }`}
                >
                  {w.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

