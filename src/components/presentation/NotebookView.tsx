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
  Palette,
} from 'lucide-react';
import {
  useAnnotationStore,
  useHydratedAnnotations,
  type Annotation,
  type HighlightColor,
} from '@/stores/useAnnotationStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { FEATURED_HERO_BOOKS, type FeaturedHeroBook } from '@/config/featured-books';
import { useBooks } from '@/hooks/queries/useBooks';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  cleanBookTitle,
  isPlaceholderAuthor,
  isPlaceholderTitle,
} from '@/lib/book-metadata';
import { formatAuthorNames } from '@/lib/utils';
import type { GutendexBook } from '@/types/book.types';

export interface NotebookViewProps {
  onBrowseCatalog?: () => void;
}

const HIGHLIGHT_COLOR_SWATCHES: Array<{
  id: HighlightColor;
  label: string;
  pillClass: string;
  activeRing: string;
}> = [
  {
    id: 'yellow',
    label: 'Yellow',
    pillClass: 'bg-amber-300 border-amber-400 dark:bg-amber-400/80',
    activeRing: 'ring-2 ring-offset-2 ring-amber-500',
  },
  {
    id: 'amber',
    label: 'Amber',
    pillClass: 'bg-orange-300 border-orange-400 dark:bg-orange-400/80',
    activeRing: 'ring-2 ring-offset-2 ring-orange-500',
  },
  {
    id: 'mint',
    label: 'Mint',
    pillClass: 'bg-emerald-300 border-emerald-400 dark:bg-emerald-400/80',
    activeRing: 'ring-2 ring-offset-2 ring-emerald-500',
  },
  {
    id: 'rose',
    label: 'Rose',
    pillClass: 'bg-rose-300 border-rose-400 dark:bg-rose-400/80',
    activeRing: 'ring-2 ring-offset-2 ring-rose-500',
  },
];

const COLOR_FILTERS: Array<{ id: HighlightColor | 'all'; label: string; badgeClass: string }> = [
  { id: 'all', label: 'All Colors', badgeClass: 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-border' },
  { id: 'yellow', label: 'Yellow', badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60' },
  { id: 'amber', label: 'Amber', badgeClass: 'bg-orange-100 text-orange-900 border border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800/60' },
  { id: 'mint', label: 'Mint', badgeClass: 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60' },
  { id: 'rose', label: 'Rose', badgeClass: 'bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60' },
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
  const {
    annotations,
    updateAnnotationColor,
    updateAnnotationNote,
    deleteAnnotation,
    clearAllAnnotations,
  } = useHydratedAnnotations();
  const user = useAuthStore((s) => s.user);

  // Cross-reference metadata sources
  const savedBooks = useBookshelfStore((s) => s.savedBooks);
  const favoriteBooks = useBookshelfStore((s) => s.favoriteBooks || []);
  const updateBookMetadata = useAnnotationStore((s) => s.updateBookMetadata);

  // Identify book IDs that lack resolved titles/authors and are not in local stores or static fixtures
  const missingMetadataBookIds = useMemo(() => {
    const ids = new Set<number>();
    for (const ann of annotations) {
      if (!ann.bookId || ann.bookId <= 0) continue;
      const cleanTitle = cleanBookTitle(ann.bookTitle);
      const hasValidTitle = cleanTitle && !isPlaceholderTitle(cleanTitle);
      const hasValidAuthor = ann.bookAuthor && !isPlaceholderAuthor(ann.bookAuthor);
      if (hasValidTitle && hasValidAuthor) continue;

      const inSaved = savedBooks.some((b) => b.id === ann.bookId);
      const inFavorite = favoriteBooks.some((b) => b.id === ann.bookId);
      const inFeatured = FEATURED_HERO_BOOKS.some((b) => b.id === ann.bookId);

      if (!inSaved && !inFavorite && !inFeatured) {
        ids.add(ann.bookId);
      }
    }
    return Array.from(ids).sort((a, b) => a - b);
  }, [annotations, savedBooks, favoriteBooks]);

  // Query Gutendex remote API / cache for any unindexed annotated books
  const { data: remoteBooksData } = useBooks(
    { ids: missingMetadataBookIds.join(','), page: 1, copyright: false },
    { enabled: missingMetadataBookIds.length > 0 }
  );

  // Auto-heal missing metadata in local annotations when remote books resolve
  useEffect(() => {
    if (!remoteBooksData?.results || remoteBooksData.results.length === 0) return;
    for (const book of remoteBooksData.results) {
      const author = book.authors ? formatAuthorNames(book.authors) : undefined;
      updateBookMetadata(book.id, book.title, author);
    }
  }, [remoteBooksData, updateBookMetadata]);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState<HighlightColor | 'all'>('all');
  const [groupMode, setGroupMode] = useState<'volume' | 'chronological'>('volume');
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [annotationToDelete, setAnnotationToDelete] = useState<Annotation | null>(null);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [editColor, setEditColor] = useState<HighlightColor>('yellow');
  const [activeColorPickerId, setActiveColorPickerId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Dismiss quick color swatch popover when clicking outside or pressing Escape
  useEffect(() => {
    if (!activeColorPickerId) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-testid^="color-badge-container-"]')) return;
      setActiveColorPickerId(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveColorPickerId(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeColorPickerId]);

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
      const fromSaved = savedBooks.find((b) => b.id === ann.bookId);
      const fromFavorite = favoriteBooks.find((b) => b.id === ann.bookId);
      const fromFeatured = FEATURED_HERO_BOOKS.find((b: FeaturedHeroBook) => b.id === ann.bookId);
      const fromApi = remoteBooksData?.results?.find((b: GutendexBook) => b.id === ann.bookId);

      const cleanedAnnTitle = cleanBookTitle(ann.bookTitle);
      const hasValidAnnTitle = cleanedAnnTitle && !isPlaceholderTitle(cleanedAnnTitle);

      const candidateTitle =
        (hasValidAnnTitle ? cleanedAnnTitle : '') ||
        fromSaved?.title ||
        fromFavorite?.title ||
        fromFeatured?.title ||
        fromApi?.title ||
        cleanedAnnTitle;

      const cleanedAnnAuthor = !isPlaceholderAuthor(ann.bookAuthor) ? ann.bookAuthor?.replace(/^by\s+/i, '').trim() : '';

      const savedAuthor = fromSaved?.authors ? formatAuthorNames(fromSaved.authors) : '';
      const favoriteAuthor = fromFavorite?.authors ? formatAuthorNames(fromFavorite.authors) : '';
      const apiAuthor = fromApi?.authors ? formatAuthorNames(fromApi.authors) : '';

      const candidateAuthor =
        cleanedAnnAuthor ||
        (!isPlaceholderAuthor(savedAuthor) ? savedAuthor : '') ||
        (!isPlaceholderAuthor(favoriteAuthor) ? favoriteAuthor : '') ||
        fromFeatured?.author ||
        (!isPlaceholderAuthor(apiAuthor) ? apiAuthor : '') ||
        '';

      const cleanTitle = cleanBookTitle(candidateTitle);
      const finalTitle =
        (!isPlaceholderTitle(cleanTitle) ? cleanTitle : '') ||
        cleanBookTitle(fromFeatured?.title) ||
        cleanBookTitle(fromSaved?.title) ||
        cleanBookTitle(fromFavorite?.title) ||
        cleanBookTitle(fromApi?.title) ||
        (ann.bookId ? `Volume #${ann.bookId}` : 'Public Domain Classic');

      const finalAuthor =
        candidateAuthor ||
        (!isPlaceholderAuthor(ann.bookAuthor) ? ann.bookAuthor : '') ||
        fromFeatured?.author ||
        'Classic Literature';

      return {
        title: finalTitle,
        author: finalAuthor,
      };
    },
    [savedBooks, favoriteBooks, remoteBooksData]
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
    setEditColor(ann.color);
    setActiveColorPickerId(null);
  };

  const handleSaveNote = async (id: string, originalColor: HighlightColor) => {
    if (editColor !== originalColor) {
      await updateAnnotationColor(id, editColor, user?.id);
    }
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
        <SectionHeader
          eyebrow="PERSONAL COMMONPLACE NOTEBOOK • MARGINALIA & REFLECTIONS"
          title="Literary Notebook"
          subtitle={
            annotations.length > 0
              ? `You have preserved ${annotations.length} passage${annotations.length === 1 ? '' : 's'} across ${uniqueBookCount} literary volume${uniqueBookCount === 1 ? '' : 's'}.`
              : 'Capture, organize, and revisit prose excerpts, colorful thematic highlights, and personal reflections.'
          }
        >
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
        </SectionHeader>

      {annotations.length === 0 ? (
        /* Empty State */
        <div className="max-w-md mx-auto my-12 p-8 text-center bg-card border border-border rounded-2xl shadow-booksaw space-y-5">
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-card border border-border rounded-xl shadow-booksaw">
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
            <div className="flex items-center gap-1 self-end sm:self-auto bg-muted/60 p-1 rounded-lg border border-border">
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
                      : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50'
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
                  <div className="flex items-center justify-between border-b border-border pb-2">
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
                <div className="mt-2 p-3 rounded-lg bg-muted/40 border border-border text-xs">
                  <p className="font-serif italic text-foreground/90 line-clamp-3">
                    &ldquo;{annotationToDelete.selectedText}&rdquo;
                  </p>
                  {annotationToDelete.note && (
                    <p className="mt-1.5 pt-1.5 border-t border-border font-sans text-muted-foreground line-clamp-2">
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
    const isEditing = editingAnnotationId === ann.id;
    // Live Preview: If currently editing, preview the draft editColor; otherwise use saved ann.color
    const activeColor = isEditing ? editColor : ann.color;
    const colorStyle = HIGHLIGHT_CARD_COLORS[activeColor] || HIGHLIGHT_CARD_COLORS.yellow;
    const isCopied = copiedId === ann.id;

    return (
      <article
        key={ann.id}
        data-testid={`notebook-quote-card-${ann.id}`}
        className={`relative flex flex-col justify-between p-4 sm:p-5 rounded-xl border border-border bg-card shadow-booksaw hover:shadow-booksaw-hover hover:border-primary/40 transition-all border-l-4 ${colorStyle.border}`}
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
            {/* Quick Color Swatch Badge & Popover */}
            <div className="relative shrink-0" data-testid={`color-badge-container-${ann.id}`}>
              <button
                type="button"
                onClick={() => setActiveColorPickerId((prev) => (prev === ann.id ? null : ann.id))}
                data-testid={`color-badge-btn-${ann.id}`}
                aria-label={`Highlight color: ${activeColor}. Click to change color.`}
                aria-expanded={activeColorPickerId === ann.id}
                title="Click to change highlight color"
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider transition-all hover:scale-105 active:scale-95 cursor-pointer select-none border border-transparent hover:border-current/30 ${colorStyle.bg} ${colorStyle.text}`}
              >
                <span>{activeColor}</span>
                <Palette className="w-2.5 h-2.5 opacity-70" />
              </button>

              {activeColorPickerId === ann.id && (
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
                          await updateAnnotationColor(ann.id, c.id, user?.id);
                          setActiveColorPickerId(null);
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
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-border/50">
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
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAnnotationId(null)}
                  className="px-2.5 py-1 text-xs font-mono rounded text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <Button
                  size="sm"
                  onClick={() => handleSaveNote(ann.id, ann.color)}
                  className="text-xs font-mono uppercase h-7 px-3"
                >
                  Save Note
                </Button>
              </div>
            </div>
          ) : ann.note ? (
            <div className="p-2.5 rounded-lg bg-muted/60 border border-border text-xs font-sans text-foreground/90 space-y-1">
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
        <div className="flex items-center justify-between gap-2 pt-4 mt-3 border-t border-border text-xs font-mono">
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

            {/* Edit Note & Color */}
            <button
              type="button"
              onClick={() => handleStartEditNote(ann)}
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
