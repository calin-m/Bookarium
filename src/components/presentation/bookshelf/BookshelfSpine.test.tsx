import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

    const hoverCard = screen.getByText('75% read').closest('div.absolute');
    expect(hoverCard).toHaveClass('hidden', 'lg:group-hover:flex');

    const readBtn = screen.getByLabelText('Open reader for Pride and Prejudice');
    fireEvent.click(readBtn);
    expect(handleBookClick).toHaveBeenCalledWith(mockBook);

    const downloadBtn = screen.getByLabelText('Download formats for Pride and Prejudice');
    fireEvent.click(downloadBtn);
    expect(handleDownload).toHaveBeenCalledWith(mockBook);

    const saveBtn = screen.getByLabelText('Remove from bookshelf');
    fireEvent.click(saveBtn);
    expect(handleToggleSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('remove-bookshelf-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(handleToggleSave).not.toHaveBeenCalled();

    fireEvent.click(saveBtn);
    fireEvent.click(screen.getByRole('button', { name: /Remove from Shelf/i }));
    expect(handleToggleSave).toHaveBeenCalledWith(mockBook);

    const likeBtn = screen.getByLabelText('Remove from favorites');
    fireEvent.click(likeBtn);
    expect(handleToggleFavorite).not.toHaveBeenCalled();
    expect(screen.getByTestId('remove-favorite-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Remove Favorite/i }));
    expect(handleToggleFavorite).toHaveBeenCalledWith(mockBook);
  });

  it('renders offline indicator and fires onToggleOffline, onToggleSave, and onToggleFavorite when not saved/favorited', () => {
    const handleToggleOffline = vi.fn();
    const handleToggleSave = vi.fn();
    const handleToggleFavorite = vi.fn();
    render(
      <BookshelfSpine
        book={mockBook}
        bookIndex={0}
        isSaved={false}
        isFavorite={false}
        isOffline={true}
        onToggleSave={handleToggleSave}
        onToggleFavorite={handleToggleFavorite}
        onToggleOffline={handleToggleOffline}
        onSpineClick={vi.fn()}
      />
    );

    // Redundant top Downloaded pill is removed; offline action is consolidated into bottom 4-state button
    expect(screen.queryByTitle(/Downloaded for offline reading — Click to remove/i)).toBeNull();
    const offlineBtn = screen.getByLabelText(`Remove offline copy of ${mockBook.title}`);
    expect(offlineBtn).toBeInTheDocument();
    expect(offlineBtn).toHaveClass('flex', 'items-center', 'justify-center');
    fireEvent.click(offlineBtn);
    expect(handleToggleOffline).toHaveBeenCalledWith(mockBook);

    // Immediate add when not saved / not favorite
    fireEvent.click(screen.getByLabelText('Save to bookshelf'));
    expect(handleToggleSave).toHaveBeenCalledWith(mockBook);

    fireEvent.click(screen.getByLabelText('Add to favorites'));
    expect(handleToggleFavorite).toHaveBeenCalledWith(mockBook);
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

  it('renders muted spine, restriction badge, banner, and disabled buttons for copyright-protected books', async () => {
    const { useJurisdictionStore } = await import('@/stores/useJurisdictionStore');
    act(() => {
      useJurisdictionStore.setState({ country: 'RO' });
    });

    const restrictedBook: GutendexBook = {
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
      download_count: 25000,
    };

    render(
      <BookshelfSpine
        book={restrictedBook}
        bookIndex={0}
        isSaved={true}
        isFavorite={false}
        isOffline={false}
        onToggleSave={vi.fn()}
        onToggleFavorite={vi.fn()}
        onSpineClick={vi.fn()}
      />
    );

    // Spine shows regional restriction badge
    expect(screen.getByTestId('spine-restricted-badge-863')).toBeInTheDocument();
    expect(screen.getByText('RO')).toBeInTheDocument();

    // Hover card shows Protected (RO) and restriction banner
    expect(screen.getByTestId('spine-card-restricted-863')).toBeInTheDocument();
    expect(screen.getByTestId('spine-restricted-banner-863')).toBeInTheDocument();

    // Read button is disabled
    const restrictedReadBtn = screen.getByRole('button', { name: `${restrictedBook.title} is restricted in RO` });
    expect(restrictedReadBtn).toBeDisabled();

    // Offline button is disabled
    const restrictedOfflineBtn = screen.getByRole('button', { name: `Offline storage unavailable for ${restrictedBook.title}` });
    expect(restrictedOfflineBtn).toBeDisabled();

    act(() => {
      useJurisdictionStore.setState({ country: 'US' });
    });
  });

  it('renders embossed 5-star spine stamp, multi-shelf Move to Shelf selector, full tooltip matrix, and router fallback', async () => {
    const { useBookshelfStore } = await import('@/stores/useBookshelfStore');
    const { useReaderStore } = await import('@/stores/useReaderStore');
    act(() => {
      useBookshelfStore.setState({ bookRatings: { 1342: 5 } });
    });

    const onMoveBookToShelf = vi.fn().mockResolvedValue(true);
    const onSpineClick = vi.fn();
    const anonymousBook: GutendexBook = {
      ...mockBook,
      authors: [],
    };

    render(
      <BookshelfSpine
        book={anonymousBook}
        bookIndex={0}
        isSaved={true}
        isFavorite={true}
        isOffline={true}
        onToggleSave={vi.fn()}
        onToggleFavorite={vi.fn()}
        onSpineClick={onSpineClick}
        cloudBookshelves={[
          { id: 'shelf-def', user_id: 'u1', name: 'General', is_default: true, is_public: false, created_at: '', updated_at: '' },
          { id: 'shelf-regency', user_id: 'u1', name: 'Regency Classics', is_default: false, is_public: true, created_at: '', updated_at: '' },
        ]}
        cloudBookshelfItems={[
          { id: 'item-1', bookshelf_id: 'shelf-def', user_id: 'u1', book_id: 1342, book_title: 'Pride and Prejudice', book_authors: ['Jane Austen'], cover_url: null, added_at: '' },
        ]}
        userId="u1"
        onMoveBookToShelf={onMoveBookToShelf}
      />
    );

    // Anonymous author fallback
    expect(screen.getAllByText('Anonymous').length).toBeGreaterThan(0);

    // Embossed gold 5-star stamp on spine
    expect(screen.getByTitle('Rated 5/5 stars')).toBeInTheDocument();

    // Spine click
    fireEvent.click(screen.getByTestId('shelf-book-1342'));
    expect(onSpineClick).toHaveBeenCalledWith(anonymousBook);

    // Hover Read, Download, Favorite, Bookshelf, Offline buttons to cover all tooltipContent branches
    const readBtn = screen.getByLabelText('Open reader for Pride and Prejudice');
    const hoverCard = readBtn.closest('div.absolute') as HTMLElement;
    fireEvent.mouseMove(hoverCard, { clientX: 150, clientY: 200 });
    fireEvent.mouseEnter(readBtn);
    expect(screen.getByText('Open Reader')).toBeInTheDocument();
    fireEvent.mouseLeave(readBtn);

    const offlineBtn = screen.getByLabelText(`Remove offline copy of ${mockBook.title}`);
    fireEvent.mouseMove(hoverCard, { clientX: 150, clientY: 200 });
    fireEvent.mouseEnter(offlineBtn);
    expect(screen.getByText('Remove Offline Copy')).toBeInTheDocument();
    fireEvent.mouseLeave(offlineBtn);

    const downloadBtn = screen.getByLabelText('Download formats for Pride and Prejudice');
    fireEvent.mouseMove(hoverCard, { clientX: 150, clientY: 200 });
    fireEvent.mouseEnter(downloadBtn);
    expect(screen.getByText('Download Formats (EPUB, TXT)')).toBeInTheDocument();
    fireEvent.mouseLeave(downloadBtn);

    const saveBtn = screen.getByLabelText('Remove from bookshelf');
    fireEvent.mouseMove(hoverCard, { clientX: 150, clientY: 200 });
    fireEvent.mouseEnter(saveBtn);
    expect(screen.getByText('Remove from Bookshelf')).toBeInTheDocument();
    fireEvent.mouseLeave(saveBtn);

    const favBtn = screen.getByLabelText('Remove from favorites');
    fireEvent.mouseMove(hoverCard, { clientX: 150, clientY: 200 });
    fireEvent.mouseEnter(favBtn);
    expect(screen.getByText('Remove from Favorites')).toBeInTheDocument();
    fireEvent.mouseLeave(favBtn);

    // Click Read when onBookClick is omitted -> opens reader store and pushes route
    fireEvent.click(readBtn);
    expect(useReaderStore.getState().currentBook?.id).toBe(1342);

    // Change Move to Shelf select value
    const shelfSelect = screen.getByLabelText('Move Pride and Prejudice to shelf');
    fireEvent.change(shelfSelect, { target: { value: 'shelf-regency' } });
    expect(onMoveBookToShelf).toHaveBeenCalledWith(1342, 'shelf-regency', 'u1');
  });

  it('renders loading spinner and disables offline toggle when isDownloadingOffline is true', () => {
    const { rerender } = render(
      <BookshelfSpine
        book={mockBook}
        bookIndex={0}
        isSaved={true}
        isFavorite={false}
        isOffline={false}
        isDownloadingOffline={false}
        onToggleSave={vi.fn()}
        onToggleFavorite={vi.fn()}
        onToggleOffline={vi.fn()}
        onSpineClick={vi.fn()}
      />
    );

    const offlineBtn = screen.getByLabelText(`Download ${mockBook.title} for offline reading`);
    const hoverCard = offlineBtn.closest('div.absolute') as HTMLElement;
    fireEvent.mouseMove(hoverCard, { clientX: 150, clientY: 200 });
    fireEvent.mouseEnter(offlineBtn);
    expect(screen.getByText('Save for Offline Reading')).toBeInTheDocument();

    rerender(
      <BookshelfSpine
        book={mockBook}
        bookIndex={0}
        isSaved={true}
        isFavorite={false}
        isOffline={false}
        isDownloadingOffline={true}
        onToggleSave={vi.fn()}
        onToggleFavorite={vi.fn()}
        onToggleOffline={vi.fn()}
        onSpineClick={vi.fn()}
      />
    );

    const downloadingBtn = screen.getByLabelText(`Downloading ${mockBook.title} for offline reading`);
    expect(downloadingBtn).toBeDisabled();
    expect(screen.getByText('Saving for Offline...')).toBeInTheDocument();
  });

  it('disables Read and Save for offline reading on hover card when network is offline and book is not cached', async () => {
    const networkModule = await import('@/hooks/useNetworkStatus');
    const networkSpy = vi.spyOn(networkModule, 'useNetworkStatus').mockReturnValue({
      isOnline: false,
      isOffline: true,
    });

    render(
      <BookshelfSpine
        book={mockBook}
        bookIndex={0}
        isSaved={true}
        isFavorite={false}
        isOffline={false}
        onToggleSave={vi.fn()}
        onToggleFavorite={vi.fn()}
        onToggleOffline={vi.fn()}
        onSpineClick={vi.fn()}
      />
    );

    const offlineReadBtn = screen.getByRole('button', {
      name: `Open reader for ${mockBook.title} (Unavailable offline)`,
    });
    expect(offlineReadBtn).toBeDisabled();
    expect(offlineReadBtn).toHaveTextContent('Offline');

    const saveOfflineBtn = screen.getByRole('button', {
      name: `Download ${mockBook.title} for offline reading`,
    });
    expect(saveOfflineBtn).toBeDisabled();

    const downloadFormatsBtn = screen.getByRole('button', {
      name: `Download formats for ${mockBook.title}`,
    });
    expect(downloadFormatsBtn).toBeDisabled();

    expect(screen.getByTestId(`spine-offline-unavailable-badge-${mockBook.id}`)).toHaveTextContent('OFF');
    expect(screen.getByTestId(`spine-card-offline-unavailable-${mockBook.id}`)).toHaveTextContent('Not Downloaded');
    expect(screen.getByTestId(`spine-offline-unavailable-banner-${mockBook.id}`)).toHaveTextContent('Unavailable Offline');

    networkSpy.mockRestore();
  });
});
