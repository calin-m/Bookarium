import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookPreviewModal } from './BookPreviewModal';
import { mockBooks } from '@/mocks/handlers';
import { useBookshelfStore } from '@/stores/useBookshelfStore';

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
    useBookshelfStore.setState({
      savedBooks: [],
      readingQueue: [],
      likedBooks: [],
      likedBookIds: [],
      recentBooks: [],
      bookRatings: {},
      bookStatuses: {},
    });
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

  it('does not render curation controls for unsaved books in catalog view', () => {
    renderWithQueryClient(
      <BookPreviewModal
        book={defaultBook}
        isOpen={true}
        activeView="catalog"
        onClose={vi.fn()}
      />
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByRole('radiogroup', { name: /rate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /reading status selector/i })).not.toBeInTheDocument();
  });

  it('renders curation controls when activeView is bookshelf or likes', () => {
    const { rerender } = renderWithQueryClient(
      <BookPreviewModal
        book={defaultBook}
        isOpen={true}
        activeView="bookshelf"
        onClose={vi.fn()}
      />
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByRole('radiogroup', { name: /rate/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /reading status selector/i })).toBeInTheDocument();

    rerender(
      <QueryClientProvider client={createTestQueryClient()}>
        <BookPreviewModal
          book={defaultBook}
          isOpen={true}
          activeView="likes"
          onClose={vi.fn()}
        />
      </QueryClientProvider>
    );

    expect(screen.getByRole('radiogroup', { name: /rate/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /reading status selector/i })).toBeInTheDocument();
  });

  it('does not render curation controls in catalog view even if book is saved or has ratings in store', () => {
    useBookshelfStore.setState({
      savedBooks: [defaultBook],
      bookRatings: { [defaultBook.id]: 4 },
      bookStatuses: { [defaultBook.id]: 'currently_reading' },
    });

    renderWithQueryClient(
      <BookPreviewModal
        book={defaultBook}
        isOpen={true}
        activeView="catalog"
        onClose={vi.fn()}
      />
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByRole('radiogroup', { name: /rate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /reading status selector/i })).not.toBeInTheDocument();
  });

  it('renders curation toolbar with solid bg-card and text-foreground modal styling', () => {
    renderWithQueryClient(
      <BookPreviewModal
        book={defaultBook}
        isOpen={true}
        activeView="likes"
        onClose={vi.fn()}
      />
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    const toolbar = screen.getByTestId('personal-curation-toolbar');
    expect(toolbar).toBeInTheDocument();
    expect(toolbar.className).toContain('bg-card');
    expect(toolbar.className).toContain('text-foreground');
    expect(toolbar.className).toContain('border-border');
    expect(toolbar.className).not.toContain('bg-card/95');
    expect(toolbar.className).not.toContain('backdrop-blur-md');
  });

  it('closes modal when clicking empty space in the viewport container outside the book', () => {
    const handleClose = vi.fn();

    renderWithQueryClient(
      <BookPreviewModal
        book={defaultBook}
        isOpen={true}
        activeView="likes"
        onClose={handleClose}
      />
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    const viewportContainer = screen.getByTestId('preview-viewport-container');
    fireEvent.click(viewportContainer);

    // After animation duration, handleClose should be triggered
    act(() => {
      vi.advanceTimersByTime(450);
    });

    expect(handleClose).toHaveBeenCalled();
  });

  it('does not close modal when clicking inside the curation bar', () => {
    const handleClose = vi.fn();

    renderWithQueryClient(
      <BookPreviewModal
        book={defaultBook}
        isOpen={true}
        activeView="likes"
        onClose={handleClose}
      />
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    const toolbar = screen.getByTestId('personal-curation-toolbar');
    fireEvent.click(toolbar);

    // Clicking star button inside toolbar
    const fourStarBtn = screen.getByRole('radio', { name: /Rate 4 of 5 stars/i });
    fireEvent.click(fourStarBtn);

    // Clicking reading status badge
    const wantToReadBtn = screen.getByRole('radio', { name: /Want to Read/i });
    fireEvent.click(wantToReadBtn);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // None of these clicks should have called handleClose
    expect(handleClose).not.toHaveBeenCalled();
    expect(useBookshelfStore.getState().bookRatings[defaultBook.id]).toBe(4);
    expect(useBookshelfStore.getState().bookStatuses[defaultBook.id]).toBe('want_to_read');
  });
});


