import { Compass, Library, Heart, Highlighter, Bookmark, type LucideIcon } from 'lucide-react';
import { LIBRARY_THEMES } from '@/config/library-tokens';

export type NavViewId = 'catalog' | 'bookshelf' | 'favorites' | 'notebook' | 'bookmarks';
export type ViewId = NavViewId | 'account';

export interface NavItemConfig {
  readonly id: NavViewId;
  readonly label: string;
  readonly title: string;
  readonly icon: LucideIcon;
  readonly countKey?: 'savedCount' | 'favoriteCount' | 'annotationCount' | 'activeReadingCount';
  readonly themeKey: 'catalog' | 'bookshelf' | 'favorites' | 'notebook' | 'bookmarks';
}

export const NAV_ITEMS: readonly NavItemConfig[] = [
  {
    id: 'catalog',
    label: 'Catalog',
    title: 'Catalog',
    icon: Compass,
    themeKey: 'catalog',
  },
  {
    id: 'bookshelf',
    label: 'Bookshelf',
    title: 'Bookshelf',
    icon: Library,
    countKey: 'savedCount',
    themeKey: 'bookshelf',
  },
  {
    id: 'favorites',
    label: 'Favorites',
    title: 'Favorites',
    icon: Heart,
    countKey: 'favoriteCount',
    themeKey: 'favorites',
  },
  {
    id: 'notebook',
    label: 'Notebook',
    title: 'Notebook',
    icon: Highlighter,
    countKey: 'annotationCount',
    themeKey: 'notebook',
  },
  {
    id: 'bookmarks',
    label: 'Bookmarks',
    title: 'Bookmarks & Continue Reading',
    icon: Bookmark,
    countKey: 'activeReadingCount',
    themeKey: 'bookmarks',
  },
] as const;

export const NAVBAR_VIEW_CONFIG: Record<ViewId, { label: string; activeColor: string }> = {
  catalog: { label: 'Catalog', activeColor: LIBRARY_THEMES.catalog.navActiveText },
  bookshelf: { label: 'Bookshelf', activeColor: LIBRARY_THEMES.bookshelf.navActiveText },
  favorites: { label: 'Favorites', activeColor: LIBRARY_THEMES.favorites.navActiveText },
  notebook: { label: 'Notebook', activeColor: LIBRARY_THEMES.notebook.navActiveText },
  bookmarks: { label: 'Bookmarks', activeColor: LIBRARY_THEMES.bookmarks.navActiveText },
  account: { label: 'Account', activeColor: 'text-primary' },
};

export interface ViewContentStrategy {
  readonly eyebrow: string;
  readonly getTitle: (filters?: { search?: string; topic?: string; era?: string }) => string;
  readonly getSubtitle: (params: {
    count: number;
    booksData?: { count: number } | null;
    displayedCount?: number;
  }) => string;
  readonly emptyTitle: string;
  readonly emptyDescription: string;
  readonly collectionName?: 'bookshelf' | 'favorites';
  readonly searchPlaceholder?: string;
  readonly clearType?: 'shelf' | 'favorites';
  readonly clearButtonText?: string;
}

export const VIEW_CONTENT_CONFIG: Record<'catalog' | 'bookshelf' | 'favorites', ViewContentStrategy> = {
  catalog: {
    eyebrow: 'SOME QUALITY BOOKS • ZERO COPYRIGHT',
    getTitle: (filters) =>
      filters?.search || filters?.topic || filters?.era
        ? 'Search Catalog'
        : 'Public Domain Books',
    getSubtitle: ({ booksData, displayedCount = 0 }) =>
      booksData
        ? `Displaying ${displayedCount} of ${booksData.count.toString()} public domain volumes`
        : 'Searching Project Gutenberg catalog...',
    emptyTitle: 'No matching public domain works found',
    emptyDescription:
      'Try adjusting your search keywords, collection facets, or clearing the language/era filter.',
  },
  bookshelf: {
    eyebrow: 'PERSONAL ARCHIVE • PRESERVED LOCALLY',
    getTitle: () => 'Personal Reading Shelf',
    getSubtitle: ({ count }) =>
      `You have ${count} titles preserved on your personal shelf`,
    emptyTitle: 'Your personal shelf is currently empty',
    emptyDescription:
      'Click the bookmark ribbon on any volume to place it on your shelf for offline access.',
    collectionName: 'bookshelf',
    searchPlaceholder: 'Search your bookshelf by title, author, or subject...',
    clearType: 'shelf',
    clearButtonText: 'Clear Shelf',
  },
  favorites: {
    eyebrow: 'CURATED FAVORITES',
    getTitle: () => 'Favorite Works',
    getSubtitle: ({ count }) =>
      `You have ${count} titles in your favorites`,
    emptyTitle: 'No favorite books yet',
    emptyDescription:
      'Click the heart icon on any work to save it to your favorites.',
    collectionName: 'favorites',
    searchPlaceholder: 'Search your favorites by title, author, or subject...',
    clearType: 'favorites',
    clearButtonText: 'Clear Favorites',
  },
};

