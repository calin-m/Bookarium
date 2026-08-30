import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import Home from './page';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { mockBooks } from '@/mocks/handlers';

function renderHome() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Home />
    </QueryClientProvider>
  );
}

describe('Home page integration', () => {
  beforeEach(() => {
    useBookshelfStore.getState().clearBookshelf();
    useReaderStore.setState({ isOpen: false, currentBook: null });
  });

  it('should render catalog, hero search, sticky toolbar, and books list', async () => {
    renderHome();

    expect(screen.getByText(/Timeless Literature/i)).toBeInTheDocument();
    expect(screen.getByTestId('sticky-catalog-toolbar')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId(`book-card-${mockBooks[0].id}`)).toBeInTheDocument();
    });
  });

  it('should handle search, topic, and language change interactions', async () => {
    renderHome();

    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'Frankenstein' } });

    const topicChip = screen.getByTestId('topic-chip-philosophy');
    fireEvent.click(topicChip);

    const langSelect = screen.getByTestId('language-select');
    fireEvent.change(langSelect, { target: { value: 'en' } });

    await waitFor(() => {
      expect(screen.getByText(/Search Catalog/i)).toBeInTheDocument();
    });
  });

  it('should open advanced filter drawer and apply era and sort filters', async () => {
    renderHome();

    const openFiltersBtn = screen.getByRole('button', { name: /Open advanced filters/i });
    fireEvent.click(openFiltersBtn);

    expect(screen.getByText('Advanced Archive Filters')).toBeInTheDocument();

    const eraOption = screen.getByTestId('era-option-victorian');
    fireEvent.click(eraOption);

    const applyBtn = screen.getByRole('button', { name: /Apply filters/i });
    fireEvent.click(applyBtn);

    expect(screen.queryByText('Advanced Archive Filters')).not.toBeInTheDocument();
    expect(screen.getByText(/19th Century Victorian & Romantic/i)).toBeInTheDocument();
  });

  it('should switch between catalog, bookshelf, and likes views with item actions', async () => {
    // Pre-populate bookshelf and likes
    useBookshelfStore.getState().toggleSaveBook(mockBooks[0]);
    useBookshelfStore.getState().toggleLikeBook(mockBooks[0].id);

    renderHome();

    const bookshelfBtn = screen.getByLabelText('Bookshelf');
    fireEvent.click(bookshelfBtn);

    expect(screen.getByText('Personal Reading Shelf')).toBeInTheDocument();
    expect(screen.getByText(/You have 1 titles preserved on your personal shelf/i)).toBeInTheDocument();

    const clearBtn = screen.getByRole('button', { name: /Clear Shelf/i });
    fireEvent.click(clearBtn);
    expect(useBookshelfStore.getState().savedBooks).toHaveLength(0);

    const likedBtn = screen.getByLabelText('Liked Books');
    fireEvent.click(likedBtn);

    expect(screen.getByText('Favorite Works')).toBeInTheDocument();
  });

  it('should open download hub and close it', async () => {
    renderHome();

    await waitFor(() => {
      expect(screen.getByTestId(`book-card-${mockBooks[0].id}`)).toBeInTheDocument();
    });

    const formatButtons = screen.getAllByRole('button', { name: /Download options for/i });
    fireEvent.click(formatButtons[0]);

    expect(screen.getByText('Zero-Copyright Download Hub')).toBeInTheDocument();
    expect(screen.getByText('EPUB E-Reader')).toBeInTheDocument();

    const closeBtn = screen.getByLabelText('Close modal');
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Zero-Copyright Download Hub')).not.toBeInTheDocument();
  });
});
