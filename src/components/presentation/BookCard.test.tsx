import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BookCard } from './BookCard';
import { mockBooks } from '@/mocks/handlers';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';

describe('BookCard component', () => {
  beforeEach(() => {
    useBookshelfStore.getState().clearBookshelf();
    useReaderStore.setState({ isOpen: false, currentBook: null });
  });

  it('should render book title, author, and formats', () => {
    const book = mockBooks[0];
    render(<BookCard book={book} />);

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByText('Jane Austen')).toBeInTheDocument();
    expect(screen.getByText(/65\.4k reads/i)).toBeInTheDocument();
  });

  it('should render link to /read/[id] when clicking Read button', () => {
    const book = mockBooks[0];
    render(<BookCard book={book} />);

    const readLink = screen.getByRole('link', { name: /Read Pride and Prejudice/i });
    expect(readLink).toHaveAttribute('href', `/read/${book.id}`);
  });

  it('should toggle like and bookmark state on button clicks', () => {
    const book = mockBooks[0];
    render(<BookCard book={book} />);

    const likeBtn = screen.getByLabelText('Like book');
    fireEvent.click(likeBtn);
    expect(useBookshelfStore.getState().isBookLiked(book.id)).toBe(true);

    const bookmarkBtn = screen.getByLabelText('Save to bookshelf');
    fireEvent.click(bookmarkBtn);
    expect(useBookshelfStore.getState().isBookSaved(book.id)).toBe(true);
  });

  it('should call onDownloadClick when clicking Formats button', () => {
    const handleDownload = vi.fn();
    const book = mockBooks[0];
    render(<BookCard book={book} onDownloadClick={handleDownload} />);

    const downloadBtn = screen.getByRole('button', { name: /Download options for/i });
    fireEvent.click(downloadBtn);
    expect(handleDownload).toHaveBeenCalledWith(book);
  });
});

