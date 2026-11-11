'use client';

import React, { useState, useEffect } from 'react';
import { Palette } from 'lucide-react';
import type { HighlightColor } from '@/stores/useAnnotationStore';
import {
  ANNOTATION_COLOR_CONFIG,
  ANNOTATION_COLOR_LIST,
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
> = {
  yellow: {
    border: ANNOTATION_COLOR_CONFIG.yellow.cardBorderClass,
    bg: ANNOTATION_COLOR_CONFIG.yellow.cardBgClass,
    text: ANNOTATION_COLOR_CONFIG.yellow.cardTextClass,
  },
  amber: {
    border: ANNOTATION_COLOR_CONFIG.amber.cardBorderClass,
    bg: ANNOTATION_COLOR_CONFIG.amber.cardBgClass,
    text: ANNOTATION_COLOR_CONFIG.amber.cardTextClass,
  },
  mint: {
    border: ANNOTATION_COLOR_CONFIG.mint.cardBorderClass,
    bg: ANNOTATION_COLOR_CONFIG.mint.cardBgClass,
    text: ANNOTATION_COLOR_CONFIG.mint.cardTextClass,
  },
  rose: {
    border: ANNOTATION_COLOR_CONFIG.rose.cardBorderClass,
    bg: ANNOTATION_COLOR_CONFIG.rose.cardBgClass,
    text: ANNOTATION_COLOR_CONFIG.rose.cardTextClass,
  },
};

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

      {isColorPickerOpen && (
        <div
          data-testid={`quick-color-popover-${annotationId}`}
          className="absolute right-0 top-full mt-1.5 z-20 p-1.5 rounded-xl border border-border bg-card shadow-booksaw flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md"
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
        </div>
      )}
    </div>
  );
};
