'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
import { CollectionBottomDock } from './CollectionBottomDock';
import { CollectionFloatingSearch } from './CollectionFloatingSearch';
import { CollectionFilterDrawer } from './CollectionFilterDrawer';
import type { SortOption } from './CollectionSortDropdown';
import { smartScrollToContent, runPreservingScrollPosition } from '@/lib/scroll-utils';
import { DeleteAnnotationModal } from '@/components/reader/DeleteAnnotationModal';
import {
  useHydratedAnnotations,
  type Annotation,
  type FellowAnnotation,
  type HighlightColor,
  type MarginaliaSourceFilter,
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

export type NotebookChronoSortOption =
  | 'date_desc'
  | 'date_asc'
  | 'title_asc'
  | 'title_desc'
  | 'author_asc'
  | 'author_desc'
  | 'downloaded';
export type NotebookVolumeSortOption =
  | 'title_asc'
  | 'title_desc'
  | 'author_asc'
  | 'author_desc'
  | 'count_desc'
  | 'count_asc'
  | 'recent'
  | 'recent_asc'
  | 'downloaded';

export type NotebookVolumeBaseSort = 'title' | 'author' | 'count' | 'recent' | 'downloaded';
export type NotebookChronoBaseSort = 'date' | 'title' | 'author' | 'downloaded';

export const NOTEBOOK_VOLUME_BASE_SORT_OPTIONS: SortOption[] = [
  { value: 'title', label: 'Book Title' },
  { value: 'author', label: 'Author' },
  { value: 'count', label: 'Quote Count' },
  { value: 'recent', label: 'Date Annotated' },
  { value: 'downloaded', label: 'Downloaded' },
];

export const NOTEBOOK_CHRONO_BASE_SORT_OPTIONS: SortOption[] = [
  { value: 'date', label: 'Date Added' },
  { value: 'title', label: 'Book Title' },
  { value: 'author', label: 'Author' },
  { value: 'downloaded', label: 'Downloaded' },
];

export function decomposeVolumeSort(sort: NotebookVolumeSortOption): {
  base: NotebookVolumeBaseSort;
  dir: 'asc' | 'desc';
  isDirectionDisabled: boolean;
} {
  switch (sort) {
    case 'title_desc':
      return { base: 'title', dir: 'desc', isDirectionDisabled: false };
    case 'title_asc':
      return { base: 'title', dir: 'asc', isDirectionDisabled: false };
    case 'author_desc':
      return { base: 'author', dir: 'desc', isDirectionDisabled: false };
    case 'author_asc':
      return { base: 'author', dir: 'asc', isDirectionDisabled: false };
    case 'count_desc':
      return { base: 'count', dir: 'desc', isDirectionDisabled: false };
    case 'count_asc':
      return { base: 'count', dir: 'asc', isDirectionDisabled: false };
    case 'recent_asc':
      return { base: 'recent', dir: 'asc', isDirectionDisabled: false };
    case 'recent':
      return { base: 'recent', dir: 'desc', isDirectionDisabled: false };
    case 'downloaded':
      return { base: 'downloaded', dir: 'desc', isDirectionDisabled: true };
    default:
      return { base: 'title', dir: 'asc', isDirectionDisabled: false };
  }
}

export function resolveVolumeSort(
  base: NotebookVolumeBaseSort,
  dir: 'asc' | 'desc'
): NotebookVolumeSortOption {
  switch (base) {
    case 'title':
      return dir === 'asc' ? 'title_asc' : 'title_desc';
    case 'author':
      return dir === 'asc' ? 'author_asc' : 'author_desc';
    case 'count':
      return dir === 'asc' ? 'count_asc' : 'count_desc';
    case 'recent':
      return dir === 'asc' ? 'recent_asc' : 'recent';
    case 'downloaded':
      return 'downloaded';
  }
}

export function decomposeChronoSort(sort: NotebookChronoSortOption): {
  base: NotebookChronoBaseSort;
  dir: 'asc' | 'desc';
  isDirectionDisabled: boolean;
} {
  switch (sort) {
    case 'date_asc':
      return { base: 'date', dir: 'asc', isDirectionDisabled: false };
    case 'date_desc':
      return { base: 'date', dir: 'desc', isDirectionDisabled: false };
    case 'title_asc':
      return { base: 'title', dir: 'asc', isDirectionDisabled: false };
    case 'title_desc':
      return { base: 'title', dir: 'desc', isDirectionDisabled: false };
    case 'author_asc':
      return { base: 'author', dir: 'asc', isDirectionDisabled: false };
    case 'author_desc':
      return { base: 'author', dir: 'desc', isDirectionDisabled: false };
    case 'downloaded':
      return { base: 'downloaded', dir: 'desc', isDirectionDisabled: true };
    default:
      return { base: 'date', dir: 'desc', isDirectionDisabled: false };
  }
}

export function resolveChronoSort(
  base: NotebookChronoBaseSort,
  dir: 'asc' | 'desc'
): NotebookChronoSortOption {
  switch (base) {
    case 'date':
      return dir === 'asc' ? 'date_asc' : 'date_desc';
    case 'title':
      return dir === 'asc' ? 'title_asc' : 'title_desc';
    case 'author':
      return dir === 'asc' ? 'author_asc' : 'author_desc';
    case 'downloaded':
      return 'downloaded';
  }
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
      case 'title_desc':
        return list.sort((a, b) => {
          const titleA = resolveBookDetails(a).title;
          const titleB = resolveBookDetails(b).title;
          return titleB.localeCompare(titleA, undefined, { sensitivity: 'base' });
        });
      case 'author_asc':
        return list.sort((a, b) => {
          const authorA = resolveBookDetails(a).author;
          const authorB = resolveBookDetails(b).author;
          return authorA.localeCompare(authorB, undefined, { sensitivity: 'base' });
        });
      case 'author_desc':
        return list.sort((a, b) => {
          const authorA = resolveBookDetails(a).author;
          const authorB = resolveBookDetails(b).author;
          return authorB.localeCompare(authorA, undefined, { sensitivity: 'base' });
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
      case 'count_asc':
        return list.sort((a, b) => a.items.length - b.items.length);
      case 'recent_asc':
        return list.sort((a, b) => {
          const timeA = Math.max(...a.items.map((i) => getItemRecentTimestamp(i)), 0);
          const timeB = Math.max(...b.items.map((i) => getItemRecentTimestamp(i)), 0);
          return timeA - timeB;
        });
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

  // Single-column mobile scroll focus zone (< 1024px) and tactile dismissal
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleScrollOrResize = () => {
      if (window.innerWidth >= 1024) return;
      const anchor = document.getElementById('notebook-content-anchor');
      if (!anchor) return;
      const cardEls = Array.from(anchor.querySelectorAll<HTMLElement>('[data-notebook-quote-id]'));
      if (cardEls.length === 0) return;

      // Top boundary: near page top
      if (window.scrollY <= 32) {
        const firstId = cardEls[0].getAttribute('data-notebook-quote-id');
        if (firstId) {
          setActiveAnnotationId(firstId);
          return;
        }
      }

      // Bottom boundary: near page bottom
      const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 32;
      if (isAtBottom) {
        const lastId = cardEls[cardEls.length - 1].getAttribute('data-notebook-quote-id');
        if (lastId) {
          setActiveAnnotationId(lastId);
          return;
        }
      }

      // Viewport central focus band: ~46% from top
      const targetY = window.innerHeight * 0.46;
      let closestId: string | null = null;
      let minDistance = Infinity;

      for (const el of cardEls) {
        const rect = el.getBoundingClientRect();
        if (rect.bottom >= 0 && rect.top <= window.innerHeight) {
          const cardCenterY = rect.top + rect.height / 2;
          const dist = Math.abs(cardCenterY - targetY);
          if (dist < minDistance) {
            minDistance = dist;
            const id = el.getAttribute('data-notebook-quote-id');
            if (id) {
              closestId = id;
            }
          }
        }
      }

      if (closestId !== null) {
        setActiveAnnotationId(closestId);
      }
    };

    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(handleScrollOrResize);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    handleScrollOrResize();

    // Tap outside cards clears active state
    const handleDocumentPointerDown = (e: PointerEvent | MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.closest !== 'function' || !target.closest('[data-notebook-quote-id]')) {
        setActiveAnnotationId(null);
      }
    };

    document.addEventListener('pointerdown', handleDocumentPointerDown, { passive: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('pointerdown', handleDocumentPointerDown);
    };
  }, [totalItems, groupMode, safeCurrentPage]);

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
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (q) {
            smartScrollToContent('notebook-content-anchor', { offsetTop: 80 });
          }
        }}
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
