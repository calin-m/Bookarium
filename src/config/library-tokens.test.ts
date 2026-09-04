import { describe, it, expect } from 'vitest';
import { LIBRARY_THEMES, getLibraryTheme, type LibrarySectionKey } from './library-tokens';
import { ROUTES } from '@/config/routes';

describe('LIBRARY_THEMES configuration', () => {
  const expectedKeys: LibrarySectionKey[] = [
    'catalog',
    'bookshelf',
    'favorites',
    'notebook',
    'customShelves',
  ];

  it('contains all expected library section keys', () => {
    expectedKeys.forEach((key) => {
      expect(LIBRARY_THEMES[key]).toBeDefined();
    });
  });

  it('guarantees non-empty class strings and valid metadata for every section', () => {
    expectedKeys.forEach((key) => {
      const theme = LIBRARY_THEMES[key];
      expect(theme.name).toBeTruthy();
      expect(theme.route).toBeTruthy();
      expect(theme.iconColor).toMatch(/^text-/);
      expect(theme.hoverBorder).toMatch(/^hover:border-/);
      expect(theme.focusRing).toMatch(/^focus-visible:ring-/);
      expect(theme.arrowColor).toMatch(/^text-/);
      expect(theme.navActiveText).toMatch(/^text-/);
      expect(theme.navActiveBorder).toMatch(/^border-/);
      expect(theme.navFill).toContain('fill-');
    });
  });

  it('preserves intentional conceptual grouping between bookshelf and customShelves', () => {
    expect(LIBRARY_THEMES.bookshelf.iconColor).toBe(LIBRARY_THEMES.customShelves.iconColor);
    expect(LIBRARY_THEMES.bookshelf.hoverBorder).toBe(LIBRARY_THEMES.customShelves.hoverBorder);
    expect(LIBRARY_THEMES.bookshelf.focusRing).toBe(LIBRARY_THEMES.customShelves.focusRing);
    expect(LIBRARY_THEMES.customShelves.route).toBe(ROUTES.BOOKSHELF);
  });

  it('maps correct route targets for favorites and notebook', () => {
    expect(LIBRARY_THEMES.favorites.route).toBe(ROUTES.LIKES);
    expect(LIBRARY_THEMES.favorites.iconColor).toBe('text-destructive');
    expect(LIBRARY_THEMES.notebook.route).toBe(ROUTES.NOTEBOOK);
    expect(LIBRARY_THEMES.notebook.iconColor).toBe('text-amber-500');
  });

  it('retrieves tokens via getLibraryTheme helper correctly', () => {
    const notebookTheme = getLibraryTheme('notebook');
    expect(notebookTheme.name).toBe('Notebook');
    expect(notebookTheme.hoverBorder).toBe('hover:border-amber-500');
  });
});

