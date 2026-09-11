'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Highlighter,
  Search,
  BookOpen,
  Trash2,
  X,
  Layers,
  Clock,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { NotebookQuoteCard } from './NotebookQuoteCard';
import { DeleteAnnotationModal } from '@/components/reader/DeleteAnnotationModal';
import {
  useAnnotationStore,
  useHydratedAnnotations,
  type Annotation,
  type HighlightColor,
} from '@/stores/useAnnotationStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useJurisdiction } from '@/stores/useJurisdictionStore';
import { isBookPublicDomainInJurisdiction, type GenericBookInput } from '@/lib/copyright-engine';
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

import {
  ANNOTATION_COLOR_LIST,
  ALL_COLORS_FILTER_BADGE,
} from '@/config/annotation-tokens';

export interface NotebookViewProps {
  onBrowseCatalog?: () => void;
}

const COLOR_FILTERS: Array<{ id: HighlightColor | 'all'; label: string; badgeClass: string }> = [
  { id: 'all', label: 'All Colors', badgeClass: ALL_COLORS_FILTER_BADGE },
  ...ANNOTATION_COLOR_LIST.map((c) => ({
    id: c.id,
    label: c.label,
    badgeClass: c.filterBadgeClass,
  })),
];

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
  const { country } = useJurisdiction();

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
    { ids: missingMetadataBookIds.join(','), page: 1, copyright: false, includeRestrictedMetadata: true },
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
  const [reflectionToDelete, setReflectionToDelete] = useState<Annotation | null>(null);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);

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

      const bookEntity: GenericBookInput | undefined =
        fromSaved ||
        fromFavorite ||
        fromApi ||
        (fromFeatured
          ? {
              id: fromFeatured.id,
              title: fromFeatured.title,
              authors: [{ name: fromFeatured.author, birth_year: null, death_year: null }],
            }
          : undefined);

      const evaluation = bookEntity ? isBookPublicDomainInJurisdiction(bookEntity, country) : { isAllowed: true };
      const isRestricted = !evaluation.isAllowed;

      return {
        title: finalTitle,
        author: finalAuthor,
        isRestricted,
        country,
      };
    },
    [savedBooks, favoriteBooks, remoteBooksData, country]
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
    const map = new Map<number, { title: string; author: string; isRestricted?: boolean; country?: string; items: Annotation[] }>();

    filteredAnnotations.forEach((ann) => {
      if (!map.has(ann.bookId)) {
        const { title, author, isRestricted, country } = resolveBookDetails(ann);
        map.set(ann.bookId, { title, author, isRestricted, country, items: [] });
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
  const handleSaveNote = async (
    id: string,
    noteText: string,
    color: HighlightColor,
    originalColor: HighlightColor
  ) => {
    if (color !== originalColor) {
      await updateAnnotationColor(id, color, user?.id);
    }
    await updateAnnotationNote(id, noteText, user?.id);
    setEditingAnnotationId(null);
  };

  const handleUpdateColor = async (id: string, color: HighlightColor) => {
    await updateAnnotationColor(id, color, user?.id);
  };

  const handleDelete = async (id: string) => {
    await deleteAnnotation(id, user?.id);
  };

  const handleConfirmDeleteReflection = async () => {
    if (!reflectionToDelete) return;
    await updateAnnotationNote(reflectionToDelete.id, '', user?.id);
    if (editingAnnotationId === reflectionToDelete.id) {
      setEditingAnnotationId(null);
    }
    setReflectionToDelete(null);
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
                    <div className="flex items-baseline gap-2.5 flex-wrap">
                      <h2 className="text-lg sm:text-xl font-serif font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
                        onClick={() => router.push(`/read/${group.bookId}`)}
                      >
                        {group.title}
                      </h2>
                      <span className="text-xs font-mono text-muted-foreground">
                        by {group.author}
                      </span>
                      {group.isRestricted && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                          <Lock className="w-2.5 h-2.5" />
                          Protected ({group.country || 'Jurisdiction'})
                        </span>
                      )}
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
      <DeleteAnnotationModal
        isOpen={annotationToDelete !== null}
        onClose={() => setAnnotationToDelete(null)}
        onConfirm={async () => {
          if (annotationToDelete) {
            await handleDelete(annotationToDelete.id);
            setAnnotationToDelete(null);
          }
        }}
        annotation={annotationToDelete}
        title="Delete Saved Note & Highlight?"
        description="This will remove the highlight and any attached personal reflections from your commonplace book. This action cannot be undone."
      />

      {/* Delete Single Personal Reflection Confirmation Modal */}
      <Modal
        isOpen={reflectionToDelete !== null}
        onClose={() => setReflectionToDelete(null)}
        title="Delete Personal Reflection?"
        maxWidth="md"
      >
        <div className="p-6 space-y-5" data-testid="delete-reflection-dialog">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-foreground text-sm sm:text-base">
                Are you sure you want to delete your personal reflection?
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                This will remove only your written personal reflection. The highlighted book passage will remain safely preserved in your commonplace notebook.
              </p>
              {reflectionToDelete?.note && (
                <div className="mt-2 p-3 rounded-lg bg-muted/40 border border-border text-xs">
                  <span className="font-mono text-[10px] uppercase text-primary block mb-1">
                    Reflection to be deleted:
                  </span>
                  <p className="font-sans text-foreground/90 whitespace-pre-wrap line-clamp-4">
                    {reflectionToDelete.note}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReflectionToDelete(null)}
              className="text-xs font-mono uppercase"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmDeleteReflection}
              data-testid="confirm-delete-reflection-btn"
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent text-xs font-mono uppercase gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Reflection
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );

  // Quote Card Renderer
  function renderQuoteCard(ann: Annotation) {
    const { title, author, isRestricted, country } = resolveBookDetails(ann);

    return (
      <NotebookQuoteCard
        key={ann.id}
        annotation={ann}
        bookTitle={title}
        bookAuthor={author}
        isRestricted={isRestricted}
        jurisdictionCountry={country}
        isEditing={editingAnnotationId === ann.id}
        onStartEdit={(target) => setEditingAnnotationId(target.id)}
        onCancelEdit={() => setEditingAnnotationId(null)}
        onSaveNote={handleSaveNote}
        onUpdateColor={handleUpdateColor}
        onRequestDeleteReflection={(target) => setReflectionToDelete(target)}
        onRequestDeleteAnnotation={(target) => setAnnotationToDelete(target)}
        onJumpToReader={handleJumpToReader}
      />
    );
  }
};
