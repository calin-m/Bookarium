import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookPreviewModal } from './BookPreviewModal';
import { mockBooks } from '@/mocks/handlers';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('BookPreviewModal component', () => {
  const defaultBook = mockBooks[0]; // Pride and Prejudice

  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renders nothing when isOpen is false or book is null', () => {
    const { rerender } = renderWithQueryClient(
      <BookPreviewModal book={defaultBook} isOpen={false} onClose={vi.fn()} />
    );
    expect(screen.queryByTestId('book-preview-modal')).not.toBeInTheDocument();

    rerender(
      <QueryClientProvider client={createTestQueryClient()}>
        <BookPreviewModal book={null} isOpen={true} onClose={vi.fn()} />
      </QueryClientProvider>
    );
    expect(screen.queryByTestId('book-preview-modal')).not.toBeInTheDocument();
  });

  it('renders book preview modal and triggers cover open animation', () => {
    renderWithQueryClient(
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
    renderWithQueryClient(
      <BookPreviewModal book={defaultBook} isOpen={true} onClose={vi.fn()} />
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    const shuffleBtn = screen.getByLabelText('Shuffle passage');
    expect(shuffleBtn).toBeInTheDocument();

    fireEvent.click(shuffleBtn);

    // After shuffle, turning leaf is rendered
    expect(screen.getAllByText('Notable Passages').length).toBeGreaterThan(0);
  });

  it('calls onClose when close button or backdrop is clicked or Escape is pressed', () => {
    const handleClose = vi.fn();
    renderWithQueryClient(
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
      vi.advanceTimersByTime(1100);
    });

    expect(handleClose).toHaveBeenCalledTimes(1);

    // Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(handleClose).toHaveBeenCalledTimes(2);

    // Backdrop click
    const backdrop = screen.getByTestId('book-preview-modal');
    fireEvent.click(backdrop);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(handleClose).toHaveBeenCalledTimes(3);
  });

  it('calls onReadBook on action button click and closes modal', () => {
    const handleRead = vi.fn();
    const handleClose = vi.fn();

    renderWithQueryClient(
      <BookPreviewModal
        book={defaultBook}
        isOpen={true}
        onClose={handleClose}
        onReadBook={handleRead}
      />
    );

    act(() => {
      vi.advanceTimersByTime(300);
    });

    const readBtn = screen.getByRole('button', { name: `Read ${defaultBook.title}` });
    fireEvent.click(readBtn);
    expect(handleRead).toHaveBeenCalledWith(defaultBook);

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(handleClose).toHaveBeenCalled();
  });

  it('applies FLIP transform when originRect is provided', () => {
    renderWithQueryClient(
      <BookPreviewModal
        book={defaultBook}
        originRect={{ top: 200, left: 150, width: 240, height: 360 }}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const bookStage = screen.getByTestId('preview-book-stage');
    expect(bookStage.style.transform).toContain('translate3d');

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(bookStage.style.transform).toBe('translate3d(0px, 0px, 0px)');
  });

  it('invokes onWillClose during the landing flight prior to full onClose', () => {
    const handleClose = vi.fn();
    const handleWillClose = vi.fn();

    renderWithQueryClient(
      <BookPreviewModal
        book={defaultBook}
        isOpen={true}
        onWillClose={handleWillClose}
        onClose={handleClose}
      />
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    const bookStage = screen.getByTestId('preview-book-stage');
    fireEvent.click(bookStage);

    // Advance to 390ms: onWillClose should fire before onClose (scheduled at 390ms)
    act(() => {
      vi.advanceTimersByTime(390);
    });

    expect(handleWillClose).toHaveBeenCalledTimes(1);
    expect(handleClose).not.toHaveBeenCalled();

    // Advance remaining duration to 450ms: onClose fires
    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('renders long book titles and authors in full without truncation', () => {
    const longBook = {
      ...defaultBook,
      title: 'The Strange Case of Dr. Jekyll and Mr. Hyde and Other Classic Stories of Mystery and Terror',
      authors: [{ name: 'Stevenson, Robert Louis', birth_year: 1850, death_year: 1894 }],
    };

    renderWithQueryClient(
      <BookPreviewModal book={longBook} isOpen={true} onClose={vi.fn()} />
    );

    expect(screen.getAllByText(longBook.title).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Robert Louis Stevenson/i).length).toBeGreaterThan(0);
  });
});
