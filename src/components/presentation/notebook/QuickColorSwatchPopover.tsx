'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette } from 'lucide-react';
import { motionTokens } from '@/components/motion/motion-config';
import type { HighlightColor } from '@/stores/useAnnotationStore';
import {
  ANNOTATION_COLOR_LIST,
  type AnnotationColorTheme,
} from '@/config/annotation-tokens';

export const HIGHLIGHT_COLOR_SWATCHES = ANNOTATION_COLOR_LIST.map((c) => ({
  id: c.id,
  label: c.label,
  pillClass: c.notebookSwatchClass,
  activeRing: c.notebookActiveRing,
}));

export const HIGHLIGHT_CARD_COLORS: Record<
  HighlightColor,
  { border: string; bg: string; text: string }
> = Object.fromEntries(
  ANNOTATION_COLOR_LIST.map((c: AnnotationColorTheme) => [
    c.id,
    {
      border: c.cardBorderClass,
      bg: c.cardBgClass,
      text: c.cardTextClass,
    },
  ])
) as Record<HighlightColor, { border: string; bg: string; text: string }>;

export interface QuickColorSwatchPopoverProps {
  annotationId: string;
  activeColor: HighlightColor;
  savedColor: HighlightColor;
  isEditing?: boolean;
  onSelectColor: (id: string, color: HighlightColor) => Promise<void> | void;
}

/**
 * Self-contained highlight shade badge & quick-picker popover for `NotebookQuoteCard`
 * with outside-pointer and `Escape`-key dismissal.
 */
export const QuickColorSwatchPopover: React.FC<
  QuickColorSwatchPopoverProps
> = ({
  annotationId,
  activeColor,
  savedColor,
  isEditing = false,
  onSelectColor,
}) => {
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [prevIsEditing, setPrevIsEditing] = useState(isEditing);

  if (isEditing !== prevIsEditing) {
    setPrevIsEditing(isEditing);
    if (isEditing) {
      setIsColorPickerOpen(false);
    }
  }

  useEffect(() => {
    if (!isColorPickerOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(`[data-testid="color-badge-container-${annotationId}"]`)
      ) {
        return;
      }
      setIsColorPickerOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsColorPickerOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isColorPickerOpen, annotationId]);

  const colorStyle =
    HIGHLIGHT_CARD_COLORS[activeColor] || HIGHLIGHT_CARD_COLORS.yellow;

  return (
    <div
      className="relative shrink-0"
      data-testid={`color-badge-container-${annotationId}`}
    >
      <button
        type="button"
        onClick={() => setIsColorPickerOpen((prev) => !prev)}
        data-testid={`color-badge-btn-${annotationId}`}
        aria-label={`Highlight color: ${activeColor}. Click to change color.`}
        aria-expanded={isColorPickerOpen}
        title="Click to change highlight color"
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider transition-all hover:scale-105 active:scale-95 cursor-pointer select-none border border-transparent hover:border-current/30 ${colorStyle.bg} ${colorStyle.text}`}
      >
        <span>{activeColor}</span>
        <Palette className="w-2.5 h-2.5 opacity-70" />
      </button>

      <AnimatePresence>
        {isColorPickerOpen && (
          <motion.div
            key={`quick-color-popover-${annotationId}`}
            data-testid={`quick-color-popover-${annotationId}`}
            initial={{ opacity: 0, scale: 0.92, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -4 }}
            transition={{ duration: 0.12, ease: motionTokens.ease.smooth }}
            className="absolute right-0 top-full mt-1.5 z-20 p-1.5 rounded-xl border border-border bg-card shadow-booksaw flex items-center gap-1.5 backdrop-blur-md origin-top-right"
          >
            {HIGHLIGHT_COLOR_SWATCHES.map((c) => {
              const isSelected = savedColor === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-label={`Change highlight color to ${c.label}`}
                  title={`Change to ${c.label}`}
                  onClick={async () => {
                    await onSelectColor(annotationId, c.id);
                    setIsColorPickerOpen(false);
                  }}
                  data-testid={`quick-color-btn-${annotationId}-${c.id}`}
                  className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 active:scale-95 cursor-pointer focus-visible:outline-none ${c.pillClass} ${
                    isSelected ? c.activeRing : ''
                  }`}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
