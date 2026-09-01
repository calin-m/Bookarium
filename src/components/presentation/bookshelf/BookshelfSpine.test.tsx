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
        isLiked={false}
        onToggleSave={vi.fn()}
        onToggleLike={vi.fn()}
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
    const handleToggleLike = vi.fn();

    render(
      <BookshelfSpine
        book={mockBook}
        bookIndex={0}
        readingProgress={75}
        isSaved={true}
        isLiked={true}
        onToggleSave={handleToggleSave}
        onToggleLike={handleToggleLike}
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

    const likeBtn = screen.getByLabelText('Unlike book');
    fireEvent.click(likeBtn);
    expect(handleToggleLike).toHaveBeenCalledWith(mockBook);
  });
});
