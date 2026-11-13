'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Highlighter,
  Trash2,
  Layers,
  Clock,
} from 'lucide-react';
import { NotebookQuoteCard } from './NotebookQuoteCard';
import { NotebookFilterStrip } from './notebook/NotebookFilterStrip';
import { NotebookVolumeGroup } from './notebook/NotebookVolumeGroup';
import { CollectionEmptyState } from './CollectionEmptyState';
import { CollectionToolbar } from './CollectionToolbar';
import { CollectionBottomDock } from './CollectionBottomDock';
import { CollectionFloatingSearch } from './CollectionFloatingSearch';
import { CollectionFilterDrawer } from './CollectionFilterDrawer';
import { smartScrollToContent, runPreservingScrollPosition } from '@/lib/scroll-utils';
import { DeleteAnnotationModal } from '@/components/reader/DeleteAnnotationModal';
import {
  useHydratedAnnotations,
  type Annotation,
  type HighlightColor,
  type MarginaliaSourceFilter,
} from '@/stores/useAnnotationStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useNotebookMetadataResolver } from '@/hooks/useNotebookMetadataResolver';
import { useMobileViewportCardFocus } from '@/hooks/useMobileViewportCardFocus';
import { Button } from '@/components/ui/Button';
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal';
import { Pagination } from '@/components/ui/Pagination';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  pairOverlappingAnnotations,
  filterAndPairAnnotationsBySource,
} from '@/lib/reader-annotator';
import {
  type NotebookDisplayItem,
  type NotebookChronoSortOption,
  type NotebookVolumeSortOption,
  type NotebookVolumeBaseSort,
  type NotebookChronoBaseSort,
  NOTEBOOK_VOLUME_BASE_SORT_OPTIONS,
  NOTEBOOK_CHRONO_BASE_SORT_OPTIONS,
  decomposeVolumeSort,
  resolveVolumeSort,
  decomposeChronoSort,
  resolveChronoSort,
  filterNotebookAnnotations,
  groupAnnotationsByVolume,
  sortNotebookAnnotationsChronologically,
  sortNotebookVolumeGroups,
} from '@/lib/notebook-sorting';

export {
  type NotebookDisplayItem,
  type NotebookChronoSortOption,
  type NotebookVolumeSortOption,
  type NotebookVolumeBaseSort,
  type NotebookChronoBaseSort,
  NOTEBOOK_VOLUME_BASE_SORT_OPTIONS,
  NOTEBOOK_CHRONO_BASE_SORT_OPTIONS,
  decomposeVolumeSort,
  resolveVolumeSort,
  decomposeChronoSort,
  resolveChronoSort,
};

export interface NotebookViewProps {
  onBrowseCatalog?: () => void;
}

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
    syncWithCloud,
    clearAllAnnotations,
  } = useHydratedAnnotations();
  const user = useAuthStore((s) => s.user);
  const { resolveBookDetails, primeReaderForBook, isBookOffline, isOffline } =
    useNotebookMetadataResolver(annotations, fellowAnnotations, user?.id);

  useEffect(() => {
    if (user?.id && !isOffline) {
      void syncWithCloud(user.id, { minSyncIntervalMs: 15_000 });
    }
  }, [user?.id, isOffline, syncWithCloud]);

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
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [isBottomSearchOpen, setIsBottomSearchOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Reset page to 1 when filters, search query, mode, sorting, or marginalia source change
  const [prevFilterKey, setPrevFilterKey] = useState(
    `${searchQuery}-${selectedColor}-${groupMode}-${chronoSort}-${volumeSort}-${marginaliaSourceFilter}`
  );
  const filterKey = `${searchQuery}-${selectedColor}-${groupMode}-${chronoSort}-${volumeSort}-${marginaliaSourceFilter}`;
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setCurrentPage(1);
  }

  const {
    base: volumeBaseSort,
    dir: volumeSortDir,
    isDirectionDisabled: isVolumeDirDisabled,
  } = decomposeVolumeSort(volumeSort);

  const {
    base: chronoBaseSort,
    dir: chronoSortDir,
    isDirectionDisabled: isChronoDirDisabled,
  } = decomposeChronoSort(chronoSort);

  const currentNotebookBaseSort = groupMode === 'volume' ? volumeBaseSort : chronoBaseSort;
  const currentNotebookSortDir = groupMode === 'volume' ? volumeSortDir : chronoSortDir;
  const isCurrentNotebookDirDisabled =
    groupMode === 'volume' ? isVolumeDirDisabled : isChronoDirDisabled;

  const handleNotebookDirectionToggle = useCallback(() => {
    runPreservingScrollPosition(() => {
      if (groupMode === 'volume') {
        const { base, dir, isDirectionDisabled } = decomposeVolumeSort(volumeSort);
        if (!isDirectionDisabled) {
          const nextDir = dir === 'asc' ? 'desc' : 'asc';
          setVolumeSort(resolveVolumeSort(base, nextDir));
        }
      } else {
        const { base, dir, isDirectionDisabled } = decomposeChronoSort(chronoSort);
        if (!isDirectionDisabled) {
          const nextDir = dir === 'asc' ? 'desc' : 'asc';
          setChronoSort(resolveChronoSort(base, nextDir));
        }
      }
    });
  }, [groupMode, volumeSort, chronoSort]);

  const handleNotebookBaseSortChange = useCallback(
    (newBase: string) => {
      const defaultDir = newBase === 'title' || newBase === 'author' ? 'asc' : 'desc';
      if (groupMode === 'volume') {
        setVolumeSort(resolveVolumeSort(newBase as NotebookVolumeBaseSort, defaultDir));
      } else {
        setChronoSort(resolveChronoSort(newBase as NotebookChronoBaseSort, defaultDir));
      }
    },
    [groupMode]
  );

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
    return filterNotebookAnnotations(
      sourceFilteredAnnotations,
      selectedColor,
      searchQuery,
      resolveBookDetails
    );
  }, [sourceFilteredAnnotations, selectedColor, searchQuery, resolveBookDetails]);

  // Grouped by Volume mapping
  const groupedByVolume = useMemo(() => {
    return groupAnnotationsByVolume(filteredAnnotations, resolveBookDetails);
  }, [filteredAnnotations, resolveBookDetails]);

  // Sorted list of annotations for Chronological mode
  const sortedAnnotations = useMemo(() => {
    return sortNotebookAnnotationsChronologically(
      filteredAnnotations,
      chronoSort,
      resolveBookDetails,
      isBookOffline
    );
  }, [filteredAnnotations, chronoSort, resolveBookDetails, isBookOffline]);

  // Sorted Grouped by Volume mapping
  const sortedGroupedByVolume = useMemo(() => {
    return sortNotebookVolumeGroups(groupedByVolume, volumeSort, isBookOffline);
  }, [groupedByVolume, volumeSort, isBookOffline]);

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

  // Single-column mobile scroll focus zone (< 1024px) and tactile dismissal
  useMobileViewportCardFocus<string>({
    containerId: 'notebook-content-anchor',
    cardDataAttribute: 'data-notebook-quote-id',
    parseCardId: (raw) => raw || null,
    onActiveIdChange: setActiveAnnotationId,
    focusBandRatio: 0.46,
    deps: [totalItems, groupMode, safeCurrentPage],
  });

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

  const drawerMarginaliaOptions = useMemo(
    () => [
      { id: 'all', label: 'All Passages', count: annotations.length + fellowAnnotations.length },
      { id: 'own', label: 'My Notes', count: annotations.length },
      { id: 'fellows', label: "Fellows' Notes", count: fellowAnnotations.length },
    ],
    [annotations.length, fellowAnnotations.length]
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedColor !== 'all') count++;
    if (marginaliaSourceFilter !== 'all') count++;
    if (searchQuery.trim().length > 0) count++;
    if (groupMode === 'volume' ? volumeSort !== 'title_asc' : chronoSort !== 'date_desc') count++;
    return count;
  }, [selectedColor, marginaliaSourceFilter, searchQuery, groupMode, volumeSort, chronoSort]);

  return (
    <section id="literary-notebook-section" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 [overflow-anchor:none]" aria-label="Literary Commonplace Notebook">
      {/* Booksaw Centered Section Header */}
        <SectionHeader
          eyebrow="MARGINALIA & REFLECTIONS"
          title="Literary Notebook"
          subtitle={
            annotations.length > 0
              ? `You have preserved ${annotations.length} passage${annotations.length === 1 ? '' : 's'} across ${uniqueBookCount} literary volume${uniqueBookCount === 1 ? '' : 's'}.`
              : 'You have 0 passages preserved in your notebook'
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
        <CollectionEmptyState
          icon={<Highlighter className="w-8 h-8" />}
          iconContainerClassName="bg-amber-500/10 text-amber-500"
          headingAs="h2"
          title="Your Notebook is Empty"
          description="When reading any volume in the catalog, select inspiring sentences to highlight them in editorial pastel shades and jot down your personal reflections."
          onExploreCatalog={onBrowseCatalog}
        />
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
            sortValue={currentNotebookBaseSort}
            onSortChange={handleNotebookBaseSortChange}
            sortOptions={
              groupMode === 'volume'
                ? NOTEBOOK_VOLUME_BASE_SORT_OPTIONS
                : NOTEBOOK_CHRONO_BASE_SORT_OPTIONS
            }
            sortAriaLabel={
              groupMode === 'volume' ? 'Sort book groups' : 'Sort quotes chronologically'
            }
            sortDirection={currentNotebookSortDir}
            onDirectionToggle={handleNotebookDirectionToggle}
            isDirectionDisabled={isCurrentNotebookDirDisabled}
            singleRowOnMobile={true}
            hiddenOnMobile={true}
            extraControls={
              <button
                type="button"
                data-testid="notebook-view-mode-toggle"
                onClick={() => setGroupMode(groupMode === 'volume' ? 'chronological' : 'volume')}
                aria-label={
                  groupMode === 'volume'
                    ? 'Current mode: Grouped by Book. Click to switch to Chronological order'
                    : 'Current mode: Chronological order. Click to switch to Grouped by Book'
                }
                title={
                  groupMode === 'volume'
                    ? 'Switch to Chronological order'
                    : 'Switch to Grouped by Book'
                }
                className={`h-8 w-8 flex items-center justify-center rounded-lg border font-mono text-xs transition-all shadow-booksaw cursor-pointer shrink-0 select-none active:scale-95 ${
                  groupMode === 'chronological'
                    ? 'border-primary/40 bg-primary/5 text-primary'
                    : 'border-border bg-card hover:border-primary/40 hover:text-primary text-foreground'
                }`}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {groupMode === 'volume' ? (
                    <motion.div
                      key="volume"
                      initial={{ opacity: 0, scale: 0.8, rotate: -15, y: 1 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, rotate: 15, y: -1 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="flex items-center justify-center pointer-events-none"
                    >
                      <Layers className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="chronological"
                      initial={{ opacity: 0, scale: 0.8, rotate: -15, y: 1 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, rotate: 15, y: -1 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="flex items-center justify-center pointer-events-none"
                    >
                      <Clock className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
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
            className="space-y-6 animate-page-turn [overflow-anchor:none]"
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

      {/* Mobile Floating Search */}
      <CollectionFloatingSearch
        isOpen={isBottomSearchOpen}
        onClose={() => setIsBottomSearchOpen(false)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        contentAnchorId="notebook-content-anchor"
        searchPlaceholder="Search notes & quotes..."
        searchAriaLabel="Search notebook"
        clearAriaLabel="Clear notebook search"
      />

      {/* Mobile Filter & Sort Drawer */}
      <CollectionFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        title="Notebook Filters & Sort"
        subtitle={activeFilterCount > 0 ? `${activeFilterCount} active filters` : 'Marginalia source and sort order'}
        activeFilterCount={activeFilterCount}
        shelfOptions={drawerMarginaliaOptions}
        selectedShelfId={marginaliaSourceFilter}
        onSelectShelf={(id) => setMarginaliaSourceFilter(id as MarginaliaSourceFilter)}
        shelfSectionTitle="Marginalia Source"
        viewMode={groupMode === 'volume' ? 'book' : 'chronological'}
        onViewModeChange={(mode) => setGroupMode(mode === 'book' ? 'volume' : 'chronological')}
        sortOptions={
          groupMode === 'volume'
            ? NOTEBOOK_VOLUME_BASE_SORT_OPTIONS
            : NOTEBOOK_CHRONO_BASE_SORT_OPTIONS
        }
        selectedSort={currentNotebookBaseSort}
        onSortChange={handleNotebookBaseSortChange}
        sortSectionTitle={
          groupMode === 'volume' ? 'Sort Volume Groups' : 'Sort Quotes Chronologically'
        }
        sortDirection={currentNotebookSortDir}
        onDirectionToggle={handleNotebookDirectionToggle}
        onDirectionChange={(dir) => {
          runPreservingScrollPosition(() => {
            if (groupMode === 'volume') {
              setVolumeSort(resolveVolumeSort(volumeBaseSort, dir));
            } else {
              setChronoSort(resolveChronoSort(chronoBaseSort, dir));
            }
          });
        }}
        isDirectionDisabled={isCurrentNotebookDirDisabled}
        onResetAll={() => {
          setSearchQuery('');
          setSelectedColor('all');
          setMarginaliaSourceFilter('all');
          setGroupMode('volume');
          setVolumeSort('title_asc');
          setChronoSort('date_desc');
        }}
      />

      {/* Mobile Capsule Bottom Dock */}
      {(annotations.length > 0 || fellowAnnotations.length > 0) && (
        <CollectionBottomDock
          searchQuery={searchQuery}
          isSearchOpen={isBottomSearchOpen}
          onSearchToggle={() => setIsBottomSearchOpen((prev) => !prev)}
          activeFilterCount={activeFilterCount}
          isFiltersOpen={isFilterDrawerOpen}
          onOpenFilters={() => setIsFilterDrawerOpen((prev) => !prev)}
          modeType="view_mode"
          viewMode={groupMode === 'volume' ? 'book' : 'chronological'}
          onViewModeToggle={() => setGroupMode(groupMode === 'volume' ? 'chronological' : 'volume')}
        />
      )}
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
        isActive={activeAnnotationId === ann.id}
        onActivate={(id) => setActiveAnnotationId(id)}
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
