import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BookshelfMobileModal } from './BookshelfMobileModal';
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
        isLiked={false}
        onToggleSave={vi.fn()}
        onToggleLike={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders modal with formatted author names and triggers actions', () => {
    const handleClose = vi.fn();
    const handleBookClick = vi.fn();
    const handleDownload = vi.fn();
    const handleSave = vi.fn();
    const handleLike = vi.fn();

    render(
      <BookshelfMobileModal
        selectedMobileBook={mockBook}
        isClosingMobileSheet={false}
        onClose={handleClose}
        readingProgress={25}
        isSaved={false}
        isLiked={false}
        onToggleSave={handleSave}
        onToggleLike={handleLike}
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

    const likeBtn = screen.getByLabelText('Like book');
    fireEvent.click(likeBtn);
    expect(handleLike).toHaveBeenCalledWith(mockBook);
  });
});
