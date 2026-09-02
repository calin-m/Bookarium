'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Type, Sun, Moon, Coffee, AlignLeft, Columns } from 'lucide-react';
import type { ReaderTheme, ReaderFontFamily } from '@/stores/useReaderStore';
import { getReaderTheme } from '@/config/reader-themes';
import { useHasMounted } from '@/hooks/useHasMounted';

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
  const hasMounted = useHasMounted();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!hasMounted) return null;

  const activeTheme = getReaderTheme(theme);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Click-outside backdrop with transparent background to preserve reading text visibility */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9998] bg-transparent"
            onClick={onClose}
            aria-hidden="true"
            data-testid="controls-backdrop"
          />

          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={`fixed top-[6.75rem] sm:top-[7.25rem] inset-x-3 sm:inset-x-auto sm:right-6 md:right-8 w-auto max-w-sm sm:w-96 mx-auto sm:mx-0 z-[9999] max-h-[calc(100dvh-8.5rem)] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-xl ${activeTheme.drawerBg} border ${activeTheme.border} shadow-2xl p-4 sm:p-4.5 origin-top sm:origin-top-right`}
            role="region"
            aria-label="Reading Controls"
          >
      <div className={`flex items-center justify-between pb-2 mb-3 border-b ${activeTheme.border}`}>
        <h3 className="font-serif font-bold text-sm flex items-center gap-2">
          <Type className={`w-4 h-4 ${theme === 'sepia' ? 'text-amber-500' : 'text-primary-600 dark:text-primary-400'}`} /> Typography & Reading Mode
        </h3>
        <button
          type="button"
          onClick={onClose}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer active:scale-95 ${activeTheme.button}`}
          aria-label="Close Appearance Controls"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

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
              className={`p-2 rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
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
              className={`p-2 rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
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
              className={`p-2 rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                theme === 'dark'
                  ? `${activeTheme.activePill} border-primary-500 font-bold shadow-xs`
                  : `${activeTheme.pill} ${activeTheme.inactivePill}`
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-indigo-400" /> Dark
            </button>
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
                className={`p-2 rounded-lg border text-sm capitalize transition-all ${
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
              min="12"
              max="36"
              step="1"
              value={fontSize}
              onChange={(e) => onFontSizeChange(Number(e.target.value))}
              aria-label="Font size in pixels"
              aria-valuemin={12}
              aria-valuemax={36}
              aria-valuenow={fontSize}
              className={`w-full cursor-pointer h-1.5 rounded-lg ${
                theme === 'sepia'
                  ? 'accent-amber-500 bg-[#462e22]'
                  : 'accent-primary-600 bg-stone-200 dark:bg-stone-700'
              }`}
            />
            <div className="grid grid-cols-3 gap-1 mt-1.5">
              {[14, 18, 24].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onFontSizeChange(s)}
                  className={`py-0.5 rounded text-[9px] font-mono border transition-all ${
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
                  className={`py-0.5 rounded text-[9px] font-mono border transition-all ${
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
                className={`p-1.5 rounded text-[11px] border flex items-center justify-center gap-1 transition-all ${
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
                className={`p-1.5 rounded text-[11px] border flex items-center justify-center gap-1 transition-all ${
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
                  className={`py-1.5 px-1 rounded text-[10px] sm:text-[11px] font-mono border capitalize text-center transition-all ${
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
      </div>
    </motion.div>
  </>
)}
</AnimatePresence>,
  document.body
);
};
