import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import Home from './page';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { mockBooks } from '@/mocks/handlers';
import { ROUTES } from '@/config/routes';

export const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useParams: () => ({}),
  useRouter: () => ({
    push: (...args: any[]) => mockPush(...args),
    replace: vi.fn(),
  }),
  usePathname: () => (typeof window !== 'undefined' ? window.location.pathname : '/'),
  useSearchParams: () => {
    if (mockSearchParams.toString()) {
      return mockSearchParams;
    }
    return new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  },
}));

const pageMockBooks = mockBooks.slice(0, 6);

const mockUsePrefetchNextPage = vi.fn();

vi.mock('@/hooks/queries/useBooks', () => ({
  useBooks: () => ({
    data: {
      count: pageMockBooks.length,
      next: 'https://gutendex.com/books/?page=2',
      previous: null,
      results: pageMockBooks,
      source: 'upstream',
      latencyMs: 140,
      clientCountry: 'RO',
      jurisdictionRule: 'LIFE_70',
    },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  usePrefetchNextPage: (...args: any[]) => {
    mockUsePrefetchNextPage(...args);
    return vi.fn();
  },
}));

vi.mock('@/hooks/queries/useBookContent', () => ({
  useBookContent: () => ({
    data: 'Sample book text content',
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('@/components/presentation/LiteraryQuotes', () => ({
  LiteraryQuotes: () => <section data-testid="literary-quotes">Words That Shaped Humanity</section>,
}));

vi.mock('@/components/presentation/Footer', () => ({
  Footer: () => <footer data-testid="footer-mock">Footer</footer>,
}));

vi.mock('@/components/presentation/HeroFeaturedBook3D', () => ({
  HeroFeaturedBook3D: ({ onReadFeaturedBook, featuredBook }: { onReadFeaturedBook?: (b: any) => void; featuredBook?: any }) => (
    <div data-testid="mock-hero-3d-book">
      Featured 3D Book
      <button
        type="button"
        data-testid="read-featured-btn"
        onClick={() => onReadFeaturedBook?.(featuredBook || mockBooks[0])}
      >
        Read Featured
      </button>
      <button
        type="button"
        data-testid="read-featured-empty-btn"
        onClick={() => onReadFeaturedBook?.(undefined)}
      >
        Read Featured Empty
      </button>
      <button
        type="button"
        data-testid="read-featured-minimal-btn"
        onClick={() => onReadFeaturedBook?.({ id: 1342, title: 'Pride and Prejudice' })}
      >
        Read Featured Minimal
      </button>
    </div>
  ),
}));

const mockIsBookOffline = vi.fn().mockReturnValue(false);
const mockRemoveBook = vi.fn().mockResolvedValue(true);
const mockRemoveAll = vi.fn().mockResolvedValue(undefined);
const mockDownloadBook = vi.fn().mockResolvedValue(true);
let mockOfflineBooks: any[] = [];

vi.mock('@/hooks/useOfflineBooks', () => ({
  useOfflineBooks: () => ({
    offlineBookIds: mockOfflineBooks.map((b) => b.id),
    offlineBooks: mockOfflineBooks,
    isLoading: false,
    downloadingIds: [],
    storageQuota: null,
    downloadBook: mockDownloadBook,
    removeBook: mockRemoveBook,
    removeAll: mockRemoveAll,
    isBookOffline: mockIsBookOffline,
    isBookDownloading: vi.fn().mockReturnValue(false),
    refreshOfflineList: vi.fn().mockResolvedValue(undefined),
  }),
}));

const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: Infinity,
      staleTime: Infinity,
    },
  },
});

function renderHome() {
  let utils: any;
  act(() => {
    utils = render(
      <QueryClientProvider client={testQueryClient}>
        <Home />
      </QueryClientProvider>
    );
  });
  return utils;
}

describe('Home page integration', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSearchParams = new URLSearchParams();
    testQueryClient.clear();
    useBookshelfStore.getState().clearBookshelf();
    useReaderStore.setState({ isOpen: false, currentBook: null });
  });

  it('should render catalog, hero search, sticky toolbar, and books list', () => {
    renderHome();

    expect(screen.getByText(/Timeless Literature/i)).toBeInTheDocument();
    expect(screen.getByTestId('sticky-catalog-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId(`book-card-${mockBooks[0].id}`)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Classic of the Day/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Displaying 6 of 6 public domain volumes/i)
    ).toBeInTheDocument();
  });

  it('should handle search, topic, and language change interactions', () => {
    renderHome();

    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'Frankenstein' } });
    const searchBtn = screen.getByRole('button', { name: /^Search$/i });
    fireEvent.click(searchBtn);

    const topicChip = screen.getByTestId('topic-chip-philosophy');
    fireEvent.click(topicChip);

    const langSelect = screen.getByTestId('language-select');
    fireEvent.change(langSelect, { target: { value: 'en' } });

    expect(screen.getByText(/Search Catalog/i)).toBeInTheDocument();
  });

  it('should open advanced filter drawer and apply era and sort filters', () => {
    renderHome();

    const openFiltersBtn = screen.getByTestId('open-filters-btn');
    fireEvent.click(openFiltersBtn);

    expect(screen.getByTestId('advanced-filter-drawer')).toBeInTheDocument();

    const eraOption = screen.getByTestId('era-option-victorian');
    fireEvent.click(eraOption);

    const applyBtn = screen.getByTestId('apply-filters-btn');
    fireEvent.click(applyBtn);

    expect(screen.queryByTestId('advanced-filter-drawer')).not.toBeInTheDocument();
    expect(screen.getByText(/19th Century Victorian & Romantic/i)).toBeInTheDocument();
  });

  it('should switch to bookshelf view and require confirmation to clear shelf', () => {
    useBookshelfStore.getState().toggleSaveBook(mockBooks[0]);
    renderHome();

    const bookshelfBtn = screen.getByLabelText('Bookshelf');
    fireEvent.click(bookshelfBtn);

    expect(screen.getByText('Reading Shelf')).toBeInTheDocument();
    expect(screen.getByText(/You have 1 titles preserved on your personal shelf/i)).toBeInTheDocument();

    const clearBtn = screen.getByRole('button', { name: /Clear Shelf/i });
    fireEvent.click(clearBtn);

    // Confirmation dialog appears
    expect(screen.getByText('Clear Personal Bookshelf')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to clear your bookshelf/i)).toBeInTheDocument();

    // Cancel preserves shelf
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(useBookshelfStore.getState().savedBooks).toHaveLength(1);

    // Click again and confirm
    fireEvent.click(clearBtn);
    const confirmBtn = screen.getByRole('button', { name: /Yes, Clear Shelf/i });
    fireEvent.click(confirmBtn);
    expect(useBookshelfStore.getState().savedBooks).toHaveLength(0);
  });

  it('should switch to favorites view and require confirmation to clear favorites', () => {
    useBookshelfStore.getState().toggleFavoriteBook(mockBooks[0]);
    renderHome();

    const likedBtn = screen.getByLabelText('Favorites');
    fireEvent.click(likedBtn);

    expect(screen.getByText('Favorite Works')).toBeInTheDocument();

    const clearFavBtn = screen.getByRole('button', { name: /Clear Favorites/i });
    fireEvent.click(clearFavBtn);

    // Confirmation dialog appears
    expect(screen.getByText('Clear Favorite Books')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to clear your favorites/i)).toBeInTheDocument();

    // Cancel preserves favorites
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(useBookshelfStore.getState().favoriteBookIds).toHaveLength(1);

    // Click again and confirm
    fireEvent.click(clearFavBtn);
    const confirmBtn = screen.getByRole('button', { name: /Yes, Clear Favorites/i });
    fireEvent.click(confirmBtn);
    expect(useBookshelfStore.getState().favoriteBookIds).toHaveLength(0);
  });

  it('disconnects catalog viewMode from favorites, keeping favorites in dedicated grid mode even when catalog is in shelf mode', async () => {
    useBookshelfStore.getState().toggleFavoriteBook(mockBooks[0]);
    renderHome();

    // Switch Catalog to shelf view mode
    const shelfModeBtn = screen.getByRole('button', { name: /Shelf view/i });
    fireEvent.click(shelfModeBtn);

    // Switch to Favorites tab
    const favoritesNavBtn = screen.getByLabelText('Favorites');
    fireEvent.click(favoritesNavBtn);

    // Favorites should render BookCard grid, NOT BookshelfRack
    expect(screen.getByTestId(`book-card-${mockBooks[0].id}`)).toBeInTheDocument();
    expect(screen.queryByTestId('bookshelf-rack')).not.toBeInTheDocument();
  });

  it('adapts top clear button and confirmation modal to the active custom shelf or downloaded shelf', async () => {
    useBookshelfStore.setState({
      savedBooks: [mockBooks[0], mockBooks[1]],
      cloudBookshelves: [
        { id: 'shelf-1', user_id: 'user-1', name: 'General', is_default: true, created_at: '', updated_at: '' },
        { id: 'shelf-2', user_id: 'user-1', name: 'Philosophy', is_default: false, is_public: true, created_at: '', updated_at: '' },
      ],
      cloudBookshelfItems: [
        {
          id: 'item-1',
          bookshelf_id: 'shelf-1',
          user_id: 'user-1',
          book_id: mockBooks[0].id,
          book_title: mockBooks[0].title,
          book_authors: [],
          cover_url: null,
          added_at: '',
        },
        {
          id: 'item-2',
          bookshelf_id: 'shelf-2',
          user_id: 'user-1',
          book_id: mockBooks[1].id,
          book_title: mockBooks[1].title,
          book_authors: [],
          cover_url: null,
          added_at: '',
        },
      ],
      activeBookshelfId: 'shelf-2',
    });

    renderHome();

    // Navigate to Bookshelf tab
    const bookshelfNavBtn = screen.getByLabelText('Bookshelf');
    fireEvent.click(bookshelfNavBtn);

    // Top clear button should reflect the active custom shelf: 'Clear "Philosophy" Shelf'
    const clearCustomBtn = screen.getByRole('button', { name: /Clear "Philosophy" Shelf/i });
    expect(clearCustomBtn).toBeInTheDocument();

    fireEvent.click(clearCustomBtn);
    expect(screen.getByText('Clear "Philosophy" Bookshelf')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to clear your "Philosophy" shelf\?/i)).toBeInTheDocument();

    const confirmCustomBtn = screen.getByRole('button', { name: /Yes, Clear "Philosophy"/i });
    await act(async () => {
      fireEvent.click(confirmCustomBtn);
    });

    // Philosophy shelf books cleared, General preserved
    expect(useBookshelfStore.getState().savedBooks.map((b) => b.id)).toEqual([mockBooks[0].id]);

    // Now test Downloaded smart shelf
    mockIsBookOffline.mockImplementation((id: number) => id === mockBooks[0].id);
    act(() => {
      useBookshelfStore.setState({ activeBookshelfId: '__downloaded__' });
    });

    // Top clear button should reflect Downloaded shelf
    const clearDownloadedBtn = screen.getByRole('button', { name: /Clear Downloaded Shelf/i });
    expect(clearDownloadedBtn).toBeInTheDocument();

    fireEvent.click(clearDownloadedBtn);
    expect(screen.getByText('Clear Downloaded Books')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to clear your downloaded shelf\?/i)).toBeInTheDocument();

    const confirmDownloadsBtn = screen.getByRole('button', { name: /Yes, Clear Downloads/i });
    await act(async () => {
      fireEvent.click(confirmDownloadsBtn);
    });

    expect(mockRemoveAll).toHaveBeenCalled();
  });

  it('should open download hub and close it', () => {
    renderHome();

    expect(screen.getByTestId(`book-card-${mockBooks[0].id}`)).toBeInTheDocument();

    const downloadBtn = screen.getByLabelText(`Download options for ${mockBooks[0].title}`);
    fireEvent.click(downloadBtn);

    expect(screen.getByText('Download Hub')).toBeInTheDocument();
    expect(screen.getByText('EPUB E-Reader')).toBeInTheDocument();

    const closeBtn = screen.getByLabelText('Close modal');
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Download Hub')).not.toBeInTheDocument();
  });

  it('should open 3D book preview modal when book cover is clicked and close it on desktop', () => {
    vi.useFakeTimers();
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });

    try {
      renderHome();

      const previewTrigger = screen.getByLabelText(`Click to preview quotes for ${mockBooks[0].title}`);
      expect(previewTrigger).toBeInTheDocument();
      fireEvent.click(previewTrigger);

      expect(screen.getByTestId('book-preview-modal')).toBeInTheDocument();
      const bookStage = screen.getByTestId('preview-book-stage');
      expect(bookStage).toBeInTheDocument();
      fireEvent.click(bookStage);

      act(() => {
        vi.advanceTimersByTime(1100);
      });

      expect(screen.queryByTestId('book-preview-modal')).not.toBeInTheDocument();
    } finally {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalWidth });
      vi.useRealTimers();
    }
  });

  it('renders Bookshelf and Favorites when views are switched via Navbar', () => {
    renderHome();

    // Switch to Bookshelf
    const bookshelfBtn = screen.getByRole('button', { name: /^Bookshelf$/i });
    fireEvent.click(bookshelfBtn);
    expect(screen.getByText('Reading Shelf')).toBeInTheDocument();
    expect(screen.getByTestId('bookshelf-rack')).toBeInTheDocument();

    // Switch to Favorites
    const favoritesBtn = screen.getByRole('button', { name: /^Favorites$/i });
    fireEvent.click(favoritesBtn);
    expect(screen.getByText('Favorite Works')).toBeInTheDocument();
    expect(screen.getByText('No favorite books yet')).toBeInTheDocument();

    // Switch back to Catalog
    const catalogBtn = screen.getByRole('button', { name: /^Catalog$/i });
    fireEvent.click(catalogBtn);
    expect(screen.getByTestId(`book-card-${mockBooks[0].id}`)).toBeInTheDocument();
  });

  it('navigates to /account when swiping left on mobile while on Bookmarks view', () => {
    vi.useFakeTimers();
    const originalInnerWidth = window.innerWidth;
    const originalMatchMedia = window.matchMedia;

    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      renderHome();

      // Switch to Bookmarks view
      const bookmarksBtn = screen.getByRole('button', { name: /Bookmarks/i });
      fireEvent.click(bookmarksBtn);

      const mainEl = screen.getByRole('main');

      // Swipe left: touchStart at 450, touchEnd at 350 (|deltaX| = 100px)
      fireEvent.touchStart(mainEl, {
        touches: [{ clientX: 450, clientY: 300 }],
        changedTouches: [{ clientX: 450, clientY: 300 }],
      });

      vi.advanceTimersByTime(100);

      fireEvent.touchEnd(mainEl, {
        touches: [],
        changedTouches: [{ clientX: 350, clientY: 300 }],
      });

      expect(mockPush).toHaveBeenCalledWith(`${ROUTES.ACCOUNT}?dir=forward`);
    } finally {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalInnerWidth });
      window.matchMedia = originalMatchMedia;
      vi.useRealTimers();
    }
  });

  it('swipes right on Catalog to wrap around to Account page with backward directional slide parameter', () => {
    vi.useFakeTimers();
    const originalInnerWidth = window.innerWidth;
    const originalMatchMedia = window.matchMedia;

    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 });
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('767px'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      renderHome();

      const mainEl = screen.getByRole('main');

      // Swipe right on Catalog: touchStart at 350, touchEnd at 450 (deltaX = +100px)
      fireEvent.touchStart(mainEl, {
        touches: [{ clientX: 350, clientY: 300 }],
        changedTouches: [{ clientX: 350, clientY: 300 }],
      });

      vi.advanceTimersByTime(100);

      fireEvent.touchEnd(mainEl, {
        touches: [],
        changedTouches: [{ clientX: 450, clientY: 300 }],
      });

      expect(mockPush).toHaveBeenCalledWith(`${ROUTES.ACCOUNT}?dir=backward`);
    } finally {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalInnerWidth });
      window.matchMedia = originalMatchMedia;
      vi.useRealTimers();
    }
  });

  it('mounts with animate-view-slide-right when ?dir=backward is in URL and settles cleanly on animationEnd', () => {
    mockSearchParams = new URLSearchParams('dir=backward');
    renderHome();
    const transitionContainer = document.querySelector('.animate-view-slide-right');
    expect(transitionContainer).toBeInTheDocument();

    act(() => {
      fireEvent.animationEnd(transitionContainer!);
    });

    expect(transitionContainer).not.toHaveClass('animate-view-slide-right');
  });

  it('allows user to toggle between 8 and 16 books per page via toolbar', () => {
    renderHome();

    const size8Btn = screen.getByLabelText('Show 8 books per page');
    expect(size8Btn).toBeInTheDocument();
    fireEvent.click(size8Btn);

    const size16Btn = screen.getByLabelText('Show 16 books per page');
    expect(size16Btn).toBeInTheDocument();
    fireEvent.click(size16Btn);
  });

  it('prevents search execution on 1-character query in HeroSearch on catalog page', () => {
    renderHome();

    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'a' } });

    const searchBtn = screen.getByRole('button', { name: /^Search$/i });
    fireEvent.click(searchBtn);

    expect(screen.getByRole('alert')).toHaveTextContent(/Please enter at least 2 characters to search/i);
  });

  it('triggers predictive prefetching when approaching batch end on sub-page 3 (size 8)', () => {
    delete (window as any).location;
    (window as any).location = new URL('http://localhost:3000/?page=3&size=8');

    renderHome();

    // At page=3, size=8, subIndex is (3-1)%4 = 2.
    // isApproachingBatchEnd = 2 >= max(1, 4-2) = 2 >= 2 is true.
    expect(mockUsePrefetchNextPage).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 }),
      true
    );

    (window as any).location = new URL('http://localhost:3000/');
  });

  // =========================================================================
  // END-TO-END MULTI-STEP USER JOURNEYS (In-Memory E2E via Vitest)
  // =========================================================================
  it('E2E Journey: full catalog search -> preview open -> reader launch -> shelf curation', async () => {
    renderHome();

    // Step 1: User performs catalog search
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'Pride' } });
    const searchBtn = screen.getByRole('button', { name: /^Search$/i });
    fireEvent.click(searchBtn);

    // Step 2: User filters by topic chip
    const topicChip = screen.getByTestId('topic-chip-fiction');
    fireEvent.click(topicChip);

    // Step 3: User opens 3D preview on first book
    const card = screen.getByTestId(`book-card-${mockBooks[0].id}`);
    expect(card).toBeInTheDocument();

    const previewTrigger = screen.getByLabelText(`Click to preview quotes for ${mockBooks[0].title}`);
    fireEvent.click(previewTrigger);
    expect(screen.getByTestId('book-preview-modal')).toBeInTheDocument();

    // Step 4: User launches reader from book card
    const readBtns = screen.getAllByLabelText(`Read ${mockBooks[0].title}`);
    fireEvent.click(readBtns[0]);

    // Verify Reader Store was populated
    expect(useReaderStore.getState().currentBook?.id).toBe(mockBooks[0].id);

    // Step 5: User saves book to personal shelf
    act(() => {
      useBookshelfStore.getState().toggleSaveBook(mockBooks[0]);
      useBookshelfStore.getState().toggleFavoriteBook(mockBooks[0]);
    });

    expect(useBookshelfStore.getState().savedBooks).toHaveLength(1);
    expect(useBookshelfStore.getState().favoriteBookIds).toHaveLength(1);

    // Step 6: User switches to Bookshelf view
    const bookshelfTab = screen.getByRole('button', { name: /^Bookshelf$/i });
    fireEvent.click(bookshelfTab);

    expect(screen.getByTestId('bookshelf-rack')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
  });

  it('should dynamically filter bookshelf books with smart multi-word search in arbitrary order', () => {
    useBookshelfStore.getState().toggleSaveBook(mockBooks[0]);
    useBookshelfStore.getState().toggleSaveBook(mockBooks[1]);

    renderHome();

    // Switch to Bookshelf view
    const bookshelfTab = screen.getByRole('button', { name: /^Bookshelf$/i });
    fireEvent.click(bookshelfTab);

    const searchInput = screen.getByRole('textbox', { name: /search bookshelf/i });
    expect(searchInput).toBeInTheDocument();

    // Search with reverse word order: "austen pride"
    fireEvent.change(searchInput, { target: { value: 'austen pride' } });
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    // Clear search
    const clearBtn = screen.getByRole('button', { name: /clear bookshelf search/i });
    fireEvent.click(clearBtn);
    expect(screen.queryByRole('button', { name: /clear bookshelf search/i })).not.toBeInTheDocument();
  });

  it('should dynamically filter favorites books and show empty search feedback', () => {
    useBookshelfStore.getState().toggleFavoriteBook(mockBooks[0]);
    useBookshelfStore.getState().syncFavoriteBooks([mockBooks[0]]);

    renderHome();

    // Switch to Favorites view
    const favoritesTab = screen.getByRole('button', { name: /^Favorites$/i });
    fireEvent.click(favoritesTab);

    const searchInput = screen.getByRole('textbox', { name: /search favorites/i });
    expect(searchInput).toBeInTheDocument();

    // Search with non-matching query
    fireEvent.change(searchInput, { target: { value: 'NonExistentVolumeXYZ' } });
    expect(screen.getByText(/No volumes found matching/i)).toBeInTheDocument();

    // Click in-card Clear Search button
    const clearSearchBtn = screen.getByRole('button', { name: /^Clear Search$/i });
    fireEvent.click(clearSearchBtn);
    expect(screen.queryByText(/No volumes found matching/i)).not.toBeInTheDocument();
  });

  it('should switch to Notebook view when Notebook tab in Navbar is clicked', async () => {
    const { useAnnotationStore } = await import('@/stores/useAnnotationStore');
    await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Integration test notebook passage',
      color: 'yellow',
      note: 'My favorite quote',
    });

    renderHome();

    // Click Notebook tab in Navbar
    const notebookTab = screen.getByRole('button', { name: /^Notebook/i });
    expect(notebookTab).toBeInTheDocument();
    fireEvent.click(notebookTab);

    // Verify NotebookView rendered
    expect(screen.getByText('Literary Notebook')).toBeInTheDocument();
    expect(screen.getByText(/Integration test notebook passage/i)).toBeInTheDocument();
    expect(screen.getByText('My favorite quote')).toBeInTheDocument();

    act(() => {
      useAnnotationStore.getState().clearAllAnnotations();
    });
  });

  it('switches to Bookmarks view and renders reading ledger when Bookmarks nav tab is clicked', () => {
    useBookshelfStore.setState({ savedBooks: [pageMockBooks[0]] });
    useReaderStore.getState().setProgress(pageMockBooks[0].id, 40);
    useReaderStore.getState().saveReadingPosition(pageMockBooks[0].id, {
      chapterIndex: 1,
      chapterPage: 3,
      globalPage: 15,
      lastReadAt: new Date().toISOString(),
    });

    renderHome();

    // Click Bookmarks tab in Navbar
    const bookmarksTab = screen.getByRole('button', { name: /^Bookmarks/i });
    expect(bookmarksTab).toBeInTheDocument();
    fireEvent.click(bookmarksTab);

    // Verify BookmarksView rendered
    expect(screen.getByRole('heading', { name: 'Bookmarks' })).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('smoothly scrolls to catalog-section and updates display mode when toggling between Cards and Bookshelves', () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    renderHome();

    // Verify initial grid mode
    const gridBtn = screen.getByRole('button', { name: /Grid view/i });
    const shelfBtn = screen.getByRole('button', { name: /Shelf view/i });
    expect(gridBtn).toHaveAttribute('aria-pressed', 'true');
    expect(shelfBtn).toHaveAttribute('aria-pressed', 'false');

    // Click Bookshelves (Shelf) view
    fireEvent.click(shelfBtn);

    // Verify scrollIntoView was triggered on catalog section
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(shelfBtn).toHaveAttribute('aria-pressed', 'true');
    expect(gridBtn).toHaveAttribute('aria-pressed', 'false');

    // Reset mock call count and switch back to Cards (Grid) view
    scrollIntoViewMock.mockClear();
    fireEvent.click(gridBtn);

    // Verify scrollIntoView was triggered again
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(gridBtn).toHaveAttribute('aria-pressed', 'true');
    expect(shelfBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('smoothly scrolls to catalog-section when page size is changed via StickyCatalogToolbar', () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    renderHome();

    // Default pageSize is 16 on desktop; click 8 to change page size
    const size8Btn = screen.getByRole('button', { name: 'Show 8 books per page' });
    const size16Btn = screen.getByRole('button', { name: 'Show 16 books per page' });

    expect(size16Btn).toHaveAttribute('aria-pressed', 'true');
    expect(size8Btn).toHaveAttribute('aria-pressed', 'false');

    act(() => {
      fireEvent.click(size8Btn);
    });

    // Verify scrollIntoView was triggered on catalog-section
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(size8Btn).toHaveAttribute('aria-pressed', 'true');
    expect(size16Btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('smoothly scrolls to catalog-section when filters are applied via Show Results', () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    renderHome();

    // Open filter drawer
    const openFiltersBtn = screen.getByTestId('open-filters-btn');
    fireEvent.click(openFiltersBtn);

    expect(screen.getByTestId('advanced-filter-drawer')).toBeInTheDocument();

    // Select an era
    const eraOption = screen.getByTestId('era-option-victorian');
    fireEvent.click(eraOption);

    scrollIntoViewMock.mockClear();

    // Tap Show Results
    const applyBtn = screen.getByTestId('apply-filters-btn');
    fireEvent.click(applyBtn);

    // Verify scrollIntoView was triggered on catalog-section
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(screen.queryByTestId('advanced-filter-drawer')).not.toBeInTheDocument();
  });

  it('smoothly scrolls to catalog-section when filters are cleared via quick clear button', () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    renderHome();

    // Open drawer and apply a filter to activate quick clear button
    fireEvent.click(screen.getByTestId('open-filters-btn'));
    fireEvent.click(screen.getByTestId('era-option-victorian'));
    fireEvent.click(screen.getByTestId('apply-filters-btn'));

    expect(screen.getByTestId('clear-all-filters-btn')).toBeInTheDocument();

    scrollIntoViewMock.mockClear();

    // Click quick clear button
    fireEvent.click(screen.getByTestId('clear-all-filters-btn'));

    // Verify scrollIntoView was triggered on catalog-section
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(screen.queryByTestId('clear-all-filters-btn')).not.toBeInTheDocument();
  });

  it('switches views when swiping horizontally across main on mobile', () => {
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

    try {
      renderHome();

      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();

      // Initially on Catalog
      expect(screen.getByPlaceholderText(/search 70,000\+ classics/i)).toBeInTheDocument();

      // Swipe left on main (move from 500px to 400px)
      act(() => {
        fireEvent.touchStart(main, {
          touches: [{ clientX: 500, clientY: 300 }],
          changedTouches: [{ clientX: 500, clientY: 300 }],
        });
        fireEvent.touchEnd(main, {
          touches: [],
          changedTouches: [{ clientX: 400, clientY: 300 }],
        });
      });

      // Switches to Bookshelf with directional slide-left animation
      expect(screen.getByText('Reading Shelf')).toBeInTheDocument();
      expect(screen.getByTestId('bookshelf-rack')).toBeInTheDocument();
      const bookshelfTransitionContainer = screen.getByText('Reading Shelf').closest('.animate-view-slide-left');
      expect(bookshelfTransitionContainer).toBeInTheDocument();

      // Swipe left again
      act(() => {
        fireEvent.touchStart(main, {
          touches: [{ clientX: 500, clientY: 300 }],
          changedTouches: [{ clientX: 500, clientY: 300 }],
        });
        fireEvent.touchEnd(main, {
          touches: [],
          changedTouches: [{ clientX: 400, clientY: 300 }],
        });
      });

      // Switches to Favorites with directional slide-left animation
      expect(screen.getByText('Favorite Works')).toBeInTheDocument();
      const favoritesTransitionContainer = screen.getByText('Favorite Works').closest('.animate-view-slide-left');
      expect(favoritesTransitionContainer).toBeInTheDocument();

      // Swipe right (move from 400px to 500px)
      act(() => {
        fireEvent.touchStart(main, {
          touches: [{ clientX: 400, clientY: 300 }],
          changedTouches: [{ clientX: 400, clientY: 300 }],
        });
        fireEvent.touchEnd(main, {
          touches: [],
          changedTouches: [{ clientX: 500, clientY: 300 }],
        });
      });

      // Switches back to Bookshelf with directional slide-right animation
      expect(screen.getByText('Reading Shelf')).toBeInTheDocument();
      const returnTransitionContainer = screen.getByText('Reading Shelf').closest('.animate-view-slide-right');
      expect(returnTransitionContainer).toBeInTheDocument();

      // Firing animationEnd settles the transition container into resting state without duplicate animations
      act(() => {
        fireEvent.animationEnd(returnTransitionContainer!);
      });
      expect(returnTransitionContainer).not.toHaveClass('animate-view-slide-right');
      expect(returnTransitionContainer).not.toHaveClass('animate-page-turn');
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('switches views when swiping horizontally across main on tactile tablet devices', () => {
    const originalMatchMedia = window.matchMedia;
    const originalMaxTouchPoints = navigator.maxTouchPoints;
    const originalInnerWidth = window.innerWidth;

    Object.defineProperty(window, 'innerWidth', { value: 1142, writable: true, configurable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 10, writable: true, configurable: true });

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(pointer: coarse)' || query === '(max-width: 1366px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      renderHome();

      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();

      // Swipe left on main (move from 500px to 400px)
      act(() => {
        fireEvent.touchStart(main, {
          touches: [{ clientX: 500, clientY: 300 }],
          changedTouches: [{ clientX: 500, clientY: 300 }],
        });
        fireEvent.touchEnd(main, {
          touches: [],
          changedTouches: [{ clientX: 400, clientY: 300 }],
        });
      });

      // Successfully switches to Bookshelf view with directional slide-left animation
      expect(screen.getByText('Reading Shelf')).toBeInTheDocument();
      expect(screen.getByTestId('bookshelf-rack')).toBeInTheDocument();
    } finally {
      window.matchMedia = originalMatchMedia;
      Object.defineProperty(navigator, 'maxTouchPoints', { value: originalMaxTouchPoints, writable: true, configurable: true });
      Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true, configurable: true });
    }
  });

  describe('Bookshelf & Favorites Sorting and Pagination', () => {
    const generateBooks = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        ...mockBooks[i % mockBooks.length],
        id: 2000 + i,
        title: `Volume ${String.fromCharCode(65 + (i % 26))} ${i}`,
        authors: [{ name: `Writer ${String.fromCharCode(90 - (i % 26))}`, birth_year: 1800, death_year: 1880 }],
        download_count: (i + 1) * 100,
      }));

    it('renders sort dropdown, volume badge, top and bottom pagination on Bookshelf when books exceed 24 on desktop', () => {
      const books = generateBooks(28);
      useBookshelfStore.setState({ savedBooks: books });

      renderHome();

      // Switch to Bookshelf
      const banner = screen.getByRole('banner');
      const bookshelfBtn = within(banner).getByRole('button', { name: /^Bookshelf$/i });
      fireEvent.click(bookshelfBtn);

      // Verify sort dropdown is present
      const sortSelect = screen.getByLabelText('Sort bookshelf');
      expect(sortSelect).toBeInTheDocument();

      // Verify volume count badge
      expect(screen.getByText('28 volumes')).toBeInTheDocument();

      // Verify top compact pagination is rendered
      const topPagination = screen.getByRole('navigation', { name: 'Top bookshelf pagination' });
      expect(topPagination).toBeInTheDocument();
      expect(within(topPagination).getByTestId('top-pagination-indicator')).toHaveTextContent(/1\s*\/\s*2/);

      // Verify bottom pagination appears (28 items > 24 per page on desktop)
      const paginationNav = screen.getByTestId('pagination-nav');
      expect(paginationNav).toBeInTheDocument();
      expect(paginationNav).toHaveTextContent(/Showing 1–24 of 28 items/i);

      // Go to next page via top pagination
      const topNextBtn = within(topPagination).getByRole('button', { name: 'Next page' });
      fireEvent.click(topNextBtn);

      // Verify page 2 is active
      expect(paginationNav).toHaveTextContent(/Showing 25–28 of 28 items/i);
    });

    it('sorts saved books on Bookshelf by title ascending and author descending', () => {
      const bookAlpha = { ...mockBooks[0], id: 2001, title: 'Alpha Book', authors: [{ name: 'Author Z', birth_year: 1800, death_year: 1880 }] };
      const bookZulu = { ...mockBooks[1], id: 2002, title: 'Zulu Book', authors: [{ name: 'Author A', birth_year: 1800, death_year: 1880 }] };
      useBookshelfStore.setState({ savedBooks: [bookZulu, bookAlpha] });

      renderHome();

      // Switch to Bookshelf
      const banner = screen.getByRole('banner');
      fireEvent.click(within(banner).getByRole('button', { name: /^Bookshelf$/i }));

      const sortSelect = screen.getByLabelText('Sort bookshelf');

      // Sort by Title A-Z
      fireEvent.change(sortSelect, { target: { value: 'title_asc' } });
      expect(sortSelect).toHaveValue('title_asc');

      // Sort by Author Z-A
      fireEvent.change(sortSelect, { target: { value: 'author_desc' } });
      expect(sortSelect).toHaveValue('author_desc');
    });

    it('renders sort dropdown, volume badge, and pagination on Favorites when exceeding 24 items', () => {
      const books = generateBooks(28);
      useBookshelfStore.setState({
        favoriteBooks: books,
        favoriteBookIds: books.map((b) => b.id),
      });

      renderHome();

      // Switch to Favorites
      const banner = screen.getByRole('banner');
      const favoritesBtn = within(banner).getByRole('button', { name: /^Favorites$/i });
      fireEvent.click(favoritesBtn);

      // Verify sort dropdown
      const sortSelect = screen.getByLabelText('Sort favorites');
      expect(sortSelect).toBeInTheDocument();

      // Verify volume count badge
      expect(screen.getByText('28 volumes')).toBeInTheDocument();

      // Verify pagination
      const paginationNav = screen.getByTestId('pagination-nav');
      expect(paginationNav).toBeInTheDocument();
      expect(paginationNav).toHaveTextContent(/Showing 1–24 of 28 items/i);

      // Sort by popularity
      fireEvent.change(sortSelect, { target: { value: 'downloads_desc' } });
      expect(sortSelect).toHaveValue('downloads_desc');
    });

    it('resets pagination page to 1 when collection search query changes', () => {
      const books = generateBooks(28);
      useBookshelfStore.setState({ savedBooks: books });

      renderHome();

      // Switch to Bookshelf
      const banner = screen.getByRole('banner');
      fireEvent.click(within(banner).getByRole('button', { name: /^Bookshelf$/i }));

      // Navigate to Page 2
      const paginationNav = screen.getByTestId('pagination-nav');
      const nextBtn = within(paginationNav).getByRole('button', { name: 'Go to next page' });
      fireEvent.click(nextBtn);
      expect(paginationNav).toHaveTextContent(/Showing 25–28 of 28 items/i);

      // Type in collection search input
      const searchInput = screen.getByPlaceholderText(/search your bookshelf/i);
      fireEvent.change(searchInput, { target: { value: 'Volume' } });

      // Page should reset to 1
      expect(paginationNav).toHaveTextContent(/Showing 1–24 of 28 items/i);
    });
  });

  it('enforces overflow-x-clip on root and main containers and tightens catalog-section padding', () => {
    const utils = renderHome();

    const main = screen.getByRole('main');
    expect(main).toHaveClass('overflow-x-clip');

    const root = main.parentElement;
    expect(root).toHaveClass('overflow-x-clip');

    const catalogSection = utils.container.querySelector('#catalog-section');
    expect(catalogSection).toHaveClass('pt-6', 'sm:pt-12');
  });

  it('handles HeroSearch onReadFeaturedBook, active filter chip removal, and custom shelf filtering', () => {
    useBookshelfStore.setState({
      savedBooks: [pageMockBooks[0], pageMockBooks[1]],
      cloudBookshelves: [
        { id: 'shelf-default', user_id: 'u1', name: 'General', is_default: true, created_at: '', updated_at: '' },
        { id: 'shelf-custom', user_id: 'u1', name: 'Romanticism', is_default: false, created_at: '', updated_at: '' },
      ],
      cloudBookshelfItems: [
        {
          id: 'item-1',
          bookshelf_id: 'shelf-custom',
          user_id: 'u1',
          book_id: pageMockBooks[0].id,
          book_title: pageMockBooks[0].title,
          book_authors: ['Jane Austen'],
          cover_url: null,
          added_at: '',
        },
      ],
      activeBookshelfId: 'shelf-custom',
    });

    renderHome();

    // Click Read Now on featured book in HeroSearch
    const readFeaturedBtn = screen.getByTestId('read-featured-btn');
    fireEvent.click(readFeaturedBtn);
    expect(mockPush).toHaveBeenCalled();

    // Apply topic chip to generate an active filter chip in StickyCatalogToolbar, then remove it
    const topicChip = screen.getByTestId('topic-chip-philosophy');
    fireEvent.click(topicChip);
    const removeChipBtn = screen.getByRole('button', {
      name: /Remove filter Classical Philosophy & Ethics/i,
    });
    fireEvent.click(removeChipBtn);

    // Switch to Bookshelf view and verify custom shelf filtering
    const banner = screen.getByRole('banner');
    fireEvent.click(within(banner).getByRole('button', { name: /^Bookshelf$/i }));
    expect(screen.getByText('1 volume')).toBeInTheDocument();
  });

  it('handles BookPreviewModal onReadBook and BookshelfMobileModal callbacks', () => {
    renderHome();

    const previewTrigger = screen.getByLabelText(`Click to preview quotes for ${mockBooks[0].title}`);
    fireEvent.click(previewTrigger);

    // Both BookPreviewModal (desktop) and BookshelfMobileModal (mobile) receive selectedPreviewBook
    const mobileSheet = screen.getByTestId('mobile-book-action-sheet');
    expect(mobileSheet).toBeInTheDocument();

    // Click Download inside mobile sheet -> opens DownloadDrawer
    const mobileDownloadBtn = within(mobileSheet).getByRole('button', {
      name: `Download ${mockBooks[0].title}`,
    });
    fireEvent.click(mobileDownloadBtn);
    expect(screen.getByText('Download Hub')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close modal'));

    // Re-open preview and click Read inside mobile sheet
    fireEvent.click(previewTrigger);
    const mobileReadBtn = within(screen.getByTestId('mobile-book-action-sheet')).getByRole('button', {
      name: `Read ${mockBooks[0].title}`,
    });
    fireEvent.click(mobileReadBtn);
    expect(mockPush).toHaveBeenCalledWith(ROUTES.READ(mockBooks[0].id));
  });

  it('opens RemoveOfflineBookModal when removing downloaded book from BookshelfMobileModal', async () => {
    mockIsBookOffline.mockReturnValue(true);
    renderHome();

    const previewTrigger = screen.getByLabelText(`Click to preview quotes for ${mockBooks[0].title}`);
    await act(async () => {
      fireEvent.click(previewTrigger);
    });

    const mobileSheet = screen.getByTestId('mobile-book-action-sheet');
    expect(mobileSheet).toBeInTheDocument();

    const offlineBtn = within(mobileSheet).getByRole('button', { name: /remove offline copy/i });
    await act(async () => {
      fireEvent.click(offlineBtn);
    });

    const removeModal = screen.getByTestId('remove-offline-book-dialog');
    expect(removeModal).toBeInTheDocument();

    const confirmBtn = within(removeModal).getByRole('button', { name: /remove download/i });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(mockRemoveBook).toHaveBeenCalledWith(mockBooks[0].id);
    mockIsBookOffline.mockReturnValue(false);
  });

  it('returns to Catalog from empty NotebookView and BookmarksView via onBrowseCatalog', () => {
    useReaderStore.setState({ readingPositions: {}, readingProgress: {} });
    renderHome();

    const banner = screen.getByRole('banner');
    fireEvent.click(within(banner).getByRole('button', { name: /^Notebook/i }));
    const browseFromNotebookBtn = screen.getByRole('button', { name: /Explore Catalog/i });
    fireEvent.click(browseFromNotebookBtn);
    expect(screen.getByTestId('sticky-catalog-toolbar')).toBeInTheDocument();

    fireEvent.click(within(banner).getByRole('button', { name: /^Bookmarks/i }));
    const browseFromBookmarksBtn = screen.getByRole('button', { name: /Browse Library Catalog/i });
    fireEvent.click(browseFromBookmarksBtn);
    expect(screen.getByTestId('sticky-catalog-toolbar')).toBeInTheDocument();
  });

  it('renders Reader view when served as offline App Shell fallback for /read/[id] route', () => {
    const originalPathname = window.location.pathname;
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        pathname: '/read/1342',
        search: '',
      },
      configurable: true,
      writable: true,
    });

    renderHome();

    // Should mount the dynamic reader rather than the sticky catalog toolbar
    expect(screen.queryByTestId('sticky-catalog-toolbar')).not.toBeInTheDocument();

    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        pathname: originalPathname,
      },
      configurable: true,
      writable: true,
    });
  });

  it('filters bookshelf books to offline books when sorting by Downloaded', async () => {
    mockIsBookOffline.mockImplementation((id: number) => id === pageMockBooks[0].id);
    useBookshelfStore.setState({
      savedBooks: [pageMockBooks[0], pageMockBooks[1]],
      activeBookshelfId: null,
    });

    renderHome();

    // Switch to Bookshelf
    const banner = screen.getByRole('banner');
    fireEvent.click(within(banner).getByRole('button', { name: /^Bookshelf$/i }));

    expect(screen.getByText('2 volumes')).toBeInTheDocument();

    const sortSelect = screen.getByRole('combobox', { name: 'Sort bookshelf' });
    fireEvent.change(sortSelect, { target: { value: 'downloaded' } });

    expect(screen.getByText('1 volume')).toBeInTheDocument();
    mockIsBookOffline.mockReturnValue(false);
  });

  it('filters bookshelf books to offline books when active shelf is DOWNLOADED_SHELF_ID', async () => {
    mockIsBookOffline.mockImplementation((id: number) => id === pageMockBooks[0].id);
    useBookshelfStore.setState({
      savedBooks: [pageMockBooks[0], pageMockBooks[1]],
      activeBookshelfId: '__downloaded__',
    });

    renderHome();

    // Switch to Bookshelf
    const banner = screen.getByRole('banner');
    fireEvent.click(within(banner).getByRole('button', { name: /^Bookshelf$/i }));

    expect(screen.getByText('1 volume')).toBeInTheDocument();
    mockIsBookOffline.mockReturnValue(false);
  });

  it('filters favorites books to offline books when sorting by Downloaded and shows empty state when none are offline', async () => {
    mockIsBookOffline.mockImplementation((id: number) => id === pageMockBooks[0].id);
    useBookshelfStore.setState({
      favoriteBooks: [pageMockBooks[0], pageMockBooks[1]],
      favoriteBookIds: [pageMockBooks[0].id, pageMockBooks[1].id],
    });

    renderHome();

    // Switch to Favorites
    const favoritesBtn = screen.getByRole('button', { name: /^Favorites$/i });
    fireEvent.click(favoritesBtn);

    expect(screen.getByText('2 volumes')).toBeInTheDocument();

    const sortSelect = screen.getByRole('combobox', { name: 'Sort favorites' });
    fireEvent.change(sortSelect, { target: { value: 'downloaded' } });

    expect(screen.getByText('1 volume')).toBeInTheDocument();

    // Now test empty state when 0 books are offline
    mockIsBookOffline.mockReturnValue(false);
    fireEvent.change(sortSelect, { target: { value: 'recent' } });
    fireEvent.change(sortSelect, { target: { value: 'downloaded' } });

    expect(screen.getByText('No downloaded favorites')).toBeInTheDocument();
    expect(screen.getByText('Favorite volumes saved for offline reading will appear here.')).toBeInTheDocument();
  });

  it('shows empty state in Bookshelf when sorting by Downloaded and none are offline', async () => {
    mockIsBookOffline.mockReturnValue(false);
    useBookshelfStore.setState({
      savedBooks: [pageMockBooks[0]],
      activeBookshelfId: null,
    });

    renderHome();

    // Switch to Bookshelf
    const bookshelfTab = screen.getByRole('button', { name: /^Bookshelf$/i });
    fireEvent.click(bookshelfTab);

    const sortSelect = screen.getByRole('combobox', { name: 'Sort bookshelf' });
    fireEvent.change(sortSelect, { target: { value: 'downloaded' } });

    expect(screen.getByText(/no books found on "General"/i)).toBeInTheDocument();
  });

  it('resets catalog page and filters when clicking Bookarium brand logo in navbar', () => {
    delete (window as any).location;
    (window as any).location = new URL('http://localhost:3000/?page=5&search=austen');

    renderHome();

    // Verify search term is present in HeroSearch
    const searchInput = screen.getByTestId('search-input') as HTMLInputElement;
    expect(searchInput.value).toBe('austen');

    // Click Bookarium brand logo
    const brand = screen.getByLabelText('Bookarium logo, click to refresh catalog');
    act(() => {
      fireEvent.click(brand);
    });

    // Search input should be cleared and page reset to 1
    expect(searchInput.value).toBe('');
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect((screen.getByLabelText('Jump to page') as HTMLInputElement).value).toBe('1');

    (window as any).location = new URL('http://localhost:3000/');
  });

  it('resets page to 1 and scrolls to top when clicking the already-active Catalog tab', () => {
    delete (window as any).location;
    (window as any).location = new URL('http://localhost:3000/?page=3');

    const scrollToMock = vi.fn();
    window.scrollTo = scrollToMock;

    renderHome();

    const catalogBtn = screen.getByRole('button', { name: /^Catalog$/i });
    act(() => {
      fireEvent.click(catalogBtn);
    });

    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect((screen.getByLabelText('Jump to page') as HTMLInputElement).value).toBe('1');

    (window as any).location = new URL('http://localhost:3000/');
  });

  it('applies responsive padding classes to catalog-section to eliminate mobile pagination gap', () => {
    const { container } = renderHome();
    const catalogSection = container.querySelector('#catalog-section');
    expect(catalogSection).toBeInTheDocument();
    expect(catalogSection).toHaveClass('pt-6', 'sm:pt-12', 'pb-8', 'sm:pb-12');
  });

  it('renders CatalogOfflineView when offline and 0 books are downloaded, allowing navigation to Bookshelf', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });
    mockOfflineBooks = [];
    mockIsBookOffline.mockReturnValue(false);

    try {
      renderHome();

      expect(screen.getByTestId('catalog-offline-view')).toBeInTheDocument();
      expect(screen.queryByTestId('sticky-catalog-toolbar')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('offline-nav-bookshelf'));
      expect(screen.getByText('Reading Shelf')).toBeInTheDocument();
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
    }
  });

  it('serves downloaded books locally in Catalog with an Offline Mode banner when offline and downloaded books exist', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });
    mockOfflineBooks = [pageMockBooks[0], pageMockBooks[1]];
    mockIsBookOffline.mockImplementation((id: number) => id === pageMockBooks[0].id || id === pageMockBooks[1].id);

    try {
      renderHome();

      const banner = screen.getByTestId('catalog-offline-downloaded-banner');
      expect(banner).toHaveTextContent(/Offline Mode — Browsing your 2 downloaded volumes/i);
      expect(screen.getByTestId(`book-card-${pageMockBooks[0].id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`book-card-${pageMockBooks[1].id}`)).toBeInTheDocument();

      // Local search filtering in offline catalog
      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'Frankenstein' } });
      fireEvent.click(screen.getByRole('button', { name: /^Search$/i }));
      expect(screen.getByTestId(`book-card-${pageMockBooks[1].id}`)).toBeInTheDocument();
    } finally {
      mockOfflineBooks = [];
      mockIsBookOffline.mockReturnValue(false);
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
    }
  });

  it('filters offline catalog by topic, language, era, and sort order, and supports clearing Downloaded and Custom shelves', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });
    mockOfflineBooks = [
      pageMockBooks[0],
      pageMockBooks[1],
      {
        ...pageMockBooks[0],
        id: 9991,
        title: 'No Author Book',
        authors: [],
        languages: ['fr'],
      },
      {
        ...pageMockBooks[0],
        id: 9992,
        title: 'Dateless Author Book',
        authors: [{ name: 'Mystery Writer', birth_year: null, death_year: null }],
        languages: ['en'],
      },
    ];
    mockIsBookOffline.mockReturnValue(true);

    try {
      renderHome();

      // Test HeroFeaturedBook3D fallback callbacks
      fireEvent.click(screen.getByTestId('read-featured-minimal-btn'));
      expect(mockPush).toHaveBeenCalledWith(ROUTES.READ(1342));
      fireEvent.click(screen.getByTestId('read-featured-empty-btn'));

      // Filter by topic chip and language in HeroSearch while offline
      fireEvent.click(screen.getByTestId('topic-chip-fiction'));
      fireEvent.change(screen.getByTestId('language-select'), { target: { value: 'en' } });

      // Open filter drawer and apply era ('victorian') and sort ('ascending' then 'descending' then 'popular')
      fireEvent.click(screen.getByTestId('open-filters-btn'));
      expect(screen.getByTestId('advanced-filter-drawer')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('era-option-victorian'));
      fireEvent.click(screen.getByTestId('sort-option-ascending'));
      fireEvent.click(screen.getByTestId('apply-filters-btn'));

      fireEvent.click(screen.getByTestId('open-filters-btn'));
      fireEvent.click(screen.getByTestId('sort-option-descending'));
      fireEvent.click(screen.getByTestId('apply-filters-btn'));

      fireEvent.click(screen.getByTestId('open-filters-btn'));
      fireEvent.click(screen.getByTestId('sort-option-popular'));
      fireEvent.click(screen.getByTestId('apply-filters-btn'));

      // Switch to Bookshelf with Downloaded shelf active and test Clear Downloaded Shelf modal
      act(() => {
        useBookshelfStore.setState({
          savedBooks: [pageMockBooks[0], pageMockBooks[1]],
          activeBookshelfId: '__downloaded__',
          cloudBookshelves: [
            { id: 'shelf-gen', user_id: 'u1', name: 'General', is_default: true, created_at: '', updated_at: '' },
            { id: 'shelf-poetry', user_id: 'u1', name: 'Poetry', is_default: false, is_public: true, created_at: '', updated_at: '' },
          ],
          cloudBookshelfItems: [
            {
              id: 'item-p1',
              bookshelf_id: 'shelf-poetry',
              user_id: 'u1',
              book_id: pageMockBooks[0].id,
              book_title: pageMockBooks[0].title,
              book_authors: ['Jane Austen'],
              cover_url: null,
              added_at: '',
            },
          ],
        });
      });

      const banner = screen.getByRole('banner');
      const bookshelfTab = within(banner).getByRole('button', { name: /^Bookshelf$/i });
      fireEvent.click(bookshelfTab);
      // Click already-active Bookshelf tab to reset page
      fireEvent.click(bookshelfTab);

      const clearDownloadedBtn = screen.getByRole('button', { name: /Clear Downloaded Shelf/i });
      fireEvent.click(clearDownloadedBtn);
      expect(screen.getByText(/Are you sure you want to clear your downloaded shelf\?/i)).toBeInTheDocument();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Yes, Clear Downloads/i }));
      });

      // Switch active shelf to custom shelf ('shelf-poetry') and test Clear "Poetry" Shelf modal
      act(() => {
        useBookshelfStore.setState({ activeBookshelfId: 'shelf-poetry' });
      });
      const clearCustomBtn = screen.getByRole('button', { name: /Clear "Poetry" Shelf/i });
      fireEvent.click(clearCustomBtn);
      expect(screen.getByText(/Are you sure you want to clear your "Poetry" shelf\?/i)).toBeInTheDocument();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Yes, Clear "Poetry"/i }));
      });

      // Switch to Favorites and click already-active Favorites tab
      const favoritesTab = within(banner).getByRole('button', { name: /^Favorites$/i });
      fireEvent.click(favoritesTab);
      fireEvent.click(favoritesTab);
    } finally {
      mockOfflineBooks = [];
      mockIsBookOffline.mockReturnValue(false);
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
    }
  });
});


