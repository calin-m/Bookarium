'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Highlighter,
  Search,
  BookOpen,
  Copy,
  Check,
  Trash2,
  Edit3,
  ExternalLink,
  MessageSquare,
  X,
  Layers,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import {
  useHydratedAnnotations,
  type Annotation,
  type HighlightColor,
} from '@/stores/useAnnotationStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { FEATURED_HERO_BOOKS, type FeaturedHeroBook } from '@/config/featured-books';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

export interface NotebookViewProps {
  onBrowseCatalog?: () => void;
}

const COLOR_FILTERS: Array<{ id: HighlightColor | 'all'; label: string; badgeClass: string }> = [
  { id: 'all', label: 'All Colors', badgeClass: 'bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300' },
  { id: 'yellow', label: 'Yellow', badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300' },
  { id: 'amber', label: 'Amber', badgeClass: 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300' },
  { id: 'mint', label: 'Mint', badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300' },
  { id: 'rose', label: 'Rose', badgeClass: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300' },
];

const HIGHLIGHT_CARD_COLORS: Record<HighlightColor, { border: string; bg: string; text: string }> = {
  yellow: {
    border: 'border-l-amber-400 dark:border-l-amber-500',
    bg: 'bg-amber-50/60 dark:bg-amber-950/15',
    text: 'text-amber-900 dark:text-amber-200',
  },
  amber: {
    border: 'border-l-orange-400 dark:border-l-orange-500',
    bg: 'bg-orange-50/60 dark:bg-orange-950/15',
    text: 'text-orange-900 dark:text-orange-200',
  },
  mint: {
    border: 'border-l-emerald-400 dark:border-l-emerald-500',
    bg: 'bg-emerald-50/60 dark:bg-emerald-950/15',
    text: 'text-emerald-900 dark:text-emerald-200',
  },
  rose: {
    border: 'border-l-rose-400 dark:border-l-rose-500',
    bg: 'bg-rose-50/60 dark:bg-rose-950/15',
    text: 'text-rose-900 dark:text-rose-200',
  },
};

export const NotebookView: React.FC<NotebookViewProps> = ({ onBrowseCatalog }) => {
  const router = useRouter();
  const { annotations, updateAnnotationNote, deleteAnnotation, clearAllAnnotations } =
    useHydratedAnnotations();
  const user = useAuthStore((s) => s.user);

  // Cross-reference metadata sources
  const savedBooks = useBookshelfStore((s) => s.savedBooks);
  const likedBooks = useBookshelfStore((s) => s.likedBooks || []);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState<HighlightColor | 'all'>('all');
  const [groupMode, setGroupMode] = useState<'volume' | 'chronological'>('volume');
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [annotationToDelete, setAnnotationToDelete] = useState<Annotation | null>(null);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
  }, []);

  // Helper to resolve literary metadata for an annotation
  const resolveBookDetails = useCallback(
    (ann: Annotation) => {
      if (ann.bookTitle && ann.bookAuthor) {
        return { title: ann.bookTitle, author: ann.bookAuthor };
      }
      const fromSaved = savedBooks.find((b) => b.id === ann.bookId);
      if (fromSaved) {
        return {
          title: fromSaved.title,
          author: fromSaved.authors?.[0]?.name || 'Unknown Author',
        };
      }
      const fromLiked = likedBooks.find((b) => b.id === ann.bookId);
      if (fromLiked) {
        return {
          title: fromLiked.title,
          author: fromLiked.authors?.[0]?.name || 'Unknown Author',
        };
      }
      const fromFeatured = FEATURED_HERO_BOOKS.find((b: FeaturedHeroBook) => b.id === ann.bookId);
      if (fromFeatured) {
        return {
          title: fromFeatured.title,
          author: fromFeatured.author || 'Unknown Author',
        };
      }
      return {
        title: ann.bookTitle || `Volume #${ann.bookId}`,
        author: ann.bookAuthor || 'Classic Literature',
      };
    },
    [savedBooks, likedBooks]
  );

  // Filtered list of annotations
  const filteredAnnotations = useMemo(() => {
    return annotations.filter((ann) => {
      // 1. Color filter
      if (selectedColor !== 'all' && ann.color !== selectedColor) {
        return false;
      }
      // 2. Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const { title, author } = resolveBookDetails(ann);
        const matchesQuote = ann.selectedText.toLowerCase().includes(query);
        const matchesNote = ann.note ? ann.note.toLowerCase().includes(query) : false;
        const matchesTitle = title.toLowerCase().includes(query);
        const matchesAuthor = author.toLowerCase().includes(query);
        return matchesQuote || matchesNote || matchesTitle || matchesAuthor;
      }
      return true;
    });
  }, [annotations, selectedColor, searchQuery, resolveBookDetails]);

  // Grouped by Volume mapping
  const groupedByVolume = useMemo(() => {
    const map = new Map<number, { title: string; author: string; items: Annotation[] }>();

    filteredAnnotations.forEach((ann) => {
      if (!map.has(ann.bookId)) {
        const { title, author } = resolveBookDetails(ann);
        map.set(ann.bookId, { title, author, items: [] });
      }
      map.get(ann.bookId)!.items.push(ann);
    });

    return Array.from(map.entries()).map(([bookId, data]) => ({
      bookId,
      ...data,
    }));
  }, [filteredAnnotations, resolveBookDetails]);

  // Unique volume count
  const uniqueBookCount = useMemo(() => {
    return new Set(annotations.map((a) => a.bookId)).size;
  }, [annotations]);

  // Handlers
  const handleCopyCitation = (ann: Annotation) => {
    const { title, author } = resolveBookDetails(ann);
    const citation = `"${ann.selectedText}"\n— ${author}, ${title} (Section ${ann.chapterIndex + 1}, Page ${ann.chapterPage})`;

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(citation).catch(() => {});
    }
    setCopiedId(ann.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStartEditNote = (ann: Annotation) => {
    setEditingAnnotationId(ann.id);
    setEditNoteText(ann.note || '');
  };

  const handleSaveNote = async (id: string) => {
    await updateAnnotationNote(id, editNoteText, user?.id);
    setEditingAnnotationId(null);
  };

  const handleDelete = async (id: string) => {
    await deleteAnnotation(id, user?.id);
  };

  const handleJumpToReader = (ann: Annotation) => {
    router.push(`/read/${ann.bookId}?chapter=${ann.chapterIndex}&page=${ann.chapterPage}`);
  };

  const handleConfirmClearAll = () => {
    clearAllAnnotations();
    setIsConfirmClearOpen(false);
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" aria-label="Literary Commonplace Notebook">
      <div key="view-page-turn-notebook" className="animate-page-turn">
        {/* Booksaw Centered Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
          <div className="text-[11px] font-mono tracking-widest uppercase text-muted-foreground font-semibold">
            PERSONAL COMMONPLACE NOTEBOOK • MARGINALIA & REFLECTIONS
          </div>

          <div className="flex items-center justify-center gap-3">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-foreground tracking-tight">
              Literary Notebook
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-muted-foreground font-serif italic">
            {annotations.length > 0
              ? `You have preserved ${annotations.length} passage${annotations.length === 1 ? '' : 's'} across ${uniqueBookCount} literary volume${uniqueBookCount === 1 ? '' : 's'}.`
              : 'Capture, organize, and revisit prose excerpts, colorful thematic highlights, and personal reflections.'}
          </p>

          {annotations.length > 0 && (
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsConfirmClearOpen(true)}
                className="text-destructive border-border hover:border-destructive hover:bg-destructive/10 gap-1.5 text-xs font-mono uppercase"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All Notes
              </Button>
            </div>
          )}
        </div>

      {annotations.length === 0 ? (
        /* Empty State */
        <div className="max-w-md mx-auto my-12 p-8 text-center bg-card border border-border/80 rounded-2xl shadow-sm space-y-5">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
            <Highlighter className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-serif font-bold text-foreground">Your Notebook is Empty</h2>
            <p className="text-xs sm:text-sm text-muted-foreground font-sans leading-relaxed">
              When reading any volume in the catalog, select inspiring sentences to highlight them in editorial pastel shades and jot down your personal reflections.
            </p>
          </div>
          {onBrowseCatalog && (
            <Button onClick={onBrowseCatalog} className="gap-2 text-xs font-mono uppercase">
              <BookOpen className="w-4 h-4" />
              Explore Catalog
            </Button>
          )}
        </div>
      ) : (
        /* Notebook Content */
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-card border border-border/80 rounded-xl shadow-2xs">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                data-testid="notebook-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search quotes, reflections, books, or authors..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-sans transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 self-end sm:self-auto bg-muted/60 p-1 rounded-lg border border-border/50">
              <button
                type="button"
                onClick={() => setGroupMode('volume')}
                title="Group by Volume"
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-md transition-all ${
                  groupMode === 'volume'
                    ? 'bg-background text-foreground shadow-xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>By Book</span>
              </button>
              <button
                type="button"
                onClick={() => setGroupMode('chronological')}
                title="All Passages in Chronological Order"
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-md transition-all ${
                  groupMode === 'chronological'
                    ? 'bg-background text-foreground shadow-xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Chronological</span>
              </button>
            </div>
          </div>

          {/* Color Filter Tabs */}
          <div
            ref={colorTabsRef}
            data-testid="notebook-color-tabs"
            className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] overscroll-x-contain"
          >
            {COLOR_FILTERS.map((filter) => {
              const count =
                filter.id === 'all'
                  ? annotations.length
                  : annotations.filter((a) => a.color === filter.id).length;
              const isSelected = selectedColor === filter.id;

              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setSelectedColor(filter.id)}
                  data-testid={`notebook-filter-${filter.id}`}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono transition-all shrink-0 border cursor-pointer ${
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground font-bold shadow-xs'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80'
                  }`}
                >
                  <span>{filter.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected ? 'bg-primary-foreground/20 text-inherit' : filter.badgeClass
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Zero Results State */}
          {filteredAnnotations.length === 0 && (
            <div className="py-12 text-center bg-card/60 border border-dashed border-border rounded-xl space-y-3">
              <p className="text-sm font-serif italic text-muted-foreground">
                No passages match your current search or color filter.
              </p>
              {(searchQuery || selectedColor !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedColor('all');
                  }}
                  className="text-xs font-mono uppercase"
                >
                  Reset Filters
                </Button>
              )}
            </div>
          )}

          {/* Grouped by Volume Display */}
          {groupMode === 'volume' && groupedByVolume.length > 0 && (
            <div className="space-y-8">
              {groupedByVolume.map((group) => (
                <div key={group.bookId} className="space-y-3">
                  {/* Volume Header */}
                  <div className="flex items-center justify-between border-b border-border/80 pb-2">
                    <div className="flex items-baseline gap-2.5">
                      <h2 className="text-lg sm:text-xl font-serif font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
                        onClick={() => router.push(`/read/${group.bookId}`)}
                      >
                        {group.title}
                      </h2>
                      <span className="text-xs font-mono text-muted-foreground">
                        by {group.author}
                      </span>
                    </div>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                      {group.items.length} quote{group.items.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {/* Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {group.items.map((ann) => renderQuoteCard(ann))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Chronological Stream Display */}
          {groupMode === 'chronological' && filteredAnnotations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAnnotations.map((ann) => renderQuoteCard(ann))}
            </div>
          )}
        </div>
      )}
      </div>

      {/* Clear All Confirmation Modal */}
      <Modal
        isOpen={isConfirmClearOpen}
        onClose={() => setIsConfirmClearOpen(false)}
        title="Clear All Saved Notes & Highlights?"
        maxWidth="md"
      >
        <div className="p-6 space-y-5" data-testid="clear-all-notes-dialog">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground text-sm sm:text-base">
                Are you sure you want to clear all notes and highlights?
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                This will permanently remove all {annotations.length} highlighted passages and notes across your entire library. This action cannot be undone.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConfirmClearOpen(false)}
              className="text-xs font-mono uppercase"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmClearAll}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent text-xs font-mono uppercase gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Everything
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Single Annotation Confirmation Modal */}
      <Modal
        isOpen={annotationToDelete !== null}
        onClose={() => setAnnotationToDelete(null)}
        title="Delete Saved Note & Highlight?"
        maxWidth="md"
      >
        <div className="p-6 space-y-5" data-testid="delete-single-note-dialog">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-foreground text-sm sm:text-base">
                Are you sure you want to delete this saved passage?
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                This will remove the highlight and any attached personal reflections from your commonplace book. This action cannot be undone.
              </p>
              {annotationToDelete && (
                <div className="mt-2 p-3 rounded-lg bg-muted/40 border border-border/50 text-xs">
                  <p className="font-serif italic text-foreground/90 line-clamp-3">
                    &ldquo;{annotationToDelete.selectedText}&rdquo;
                  </p>
                  {annotationToDelete.note && (
                    <p className="mt-1.5 pt-1.5 border-t border-border/40 font-sans text-muted-foreground line-clamp-2">
                      <span className="font-mono text-[10px] uppercase text-primary mr-1">Note:</span>
                      {annotationToDelete.note}
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
              onClick={() => setAnnotationToDelete(null)}
              className="text-xs font-mono uppercase"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={async () => {
                if (annotationToDelete) {
                  await handleDelete(annotationToDelete.id);
                  setAnnotationToDelete(null);
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
    </section>
  );

  // Quote Card Renderer
  function renderQuoteCard(ann: Annotation) {
    const { title, author } = resolveBookDetails(ann);
    const colorStyle = HIGHLIGHT_CARD_COLORS[ann.color] || HIGHLIGHT_CARD_COLORS.yellow;
    const isEditing = editingAnnotationId === ann.id;
    const isCopied = copiedId === ann.id;

    return (
      <article
        key={ann.id}
        data-testid={`notebook-quote-card-${ann.id}`}
        className={`relative flex flex-col justify-between p-4 sm:p-5 rounded-xl border border-border bg-card shadow-2xs hover:shadow-sm transition-all border-l-4 ${colorStyle.border}`}
      >
        <div className="space-y-3">
          {/* Metadata Topline */}
          <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-semibold text-foreground truncate" title={`${title} by ${author}`}>
                {title}
              </span>
              <span className="text-muted-foreground hidden sm:inline truncate">by {author}</span>
              <span>•</span>
              <span className="truncate">Section {ann.chapterIndex + 1}, p. {ann.chapterPage}</span>
            </div>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold tracking-wider ${colorStyle.bg} ${colorStyle.text}`}
            >
              {ann.color}
            </span>
          </div>

          {/* Highlight Quote */}
          <blockquote className="font-serif italic text-sm sm:text-base text-foreground leading-relaxed">
            &ldquo;{ann.selectedText}&rdquo;
          </blockquote>

          {/* Personal Note Box */}
          {isEditing ? (
            <div className="space-y-2 pt-1">
              <textarea
                data-testid={`edit-note-textarea-${ann.id}`}
                value={editNoteText}
                onChange={(e) => setEditNoteText(e.target.value)}
                placeholder="Write your reflection or personal note..."
                rows={3}
                className="w-full text-xs p-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-sans leading-relaxed resize-none"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAnnotationId(null)}
                  className="px-2.5 py-1 text-xs font-mono rounded text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <Button
                  size="sm"
                  onClick={() => handleSaveNote(ann.id)}
                  className="text-xs font-mono uppercase h-7 px-3"
                >
                  Save Note
                </Button>
              </div>
            </div>
          ) : ann.note ? (
            <div className="p-2.5 rounded-lg bg-muted/50 border border-border/60 text-xs font-sans text-foreground/90 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3 text-primary" />
                  Personal Reflection
                </span>
                <button
                  type="button"
                  onClick={() => handleStartEditNote(ann)}
                  aria-label="Edit personal reflection"
                  className="text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                >
                  Edit
                </button>
              </div>
              <p className="leading-relaxed whitespace-pre-wrap">{ann.note}</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleStartEditNote(ann)}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors pt-1 cursor-pointer"
            >
              <Edit3 className="w-3 h-3" />
              <span>Add a personal note...</span>
            </button>
          )}
        </div>

        {/* Card Action Footer */}
        <div className="flex items-center justify-between gap-2 pt-4 mt-3 border-t border-border/40 text-xs font-mono">
          <div className="flex items-center gap-1 text-muted-foreground">
            {/* Copy Citation */}
            <button
              type="button"
              onClick={() => handleCopyCitation(ann)}
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

            {/* Delete Annotation */}
            <button
              type="button"
              onClick={() => setAnnotationToDelete(ann)}
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
            onClick={() => handleJumpToReader(ann)}
            data-testid={`jump-reader-btn-${ann.id}`}
            className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer font-medium text-[11px]"
          >
            <span>Read Passage</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </article>
    );
  }
};
