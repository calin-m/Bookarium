'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Highlighter, Search, Trash2, Edit3, ArrowRight, BookOpen, Check, X, AlertTriangle } from 'lucide-react';
import { ReaderDrawerShell } from './ReaderDrawerShell';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { Annotation, HighlightColor } from '@/stores/useAnnotationStore';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { getReaderTheme } from '@/config/reader-themes';
import { HIGHLIGHT_COLORS } from './TextHighlightPopover';

export interface ReaderAnnotationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  annotations: Annotation[];
  bookTitle?: string;
  theme?: ReaderTheme;
  onJumpToAnnotation: (chapterIndex: number, chapterPage: number) => void;
  onDeleteAnnotation: (id: string) => void;
  onUpdateNote: (id: string, note: string) => void;
}

const COLOR_BORDER_MAP: Record<HighlightColor, string> = {
  yellow: 'border-l-amber-400 bg-amber-500/5',
  amber: 'border-l-orange-400 bg-orange-500/5',
  mint: 'border-l-emerald-400 bg-emerald-500/5',
  rose: 'border-l-rose-400 bg-rose-500/5',
};

const COLOR_DOT_MAP: Record<HighlightColor, string> = {
  yellow: 'bg-amber-400',
  amber: 'bg-orange-400',
  mint: 'bg-emerald-400',
  rose: 'bg-rose-400',
};

export const ReaderAnnotationsDrawer: React.FC<ReaderAnnotationsDrawerProps> = ({
  isOpen,
  onClose,
  annotations,
  bookTitle: _bookTitle,
  theme = 'light',
  onJumpToAnnotation,
  onDeleteAnnotation,
  onUpdateNote,
}) => {
  const activeTheme = getReaderTheme(theme);
  const [selectedColorFilter, setSelectedColorFilter] = useState<HighlightColor | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [itemToDelete, setItemToDelete] = useState<Annotation | null>(null);

  const filteredAnnotations = useMemo(() => {
    return annotations.filter((a) => {
      const matchesColor = selectedColorFilter === 'all' || a.color === selectedColorFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        a.selectedText.toLowerCase().includes(q) ||
        (a.note && a.note.toLowerCase().includes(q));
      return matchesColor && matchesSearch;
    });
  }, [annotations, selectedColorFilter, searchQuery]);

  const handleStartEdit = (a: Annotation) => {
    setEditingNoteId(a.id);
    setEditingNoteText(a.note || '');
  };

  const handleSaveEdit = (id: string) => {
    onUpdateNote(id, editingNoteText);
    setEditingNoteId(null);
  };

  const handleJump = (chapterIndex: number, chapterPage: number) => {
    onJumpToAnnotation(chapterIndex, chapterPage);
    onClose();
  };

  const colorTabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = colorTabsRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // If deltaY is dominant (typical mouse wheel scroll)
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX) && e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [isOpen]);

  return (
    <ReaderDrawerShell
      isOpen={isOpen}
      onClose={onClose}
      title={`Notes & Highlights (${annotations.length})`}
      titleIcon={<Highlighter className="w-5 h-5 text-primary-600 dark:text-primary-400" />}
      theme={theme}
      ariaLabel="Annotations and highlights drawer"
      panelTestId="annotations-drawer-panel"
    >
      <div className="flex flex-col h-full gap-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            data-testid="annotations-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search quotes or notes..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all font-sans"
          />
        </div>

        {/* Color Filter Tabs */}
        <div
          ref={colorTabsRef}
          data-testid="annotations-color-tabs"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none overscroll-x-contain"
        >
          <button
            type="button"
            data-testid="filter-color-all"
            onClick={() => setSelectedColorFilter('all')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors shrink-0 ${
              selectedColorFilter === 'all'
                ? 'bg-primary-600 border-primary-600 text-white'
                : 'border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            All ({annotations.length})
          </button>
          {HIGHLIGHT_COLORS.map((c) => {
            const count = annotations.filter((a) => a.color === c.id).length;
            const isSelected = selectedColorFilter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                data-testid={`filter-color-${c.id}`}
                onClick={() => setSelectedColorFilter(c.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors shrink-0 ${
                  isSelected
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300 font-bold'
                    : 'border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${COLOR_DOT_MAP[c.id]}`} />
                <span>{c.label.split(' ')[1] || c.label}</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Annotations List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {filteredAnnotations.length === 0 ? (
            <div
              data-testid="annotations-empty-state"
              className={`text-center py-16 px-4 rounded-xl border border-dashed ${activeTheme.border} ${activeTheme.textMuted}`}
            >
              <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="font-serif text-sm font-semibold text-inherit mb-1">
                {annotations.length === 0 ? 'No Highlights Yet' : 'No Matching Highlights'}
              </p>
              <p className="text-xs max-w-xs mx-auto leading-relaxed">
                {annotations.length === 0
                  ? 'Select any passage of text while reading to highlight quotes, choose colors, or attach personal scholarly notes.'
                  : 'Try adjusting your color filter or search query.'}
              </p>
            </div>
          ) : (
            filteredAnnotations.map((item) => (
              <div
                key={item.id}
                data-testid={`annotation-item-${item.id}`}
                className={`rounded-xl border border-stone-200 dark:border-stone-800 border-l-4 p-3.5 flex flex-col gap-2.5 transition-all shadow-xs ${
                  COLOR_BORDER_MAP[item.color]
                }`}
              >
                {/* Header: Section/Page Badge + Actions */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 font-semibold text-stone-700 dark:text-stone-300">
                      Sec {item.chapterIndex + 1} · Page {item.chapterPage}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      data-testid={`annotation-edit-btn-${item.id}`}
                      aria-label="Edit note"
                      onClick={() => handleStartEdit(item)}
                      className="p-1 rounded hover:bg-stone-200/60 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      data-testid={`annotation-delete-btn-${item.id}`}
                      aria-label="Delete annotation"
                      onClick={() => setItemToDelete(item)}
                      className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/40 text-stone-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Highlighted Quote Text */}
                <blockquote
                  data-testid="annotation-quote-text"
                  onClick={() => handleJump(item.chapterIndex, item.chapterPage)}
                  className="font-serif italic text-sm text-foreground/90 leading-relaxed cursor-pointer hover:underline decoration-primary/40 underline-offset-2"
                >
                  &ldquo;{item.selectedText}&rdquo;
                </blockquote>

                {/* Note Section */}
                {editingNoteId === item.id ? (
                  <div className="flex flex-col gap-1.5 pt-1">
                    <textarea
                      data-testid="annotation-edit-textarea"
                      value={editingNoteText}
                      onChange={(e) => setEditingNoteText(e.target.value)}
                      placeholder="Enter personal note..."
                      rows={2}
                      className="w-full text-xs p-2 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:outline-none focus:ring-1 focus:ring-primary-500 font-sans"
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingNoteId(null)}
                        className="px-2 py-1 text-[11px] text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                      >
                        <X className="w-3.5 h-3.5 inline mr-0.5" /> Cancel
                      </button>
                      <button
                        type="button"
                        data-testid="annotation-save-edit-btn"
                        onClick={() => handleSaveEdit(item.id)}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded bg-primary-600 text-white hover:bg-primary-700"
                      >
                        <Check className="w-3.5 h-3.5 inline mr-0.5" /> Save
                      </button>
                    </div>
                  </div>
                ) : item.note ? (
                  <div
                    data-testid="annotation-note-text"
                    className="text-xs text-stone-700 dark:text-stone-300 bg-black/5 dark:bg-white/5 p-2 rounded-lg font-sans border-l-2 border-primary-500"
                  >
                    {item.note}
                  </div>
                ) : null}

                {/* Jump to passage button */}
                <button
                  type="button"
                  data-testid={`annotation-jump-btn-${item.id}`}
                  onClick={() => handleJump(item.chapterIndex, item.chapterPage)}
                  className="flex items-center gap-1 text-[11px] font-medium text-primary-600 dark:text-primary-400 hover:underline pt-1 self-start cursor-pointer"
                >
                  <span>Jump to passage</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete Single Annotation Confirmation Modal */}
      <Modal
        isOpen={itemToDelete !== null}
        onClose={() => setItemToDelete(null)}
        title="Delete Saved Highlight & Note?"
        maxWidth="md"
      >
        <div className="p-6 space-y-5" data-testid="delete-single-note-dialog">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-foreground text-sm sm:text-base">
                Are you sure you want to delete this saved quote?
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                This will remove the highlight and any attached personal reflection from your saved notes. This action cannot be undone.
              </p>
              {itemToDelete && (
                <div className="mt-2 p-3 rounded-lg bg-muted/40 border border-border/50 text-xs">
                  <p className="font-serif italic text-foreground/90 line-clamp-3">
                    &ldquo;{itemToDelete.selectedText}&rdquo;
                  </p>
                  {itemToDelete.note && (
                    <p className="mt-1.5 pt-1.5 border-t border-border/40 font-sans text-muted-foreground line-clamp-2">
                      <span className="font-mono text-[10px] uppercase text-primary mr-1">Note:</span>
                      {itemToDelete.note}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setItemToDelete(null)}
              className="text-xs font-mono uppercase"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (itemToDelete) {
                  onDeleteAnnotation(itemToDelete.id);
                  setItemToDelete(null);
                }
              }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent text-xs font-mono uppercase gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Note
            </Button>
          </div>
        </div>
      </Modal>
    </ReaderDrawerShell>
  );
};

