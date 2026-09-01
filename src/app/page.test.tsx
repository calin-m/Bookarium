import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import Home from './page';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { mockBooks } from '@/mocks/handlers';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('@/hooks/queries/useBooks', () => ({
  useBooks: () => ({
    data: {
      count: mockBooks.length,
      next: null,
      previous: null,
      results: mockBooks,
      source: 'upstream',
      latencyMs: 140,
    },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  usePrefetchNextPage: () => vi.fn(),
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
  return render(
    <QueryClientProvider client={testQueryClient}>
      <Home />
    </QueryClientProvider>
  );
}

describe('Home page integration', () => {
  beforeEach(() => {
    useBookshelfStore.getState().clearBookshelf();
    useReaderStore.setState({ isOpen: false, currentBook: null });
  });

  it('should render catalog, hero search, sticky toolbar, and books list', () => {
    renderHome();

    expect(screen.getByText(/Timeless Literature/i)).toBeInTheDocument();
    expect(screen.getByTestId('sticky-catalog-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId(`book-card-${mockBooks[0].id}`)).toBeInTheDocument();
  });

  it('should handle search, topic, and language change interactions', () => {
    renderHome();

    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'Frankenstein' } });

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

  it('should switch to bookshelf view and handle clearing shelf', () => {
    useBookshelfStore.getState().toggleSaveBook(mockBooks[0]);
    renderHome();

    const bookshelfBtn = screen.getByLabelText('Bookshelf');
    fireEvent.click(bookshelfBtn);

    expect(screen.getByText('Personal Reading Shelf')).toBeInTheDocument();
    expect(screen.getByText(/You have 1 titles preserved on your personal shelf/i)).toBeInTheDocument();

    const clearBtn = screen.getByRole('button', { name: /Clear Shelf/i });
    fireEvent.click(clearBtn);
    expect(useBookshelfStore.getState().savedBooks).toHaveLength(0);
  });

  it('should switch to favorites view and handle clearing favorites', () => {
    useBookshelfStore.getState().toggleLikeBook(mockBooks[0].id);
    renderHome();

    const likedBtn = screen.getByLabelText('Liked Books');
    fireEvent.click(likedBtn);

    expect(screen.getByText('Favorite Works')).toBeInTheDocument();

    const clearFavBtn = screen.getByRole('button', { name: /Clear Favorites/i });
    fireEvent.click(clearFavBtn);
    expect(useBookshelfStore.getState().likedBookIds).toHaveLength(0);
  });

  it('should open download hub and close it', () => {
    renderHome();

    expect(screen.getByTestId(`book-card-${mockBooks[0].id}`)).toBeInTheDocument();

    const downloadBtn = screen.getByLabelText(`Download options for ${mockBooks[0].title}`);
    fireEvent.click(downloadBtn);

    expect(screen.getByText('Zero-Copyright Download Hub')).toBeInTheDocument();
    expect(screen.getByText('EPUB E-Reader')).toBeInTheDocument();

    const closeBtn = screen.getByLabelText('Close modal');
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Zero-Copyright Download Hub')).not.toBeInTheDocument();
  });

  it('should open 3D book preview modal when book cover is clicked and close it on desktop', () => {
    vi.useFakeTimers();
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });

    try {
      renderHome();

      const previewTrigger = screen.getByLabelText(`Flip open 3D preview for ${mockBooks[0].title}`);
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
    expect(screen.getByText('Personal Reading Shelf')).toBeInTheDocument();
    expect(screen.getByTestId('bookshelf-rack')).toBeInTheDocument();

    // Switch to Favorites
    const favoritesBtn = screen.getByRole('button', { name: /^Liked Books$/i });
    fireEvent.click(favoritesBtn);
    expect(screen.getByText('Favorite Works')).toBeInTheDocument();
    expect(screen.getByText('No liked books yet')).toBeInTheDocument();

    // Switch back to Catalog
    const catalogBtn = screen.getByRole('button', { name: /^Catalog$/i });
    fireEvent.click(catalogBtn);
    expect(screen.getByTestId(`book-card-${mockBooks[0].id}`)).toBeInTheDocument();
  });

  // =========================================================================
  // END-TO-END MULTI-STEP USER JOURNEYS (In-Memory E2E via Vitest)
  // =========================================================================
  it('E2E Journey: full catalog search -> preview open -> reader launch -> shelf curation', async () => {
    renderHome();

    // Step 1: User performs catalog search
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'Pride' } });

    // Step 2: User filters by topic chip
    const topicChip = screen.getByTestId('topic-chip-fiction');
    fireEvent.click(topicChip);

    // Step 3: User opens 3D preview on first book
    const card = screen.getByTestId(`book-card-${mockBooks[0].id}`);
    expect(card).toBeInTheDocument();

    const previewTrigger = screen.getByLabelText(`Flip open 3D preview for ${mockBooks[0].title}`);
    fireEvent.click(previewTrigger);
    expect(screen.getByTestId('book-preview-modal')).toBeInTheDocument();

    // Step 4: User launches reader from book card
    const readBtns = screen.getAllByLabelText(`Read ${mockBooks[0].title}`);
    fireEvent.click(readBtns[0]);

    // Verify Reader Store was populated
    expect(useReaderStore.getState().currentBook?.id).toBe(mockBooks[0].id);

    // Step 5: User saves book to personal shelf
    useBookshelfStore.getState().toggleSaveBook(mockBooks[0]);
    useBookshelfStore.getState().toggleLikeBook(mockBooks[0].id);

    expect(useBookshelfStore.getState().savedBooks).toHaveLength(1);
    expect(useBookshelfStore.getState().likedBookIds).toHaveLength(1);

    // Step 6: User switches to Bookshelf view
    const bookshelfTab = screen.getByRole('button', { name: /^Bookshelf$/i });
    fireEvent.click(bookshelfTab);

    expect(screen.getByTestId('bookshelf-rack')).toBeInTheDocument();
    expect(screen.getByText(/General Shelf/i)).toBeInTheDocument();
  });
});

