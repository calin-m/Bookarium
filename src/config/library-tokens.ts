import { ROUTES } from '@/config/routes';

export interface LibrarySectionTheme {
  name: string;
  route: string;
  iconColor: string;
  hoverBorder: string;
  focusRing: string;
  arrowColor: string;
  navActiveText: string;
  navActiveBorder: string;
  navFill: string;
}

/**
 * Centralized design tokens for library sections and navigation views.
 * Ensures strict visual parity between the Header navigation, Account library cards,
 * and collection views across Light, Dark, and Sepia themes.
 */
export const LIBRARY_THEMES = {
  catalog: {
    name: 'Catalog',
    route: ROUTES.CATALOG,
    iconColor: 'text-primary',
    hoverBorder: 'hover:border-primary',
    focusRing: 'focus-visible:ring-primary',
    arrowColor: 'text-primary',
    navActiveText: 'text-primary',
    navActiveBorder: 'border-primary',
    navFill: 'fill-primary text-primary',
  },
  bookshelf: {
    name: 'Bookshelf',
    route: ROUTES.BOOKSHELF,
    iconColor: 'text-primary',
    hoverBorder: 'hover:border-primary',
    focusRing: 'focus-visible:ring-primary',
    arrowColor: 'text-primary',
    navActiveText: 'text-primary',
    navActiveBorder: 'border-primary',
    navFill: 'fill-primary text-primary',
  },
  favorites: {
    name: 'Favorites',
    route: ROUTES.FAVORITES,
    iconColor: 'text-destructive',
    hoverBorder: 'hover:border-destructive',
    focusRing: 'focus-visible:ring-destructive',
    arrowColor: 'text-destructive',
    navActiveText: 'text-destructive',
    navActiveBorder: 'border-destructive',
    navFill: 'fill-destructive text-destructive',
  },
  notebook: {
    name: 'Notebook',
    route: ROUTES.NOTEBOOK,
    iconColor: 'text-amber-500',
    hoverBorder: 'hover:border-amber-500',
    focusRing: 'focus-visible:ring-amber-500',
    arrowColor: 'text-amber-500',
    navActiveText: 'text-amber-600 dark:text-amber-400',
    navActiveBorder: 'border-amber-500',
    navFill: 'fill-amber-500 text-amber-500',
  },
  customShelves: {
    name: 'Custom Shelves',
    route: ROUTES.BOOKSHELF,
    iconColor: 'text-primary',
    hoverBorder: 'hover:border-primary',
    focusRing: 'focus-visible:ring-primary',
    arrowColor: 'text-primary',
    navActiveText: 'text-primary',
    navActiveBorder: 'border-primary',
    navFill: 'fill-primary text-primary',
  },
  bookmarks: {
    name: 'Bookmarks',
    route: ROUTES.BOOKMARKS,
    iconColor: 'text-indigo-500',
    hoverBorder: 'hover:border-indigo-500',
    focusRing: 'focus-visible:ring-indigo-500',
    arrowColor: 'text-indigo-500',
    navActiveText: 'text-indigo-600 dark:text-indigo-400',
    navActiveBorder: 'border-indigo-500',
    navFill: 'fill-indigo-500 text-indigo-500',
  },
} as const;

export type LibrarySectionKey = keyof typeof LIBRARY_THEMES;

/**
 * Type-safe helper to retrieve tokens for any library section.
 */
export function getLibraryTheme(key: LibrarySectionKey): LibrarySectionTheme {
  return LIBRARY_THEMES[key];
}

