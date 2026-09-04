import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BookshelfMobileModal } from './BookshelfMobileModal';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import type { GutendexBook } from '@/mocks/handlers';

const mockBook: GutendexBook = {
  id: 1342,
  title: 'Pride and Prejudice',
  authors: [{ name: 'Austen, Jane (1775-1817)', birth_year: 1775, death_year: 1817 }],
  translators: [],
  subjects: ['Courtship -- Fiction'],
  bookshelves: [],
  languages: ['en'],
  copyright: false,
  media_type: 'Text',
  formats: {},
  download_count: 50000,
};

describe('BookshelfMobileModal Component', () => {
  it('returns null when selectedMobileBook is null', () => {
    const { container } = render(
      <BookshelfMobileModal
        selectedMobileBook={null}
        isClosingMobileSheet={false}
        onClose={vi.fn()}
        isSaved={false}
        isFavorite={false}
        onToggleSave={vi.fn()}
        onToggleFavorite={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders modal with formatted author names and triggers actions', () => {
    const handleClose = vi.fn();
    const handleBookClick = vi.fn();
    const handleDownload = vi.fn();
    const handleSave = vi.fn();
    const handleFavorite = vi.fn();

    render(
      <BookshelfMobileModal
        selectedMobileBook={mockBook}
        isClosingMobileSheet={false}
        onClose={handleClose}
        readingProgress={25}
        isSaved={false}
        isFavorite={false}
        onToggleSave={handleSave}
        onToggleFavorite={handleFavorite}
        onBookClick={handleBookClick}
        onDownloadClick={handleDownload}
      />
    );

    expect(screen.getByText('Jane Austen')).toBeInTheDocument();
    expect(screen.getByText(/25% read/i)).toBeInTheDocument();

    const readBtn = screen.getByRole('button', { name: `Read ${mockBook.title}` });
    fireEvent.click(readBtn);
    expect(handleBookClick).toHaveBeenCalledWith(mockBook);
    expect(handleClose).toHaveBeenCalledTimes(1);

    const downloadBtn = screen.getByLabelText('Download Pride and Prejudice');
    fireEvent.click(downloadBtn);
    expect(handleDownload).toHaveBeenCalledWith(mockBook);

    const saveBtn = screen.getByLabelText('Save to bookshelf');
    fireEvent.click(saveBtn);
    expect(handleSave).toHaveBeenCalledWith(mockBook);

    const likeBtn = screen.getByLabelText('Add to favorites');
    fireEvent.click(likeBtn);
    expect(handleFavorite).toHaveBeenCalledWith(mockBook);
  });

  it('renders offline indicator and fires onToggleOffline', () => {
    const handleToggleOffline = vi.fn();
    render(
      <BookshelfMobileModal
        selectedMobileBook={mockBook}
        isClosingMobileSheet={false}
        onClose={vi.fn()}
        isSaved={false}
        isFavorite={false}
        isOffline={true}
        onToggleSave={vi.fn()}
        onToggleFavorite={vi.fn()}
        onToggleOffline={handleToggleOffline}
      />
    );

    expect(screen.getByText('Offline')).toBeInTheDocument();
    const offlineBtn = screen.getByLabelText('Remove offline copy');
    fireEvent.click(offlineBtn);
    expect(handleToggleOffline).toHaveBeenCalledWith(mockBook);
  });

  it('renders rating and reading status controls and handles interactions', () => {
    render(
      <BookshelfMobileModal
        selectedMobileBook={mockBook}
        isClosingMobileSheet={false}
        onClose={vi.fn()}
        isSaved={true}
        isFavorite={false}
        onToggleSave={vi.fn()}
        onToggleFavorite={vi.fn()}
      />
    );

    expect(screen.getByText('My Rating')).toBeInTheDocument();
    expect(screen.getByText('Reading Status')).toBeInTheDocument();

    const star4 = screen.getByRole('radio', { name: 'Rate 4 of 5 stars' });
    fireEvent.click(star4);
    expect(useBookshelfStore.getState().bookRatings[mockBook.id]).toBe(4);
    expect(screen.getByRole('radio', { name: 'Rate 4 of 5 stars' })).toHaveAttribute('aria-checked', 'true');

    const finishedBtn = screen.getByRole('radio', { name: 'Finished' });
    fireEvent.click(finishedBtn);
    expect(useBookshelfStore.getState().bookStatuses[mockBook.id]).toBe('finished');
    expect(screen.getByRole('radio', { name: 'Finished' })).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onClose when clicking the backdrop or pressing Escape', () => {
    const handleClose = vi.fn();
    render(
      <BookshelfMobileModal
        selectedMobileBook={mockBook}
        onClose={handleClose}
      />
    );

    const backdrop = screen.getByTestId('mobile-sheet-backdrop');
    expect(backdrop).toHaveClass('bg-transparent');
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('hides personal curation section when activeView is catalog', () => {
    render(
      <BookshelfMobileModal
        selectedMobileBook={mockBook}
        onClose={vi.fn()}
        activeView="catalog"
      />
    );

    expect(screen.queryByTestId('mobile-curation-section')).not.toBeInTheDocument();
    expect(screen.queryByText('My Rating')).not.toBeInTheDocument();
  });

  it('shows personal curation section when activeView is favorites', () => {
    render(
      <BookshelfMobileModal
        selectedMobileBook={mockBook}
        onClose={vi.fn()}
        activeView="favorites"
      />
    );

    expect(screen.getByTestId('mobile-curation-section')).toBeInTheDocument();
    expect(screen.getByText('My Rating')).toBeInTheDocument();
  });
});


