'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Highlighter,
  BookOpen,
  Trash2,
  Layers,
  Clock,
} from 'lucide-react';
import { NotebookQuoteCard } from './NotebookQuoteCard';
import { NotebookFilterStrip } from './notebook/NotebookFilterStrip';
import { NotebookVolumeGroup } from './notebook/NotebookVolumeGroup';
import { CollectionToolbar } from './CollectionToolbar';
import type { SortOption } from './CollectionSortDropdown';
import { smartScrollToContent, createTabScrubberHandlers } from '@/lib/scroll-utils';
import { DeleteAnnotationModal } from '@/components/reader/DeleteAnnotationModal';
import {
  useHydratedAnnotations,
  type Annotation,
  type FellowAnnotation,
  type HighlightColor,
} from '@/stores/useAnnotationStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useNotebookMetadataResolver } from '@/hooks/useNotebookMetadataResolver';
import { Button } from '@/components/ui/Button';
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal';
import { Pagination } from '@/components/ui/Pagination';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  pairOverlappingAnnotations,
  filterAndPairAnnotationsBySource,
  isFellowAnnotation,
} from '@/lib/reader-annotator';

export type NotebookDisplayItem = (Annotation | FellowAnnotation) & {
  pairedFellowAnnotation?: FellowAnnotation;
  matchingOwnAnnotation?: Annotation;
};

export interface NotebookViewProps {
  onBrowseCatalog?: () => void;
}

export type NotebookChronoSortOption = 'date_desc' | 'date_asc' | 'title_asc' | 'author_asc' | 'downloaded';
export type NotebookVolumeSortOption =
  | 'title_asc'
  | 'title_desc'
  | 'author_asc'
  | 'author_desc'
  | 'count_desc'
  | 'recent'
  | 'downloaded';

const CHRONO_SORT_OPTIONS: SortOption[] = [
  { value: 'date_desc', label: 'Date Added (Newest)' },
  { value: 'date_asc', label: 'Date Added (Oldest)' },
  { value: 'title_asc', label: 'Book Title (A → Z)' },
  { value: 'author_asc', label: 'Author (A → Z)' },
  { value: 'downloaded', label: 'Downloaded' },
];

const VOLUME_SORT_OPTIONS: SortOption[] = [
  { value: 'title_asc', label: 'Book Title (A → Z)' },
  { value: 'title_desc', label: 'Book Title (Z → A)' },
  { value: 'author_asc', label: 'Author (A → Z)' },
  { value: 'author_desc', label: 'Author (Z → A)' },
  { value: 'count_desc', label: 'Most Quotes First' },
  { value: 'recent', label: 'Recently Annotated' },
  { value: 'downloaded', label: 'Downloaded' },
];

const CHRONO_PAGE_SIZE = 12;
const VOLUME_PAGE_SIZE = 6;

export const NotebookView: React.FC<NotebookViewProps> = ({ onBrowseCatalog }) => {
  const router = useRouter();
  const {
    annotations,
    fellowAnnotations,
    marginaliaSourceFilter,
    setMarginaliaSourceFilter,
    addAnnotation,
    updateAnnotationColor,
    updateAnnotationNote,
    deleteAnnotation,
    clearAllAnnotations,
  } = useHydratedAnnotations();
  const user = useAuthStore((s) => s.user);
  const { resolveBookDetails, primeReaderForBook, isBookOffline, isOffline } =
    useNotebookMetadataResolver(annotations, fellowAnnotations, user?.id);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState<HighlightColor | 'all'>('all');
  const [groupMode, setGroupMode] = useState<'volume' | 'chronological'>('volume');
  const [chronoSort, setChronoSort] = useState<NotebookChronoSortOption>('date_desc');
  const [volumeSort, setVolumeSort] = useState<NotebookVolumeSortOption>('title_asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [annotationToDelete, setAnnotationToDelete] = useState<Annotation | null>(null);
  const [reflectionToDelete, setReflectionToDelete] = useState<Annotation | null>(null);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);

  // Reset page to 1 when filters, search query, mode, sorting, or marginalia source change
  const [prevFilterKey, setPrevFilterKey] = useState(
    `${searchQuery}-${selectedColor}-${groupMode}-${chronoSort}-${volumeSort}-${marginaliaSourceFilter}`
  );
  const filterKey = `${searchQuery}-${selectedColor}-${groupMode}-${chronoSort}-${volumeSort}-${marginaliaSourceFilter}`;
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setCurrentPage(1);
  }

  const pairedAllAnnotations = useMemo(() => {
    return pairOverlappingAnnotations(annotations, fellowAnnotations);
  }, [annotations, fellowAnnotations]);

  const sourceFilteredAnnotations: NotebookDisplayItem[] = useMemo(() => {
    return filterAndPairAnnotationsBySource(
      annotations,
      fellowAnnotations,
      marginaliaSourceFilter,
      pairedAllAnnotations
    );
  }, [annotations, fellowAnnotations, marginaliaSourceFilter, pairedAllAnnotations]);

  // Filtered list of annotations
  const filteredAnnotations = useMemo(() => {
    return sourceFilteredAnnotations.filter((ann) => {
      // 1. Color filter (checks primary annotation color and paired fellow color)
      if (selectedColor !== 'all') {
        const matchesPrimary = ann.color === selectedColor;
        const matchesPaired = ann.pairedFellowAnnotation?.color === selectedColor;
        if (!matchesPrimary && !matchesPaired) {
          return false;
        }
      }
      // 2. Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const { title, author } = resolveBookDetails(ann);
        const matchesQuote = ann.selectedText.toLowerCase().includes(query);
        const matchesNote = ann.note ? ann.note.toLowerCase().includes(query) : false;
        const matchesTitle = title.toLowerCase().includes(query);
        const matchesAuthor = author.toLowerCase().includes(query);
        const matchesPairedQuote = ann.pairedFellowAnnotation?.selectedText.toLowerCase().includes(query) || false;
        const matchesPairedNote = ann.pairedFellowAnnotation?.note ? ann.pairedFellowAnnotation.note.toLowerCase().includes(query) : false;
        const matchesPairedFellow = Boolean(
          ann.pairedFellowAnnotation &&
          ((ann.pairedFellowAnnotation.fellowDisplayName && ann.pairedFellowAnnotation.fellowDisplayName.toLowerCase().includes(query)) ||
            ann.pairedFellowAnnotation.fellowUsername.toLowerCase().includes(query))
        );
        const matchesFellowSelf = Boolean(
          isFellowAnnotation(ann) &&
          ((ann.fellowDisplayName && ann.fellowDisplayName.toLowerCase().includes(query)) ||
            ann.fellowUsername.toLowerCase().includes(query))
        );
        return (
          matchesQuote ||
          matchesNote ||
          matchesTitle ||
          matchesAuthor ||
          matchesPairedQuote ||
          matchesPairedNote ||
          matchesPairedFellow ||
          matchesFellowSelf
        );
      }
      return true;
    });
  }, [sourceFilteredAnnotations, selectedColor, searchQuery, resolveBookDetails]);

  // Grouped by Volume mapping
  const groupedByVolume = useMemo(() => {
    const map = new Map<
      number,
      {
        title: string;
        author: string;
        isRestricted?: boolean;
        country?: string;
        items: NotebookDisplayItem[];
      }
    >();

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

  const getItemCreatedAt = useCallback((item: NotebookDisplayItem): number => {
    const tSelf = new Date(item.createdAt).getTime();
    const tPaired = item.pairedFellowAnnotation
      ? new Date(item.pairedFellowAnnotation.createdAt).getTime()
      : 0;
    return Math.max(tSelf, tPaired);
  }, []);

  const getItemRecentTimestamp = useCallback((item: NotebookDisplayItem): number => {
    const tSelf = new Date(item.updatedAt || item.createdAt).getTime();
    const tPaired = item.pairedFellowAnnotation
      ? new Date(item.pairedFellowAnnotation.updatedAt || item.pairedFellowAnnotation.createdAt).getTime()
      : 0;
    return Math.max(tSelf, tPaired);
  }, []);

  // Sorted list of annotations for Chronological mode
  const sortedAnnotations = useMemo(() => {
    const list = [...filteredAnnotations];
    switch (chronoSort) {
      case 'date_asc':
        return list.sort((a, b) => getItemCreatedAt(a) - getItemCreatedAt(b));
      case 'title_asc':
        return list.sort((a, b) => {
          const titleA = resolveBookDetails(a).title;
          const titleB = resolveBookDetails(b).title;
          return titleA.localeCompare(titleB, undefined, { sensitivity: 'base' });
        });
      case 'author_asc':
        return list.sort((a, b) => {
          const authorA = resolveBookDetails(a).author;
          const authorB = resolveBookDetails(b).author;
          return authorA.localeCompare(authorB, undefined, { sensitivity: 'base' });
        });
      case 'downloaded':
        return list
          .filter((a) => isBookOffline(a.bookId))
          .sort((a, b) => getItemCreatedAt(b) - getItemCreatedAt(a));
      case 'date_desc':
      default:
        return list.sort((a, b) => getItemCreatedAt(b) - getItemCreatedAt(a));
    }
  }, [filteredAnnotations, chronoSort, resolveBookDetails, isBookOffline, getItemCreatedAt]);

  // Sorted Grouped by Volume mapping
  const sortedGroupedByVolume = useMemo(() => {
    const list = [...groupedByVolume];
    switch (volumeSort) {
      case 'title_desc':
        return list.sort((a, b) => b.title.localeCompare(a.title, undefined, { sensitivity: 'base' }));
      case 'author_asc':
        return list.sort((a, b) => a.author.localeCompare(b.author, undefined, { sensitivity: 'base' }));
      case 'author_desc':
        return list.sort((a, b) => b.author.localeCompare(a.author, undefined, { sensitivity: 'base' }));
      case 'count_desc':
        return list.sort((a, b) => b.items.length - a.items.length);
      case 'recent':
        return list.sort((a, b) => {
          const timeA = Math.max(...a.items.map((i) => getItemRecentTimestamp(i)), 0);
          const timeB = Math.max(...b.items.map((i) => getItemRecentTimestamp(i)), 0);
          return timeB - timeA;
        });
      case 'downloaded':
        return list
          .filter((v) => isBookOffline(v.bookId))
          .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
      case 'title_asc':
      default:
        return list.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    }
  }, [groupedByVolume, volumeSort, isBookOffline, getItemRecentTimestamp]);

  // Pagination slicing
  const chronoTotalPages = Math.ceil(sortedAnnotations.length / CHRONO_PAGE_SIZE);
  const volumeTotalPages = Math.ceil(sortedGroupedByVolume.length / VOLUME_PAGE_SIZE);
  const totalPages = groupMode === 'volume' ? volumeTotalPages : chronoTotalPages;
  const safeCurrentPage = Math.min(currentPage, Math.max(1, totalPages));

  const paginatedAnnotations = useMemo(() => {
    const start = (safeCurrentPage - 1) * CHRONO_PAGE_SIZE;
    return sortedAnnotations.slice(start, start + CHRONO_PAGE_SIZE);
  }, [sortedAnnotations, safeCurrentPage]);

  const paginatedGroupedByVolume = useMemo(() => {
    const start = (safeCurrentPage - 1) * VOLUME_PAGE_SIZE;
    return sortedGroupedByVolume.slice(start, start + VOLUME_PAGE_SIZE);
  }, [sortedGroupedByVolume, safeCurrentPage]);

  const totalItems = groupMode === 'volume' ? sortedGroupedByVolume.length : sortedAnnotations.length;
  const pageSize = groupMode === 'volume' ? VOLUME_PAGE_SIZE : CHRONO_PAGE_SIZE;

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    if (typeof window !== 'undefined') {
      const didScroll = smartScrollToContent('notebook-content-anchor', { offsetTop: 80 });
      if (!didScroll && !document.getElementById('notebook-content-anchor')) {
        const section = document.getElementById('literary-notebook-section');
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  };

  // Unique volume count across own and fellow annotations
  const uniqueBookCount = useMemo(() => {
    const ids = new Set<number>();
    annotations.forEach((a) => ids.add(a.bookId));
    fellowAnnotations.forEach((fa) => ids.add(fa.bookId));
    return ids.size;
  }, [annotations, fellowAnnotations]);

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
    if (isOffline && !isBookOffline(ann.bookId)) return;
    primeReaderForBook(ann.bookId);
    router.push(`/read/${ann.bookId}?chapter=${ann.chapterIndex}&page=${ann.chapterPage}&annotationId=${ann.id}`);
  };

  const handleConfirmClearAll = () => {
    clearAllAnnotations();
    setIsConfirmClearOpen(false);
  };

  return (
    <section id="literary-notebook-section" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12" aria-label="Literary Commonplace Notebook">
      {/* Booksaw Centered Section Header */}
        <SectionHeader
          eyebrow="MARGINALIA & REFLECTIONS"
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

      {annotations.length === 0 && fellowAnnotations.length === 0 ? (
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
          <CollectionToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search quotes, reflections, books, or authors..."
            searchAriaLabel="Search quotes"
            searchTestId="notebook-search-input"
            sortValue={groupMode === 'volume' ? volumeSort : chronoSort}
            onSortChange={(newSort) => {
              if (groupMode === 'volume') {
                setVolumeSort(newSort as NotebookVolumeSortOption);
              } else {
                setChronoSort(newSort as NotebookChronoSortOption);
              }
            }}
            sortOptions={groupMode === 'volume' ? VOLUME_SORT_OPTIONS : CHRONO_SORT_OPTIONS}
            sortAriaLabel={groupMode === 'volume' ? 'Sort book groups' : 'Sort quotes chronologically'}
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            paginationAriaLabel="Top notebook pagination"
            extraControls={
              <div
                {...createTabScrubberHandlers(setGroupMode)}
                className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border shrink-0 select-none touch-pan-y"
              >
                <button
                  type="button"
                  data-tab-id="volume"
                  onClick={() => setGroupMode('volume')}
                  title="Group by Volume"
                  aria-label="By Book"
                  aria-pressed={groupMode === 'volume'}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 lg:px-2.5 py-1 text-xs font-mono rounded-md transition-all cursor-pointer select-none ${
                    groupMode === 'volume'
                      ? 'bg-background text-foreground shadow-xs font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden lg:inline">By Book</span>
                </button>
                <button
                  type="button"
                  data-tab-id="chronological"
                  onClick={() => setGroupMode('chronological')}
                  title="All Passages in Chronological Order"
                  aria-label="Chronological"
                  aria-pressed={groupMode === 'chronological'}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 lg:px-2.5 py-1 text-xs font-mono rounded-md transition-all cursor-pointer select-none ${
                    groupMode === 'chronological'
                      ? 'bg-background text-foreground shadow-xs font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden lg:inline">Chronological</span>
                </button>
              </div>
            }
          />

          {/* Color & Symposium Source Filter Tabs */}
          <NotebookFilterStrip
            selectedColor={selectedColor}
            onSelectColor={setSelectedColor}
            marginaliaSourceFilter={marginaliaSourceFilter}
            onSelectSourceFilter={setMarginaliaSourceFilter}
            ownCount={annotations.length}
            fellowCount={fellowAnnotations.length}
            pairedAllCount={pairedAllAnnotations.length}
            sourceFilteredItems={sourceFilteredAnnotations}
          />

          {/* Zero Results State */}
          {(groupMode === 'volume' ? sortedGroupedByVolume.length === 0 : sortedAnnotations.length === 0) && (
            <div className="py-12 text-center bg-card/60 border border-dashed border-border rounded-xl space-y-3">
              <p className="text-sm font-serif italic text-muted-foreground">
                {(groupMode === 'volume' ? volumeSort : chronoSort) === 'downloaded'
                  ? 'No passages from downloaded volumes match your current filter.'
                  : 'No passages match your current search or color filter.'}
              </p>
              {(searchQuery || selectedColor !== 'all' || (groupMode === 'volume' ? volumeSort : chronoSort) === 'downloaded') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedColor('all');
                    if (groupMode === 'volume') {
                      setVolumeSort('title_asc');
                    } else {
                      setChronoSort('date_desc');
                    }
                  }}
                  className="text-xs font-mono uppercase"
                >
                  Reset Filters
                </Button>
              )}
            </div>
          )}

          {/* Main Notebook Content with Anchor and tactile page turn */}
          <div
            id="notebook-content-anchor"
            key={`notebook-content-${groupMode}-${selectedColor}-${safeCurrentPage}`}
            className="space-y-6 animate-page-turn"
          >
            {/* Grouped by Volume Display */}
            {groupMode === 'volume' && sortedGroupedByVolume.length > 0 && (
              <div className="space-y-8">
                {paginatedGroupedByVolume.map((group) => (
                  <NotebookVolumeGroup
                    key={group.bookId}
                    group={group}
                    isUnavailableOffline={isOffline && !isBookOffline(group.bookId)}
                    onOpenVolume={(bookId) => {
                      primeReaderForBook(bookId);
                      router.push(`/read/${bookId}`);
                    }}
                    renderQuoteCard={renderQuoteCard}
                  />
                ))}
              </div>
            )}

            {/* Chronological Stream Display */}
            {groupMode === 'chronological' && sortedAnnotations.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {paginatedAnnotations.map((ann) => renderQuoteCard(ann))}
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          <Pagination
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            totalItems={totalItems}
            pageSize={pageSize}
            className="mt-8"
          />
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      <ConfirmActionModal
        isOpen={isConfirmClearOpen}
        onClose={() => setIsConfirmClearOpen(false)}
        onConfirm={handleConfirmClearAll}
        title="Clear All Saved Notes & Highlights?"
        heading="Are you sure you want to clear all notes and highlights?"
        description={`This will permanently remove all ${annotations.length} highlighted passages and notes across your entire library. This action cannot be undone.`}
        confirmLabel={
          <>
            <Trash2 className="w-3.5 h-3.5" />
            Clear Everything
          </>
        }
        maxWidth="md"
        buttonSize="sm"
        dialogTestId="clear-all-notes-dialog"
      />

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
      <ConfirmActionModal
        isOpen={reflectionToDelete !== null}
        onClose={() => setReflectionToDelete(null)}
        onConfirm={handleConfirmDeleteReflection}
        title="Delete Personal Reflection?"
        heading="Are you sure you want to delete your personal reflection?"
        description="This will remove only your written personal reflection. The highlighted book passage will remain safely preserved in your commonplace notebook."
        confirmLabel={
          <>
            <Trash2 className="w-3.5 h-3.5" />
            Delete Reflection
          </>
        }
        maxWidth="md"
        buttonSize="sm"
        dialogTestId="delete-reflection-dialog"
        confirmTestId="confirm-delete-reflection-btn"
      >
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
      </ConfirmActionModal>
    </section>
  );

  // Quote Card Renderer
  function renderQuoteCard(ann: NotebookDisplayItem) {
    const { title, author, isRestricted, country } = resolveBookDetails(ann);

    return (
      <NotebookQuoteCard
        key={ann.id}
        annotation={ann}
        pairedFellowAnnotation={ann.pairedFellowAnnotation}
        matchingOwnAnnotation={ann.matchingOwnAnnotation}
        bookTitle={title}
        bookAuthor={author}
        isRestricted={isRestricted}
        isUnavailableOffline={isOffline && !isBookOffline(ann.bookId)}
        jurisdictionCountry={country}
        isEditing={editingAnnotationId === ann.id}
        onStartEdit={(target) => setEditingAnnotationId(target.id)}
        onCancelEdit={() => setEditingAnnotationId(null)}
        onSaveNote={handleSaveNote}
        onUpdateColor={handleUpdateColor}
        onRequestDeleteReflection={(target) => setReflectionToDelete(target)}
        onRequestDeleteAnnotation={(target) => setAnnotationToDelete(target)}
        onJumpToReader={handleJumpToReader}
        onSaveFellowAsOwn={async (fellow, noteText, color) => {
          await addAnnotation(
            {
              bookId: fellow.bookId,
              bookTitle: title,
              bookAuthor: author,
              chapterIndex: fellow.chapterIndex,
              chapterPage: fellow.chapterPage,
              selectedText: fellow.selectedText,
              color: color || ann.matchingOwnAnnotation?.color || 'yellow',
              note: noteText,
            },
            user?.id
          );
        }}
      />
    );
  }
};
