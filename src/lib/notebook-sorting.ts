import type { SortOption } from '@/components/presentation/CollectionSortDropdown';
import type {
  Annotation,
  FellowAnnotation,
  HighlightColor,
} from '@/stores/useAnnotationStore';
import { isFellowAnnotation } from '@/lib/reader-annotator';

export type NotebookDisplayItem = (Annotation | FellowAnnotation) & {
  pairedFellowAnnotation?: FellowAnnotation;
  matchingOwnAnnotation?: Annotation;
};

export interface NotebookBookDetails {
  title: string;
  author: string;
  isRestricted?: boolean;
  country?: string;
}

export interface NotebookVolumeGroupItem {
  bookId: number;
  title: string;
  author: string;
  isRestricted?: boolean;
  country?: string;
  items: NotebookDisplayItem[];
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

export type NotebookVolumeBaseSort =
  | 'title'
  | 'author'
  | 'count'
  | 'recent'
  | 'downloaded';

export type NotebookChronoBaseSort =
  | 'date'
  | 'title'
  | 'author'
  | 'downloaded';

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

export function getItemCreatedAt(item: NotebookDisplayItem): number {
  const tSelf = new Date(item.createdAt).getTime();
  const tPaired = item.pairedFellowAnnotation
    ? new Date(item.pairedFellowAnnotation.createdAt).getTime()
    : 0;
  return Math.max(tSelf, tPaired);
}

export function getItemRecentTimestamp(item: NotebookDisplayItem): number {
  const tSelf = new Date(item.updatedAt || item.createdAt).getTime();
  const tPaired = item.pairedFellowAnnotation
    ? new Date(
        item.pairedFellowAnnotation.updatedAt ||
          item.pairedFellowAnnotation.createdAt
      ).getTime()
    : 0;
  return Math.max(tSelf, tPaired);
}

export function filterNotebookAnnotations(
  sourceFilteredAnnotations: NotebookDisplayItem[],
  selectedColor: HighlightColor | 'all',
  searchQuery: string,
  resolveBookDetails: (ann: Annotation | FellowAnnotation) => NotebookBookDetails
): NotebookDisplayItem[] {
  const trimmedQuery = searchQuery.trim().toLowerCase();

  return sourceFilteredAnnotations.filter((ann) => {
    if (selectedColor !== 'all') {
      const matchesPrimary = ann.color === selectedColor;
      const matchesPaired = ann.pairedFellowAnnotation?.color === selectedColor;
      if (!matchesPrimary && !matchesPaired) {
        return false;
      }
    }

    if (trimmedQuery) {
      const { title, author } = resolveBookDetails(ann);
      const matchesQuote = ann.selectedText.toLowerCase().includes(trimmedQuery);
      const matchesNote = ann.note
        ? ann.note.toLowerCase().includes(trimmedQuery)
        : false;
      const matchesTitle = title.toLowerCase().includes(trimmedQuery);
      const matchesAuthor = author.toLowerCase().includes(trimmedQuery);
      const matchesPairedQuote =
        ann.pairedFellowAnnotation?.selectedText
          .toLowerCase()
          .includes(trimmedQuery) || false;
      const matchesPairedNote = ann.pairedFellowAnnotation?.note
        ? ann.pairedFellowAnnotation.note.toLowerCase().includes(trimmedQuery)
        : false;
      const matchesPairedFellow = Boolean(
        ann.pairedFellowAnnotation &&
          ((ann.pairedFellowAnnotation.fellowDisplayName &&
            ann.pairedFellowAnnotation.fellowDisplayName
              .toLowerCase()
              .includes(trimmedQuery)) ||
            ann.pairedFellowAnnotation.fellowUsername
              .toLowerCase()
              .includes(trimmedQuery))
      );
      const matchesFellowSelf = Boolean(
        isFellowAnnotation(ann) &&
          ((ann.fellowDisplayName &&
            ann.fellowDisplayName.toLowerCase().includes(trimmedQuery)) ||
            ann.fellowUsername.toLowerCase().includes(trimmedQuery))
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
}

export function groupAnnotationsByVolume(
  filteredAnnotations: NotebookDisplayItem[],
  resolveBookDetails: (ann: Annotation | FellowAnnotation) => NotebookBookDetails
): NotebookVolumeGroupItem[] {
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
}

export function sortNotebookAnnotationsChronologically(
  filteredAnnotations: NotebookDisplayItem[],
  chronoSort: NotebookChronoSortOption,
  resolveBookDetails: (ann: Annotation | FellowAnnotation) => NotebookBookDetails,
  isBookOffline: (bookId: number) => boolean
): NotebookDisplayItem[] {
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
}

export function sortNotebookVolumeGroups(
  groupedByVolume: NotebookVolumeGroupItem[],
  volumeSort: NotebookVolumeSortOption,
  isBookOffline: (bookId: number) => boolean
): NotebookVolumeGroupItem[] {
  const list = [...groupedByVolume];
  switch (volumeSort) {
    case 'title_desc':
      return list.sort((a, b) =>
        b.title.localeCompare(a.title, undefined, { sensitivity: 'base' })
      );
    case 'author_asc':
      return list.sort((a, b) =>
        a.author.localeCompare(b.author, undefined, { sensitivity: 'base' })
      );
    case 'author_desc':
      return list.sort((a, b) =>
        b.author.localeCompare(a.author, undefined, { sensitivity: 'base' })
      );
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
        .sort((a, b) =>
          a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
        );
    case 'title_asc':
    default:
      return list.sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
      );
  }
}
