import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCatalogFilters } from './useCatalogFilters';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => (typeof window !== 'undefined' ? window.location.pathname : '/'),
  useSearchParams: () => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''),
}));

describe('useCatalogFilters', () => {
  it('initializes with default catalog filters and page 1', () => {
    const { result } = renderHook(() => useCatalogFilters());

    expect(result.current.search).toBe('');
    expect(result.current.topic).toBe('');
    expect(result.current.language).toBe('');
    expect(result.current.era).toBe('');
    expect(result.current.sort).toBe('popular');
    expect(result.current.page).toBe(1);
    expect(result.current.activeView).toBe('catalog');
    expect(result.current.viewMode).toBe('grid');
    expect(result.current.activeFilterChips).toEqual([]);
    expect(result.current.queryParams.copyright).toBe(false);
  });

  it('updates search and resets page to 1', () => {
    const { result } = renderHook(() => useCatalogFilters());

    act(() => {
      result.current.setPage(5);
    });
    expect(result.current.page).toBe(5);

    act(() => {
      result.current.handleSearchChange('Austen');
    });

    expect(result.current.search).toBe('Austen');
    expect(result.current.page).toBe(1);
    expect(result.current.queryParams.search).toBe('Austen');
    expect(result.current.activeFilterChips.length).toBe(1);
    expect(result.current.activeFilterChips[0].id).toBe('search');
  });

  it('handles topic, language, and era updates correctly', () => {
    const { result } = renderHook(() => useCatalogFilters());

    act(() => {
      result.current.handleTopicChange('philosophy');
      result.current.handleLanguageChange('la');
      result.current.handleEraChange('antiquity');
    });

    expect(result.current.topic).toBe('philosophy');
    expect(result.current.language).toBe('la');
    expect(result.current.era).toBe('antiquity');
    expect(result.current.selectedEraObj?.start).toBe(-800);
    expect(result.current.queryParams.authorYearStart).toBe(-800);
    expect(result.current.activeFilterChips.length).toBe(3);
  });

  it('removes individual filter chips', () => {
    const { result } = renderHook(() => useCatalogFilters());

    act(() => {
      result.current.handleSearchChange('Homer');
      result.current.handleTopicChange('poetry');
    });
    expect(result.current.activeFilterChips.length).toBe(2);

    act(() => {
      result.current.removeFilterChip('search');
    });
    expect(result.current.search).toBe('');
    expect(result.current.topic).toBe('poetry');
    expect(result.current.activeFilterChips.length).toBe(1);
  });

  it('resets all filters cleanly', () => {
    const { result } = renderHook(() => useCatalogFilters());

    act(() => {
      result.current.handleSearchChange('Dostoevsky');
      result.current.handleTopicChange('fiction');
      result.current.handleEraChange('victorian');
      result.current.handleSortChange('descending');
      result.current.setPage(4);
    });

    act(() => {
      result.current.handleResetAllFilters();
    });

    expect(result.current.search).toBe('');
    expect(result.current.topic).toBe('');
    expect(result.current.era).toBe('');
    expect(result.current.sort).toBe('popular');
    expect(result.current.page).toBe(1);
    expect(result.current.activeFilterChips).toEqual([]);
  });

  it('toggles view modes and drawer visibility', () => {
    const { result } = renderHook(() => useCatalogFilters());

    act(() => {
      result.current.setViewMode('shelf');
      result.current.setActiveView('bookshelf');
      result.current.setIsFilterDrawerOpen(true);
    });

    expect(result.current.viewMode).toBe('shelf');
    expect(result.current.activeView).toBe('bookshelf');
    expect(result.current.isFilterDrawerOpen).toBe(true);
  });

  it('hydrates initial filter state from clean pathname /bookshelf', () => {
    delete (window as any).location;
    (window as any).location = new URL('http://localhost:3000/bookshelf?search=Plato&page=2');

    const { result } = renderHook(() => useCatalogFilters());

    expect(result.current.activeView).toBe('bookshelf');
    expect(result.current.search).toBe('Plato');
    expect(result.current.page).toBe(2);

    (window as any).location = new URL('http://localhost:3000/');
  });

  it('hydrates initial filter state from clean pathname /favorites, /notebook, and /bookmarks', () => {
    delete (window as any).location;
    (window as any).location = new URL('http://localhost:3000/favorites');
    const { result: favResult } = renderHook(() => useCatalogFilters());
    expect(favResult.current.activeView).toBe('favorites');

    (window as any).location = new URL('http://localhost:3000/notebook');
    const { result: noteResult } = renderHook(() => useCatalogFilters());
    expect(noteResult.current.activeView).toBe('notebook');

    (window as any).location = new URL('http://localhost:3000/bookmarks');
    const { result: markResult } = renderHook(() => useCatalogFilters());
    expect(markResult.current.activeView).toBe('bookmarks');

    (window as any).location = new URL('http://localhost:3000/');
  });

  it('preserves backward compatibility by hydrating from legacy query param view=bookshelf', () => {
    delete (window as any).location;
    (window as any).location = new URL('http://localhost:3000/?search=Plato&topic=philosophy&page=3&sort=ascending&view=bookshelf');

    const { result } = renderHook(() => useCatalogFilters());

    expect(result.current.search).toBe('Plato');
    expect(result.current.topic).toBe('philosophy');
    expect(result.current.page).toBe(3);
    expect(result.current.sort).toBe('ascending');
    expect(result.current.activeView).toBe('bookshelf');

    (window as any).location = new URL('http://localhost:3000/');
  });

  it('preserves backward compatibility with legacy view=notebook and view=bookmarks', () => {
    delete (window as any).location;
    (window as any).location = new URL('http://localhost:3000/?view=notebook');
    const { result: noteResult } = renderHook(() => useCatalogFilters());
    expect(noteResult.current.activeView).toBe('notebook');

    (window as any).location = new URL('http://localhost:3000/?view=bookmarks');
    const { result: markResult } = renderHook(() => useCatalogFilters());
    expect(markResult.current.activeView).toBe('bookmarks');

    (window as any).location = new URL('http://localhost:3000/');
  });

  it('preserves backward compatibility with legacy view=favorites and view=likes', () => {
    delete (window as any).location;
    (window as any).location = new URL('http://localhost:3000/?view=favorites');
    const { result: favResult } = renderHook(() => useCatalogFilters());
    expect(favResult.current.activeView).toBe('favorites');

    (window as any).location = new URL('http://localhost:3000/?view=likes');
    const { result: likesResult } = renderHook(() => useCatalogFilters());
    expect(likesResult.current.activeView).toBe('favorites');

    (window as any).location = new URL('http://localhost:3000/');
  });
});

