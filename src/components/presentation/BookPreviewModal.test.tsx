import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { BookPreviewModal } from './BookPreviewModal';
import { mockBooks } from '@/mocks/handlers';

describe('BookPreviewModal component', () => {
  const defaultBook = mockBooks[0]; // Pride and Prejudice

  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renders nothing when isOpen is false or book is null', () => {
    const { rerender } = render(
      <BookPreviewModal book={defaultBook} isOpen={false} onClose={vi.fn()} />
    );
    expect(screen.queryByTestId('book-preview-modal')).not.toBeInTheDocument();

    rerender(<BookPreviewModal book={null} isOpen={true} onClose={vi.fn()} />);
    expect(screen.queryByTestId('book-preview-modal')).not.toBeInTheDocument();
  });

  it('renders book preview modal and triggers cover open animation', () => {
    render(
      <BookPreviewModal book={defaultBook} isOpen={true} onClose={vi.fn()} />
    );

    expect(screen.getByTestId('book-preview-modal')).toBeInTheDocument();
    expect(screen.getAllByText('Pride and Prejudice').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Jane Austen/i).length).toBeGreaterThan(0);

    const bookStage = screen.getByTestId('preview-book-stage');
    expect(bookStage).toHaveClass('book-closed');

    // Advance timer to trigger cover opening
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(bookStage).toHaveClass('book-open');
  });

  it('handles shuffle click and cycles through passages', () => {
    render(
      <BookPreviewModal book={defaultBook} isOpen={true} onClose={vi.fn()} />
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    const shuffleBtn = screen.getByLabelText('Shuffle passage');
    expect(shuffleBtn).toBeInTheDocument();

    fireEvent.click(shuffleBtn);

    // After shuffle, turning leaf is rendered
    expect(screen.getByText('Notable Soliloquy')).toBeInTheDocument();
  });

  it('calls onClose when close button or backdrop is clicked or Escape is pressed', () => {
    const handleClose = vi.fn();
    render(
      <BookPreviewModal
        book={defaultBook}
        originRect={{ top: 100, left: 100, width: 200, height: 300 }}
        isOpen={true}
        onClose={handleClose}
      />
    );

    act(() => {
      vi.advanceTimersByTime(300);
    });

    const bookStage = screen.getByTestId('preview-book-stage');
    fireEvent.click(bookStage);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(handleClose).toHaveBeenCalledTimes(1);

    // Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(handleClose).toHaveBeenCalledTimes(2);

    // Backdrop click
    const backdrop = screen.getByTestId('book-preview-modal');
    fireEvent.click(backdrop);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(handleClose).toHaveBeenCalledTimes(3);
  });

  it('calls onReadBook and onDownloadBook on action button clicks', () => {
    const handleRead = vi.fn();
    const handleDownload = vi.fn();
    const handleClose = vi.fn();

    render(
      <BookPreviewModal
        book={defaultBook}
        isOpen={true}
        onClose={handleClose}
        onReadBook={handleRead}
        onDownloadBook={handleDownload}
      />
    );

    act(() => {
      vi.advanceTimersByTime(300);
    });

    const readBtn = screen.getByRole('button', { name: `Read ${defaultBook.title}` });
    fireEvent.click(readBtn);
    expect(handleRead).toHaveBeenCalledWith(defaultBook);

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(handleClose).toHaveBeenCalled();

    const getBtn = screen.getByRole('button', { name: 'Download formats' });
    fireEvent.click(getBtn);
    expect(handleDownload).toHaveBeenCalledWith(defaultBook);
  });
});
