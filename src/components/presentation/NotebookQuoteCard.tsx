'use client';

import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  Trash2,
  Edit3,
  ExternalLink,
  MessageSquare,
  Palette,
} from 'lucide-react';
import type { Annotation, HighlightColor } from '@/stores/useAnnotationStore';
import { Button } from '@/components/ui/Button';
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

export const HIGHLIGHT_CARD_COLORS: Record<HighlightColor, { border: string; bg: string; text: string }> = {
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

export interface NotebookQuoteCardProps {
  annotation: Annotation;
  bookTitle: string;
  bookAuthor: string;
  isEditing?: boolean;
  onStartEdit?: (ann: Annotation) => void;
  onCancelEdit?: () => void;
  onSaveNote: (
    id: string,
    noteText: string,
    color: HighlightColor,
    originalColor: HighlightColor
  ) => Promise<void> | void;
  onUpdateColor: (id: string, color: HighlightColor) => Promise<void> | void;
  onRequestDeleteReflection: (ann: Annotation) => void;
  onRequestDeleteAnnotation: (ann: Annotation) => void;
  onJumpToReader: (ann: Annotation) => void;
}

/**
 * Self-contained literary notebook card rendering a highlighted passage,
 * quick color swatch popover, citation copy feedback, and inline reflection editing.
 */
export const NotebookQuoteCard: React.FC<NotebookQuoteCardProps> = ({
  annotation: ann,
  bookTitle,
  bookAuthor,
  isEditing = false,
  onStartEdit,
  onCancelEdit,
  onSaveNote,
  onUpdateColor,
  onRequestDeleteReflection,
  onRequestDeleteAnnotation,
  onJumpToReader,
}) => {
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [editNoteText, setEditNoteText] = useState(ann.note || '');
  const [editColor, setEditColor] = useState<HighlightColor>(ann.color);
  const [isCopied, setIsCopied] = useState(false);

  const [prevIsEditing, setPrevIsEditing] = useState(isEditing);
  if (isEditing !== prevIsEditing) {
    setPrevIsEditing(isEditing);
    if (isEditing) {
      setEditNoteText(ann.note || '');
      setEditColor(ann.color);
      setIsColorPickerOpen(false);
    }
  }

  // Dismiss quick color swatch popover when clicking outside or pressing Escape
  useEffect(() => {
    if (!isColorPickerOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(`[data-testid="color-badge-container-${ann.id}"]`)) return;
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
  }, [isColorPickerOpen, ann.id]);

  const activeColor = isEditing ? editColor : ann.color;
  const colorStyle = HIGHLIGHT_CARD_COLORS[activeColor] || HIGHLIGHT_CARD_COLORS.yellow;

  const handleCopyCitation = () => {
    const citation = `"${ann.selectedText}"\n— ${bookAuthor}, ${bookTitle} (Section ${ann.chapterIndex + 1}, Page ${ann.chapterPage})`;

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(citation).catch(() => {});
    }
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleStartEditInternal = () => {
    setEditNoteText(ann.note || '');
    setEditColor(ann.color);
    setIsColorPickerOpen(false);
    onStartEdit?.(ann);
  };

  const handleCancelInternal = () => {
    setEditColor(ann.color);
    setEditNoteText(ann.note || '');
    onCancelEdit?.();
  };

  const handleSaveInternal = async () => {
    await onSaveNote(ann.id, editNoteText, editColor, ann.color);
  };

  return (
    <article
      data-testid={`notebook-quote-card-${ann.id}`}
      className={`relative flex flex-col justify-between p-4 sm:p-5 rounded-xl border border-border bg-card shadow-booksaw hover:shadow-booksaw-hover hover:border-primary/40 transition-all border-l-4 ${colorStyle.border}`}
    >
      <div className="space-y-3">
        {/* Metadata Topline */}
        <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground">
          <div className="flex items-center gap-1.5 truncate">
            <span
              className="font-semibold text-foreground truncate"
              title={`${bookTitle} by ${bookAuthor}`}
            >
              {bookTitle}
            </span>
            <span className="text-muted-foreground hidden sm:inline truncate">by {bookAuthor}</span>
            <span>•</span>
            <span className="truncate">
              Section {ann.chapterIndex + 1}, p. {ann.chapterPage}
            </span>
          </div>

          {/* Quick Color Swatch Badge & Popover */}
          <div className="relative shrink-0" data-testid={`color-badge-container-${ann.id}`}>
            <button
              type="button"
              onClick={() => setIsColorPickerOpen((prev) => !prev)}
              data-testid={`color-badge-btn-${ann.id}`}
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
                data-testid={`quick-color-popover-${ann.id}`}
                className="absolute right-0 top-full mt-1.5 z-20 p-1.5 rounded-xl border border-border bg-card shadow-booksaw flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md"
              >
                {HIGHLIGHT_COLOR_SWATCHES.map((c) => {
                  const isSelected = ann.color === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-label={`Change highlight color to ${c.label}`}
                      title={`Change to ${c.label}`}
                      onClick={async () => {
                        await onUpdateColor(ann.id, c.id);
                        setIsColorPickerOpen(false);
                      }}
                      data-testid={`quick-color-btn-${ann.id}-${c.id}`}
                      className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 active:scale-95 cursor-pointer focus-visible:outline-none ${c.pillClass} ${
                        isSelected ? c.activeRing : ''
                      }`}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Highlight Quote */}
        <blockquote className="font-serif italic text-sm sm:text-base text-foreground leading-relaxed">
          &ldquo;{ann.selectedText}&rdquo;
        </blockquote>

        {/* Personal Note Box */}
        {isEditing ? (
          <div className="space-y-2.5 pt-1">
            {/* Highlight Shade Picker in Edit Mode */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-border">
              <span className="text-[11px] font-mono text-muted-foreground">Highlight Shade:</span>
              <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Highlight color">
                {HIGHLIGHT_COLOR_SWATCHES.map((c) => {
                  const isSelected = editColor === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={c.label}
                      title={c.label}
                      onClick={() => setEditColor(c.id)}
                      data-testid={`edit-color-btn-${ann.id}-${c.id}`}
                      className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 active:scale-95 cursor-pointer focus-visible:outline-none ${c.pillClass} ${
                        isSelected ? c.activeRing : ''
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            <textarea
              data-testid={`edit-note-textarea-${ann.id}`}
              value={editNoteText}
              onChange={(e) => setEditNoteText(e.target.value)}
              placeholder="Write your reflection or personal note..."
              rows={3}
              className="w-full text-xs p-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-sans leading-relaxed resize-none"
            />
            <div className="flex items-center justify-between gap-2 pt-1">
              {ann.note ? (
                <button
                  type="button"
                  onClick={() => onRequestDeleteReflection(ann)}
                  aria-label="Delete note"
                  data-testid={`delete-reflection-editor-btn-${ann.id}`}
                  className="text-[11px] font-mono text-destructive/80 hover:text-destructive hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete Note</span>
                </button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelInternal}
                  className="px-2.5 py-1 text-xs font-mono rounded text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <Button
                  size="sm"
                  onClick={handleSaveInternal}
                  className="text-xs font-mono uppercase h-7 px-3"
                >
                  Save Note
                </Button>
              </div>
            </div>
          </div>
        ) : ann.note ? (
          <div className="p-2.5 rounded-lg bg-muted/60 border border-border text-xs font-sans text-foreground/90 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-primary" />
                Personal Reflection
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleStartEditInternal}
                  aria-label="Edit personal reflection"
                  className="text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                >
                  Edit
                </button>
                <span className="text-border select-none" aria-hidden="true">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => onRequestDeleteReflection(ann)}
                  aria-label="Delete personal reflection"
                  data-testid={`delete-reflection-btn-${ann.id}`}
                  className="text-muted-foreground hover:text-destructive hover:underline cursor-pointer transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
            <p className="leading-relaxed whitespace-pre-wrap">{ann.note}</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleStartEditInternal}
            className="inline-flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors pt-1 cursor-pointer"
          >
            <Edit3 className="w-3 h-3" />
            <span>Add a personal note...</span>
          </button>
        )}
      </div>

      {/* Card Action Footer */}
      <div className="flex items-center justify-between gap-2 pt-4 mt-3 border-t border-border text-xs font-mono">
        <div className="flex items-center gap-1 text-muted-foreground">
          {/* Copy Citation */}
          <button
            type="button"
            onClick={handleCopyCitation}
            data-testid={`copy-citation-btn-${ann.id}`}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px] cursor-pointer"
            title="Copy quote with full academic citation"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Edit Note & Color */}
          <button
            type="button"
            onClick={handleStartEditInternal}
            data-testid={`edit-quote-btn-${ann.id}`}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px] cursor-pointer"
            title="Edit personal reflection and color"
            aria-label="Edit personal reflection and color"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>

          {/* Delete Annotation */}
          <button
            type="button"
            onClick={() => onRequestDeleteAnnotation(ann)}
            data-testid={`delete-quote-btn-${ann.id}`}
            className="p-1.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
            title="Delete passage"
            aria-label="Delete passage"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Jump to Reader */}
        <button
          type="button"
          onClick={() => onJumpToReader(ann)}
          data-testid={`jump-reader-btn-${ann.id}`}
          className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer font-medium text-[11px]"
        >
          <span>Read Passage</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </article>
  );
};

