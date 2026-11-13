import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, NAVBAR_VIEW_CONFIG, VIEW_CONTENT_CONFIG } from './views.config';

describe('views.config', () => {
  describe('NAV_ITEMS', () => {
    it('contains all 5 primary navigation items', () => {
      const ids = NAV_ITEMS.map((item) => item.id);
      expect(ids).toEqual(['catalog', 'bookshelf', 'favorites', 'notebook', 'bookmarks']);
    });

    it('has valid labels, titles, and icons for each nav item', () => {
      for (const item of NAV_ITEMS) {
        expect(item.id).toBeTruthy();
        expect(item.label).toBeTruthy();
        expect(item.title).toBeTruthy();
        expect(item.icon).toBeDefined();
        expect(item.themeKey).toBeTruthy();
      }
    });

    it('assigns correct countKey for collections', () => {
      const bookshelf = NAV_ITEMS.find((i) => i.id === 'bookshelf');
      const favorites = NAV_ITEMS.find((i) => i.id === 'favorites');
      const notebook = NAV_ITEMS.find((i) => i.id === 'notebook');
      const bookmarks = NAV_ITEMS.find((i) => i.id === 'bookmarks');
      const catalog = NAV_ITEMS.find((i) => i.id === 'catalog');

      expect(bookshelf?.countKey).toBe('savedCount');
      expect(favorites?.countKey).toBe('favoriteCount');
      expect(notebook?.countKey).toBe('annotationCount');
      expect(bookmarks?.countKey).toBe('activeReadingCount');
      expect(catalog?.countKey).toBeUndefined();
    });
  });

  describe('NAVBAR_VIEW_CONFIG', () => {
    it('has label and activeColor configuration for all views including account', () => {
      const expectedViews: Array<keyof typeof NAVBAR_VIEW_CONFIG> = [
        'catalog',
        'bookshelf',
        'favorites',
        'notebook',
        'bookmarks',
        'account',
      ];
      for (const viewId of expectedViews) {
        const entry = NAVBAR_VIEW_CONFIG[viewId];
        expect(entry).toBeDefined();
        expect(entry.label.length).toBeGreaterThan(0);
        expect(entry.activeColor).toContain('text-');
      }
      expect(NAVBAR_VIEW_CONFIG.account.label).toBe('Account');
      expect(NAVBAR_VIEW_CONFIG.account.activeColor).toBe('text-primary');
    });
  });

  describe('VIEW_CONTENT_CONFIG', () => {
    it('correctly calculates catalog titles and subtitles', () => {
      const catalog = VIEW_CONTENT_CONFIG.catalog;
      expect(catalog.getTitle()).toBe('Recent Books');
      expect(catalog.getTitle({ sort: 'descending' })).toBe('Recent Books');
      expect(catalog.getTitle({ sort: '' })).toBe('Recent Books');
      expect(catalog.getTitle({ sort: 'popular' })).toBe('Popular Books');
      expect(catalog.getTitle({ sort: 'ascending' })).toBe('Oldest Books');
      expect(catalog.getTitle({ search: 'dickens', sort: 'popular' })).toBe('Search Catalog');
      expect(catalog.getTitle({ topic: 'fiction', sort: 'ascending' })).toBe('Search Catalog');
      expect(catalog.getTitle({ era: 'victorian' })).toBe('Search Catalog');

      expect(catalog.getSubtitle({ count: 0, booksData: null })).toBe('Searching Project Gutenberg catalog...');
      expect(
        catalog.getSubtitle({
          count: 0,
          booksData: { count: 42 },
          displayedCount: 10,
        })
      ).toBe('Displaying 10 of 42 public domain volumes');

      // Formatted numbers with comma separators
      expect(
        catalog.getSubtitle({
          count: 0,
          booksData: { count: 55754 },
          displayedCount: 16,
        })
      ).toBe('Displaying 16 of 55,754 public domain volumes');

      expect(
        catalog.getSubtitle({
          count: 0,
          booksData: { count: 78086 },
          displayedCount: 16,
        })
      ).toBe('Displaying 16 of 78,086 public domain volumes');
    });

    it('correctly formats bookshelf and favorites content', () => {
      const shelf = VIEW_CONTENT_CONFIG.bookshelf;
      expect(shelf.getTitle()).toBe('Reading Shelf');
      expect(shelf.getSubtitle({ count: 5 })).toBe('You have 5 titles preserved on your personal shelf');
      expect(shelf.emptyDescription).toContain('bookshelf icon');
      expect(shelf.collectionName).toBe('bookshelf');
      expect(shelf.clearType).toBe('shelf');

      const fav = VIEW_CONTENT_CONFIG.favorites;
      expect(fav.getTitle()).toBe('Favorite Works');
      expect(fav.getSubtitle({ count: 3 })).toBe('You have 3 titles in your favorites');
      expect(fav.collectionName).toBe('favorites');
      expect(fav.clearType).toBe('favorites');
    });
  });
});

