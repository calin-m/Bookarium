import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BookshelfRack } from './BookshelfRack';
import { mockBooks } from '@/mocks/handlers';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';

describe('BookshelfRack Component', () => {
  beforeEach(() => {
    useBookshelfStore.getState().clearBookshelf();
    useReaderStore.getState().closeReader();
  });

  it('renders shelf with books', () => {
    render(<BookshelfRack books={mockBooks} />);
    expect(screen.getByTestId('bookshelf-rack')).toBeInTheDocument();
    expect(screen.getByTestId(`shelf-book-${mockBooks[0].id}`)).toBeInTheDocument();
  });

  it('renders empty message when no books are provided', () => {
    render(<BookshelfRack books={[]} />);
    expect(screen.getByText(/no books found on this shelf/i)).toBeInTheDocument();
  });

  it('triggers onBookClick or openReader when book spine is clicked', () => {
    const handleBookClick = vi.fn();
    render(<BookshelfRack books={mockBooks} onBookClick={handleBookClick} />);

    const bookElem = screen.getByTestId(`shelf-book-${mockBooks[0].id}`);
    fireEvent.click(bookElem);
    expect(handleBookClick).toHaveBeenCalledWith(mockBooks[0]);
  });

  it('supports keyboard navigation via Enter and Space keys', () => {
    const handleBookClick = vi.fn();
    render(<BookshelfRack books={mockBooks} onBookClick={handleBookClick} />);

    const bookElem = screen.getByTestId(`shelf-book-${mockBooks[0].id}`);
    fireEvent.keyDown(bookElem, { key: 'Enter' });
    expect(handleBookClick).toHaveBeenCalledWith(mockBooks[0]);

    fireEvent.keyDown(bookElem, { key: ' ' });
    expect(handleBookClick).toHaveBeenCalledTimes(2);
  });

  it('opens reader using default handler if onBookClick is omitted', () => {
    render(<BookshelfRack books={mockBooks} />);
    const bookElem = screen.getByTestId(`shelf-book-${mockBooks[0].id}`);
    fireEvent.click(bookElem);
    expect(useReaderStore.getState().isOpen).toBe(true);
    expect(useReaderStore.getState().currentBook?.id).toBe(mockBooks[0].id);
  });

  it('handles quick action download and bookmark clicks', () => {
    const handleDownload = vi.fn();
    render(<BookshelfRack books={mockBooks} onDownloadClick={handleDownload} />);

    const downloadBtns = screen.getAllByLabelText(`Download formats for ${mockBooks[0].title}`);
    fireEvent.click(downloadBtns[0]);
    expect(handleDownload).toHaveBeenCalledWith(mockBooks[0]);

    const saveBtns = screen.getAllByLabelText('Save to bookshelf');
    fireEvent.click(saveBtns[0]);
    expect(useBookshelfStore.getState().isBookSaved(mockBooks[0].id)).toBe(true);

    const likeBtns = screen.getAllByLabelText('Like book');
    fireEvent.click(likeBtns[0]);
    expect(useBookshelfStore.getState().isBookLiked(mockBooks[0].id)).toBe(true);
  });
});

