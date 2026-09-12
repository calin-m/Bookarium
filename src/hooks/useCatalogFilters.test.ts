import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCatalogFilters, parseFiltersFromUrl } from './useCatalogFilters';

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
    expect(result.current.pageSize).toBe(16);
    expect(result.current.activeView).toBe('catalog');
    expect(result.current.viewMode).toBe('grid');
    expect(result.current.activeFilterChips).toEqual([]);
    expect(result.current.queryParams.copyright).toBe(false);
    expect(typeof result.current.isMobile).toBe('boolean');
  });

  it('updates search and resets page to 1', () => {
    const { result } = renderHook(() => useCatalogFilters());

    act(() => {
      result.current.setPage(5);
    });
    expect(result.current.page).toBe(5);

    act(() => {
      result.current.handleSearchChange('   Jane    Austen   ');
    });

    expect(result.current.search).toBe('Jane Austen');
    expect(result.current.page).toBe(1);
    expect(result.current.queryParams.search).toBe('Jane Austen');
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

describe('parseFiltersFromUrl', () => {
  it('parses page from searchParams in SSR and client environments', () => {
    const searchParams = new URLSearchParams('page=8&search=Dante&topic=poetry&sort=ascending&format=epub');
    const parsed = parseFiltersFromUrl('/catalog', searchParams);

    expect(parsed.page).toBe(8);
    expect(parsed.search).toBe('Dante');
    expect(parsed.topic).toBe('poetry');
    expect(parsed.sort).toBe('ascending');
    expect(parsed.format).toBe('epub');
    expect(parsed.view).toBe('catalog');
  });

  it('handles empty parameters with safe defaults', () => {
    const searchParams = new URLSearchParams('');
    const parsed = parseFiltersFromUrl('/', searchParams);

    expect(parsed.page).toBe(1);
    expect(parsed.search).toBe('');
    expect(parsed.topic).toBe('');
    expect(parsed.sort).toBe('popular');
    expect(parsed.format).toBe('');
    expect(parsed.view).toBe('catalog');
  });

  it('sanitizes invalid page numbers to default page 1', () => {
    const invalidZero = parseFiltersFromUrl('/', new URLSearchParams('page=0'));
    expect(invalidZero.page).toBe(1);

    const invalidNegative = parseFiltersFromUrl('/', new URLSearchParams('page=-4'));
    expect(invalidNegative.page).toBe(1);

    const invalidNaN = parseFiltersFromUrl('/', new URLSearchParams('page=invalid'));
    expect(invalidNaN.page).toBe(1);
  });

  it('correctly maps route pathname to view mode', () => {
    expect(parseFiltersFromUrl('/bookshelf', null).view).toBe('bookshelf');
    expect(parseFiltersFromUrl('/favorites', null).view).toBe('favorites');
    expect(parseFiltersFromUrl('/notebook', null).view).toBe('notebook');
    expect(parseFiltersFromUrl('/bookmarks', null).view).toBe('bookmarks');
    expect(parseFiltersFromUrl('/catalog', null).view).toBe('catalog');
  });

  it('parses size parameter with valid values and safe fallback', () => {
    expect(parseFiltersFromUrl('/', new URLSearchParams('size=8')).size).toBe(8);
    expect(parseFiltersFromUrl('/', new URLSearchParams('size=16')).size).toBe(16);
    expect(parseFiltersFromUrl('/', new URLSearchParams('size=invalid')).size).toBe(16);
    expect(parseFiltersFromUrl('/', new URLSearchParams('')).size).toBe(16);
  });
});

describe('windowed chunk sub-pagination in useCatalogFilters', () => {
  it('maps client sub-pages to upstream 32-batch apiPage', () => {
    const { result } = renderHook(() => useCatalogFilters());

    act(() => {
      result.current.setPageSize(8);
    });

    // When pageSize = 8, subPagesPerBatch = 4
    // Client pages 1..4 map to upstream apiPage 1
    act(() => {
      result.current.setPage(1);
    });
    expect(result.current.queryParams.page).toBe(1);

    act(() => {
      result.current.setPage(4);
    });
    expect(result.current.queryParams.page).toBe(1);

    // Client page 5 moves to upstream apiPage 2
    act(() => {
      result.current.setPage(5);
    });
    expect(result.current.queryParams.page).toBe(2);

    // Client page 8 is still in upstream apiPage 2
    act(() => {
      result.current.setPage(8);
    });
    expect(result.current.queryParams.page).toBe(2);

    // Client page 9 moves to upstream apiPage 3
    act(() => {
      result.current.setPage(9);
    });
    expect(result.current.queryParams.page).toBe(3);
  });

  it('translates reading position when switching pageSize between 8 and 16', () => {
    const { result } = renderHook(() => useCatalogFilters());

    act(() => {
      result.current.setPageSize(8);
      result.current.setPage(5); // first book index is (5 - 1) * 8 = 32
    });

    // Switching to size 16 should place book 32 on page 3: Math.floor(32 / 16) + 1 = 3
    act(() => {
      result.current.setPageSize(16);
    });
    expect(result.current.page).toBe(3);
    expect(result.current.pageSize).toBe(16);
  });

  it('defaults to pageSize 8 on mobile viewports (<768px)', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useCatalogFilters());
    expect(result.current.pageSize).toBe(8);

    window.matchMedia = originalMatchMedia;
  });

  it('normalizes page coordinates and prevents redundant API query changes when resizing from mobile to desktop', () => {
    const originalMatchMedia = window.matchMedia;
    let isMobile = true;
    let listeners: Array<() => void> = [];

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 767px)' ? isMobile : !isMobile,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: (_event: string, cb: () => void) => {
        listeners.push(cb);
      },
      removeEventListener: (_event: string, cb: () => void) => {
        listeners = listeners.filter((l) => l !== cb);
      },
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useCatalogFilters());
    expect(result.current.pageSize).toBe(8);

    // Navigate to mobile page 3 (first book index: (3 - 1) * 8 = 16)
    act(() => {
      result.current.setPage(3);
    });
    expect(result.current.page).toBe(3);
    expect(result.current.queryParams.page).toBe(1);

    // Simulate device rotation / window resize to desktop (>=768px)
    act(() => {
      isMobile = false;
      listeners.forEach((cb) => cb());
    });

    // Book 16 on desktop (pageSize = 16) maps to desktop page 2: Math.floor(16 / 16) + 1 = 2
    expect(result.current.pageSize).toBe(16);
    expect(result.current.page).toBe(2);
    // Crucially: queryParams.page remains 1 (no extraneous network fetch)
    expect(result.current.queryParams.page).toBe(1);

    window.matchMedia = originalMatchMedia;
  });

  it('normalizes page coordinates and preserves batch index when resizing from desktop to mobile', () => {
    const originalMatchMedia = window.matchMedia;
    let isMobile = false;
    let listeners: Array<() => void> = [];

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 767px)' ? isMobile : !isMobile,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: (_event: string, cb: () => void) => {
        listeners.push(cb);
      },
      removeEventListener: (_event: string, cb: () => void) => {
        listeners = listeners.filter((l) => l !== cb);
      },
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useCatalogFilters());
    expect(result.current.pageSize).toBe(16);

    // Navigate to desktop page 2 (first book index: (2 - 1) * 16 = 16)
    act(() => {
      result.current.setPage(2);
    });
    expect(result.current.page).toBe(2);
    expect(result.current.queryParams.page).toBe(1);

    // Simulate resize to mobile (<768px)
    act(() => {
      isMobile = true;
      listeners.forEach((cb) => cb());
    });

    // Book 16 on mobile (pageSize = 8) maps to mobile page 3: Math.floor(16 / 8) + 1 = 3
    expect(result.current.pageSize).toBe(8);
    expect(result.current.page).toBe(3);
    expect(result.current.queryParams.page).toBe(1);

    window.matchMedia = originalMatchMedia;
  });

  it('preserves higher batch coordinates (batch 2) across mobile-to-desktop resize', () => {
    const originalMatchMedia = window.matchMedia;
    let isMobile = true;
    let listeners: Array<() => void> = [];

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 767px)' ? isMobile : !isMobile,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: (_event: string, cb: () => void) => {
        listeners.push(cb);
      },
      removeEventListener: (_event: string, cb: () => void) => {
        listeners = listeners.filter((l) => l !== cb);
      },
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useCatalogFilters());

    // Mobile page 5 is in batch 2: subPagesPerBatch = 4, apiPage = Math.floor((5 - 1) / 4) + 1 = 2
    act(() => {
      result.current.setPage(5);
    });
    expect(result.current.page).toBe(5);
    expect(result.current.queryParams.page).toBe(2);

    // Resize to desktop
    act(() => {
      isMobile = false;
      listeners.forEach((cb) => cb());
    });

    // First book index is (5 - 1) * 8 = 32. On desktop: Math.floor(32 / 16) + 1 = 3
    expect(result.current.pageSize).toBe(16);
    expect(result.current.page).toBe(3);
    // Desktop page 3 apiPage: Math.floor((3 - 1) / 2) + 1 = 2 (still batch 2!)
    expect(result.current.queryParams.page).toBe(2);

    window.matchMedia = originalMatchMedia;
  });

  it('does not alter page or pageSize when explicit size override is set', () => {
    const originalMatchMedia = window.matchMedia;
    let isMobile = true;
    let listeners: Array<() => void> = [];

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 767px)' ? isMobile : !isMobile,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: (_event: string, cb: () => void) => {
        listeners.push(cb);
      },
      removeEventListener: (_event: string, cb: () => void) => {
        listeners = listeners.filter((l) => l !== cb);
      },
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useCatalogFilters());

    act(() => {
      result.current.setPageSize(32);
      result.current.setPage(2);
    });
    expect(result.current.pageSize).toBe(32);
    expect(result.current.page).toBe(2);

    // Resize from mobile to desktop
    act(() => {
      isMobile = false;
      listeners.forEach((cb) => cb());
    });

    // Explicit size remains 32 and page remains 2
    expect(result.current.pageSize).toBe(32);
    expect(result.current.page).toBe(2);

    window.matchMedia = originalMatchMedia;
  });
});

describe('view-scoped URL pagination and query parameter synchronization', () => {
  let replaceStateSpy: any;

  beforeEach(() => {
    delete (window as any).location;
    (window as any).location = new URL('http://localhost:3000/');
    replaceStateSpy = vi.spyOn(window.history, 'replaceState');
  });

  afterEach(() => {
    replaceStateSpy?.mockRestore();
  });

  it('synchronizes catalog pagination to URL as /?page=2 when on catalog view', () => {
    const { result } = renderHook(() => useCatalogFilters());

    act(() => {
      result.current.setPage(2);
    });

    expect(result.current.page).toBe(2);
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/?page=2');
  });

  it('omits catalog pagination parameter when navigating from catalog page 2 to /bookshelf', () => {
    const { result } = renderHook(() => useCatalogFilters());

    act(() => {
      result.current.setPage(2);
    });
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/?page=2');

    act(() => {
      result.current.setActiveView('bookshelf');
    });

    expect(result.current.activeView).toBe('bookshelf');
    // Crucial assertion: URL is strictly /bookshelf without ?page=2
    expect(replaceStateSpy).toHaveBeenLastCalledWith(null, '', '/bookshelf');
  });

  it('restores catalog pagination position when switching back from /bookshelf to catalog', () => {
    const { result } = renderHook(() => useCatalogFilters());

    act(() => {
      result.current.setPage(3);
    });
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/?page=3');

    act(() => {
      result.current.setActiveView('bookshelf');
    });
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/bookshelf');

    act(() => {
      result.current.setActiveView('catalog');
    });
    expect(result.current.activeView).toBe('catalog');
    expect(result.current.page).toBe(3);
    expect(replaceStateSpy).toHaveBeenLastCalledWith(null, '', '/?page=3');
  });

  it('prevents search, topic, and sort filters from leaking into personal collection views', () => {
    const { result } = renderHook(() => useCatalogFilters());

    act(() => {
      result.current.handleSearchChange('Austen');
      result.current.handleTopicChange('fiction');
      result.current.handleSortChange('ascending');
      result.current.setPage(2);
    });

    expect(replaceStateSpy).toHaveBeenLastCalledWith(
      null,
      '',
      '/?search=Austen&topic=fiction&sort=ascending&page=2'
    );

    // Switch to favorites
    act(() => {
      result.current.setActiveView('favorites');
    });
    expect(replaceStateSpy).toHaveBeenLastCalledWith(null, '', '/favorites');

    // Switch to notebook
    act(() => {
      result.current.setActiveView('notebook');
    });
    expect(replaceStateSpy).toHaveBeenLastCalledWith(null, '', '/notebook');

    // Switch to bookmarks
    act(() => {
      result.current.setActiveView('bookmarks');
    });
    expect(replaceStateSpy).toHaveBeenLastCalledWith(null, '', '/bookmarks');

    // Switch back to catalog: full state is restored!
    act(() => {
      result.current.setActiveView('catalog');
    });
    expect(replaceStateSpy).toHaveBeenLastCalledWith(
      null,
      '',
      '/?search=Austen&topic=fiction&sort=ascending&page=2'
    );
  });
});


