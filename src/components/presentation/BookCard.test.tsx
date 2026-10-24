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

    expect(screen.getAllByText('Classics').length).toBeGreaterThan(0);
    expect(screen.getByText('Romance')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /more topics/i }).length).toBeGreaterThan(0);
  });

  it('should open unabridged topics popover when clicking +N button', () => {
    const book = mockBooks[0];
    render(<BookCard book={book} />);

    const overflowBtn = screen.getAllByRole('button', { name: /more topics/i })[0];
    fireEvent.click(overflowBtn);

    expect(screen.getByText(/All Topics/i)).toBeInTheDocument();
    expect(screen.getByText('Courtship')).toBeInTheDocument();
    expect(screen.getByText('Domestic Fiction')).toBeInTheDocument();
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
    expect(bookmarkBtn.querySelector('svg')).toHaveClass('w-3.5', 'h-3.5');
    expect(bookmarkBtn.querySelector('svg')).not.toHaveClass('fill-current');
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

    // Get button should also be disabled
    const getBtn = screen.getByRole('button', { name: /Download unavailable for The Mysterious Affair at Styles in GB/i });
    expect(getBtn).toBeDisabled();
  });

  it('applies opacity and grayscale to cover image when book is restricted', () => {
    act(() => {
      useJurisdictionStore.getState().setCountry('GB');
    });

    const restrictedBookWithCover: any = {
      id: 864,
      title: 'Restricted Title With Cover',
      authors: [{ name: 'Modern Author', birth_year: 1940, death_year: 1995 }],
      translators: [],
      subjects: ['Fiction'],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {
        'image/jpeg': 'https://example.com/cover.jpg',
      },
      download_count: 100,
    };

    render(<BookCard book={restrictedBookWithCover} />);

    const coverImg = screen.getByAltText('Cover of Restricted Title With Cover');
    expect(coverImg.className).toContain('opacity-65');
    expect(coverImg.className).toContain('grayscale-[35%]');
  });

  it('opens unconstrained popover when clicking +N tag and invokes onTopicClick', () => {
    const onTopicClick = vi.fn();
    const bookWithManyTags: any = {
      id: 999,
      title: 'Multigenre Masterpiece',
      authors: [{ name: 'Polymath, Author', birth_year: 1800, death_year: 1860 }],
      translators: [],
      subjects: [
        'Science fiction',
        'Gothic fiction',
        'Detective and mystery stories',
        'Courtship -- Fiction',
        'Philosophy',
      ],
      bookshelves: ['Precursors of Science Fiction', 'Romantic Fiction', 'Category: British Literature'],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 1200,
    };

    render(<BookCard book={bookWithManyTags} onTopicClick={onTopicClick} />);

    // Click on the +N overflow button
    const plusButtons = screen.getAllByRole('button', { name: /more topics for Multigenre Masterpiece/i });
    expect(plusButtons.length).toBeGreaterThan(0);
    fireEvent.click(plusButtons[0]);

    // Popover is open
    expect(screen.getByText(/All Topics/i)).toBeInTheDocument();

    // Verify unconstrained container class
    const popoverHeading = screen.getByText(/All Topics/i);
    const popoverContainer = popoverHeading.closest('.space-y-1\\.5') || popoverHeading.parentElement?.parentElement;
    const tagList = popoverContainer?.querySelector('.overflow-y-auto');
    expect(tagList?.className).toContain('max-h-[min(320px,65vh)]');

    // Verify Category: prefix was stripped
    expect(screen.getByText('British Literature')).toBeInTheDocument();

    // Click a topic inside the popover
    const topicTag = screen.getByText('British Literature');
    fireEvent.click(topicTag);
    expect(onTopicClick).toHaveBeenCalledWith('British Literature');

    // Popover closes after selecting a topic
    expect(screen.queryByText(/All Topics/i)).not.toBeInTheDocument();

    // Reopen popover using desktop button if available and close with close button
    if (plusButtons.length > 1) {
      fireEvent.click(plusButtons[1]);
    } else {
      fireEvent.click(plusButtons[0]);
    }
    expect(screen.getByText(/All Topics/i)).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Close topic list/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByText(/All Topics/i)).not.toBeInTheDocument();

    // Reopen and close via outside pointerdown
    fireEvent.click(plusButtons[0]);
    expect(screen.getByText(/All Topics/i)).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByText(/All Topics/i)).not.toBeInTheDocument();
  });

  it('enforces min-w-0 on card root and inner metadata flex column to prevent mobile grid blowout', () => {
    const book = mockBooks[0];
    render(<BookCard book={book} />);

    const card = screen.getByTestId(`book-card-${book.id}`);
    expect(card).toHaveClass('min-w-0');

    const title = screen.getByText('Pride and Prejudice');
    const metadataColumn = title.closest('.min-w-0');
    expect(metadataColumn).toBeInTheDocument();
  });

  it('preserves neutral editorial card border, shadow-booksaw elevation, and clean topic badges without orange hover borders', () => {
    const book = mockBooks[0];
    render(<BookCard book={book} onPreviewClick={vi.fn()} onTopicClick={vi.fn()} />);

    const card = screen.getByTestId(`book-card-${book.id}`);
    expect(card).toHaveClass('border-border', 'shadow-booksaw', 'hover:shadow-booksaw-hover');
    expect(card).not.toHaveClass('shadow-xs', 'hover:border-primary/50');

    const coverVisual = screen.getByLabelText(`Click to preview quotes for ${book.title}`);
    expect(coverVisual).toHaveClass('border-b', 'border-border', 'bg-muted', 'dark:bg-secondary/30');

    const likeBtn = screen.getByLabelText('Add to favorites');
    expect(likeBtn).toHaveClass('bg-card', 'border', 'border-border');

    const saveBtn = screen.getByLabelText('Save to bookshelf');
    expect(saveBtn).toHaveClass('bg-card', 'border', 'border-border');

    const topicBadges = screen.getAllByText('Classics');
    expect(topicBadges.length).toBeGreaterThan(0);
    for (const badge of topicBadges) {
      expect(badge).toHaveClass('border-border', 'text-foreground', 'hover:text-primary');
      expect(badge).not.toHaveClass('group-hover:border-primary/60', 'hover:bg-primary/10', 'bg-muted/40');
    }

    const overflowBtn = screen.getAllByRole('button', { name: /more topics/i })[0];
    fireEvent.click(overflowBtn);
    const popoverTag = screen.getByText('Courtship');
    expect(popoverTag).toHaveClass('border-border', 'hover:bg-muted/80', 'hover:text-primary');
    expect(popoverTag).not.toHaveClass('hover:border-primary');
  });

  it('covers rating & reading status badges, direct primary tag clicks, restricted cover clicks, and all favorite/bookshelf tooltip states', () => {
    const book = mockBooks[0];
    const onPreviewClick = vi.fn();
    const onDownloadClick = vi.fn();
    const onTopicClick = vi.fn();

    // Seed saved, favorite, 5-star rating, and reading status
    useBookshelfStore.getState().toggleSaveBook(book);
    useBookshelfStore.getState().toggleFavoriteBook(book);
    useBookshelfStore.setState({
      bookRatings: { [book.id]: 5 },
      bookStatuses: { [book.id]: 'currently_reading' },
    });

    const { rerender } = render(
      <BookCard
        book={book}
        activeView="favorites"
        onPreviewClick={onPreviewClick}
        onDownloadClick={onDownloadClick}
        onTopicClick={onTopicClick}
      />
    );

    expect(screen.getByText('📖 Reading')).toBeInTheDocument();

    // Test 'finished' and 'want_to_read' status badges
    act(() => {
      useBookshelfStore.setState({ bookStatuses: { [book.id]: 'finished' } });
    });
    rerender(
      <BookCard
        book={book}
        activeView="favorites"
        onPreviewClick={onPreviewClick}
        onDownloadClick={onDownloadClick}
        onTopicClick={onTopicClick}
      />
    );
    expect(screen.getByText('✓ Finished')).toBeInTheDocument();

    act(() => {
      useBookshelfStore.setState({ bookStatuses: { [book.id]: 'want_to_read' } });
    });
    rerender(
      <BookCard
        book={book}
        activeView="favorites"
        onPreviewClick={onPreviewClick}
        onDownloadClick={onDownloadClick}
        onTopicClick={onTopicClick}
      />
    );
    expect(screen.getByText('🔖 Want to Read')).toBeInTheDocument();

    // Click primary tag badge directly
    const primaryTags = screen.getAllByText('Classics');
    fireEvent.click(primaryTags[0]);
    expect(onTopicClick).toHaveBeenCalledWith('Classics');
    if (primaryTags[1]) {
      fireEvent.click(primaryTags[1]);
    }

    // Hover favorite & bookshelf buttons when saved & favorited, and while confirming removal
    const coverVisual = screen.getByLabelText(`Click to preview quotes for ${book.title}`);
    fireEvent.mouseMove(coverVisual, { clientX: 120, clientY: 160 });

    const favBtn = screen.getByRole('button', { name: /Remove from favorites/i });
    fireEvent.mouseEnter(favBtn);
    expect(screen.getByText('Remove from Favorites')).toBeInTheDocument();

    // Click once to arm removal confirmation -> tooltip shows 'Click again to remove'
    fireEvent.click(favBtn);
    expect(screen.getByText('Click again to remove')).toBeInTheDocument();

    // Disarm via onBlur
    fireEvent.blur(favBtn);
    expect(screen.getByRole('button', { name: /Remove from favorites/i })).toBeInTheDocument();

    // Arm again and disarm via cover mouseLeave
    fireEvent.click(screen.getByRole('button', { name: /Remove from favorites/i }));
    fireEvent.mouseLeave(coverVisual);
    expect(screen.getByRole('button', { name: /Remove from favorites/i })).toBeInTheDocument();

    // Hover bookshelf button when saved -> 'Remove from Bookshelf'
    fireEvent.mouseMove(coverVisual, { clientX: 120, clientY: 160 });
    const saveBtn = screen.getByRole('button', { name: /Remove from bookshelf/i });
    fireEvent.mouseEnter(saveBtn);
    expect(screen.getByText('Remove from Bookshelf')).toBeInTheDocument();
    fireEvent.mouseLeave(saveBtn);

    // Restricted book cover click with onPreviewClick vs fallback to onDownloadClick
    act(() => {
      useJurisdictionStore.getState().setCountry('GB');
    });
    const restrictedBook = {
      ...book,
      id: 865,
      authors: [{ name: 'Modern, Author', birth_year: 1930, death_year: 1995 }],
    };
    rerender(
      <BookCard
        book={restrictedBook}
        onPreviewClick={onPreviewClick}
        onDownloadClick={onDownloadClick}
      />
    );
    fireEvent.click(screen.getByLabelText(`Click to preview quotes for ${restrictedBook.title}`));
    expect(onPreviewClick).toHaveBeenCalledWith(restrictedBook, expect.any(Object));

    rerender(<BookCard book={restrictedBook} onDownloadClick={onDownloadClick} />);
    const cardEl = screen.getByTestId('book-card-865');
    fireEvent.click(cardEl.firstElementChild as HTMLElement);
    expect(onDownloadClick).toHaveBeenCalledWith(restrictedBook);
  });

  it('renders read-only Offline badge on cover when isOffline is true', () => {
    const book = mockBooks[0];
    const { rerender } = render(<BookCard book={book} isOffline={false} />);
    expect(screen.queryByTestId(`book-card-offline-badge-${book.id}`)).not.toBeInTheDocument();

    rerender(<BookCard book={book} isOffline={true} />);
    const badge = screen.getByTestId(`book-card-offline-badge-${book.id}`);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Offline');
  });
});


