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
  | 'progress_asc';

export type FavoritesSortOption =
  | 'recent'
  | 'title_asc'
  | 'title_desc'
  | 'author_asc'
  | 'author_desc'
  | 'downloads_desc';

export const BOOKSHELF_SORT_OPTIONS: SortOption[] = [
  { value: 'recent', label: 'Recently Added' },
  { value: 'title_asc', label: 'Title (A → Z)' },
  { value: 'title_desc', label: 'Title (Z → A)' },
  { value: 'author_asc', label: 'Author (A → Z)' },
  { value: 'author_desc', label: 'Author (Z → A)' },
  { value: 'progress_desc', label: 'Progress (High → Low)' },
  { value: 'progress_asc', label: 'Progress (Low → High)' },
];

export const FAVORITES_SORT_OPTIONS: SortOption[] = [
  { value: 'recent', label: 'Recently Favorited' },
  { value: 'title_asc', label: 'Title (A → Z)' },
  { value: 'title_desc', label: 'Title (Z → A)' },
  { value: 'author_asc', label: 'Author (A → Z)' },
  { value: 'author_desc', label: 'Author (Z → A)' },
  { value: 'downloads_desc', label: 'Popularity (Downloads)' },
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

    case 'recent':
    default:
      return list;
  }
}

