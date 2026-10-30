import type { GutendexBook } from '@/types/book.types';
import { cleanBookTitle } from '@/lib/book-metadata';
import { formatAuthorNames } from '@/lib/utils';
import type { SortOption } from '@/components/presentation/CollectionSortDropdown';

export type BookshelfSortOption =
  | 'recent'
  | 'title_asc'
  | 'title_desc'
  | 'author_asc'
  | 'author_desc'
  | 'progress_desc'
  | 'progress_asc'
  | 'downloaded';

export type FavoritesSortOption =
  | 'recent'
  | 'title_asc'
  | 'title_desc'
  | 'author_asc'
  | 'author_desc'
  | 'downloads_desc'
  | 'downloaded';

export const BOOKSHELF_SORT_OPTIONS: SortOption[] = [
  { value: 'recent', label: 'Recently Added' },
  { value: 'title_asc', label: 'Title (A → Z)' },
  { value: 'title_desc', label: 'Title (Z → A)' },
  { value: 'author_asc', label: 'Author (A → Z)' },
  { value: 'author_desc', label: 'Author (Z → A)' },
  { value: 'progress_desc', label: 'Progress (High → Low)' },
  { value: 'progress_asc', label: 'Progress (Low → High)' },
  { value: 'downloaded', label: 'Downloaded' },
];

export const FAVORITES_SORT_OPTIONS: SortOption[] = [
  { value: 'recent', label: 'Recently Favorited' },
  { value: 'title_asc', label: 'Title (A → Z)' },
  { value: 'title_desc', label: 'Title (Z → A)' },
  { value: 'author_asc', label: 'Author (A → Z)' },
  { value: 'author_desc', label: 'Author (Z → A)' },
  { value: 'downloads_desc', label: 'Popularity (Downloads)' },
  { value: 'downloaded', label: 'Downloaded' },
];

/**
 * Pure sorting engine for book collections (Bookshelf, Favorites).
 * Handles alphabetical title sorting, natural author names, reading progress, and download counts.
 */
export function sortBooks(
  books: GutendexBook[],
  sortBy: string,
  readingProgress?: Record<number, number>
): GutendexBook[] {
  if (!books || books.length <= 1) return books ? [...books] : [];
  const list = [...books];

  switch (sortBy) {
    case 'title_asc':
      return list.sort((a, b) => {
        const titleA = cleanBookTitle(a.title);
        const titleB = cleanBookTitle(b.title);
        return titleA.localeCompare(titleB, undefined, { sensitivity: 'base' });
      });

    case 'title_desc':
      return list.sort((a, b) => {
        const titleA = cleanBookTitle(a.title);
        const titleB = cleanBookTitle(b.title);
        return titleB.localeCompare(titleA, undefined, { sensitivity: 'base' });
      });

    case 'author_asc':
      return list.sort((a, b) => {
        const authorA = a.authors ? formatAuthorNames(a.authors) : '';
        const authorB = b.authors ? formatAuthorNames(b.authors) : '';
        return authorA.localeCompare(authorB, undefined, { sensitivity: 'base' });
      });

    case 'author_desc':
      return list.sort((a, b) => {
        const authorA = a.authors ? formatAuthorNames(a.authors) : '';
        const authorB = b.authors ? formatAuthorNames(b.authors) : '';
        return authorB.localeCompare(authorA, undefined, { sensitivity: 'base' });
      });

    case 'progress_desc':
      return list.sort((a, b) => {
        const progA = readingProgress?.[a.id] ?? 0;
        const progB = readingProgress?.[b.id] ?? 0;
        return progB - progA;
      });

    case 'progress_asc':
      return list.sort((a, b) => {
        const progA = readingProgress?.[a.id] ?? 0;
        const progB = readingProgress?.[b.id] ?? 0;
        return progA - progB;
      });

    case 'downloads_desc':
      return list.sort((a, b) => (b.download_count ?? 0) - (a.download_count ?? 0));

    case 'downloaded':
    case 'recent':
    default:
      return list;
  }
}

/**
 * Merges and deduplicates downloaded books across `savedBooks` and `offlineBooks`,
 * preserving `savedBooks` order first followed by any additional offline volumes.
 */
export function mergeDownloadedShelfBooks(
  savedBooks: GutendexBook[],
  offlineBooks: GutendexBook[],
  isBookOffline: (id: number) => boolean
): GutendexBook[] {
  const map = new Map<number, GutendexBook>();
  for (const b of savedBooks) {
    if (isBookOffline(b.id)) {
      map.set(b.id, b);
    }
  }
  for (const b of offlineBooks) {
    if (isBookOffline(b.id) && !map.has(b.id)) {
      map.set(b.id, b);
    }
  }
  return Array.from(map.values());
}

/**
 * Resolves the active bookshelf metadata (`defaultShelf`, `currentActiveShelfId`, `activeShelf`,
 * `isViewingDownloaded`, `isViewingGeneral`) across General, Downloaded, and custom named shelves.
 */
export function resolveBookshelfViewState<TShelf extends { id: string; is_default?: boolean }>({
  cloudBookshelves,
  activeBookshelfId,
  downloadedShelfId,
}: {
  cloudBookshelves: ReadonlyArray<TShelf>;
  activeBookshelfId?: string | null;
  downloadedShelfId: string;
}): {
  defaultShelf: TShelf | undefined;
  currentActiveShelfId: string | undefined;
  activeShelf: TShelf | undefined;
  isViewingDownloaded: boolean;
  isViewingGeneral: boolean;
} {
  const defaultShelf = cloudBookshelves.find((s) => s.is_default) || cloudBookshelves[0];
  const currentActiveShelfId = activeBookshelfId || defaultShelf?.id;
  const isViewingDownloaded = currentActiveShelfId === downloadedShelfId;
  const isViewingGeneral =
    !isViewingDownloaded && (defaultShelf ? currentActiveShelfId === defaultShelf.id : true);
  const activeShelf =
    cloudBookshelves.find((s) => s.id === currentActiveShelfId) || defaultShelf;

  return {
    defaultShelf,
    currentActiveShelfId,
    activeShelf,
    isViewingDownloaded,
    isViewingGeneral,
  };
}

/**
 * Filters a book collection to only the books assigned to a specific custom shelf ID.
 */
export function filterCustomShelfBooks(
  books: GutendexBook[],
  cloudBookshelfItems: ReadonlyArray<{ bookshelf_id: string; book_id: number }>,
  currentActiveShelfId?: string | null
): GutendexBook[] {
  const currentShelfBookIds = new Set(
    cloudBookshelfItems
      .filter((item) => item.bookshelf_id === currentActiveShelfId)
      .map((item) => item.book_id)
  );
  return books.filter((b) => currentShelfBookIds.has(b.id));
}


