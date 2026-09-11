import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { BookCard } from './BookCard';
import { mockBooks } from '@/mocks/handlers';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { useJurisdictionStore } from '@/stores/useJurisdictionStore';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('BookCard component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBookshelfStore.getState().clearBookshelf();
    useReaderStore.setState({ isOpen: false, currentBook: null });
    useJurisdictionStore.setState({
      country: 'US',
      rule: 'US_PUBLIC_DOMAIN',
      overrideCountry: null,
    });
  });

  it('should render book title, author, and formats', () => {
    const book = mockBooks[0];
    render(<BookCard book={book} />);

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByText('Jane Austen')).toBeInTheDocument();
    expect(screen.getByText(/65\.4k reads/i)).toBeInTheDocument();
  });

  it('should render multiple separate subject tag pills in the card body', () => {
    const book = mockBooks[0];
    render(<BookCard book={book} />);

    expect(screen.getByText('Courtship')).toBeInTheDocument();
    expect(screen.getByText('Domestic fiction')).toBeInTheDocument();
  });

  it('should render link to /read/[id] when clicking Read button', () => {
    const book = mockBooks[0];
    render(<BookCard book={book} />);

    const readLink = screen.getByRole('link', { name: /Read Pride and Prejudice/i });
    expect(readLink).toHaveAttribute('href', `/read/${book.id}`);
  });

  it('should toggle favorite and bookmark state on button clicks', () => {
    const book = mockBooks[0];
    render(<BookCard book={book} />);

    const likeBtn = screen.getByLabelText('Add to favorites');
    fireEvent.click(likeBtn);
    expect(useBookshelfStore.getState().isBookFavorite(book.id)).toBe(true);

    const unlikeBtn = screen.getByLabelText('Remove from favorites');
    expect(unlikeBtn).toBeInTheDocument();

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

  it('should call onPreviewClick when clicking book cover visual on desktop', () => {
    const handlePreview = vi.fn();
    const book = mockBooks[0];
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });

    try {
      render(<BookCard book={book} onPreviewClick={handlePreview} />);

      const coverVisual = screen.getByLabelText(`Click to preview quotes for ${book.title}`);
      fireEvent.click(coverVisual);
      expect(handlePreview).toHaveBeenCalledWith(book, expect.any(Object));
    } finally {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalWidth });
    }
  });

  it('should navigate to /read/[id] on mobile when clicking book cover visual in catalog view', () => {
    const handlePreview = vi.fn();
    const book = mockBooks[0];
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 });

    try {
      render(<BookCard book={book} onPreviewClick={handlePreview} activeView="catalog" />);

      const coverVisual = screen.getByLabelText(`Click to preview quotes for ${book.title}`);
      fireEvent.click(coverVisual);

      expect(handlePreview).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith(`/read/${book.id}`);
      expect(useReaderStore.getState().currentBook?.id).toBe(book.id);
    } finally {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalWidth });
    }
  });

  it('should call onPreviewClick on mobile when activeView is favorites', () => {
    const handlePreview = vi.fn();
    const book = mockBooks[0];
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 });

    try {
      render(<BookCard book={book} onPreviewClick={handlePreview} activeView="favorites" />);

      const coverVisual = screen.getByLabelText(`Click to preview quotes for ${book.title}`);
      fireEvent.click(coverVisual);

      expect(handlePreview).toHaveBeenCalledWith(book, expect.any(Object));
      expect(mockPush).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalWidth });
    }
  });

  it('applies responsive active styling (desktop hide, mobile highlight) when isPreviewActive is true', () => {
    const book = mockBooks[0];
    render(<BookCard book={book} isPreviewActive={true} />);
    const card = screen.getByTestId(`book-card-${book.id}`);
    expect(card).toHaveClass('lg:opacity-0');
    expect(card).toHaveClass('max-lg:opacity-100');
    expect(card).toHaveClass('max-lg:ring-2');
  });

  it('should render cursor tooltip on hover when onPreviewClick is provided', () => {
    vi.useFakeTimers();
    const book = mockBooks[0];
    render(<BookCard book={book} onPreviewClick={vi.fn()} />);

    const coverVisual = screen.getByLabelText(`Click to preview quotes for ${book.title}`);
    fireEvent.mouseEnter(coverVisual);
    fireEvent.mouseMove(coverVisual, { clientX: 100, clientY: 100 });

    act(() => {
      vi.advanceTimersByTime(450);
    });

    expect(screen.getByText(/Click to preview quotes/i)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('renders fallback cover when image error occurs', () => {
    const book = mockBooks[0];
    render(<BookCard book={book} onPreviewClick={vi.fn()} />);

    const coverImg = screen.getByAltText(`Cover of ${book.title}`);
    fireEvent.error(coverImg);

    expect(screen.getByText(/Public Domain/i)).toBeInTheDocument();
    expect(screen.getAllByText(book.title).length).toBeGreaterThanOrEqual(1);
  });

  it('triggers preview on Enter or Space key press on cover', () => {
    const handlePreview = vi.fn();
    const book = mockBooks[0];
    render(<BookCard book={book} onPreviewClick={handlePreview} />);

    const coverVisual = screen.getByLabelText(`Click to preview quotes for ${book.title}`);
    fireEvent.keyDown(coverVisual, { key: 'Enter' });
    expect(handlePreview).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(coverVisual, { key: ' ' });
    expect(handlePreview).toHaveBeenCalledTimes(2);
  });

  it('updates cursor tooltip to Add to Favorites and Add to Bookshelf when hovering action buttons', () => {
    vi.useFakeTimers();
    const book = mockBooks[0];
    render(<BookCard book={book} onPreviewClick={vi.fn()} />);

    const coverVisual = screen.getByLabelText(`Click to preview quotes for ${book.title}`);
    fireEvent.mouseEnter(coverVisual);
    fireEvent.mouseMove(coverVisual, { clientX: 100, clientY: 100 });

    const likeButton = screen.getByRole('button', { name: /Add to favorites/i });
    fireEvent.mouseEnter(likeButton);

    expect(screen.getByText(/Add to Favorites/i)).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: /Save to bookshelf/i });
    fireEvent.mouseEnter(saveButton);

    expect(screen.getByText(/Add to Bookshelf/i)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('requires two clicks on favorite button to remove from favorites when activeView="favorites"', () => {
    const book = mockBooks[0];
    useBookshelfStore.getState().toggleFavoriteBook(book);
    expect(useBookshelfStore.getState().isBookFavorite(book.id)).toBe(true);

    render(<BookCard book={book} activeView="favorites" />);

    const removeBtn = screen.getByRole('button', { name: /Remove from favorites/i });
    
    // Click 1: arms confirmation, does NOT remove yet
    fireEvent.click(removeBtn);
    expect(useBookshelfStore.getState().isBookFavorite(book.id)).toBe(true);
    expect(screen.getByRole('button', { name: /Click again to confirm removal from favorites/i })).toBeInTheDocument();

    // Click 2: confirms removal and removes from favorites
    const confirmBtn = screen.getByRole('button', { name: /Click again to confirm removal from favorites/i });
    fireEvent.click(confirmBtn);
    expect(useBookshelfStore.getState().isBookFavorite(book.id)).toBe(false);
  });

  it('auto-disarms favorite removal confirmation after timeout when activeView="favorites"', () => {
    vi.useFakeTimers();
    const book = mockBooks[0];
    useBookshelfStore.getState().toggleFavoriteBook(book);

    render(<BookCard book={book} activeView="favorites" />);

    const removeBtn = screen.getByRole('button', { name: /Remove from favorites/i });
    fireEvent.click(removeBtn);

    expect(screen.getByRole('button', { name: /Click again to confirm removal from favorites/i })).toBeInTheDocument();

    // Advance past 3500ms timeout
    act(() => {
      vi.advanceTimersByTime(3600);
    });

    expect(screen.getByRole('button', { name: /Remove from favorites/i })).toBeInTheDocument();
    expect(useBookshelfStore.getState().isBookFavorite(book.id)).toBe(true);
    vi.useRealTimers();
  });

  it('disarms favorite removal confirmation on mouse leave or blur when activeView="favorites"', () => {
    const book = mockBooks[0];
    useBookshelfStore.getState().toggleFavoriteBook(book);

    render(<BookCard book={book} activeView="favorites" />);

    const removeBtn = screen.getByRole('button', { name: /Remove from favorites/i });
    fireEvent.click(removeBtn);

    const armedBtn = screen.getByRole('button', { name: /Click again to confirm removal from favorites/i });
    expect(armedBtn).toBeInTheDocument();

    fireEvent.mouseLeave(armedBtn);
    expect(screen.getByRole('button', { name: /Remove from favorites/i })).toBeInTheDocument();
    expect(useBookshelfStore.getState().isBookFavorite(book.id)).toBe(true);
  });

  it('renders Protected (GB) badge and disabled Restricted button when book is protected in UK', () => {
    act(() => {
      useJurisdictionStore.getState().setCountry('GB');
    });

    const christieBook: any = {
      id: 863,
      title: 'The Mysterious Affair at Styles',
      authors: [{ name: 'Christie, Agatha', birth_year: 1890, death_year: 1976 }],
      translators: [],
      subjects: ['Detective and mystery stories'],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 500,
    };

    render(<BookCard book={christieBook} />);

    expect(screen.getByText('Protected (GB)')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Read The Mysterious Affair at Styles/i })).not.toBeInTheDocument();
    const restrictedBtn = screen.getByRole('button', { name: /is restricted in GB/i });
    expect(restrictedBtn).toBeDisabled();
    expect(restrictedBtn).toHaveTextContent('Restricted');
  });
});
