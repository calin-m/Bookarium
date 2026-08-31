import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import Home from './page';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { mockBooks } from '@/mocks/handlers';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
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
});
