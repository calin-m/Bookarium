import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BookshelfSpine } from './BookshelfSpine';
import type { GutendexBook } from '@/mocks/handlers';

const mockBook: GutendexBook = {
  id: 1342,
  title: 'Pride and Prejudice',
  authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
  translators: [],
  subjects: ['Courtship -- Fiction', 'Sisters -- Fiction'],
  bookshelves: ['Best Books Ever'],
  languages: ['en'],
  copyright: false,
  media_type: 'Text',
  formats: {
    'text/html': 'https://www.gutenberg.org/ebooks/1342.html.images',
    'application/epub+zip': 'https://www.gutenberg.org/ebooks/1342.epub3.images',
    'image/jpeg': 'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg',
  },
  download_count: 50000,
};

describe('BookshelfSpine Component', () => {
  it('renders spine title, author, and handles keyboard interaction', () => {
    const handleSpineClick = vi.fn();
    render(
      <BookshelfSpine
        book={mockBook}
        bookIndex={0}
        readingProgress={50}
        isSaved={false}
        isFavorite={false}
        onToggleSave={vi.fn()}
        onToggleFavorite={vi.fn()}
        onSpineClick={handleSpineClick}
      />
    );

    expect(screen.getAllByText('Pride and Prejudice').length).toBeGreaterThan(0);
    expect(screen.getByText('Austen')).toBeInTheDocument();

    const spine = screen.getByTestId('shelf-book-1342');
    fireEvent.keyDown(spine, { key: 'Enter' });
    expect(handleSpineClick).toHaveBeenCalledWith(mockBook);

    fireEvent.keyDown(spine, { key: ' ' });
    expect(handleSpineClick).toHaveBeenCalledTimes(2);
  });

  it('triggers quick actions from desktop hover card', () => {
    const handleBookClick = vi.fn();
    const handleDownload = vi.fn();
    const handleToggleSave = vi.fn();
    const handleToggleFavorite = vi.fn();

    render(
      <BookshelfSpine
        book={mockBook}
        bookIndex={0}
        readingProgress={75}
        isSaved={true}
        isFavorite={true}
        onToggleSave={handleToggleSave}
        onToggleFavorite={handleToggleFavorite}
        onSpineClick={vi.fn()}
        onBookClick={handleBookClick}
        onDownloadClick={handleDownload}
      />
    );

    expect(screen.getByText('75% read')).toBeInTheDocument();

    const readBtn = screen.getByLabelText('Open reader for Pride and Prejudice');
    fireEvent.click(readBtn);
    expect(handleBookClick).toHaveBeenCalledWith(mockBook);

    const downloadBtn = screen.getByLabelText('Download formats for Pride and Prejudice');
    fireEvent.click(downloadBtn);
    expect(handleDownload).toHaveBeenCalledWith(mockBook);

    const saveBtn = screen.getByLabelText('Remove from bookshelf');
    fireEvent.click(saveBtn);
    expect(handleToggleSave).toHaveBeenCalledWith(mockBook);

    const likeBtn = screen.getByLabelText('Remove from favorites');
    fireEvent.click(likeBtn);
    expect(handleToggleFavorite).toHaveBeenCalledWith(mockBook);
  });

  it('renders offline indicator and fires onToggleOffline when clicked', () => {
    const handleToggleOffline = vi.fn();
    render(
      <BookshelfSpine
        book={mockBook}
        bookIndex={0}
        isSaved={true}
        isFavorite={false}
        isOffline={true}
        onToggleSave={vi.fn()}
        onToggleFavorite={vi.fn()}
        onToggleOffline={handleToggleOffline}
        onSpineClick={vi.fn()}
      />
    );

    expect(screen.getByText('Offline')).toBeInTheDocument();
    const offlineBtn = screen.getByLabelText(`Remove offline copy of ${mockBook.title}`);
    fireEvent.click(offlineBtn);
    expect(handleToggleOffline).toHaveBeenCalledWith(mockBook);
  });

  it('renders cursor-following portal tooltip on hover card button hover', () => {
    render(
      <BookshelfSpine
        book={mockBook}
        bookIndex={0}
        isSaved={false}
        isFavorite={false}
        isOffline={false}
        onToggleSave={vi.fn()}
        onToggleFavorite={vi.fn()}
        onSpineClick={vi.fn()}
      />
    );

    const saveBtn = screen.getByLabelText('Save to bookshelf');
    const hoverCard = saveBtn.closest('div.absolute') as HTMLElement;

    // Simulate mouse move to establish cursor position
    fireEvent.mouseMove(hoverCard, { clientX: 200, clientY: 300 });

    // Hover save button
    fireEvent.mouseEnter(saveBtn);

    expect(screen.getByTestId(`spine-tooltip-${mockBook.id}`)).toBeInTheDocument();
    expect(screen.getByText('Save to Bookshelf')).toBeInTheDocument();

    // Hover offline button
    const offlineBtn = screen.getByLabelText(`Download ${mockBook.title} for offline reading`);
    fireEvent.mouseEnter(offlineBtn);
    expect(screen.getByText('Save for Offline Reading')).toBeInTheDocument();

    // Leave button
    fireEvent.mouseLeave(offlineBtn);
    expect(screen.queryByTestId(`spine-tooltip-${mockBook.id}`)).not.toBeInTheDocument();
  });
});
