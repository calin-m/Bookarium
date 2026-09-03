'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Copy, Trash2, Check, X } from 'lucide-react';
import type { HighlightColor } from '@/stores/useAnnotationStore';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { useHasMounted } from '@/hooks/useHasMounted';

export interface TextHighlightPopoverProps {
  isOpen: boolean;
  selectedText: string;
  position: { top: number; left: number } | null;
  activeColor?: HighlightColor;
  existingNote?: string;
  existingAnnotationId?: string;
  onSelectColor: (color: HighlightColor) => void;
  onSaveNote?: (note: string) => void;
  onDelete?: () => void;
  onCopyQuote?: () => void;
  onClose: () => void;
  theme?: ReaderTheme;
}

export const HIGHLIGHT_COLORS: Array<{
  id: HighlightColor;
  label: string;
  pillClass: string;
  activeRing: string;
}> = [
  {
    id: 'yellow',
    label: 'Canary Yellow',
    pillClass: 'bg-amber-300 hover:bg-amber-400 border-amber-400 text-amber-950',
    activeRing: 'ring-2 ring-amber-500 ring-offset-1',
  },
  {
    id: 'amber',
    label: 'Vintage Amber',
    pillClass: 'bg-orange-300 hover:bg-orange-400 border-orange-400 text-orange-950',
    activeRing: 'ring-2 ring-orange-500 ring-offset-1',
  },
  {
    id: 'mint',
    label: 'Calm Mint',
    pillClass: 'bg-emerald-300 hover:bg-emerald-400 border-emerald-400 text-emerald-950',
    activeRing: 'ring-2 ring-emerald-500 ring-offset-1',
  },
  {
    id: 'rose',
    label: 'Soft Rose',
    pillClass: 'bg-rose-300 hover:bg-rose-400 border-rose-400 text-rose-950',
    activeRing: 'ring-2 ring-rose-500 ring-offset-1',
  },
];

export const TextHighlightPopover: React.FC<TextHighlightPopoverProps> = ({
  isOpen,
  selectedText,
  position,
  activeColor,
  existingNote = '',
  existingAnnotationId,
  onSelectColor,
  onSaveNote,
  onDelete,
  onCopyQuote,
  onClose,
  theme = 'light',
}) => {
  const hasMounted = useHasMounted();
  const [isNoteExpanded, setIsNoteExpanded] = useState(Boolean(existingNote));
  const [noteText, setNoteText] = useState(existingNote);
  const [copied, setCopied] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [prevProps, setPrevProps] = useState({ existingNote, isOpen });
  if (prevProps.existingNote !== existingNote || prevProps.isOpen !== isOpen) {
    setPrevProps({ existingNote, isOpen });
    setNoteText(existingNote);
    setIsNoteExpanded(Boolean(existingNote));
  }

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleCopy = () => {
    if (onCopyQuote) {
      onCopyQuote();
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(selectedText);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSaveNote = () => {
    if (onSaveNote) {
      onSaveNote(noteText);
    }
    setIsNoteExpanded(false);
  };

  if (!hasMounted || !isOpen || !position) return null;

  // Viewport bounding clamp and centered positioning
  const popoverWidth = isNoteExpanded ? 288 : 256;
  const halfWidth = popoverWidth / 2;
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 800;

  // Center horizontally over the anchor point while preventing offscreen overflow
  const safeLeft = Math.max(12, Math.min(position.left - halfWidth, windowWidth - popoverWidth - 12));

  // Vertical placement: if near header, place below anchor; otherwise place above anchor
  const showBelow = isNoteExpanded ? position.top < 160 : position.top < 120;
  const safeTop = showBelow ? position.top + 34 : Math.max(70, position.top - (isNoteExpanded ? 130 : 54));

  const themeBg =
    theme === 'dark'
      ? 'bg-stone-900 border-stone-700 text-stone-100 shadow-2xl'
      : theme === 'sepia'
      ? 'bg-[#f4ebd9] border-[#d8caa8] text-[#433422] shadow-xl'
      : 'bg-white border-stone-200 text-stone-900 shadow-xl';

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={popoverRef}
        data-testid="text-highlight-popover"
        role="dialog"
        aria-label="Text selection tools"
        initial={{ opacity: 0, scale: 0.9, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 4 }}
        transition={{ duration: 0.15 }}
        style={{
          position: 'fixed',
          top: safeTop,
          left: safeLeft,
          zIndex: 60,
        }}
        className={`rounded-xl border p-1.5 flex flex-col gap-1.5 text-xs font-sans select-none backdrop-blur-md ${themeBg}`}
      >
        {/* Main Action Bar: 4 Color Swatches + Note + Copy + Delete */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 pr-1.5 border-r border-stone-200/50 dark:border-stone-700/50">
            {HIGHLIGHT_COLORS.map((c) => {
              const isSelected = activeColor === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  data-testid={`highlight-color-${c.id}`}
                  aria-label={`Highlight with ${c.label}`}
                  onClick={() => onSelectColor(c.id)}
                  className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 active:scale-95 focus-visible:outline-none ${c.pillClass} ${
                    isSelected ? c.activeRing : ''
                  }`}
                />
              );
            })}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid="highlight-add-note-btn"
              aria-label="Add or edit personal note"
              onClick={() => setIsNoteExpanded(!isNoteExpanded)}
              className={`p-1.5 rounded-lg transition-colors hover:bg-stone-100 dark:hover:bg-stone-800 ${
                isNoteExpanded || existingNote ? 'text-primary-600 dark:text-primary-400 font-bold' : 'text-stone-500'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
            </button>

            <button
              type="button"
              data-testid="highlight-copy-btn"
              aria-label="Copy quote to clipboard"
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>

            {existingAnnotationId && onDelete && (
              <button
                type="button"
                data-testid="highlight-delete-btn"
                aria-label="Remove highlight"
                onClick={onDelete}
                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              aria-label="Close selection menu"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Expandable Micro-Note Input */}
        {isNoteExpanded && (
          <div data-testid="highlight-note-container" className="pt-1 border-t border-stone-200/50 dark:border-stone-700/50 flex flex-col gap-1.5 w-64 sm:w-72">
            <textarea
              data-testid="highlight-note-textarea"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add your note or reflection..."
              rows={2}
              className="w-full text-xs p-2 rounded-md border border-stone-300 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/50 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none font-sans"
              autoFocus
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setIsNoteExpanded(false)}
                className="px-2 py-1 text-[11px] font-medium text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="highlight-save-note-btn"
                onClick={handleSaveNote}
                className="px-2.5 py-1 text-[11px] font-semibold rounded bg-primary-600 hover:bg-primary-700 text-white transition-colors"
              >
                Save Note
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};
