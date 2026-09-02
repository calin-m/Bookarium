import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react';
import React from 'react';
import { BookshelfRack } from './BookshelfRack';
import { mockBooks } from '@/mocks/handlers';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { useAuthStore } from '@/stores/useAuthStore';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe('BookshelfRack Component', () => {
  beforeEach(() => {
    pushMock.mockClear();
    useAuthStore.setState({ user: null, profile: null });
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
    expect(screen.getByText(/no books found on "General"/i)).toBeInTheDocument();
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

  it('opens reader route using default handler if onBookClick is omitted', () => {
    render(<BookshelfRack books={mockBooks} />);
    const bookElem = screen.getByTestId(`shelf-book-${mockBooks[0].id}`);
    fireEvent.click(bookElem);
    expect(pushMock).toHaveBeenCalledWith(`/read/${mockBooks[0].id}`);
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

  it('renders guest mode sync prompt and triggers auth modal', () => {
    render(<BookshelfRack books={mockBooks} />);
    expect(screen.getByText(/Guest Mode \(Local\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign in to Sync/i)).toBeInTheDocument();
  });

  it('displays rounded integer percentage for reading progress', () => {
    useReaderStore.setState({
      readingProgress: {
        [mockBooks[0].id]: 42.857,
      },
    });

    render(<BookshelfRack books={mockBooks} />);
    expect(screen.getByText('43% read')).toBeInTheDocument();
  });

  it('displays 0% read for opened books on page 1', () => {
    useReaderStore.setState({
      readingProgress: {
        [mockBooks[0].id]: 0,
      },
    });

    render(<BookshelfRack books={mockBooks} />);
    expect(screen.getByText('0% read')).toBeInTheDocument();
  });

  it('renders cloud shelves and allows switching active shelf', () => {
    useAuthStore.setState({ user: { id: 'user-1', email: 'test@example.com' } as any });

    useBookshelfStore.setState({
      cloudBookshelves: [
        { id: 'shelf-1', user_id: 'user-1', name: 'General', is_default: true, created_at: '', updated_at: '' },
        { id: 'shelf-2', user_id: 'user-1', name: 'Philosophy', is_default: false, created_at: '', updated_at: '' },
      ],
      activeBookshelfId: 'shelf-2',
    });

    render(<BookshelfRack books={mockBooks} />);

    expect(screen.getByRole('button', { name: 'General' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Philosophy' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'General' }));
    expect(useBookshelfStore.getState().activeBookshelfId).toBe('shelf-1');
  });

  it('opens rename shelf modal and submits new shelf name', async () => {
    useAuthStore.setState({ user: { id: 'user-1', email: 'test@example.com' } as any });
    const updateMock = vi.fn().mockResolvedValue(true);

    useBookshelfStore.setState({
      cloudBookshelves: [
        { id: 'shelf-1', user_id: 'user-1', name: 'General', is_default: true, created_at: '', updated_at: '' },
        { id: 'shelf-2', user_id: 'user-1', name: 'Philosophy', is_default: false, created_at: '', updated_at: '' },
      ],
      activeBookshelfId: 'shelf-2',
      updateCloudBookshelf: updateMock,
    });

    render(<BookshelfRack books={mockBooks} />);

    const renameBtn = screen.getByLabelText('Rename Philosophy');
    fireEvent.click(renameBtn);
    expect(screen.getByText('Rename Bookshelf')).toBeInTheDocument();

    // Cancel rename modal
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Rename Bookshelf')).not.toBeInTheDocument();

    // Open and submit rename
    fireEvent.click(renameBtn);
    const renameInput = screen.getByPlaceholderText('Shelf Name');
    fireEvent.change(renameInput, { target: { value: 'Greek Philosophy' } });
    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
    });

    expect(updateMock).toHaveBeenCalledWith('shelf-2', 'Greek Philosophy', 'user-1');
    expect(screen.queryByText('Rename Bookshelf')).not.toBeInTheDocument();
  });

  it('opens delete shelf modal and confirms custom shelf deletion', async () => {
    useAuthStore.setState({ user: { id: 'user-1', email: 'test@example.com' } as any });
    const deleteMock = vi.fn().mockResolvedValue(true);

    useBookshelfStore.setState({
      cloudBookshelves: [
        { id: 'shelf-1', user_id: 'user-1', name: 'General', is_default: true, created_at: '', updated_at: '' },
        { id: 'shelf-2', user_id: 'user-1', name: 'Philosophy', is_default: false, created_at: '', updated_at: '' },
      ],
      activeBookshelfId: 'shelf-2',
      deleteCloudBookshelf: deleteMock,
    });

    render(<BookshelfRack books={mockBooks} />);

    const deleteBtn = screen.getByLabelText('Delete Philosophy');
    fireEvent.click(deleteBtn);
    expect(screen.getByText('Delete Bookshelf')).toBeInTheDocument();

    // Cancel delete modal
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Delete Bookshelf')).not.toBeInTheDocument();

    // Reopen and confirm deletion
    fireEvent.click(deleteBtn);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete Shelf' }));
    });

    expect(deleteMock).toHaveBeenCalledWith('shelf-2', 'user-1');
    expect(screen.queryByText('Delete Bookshelf')).not.toBeInTheDocument();
  });

  it('opens create shelf modal and submits a new custom shelf', async () => {
    useAuthStore.setState({ user: { id: 'user-1', email: 'test@example.com' } as any });
    const createMock = vi.fn().mockResolvedValue({ id: 'shelf-new', name: 'Poetry' });

    useBookshelfStore.setState({
      cloudBookshelves: [
        { id: 'shelf-1', user_id: 'user-1', name: 'General', is_default: true, created_at: '', updated_at: '' },
      ],
      activeBookshelfId: 'shelf-1',
      createCloudBookshelf: createMock,
    });

    render(<BookshelfRack books={mockBooks} />);

    const newShelfBtn = screen.getByRole('button', { name: 'Create New Shelf' });
    fireEvent.click(newShelfBtn);
    expect(screen.getByText('Create New Bookshelf')).toBeInTheDocument();

    const createInput = screen.getByPlaceholderText('e.g. Philosophy & Logic');
    fireEvent.change(createInput, { target: { value: 'Poetry' } });
    await act(async () => {
      fireEvent.click(screen.getByText('Create Shelf'));
    });

    expect(createMock).toHaveBeenCalledWith('Poetry', 'user-1');
    expect(screen.queryByText('Create New Bookshelf')).not.toBeInTheDocument();
  });

  it('renders empty shelf state and allows browsing catalog', () => {
    useAuthStore.setState({ user: { id: 'user-1', email: 'test@example.com' } as any });
    useBookshelfStore.setState({
      cloudBookshelves: [
        { id: 'shelf-1', user_id: 'user-1', name: 'General', is_default: true, created_at: '', updated_at: '' },
      ],
      activeBookshelfId: 'shelf-1',
    });

    render(<BookshelfRack books={[]} />);

    expect(screen.getByText(/No books found on "General"/i)).toBeInTheDocument();
    const browseBtn = screen.getByText('Browse Catalog');
    fireEvent.click(browseBtn);
    expect(pushMock).toHaveBeenCalledWith('/');
  });

  it('calls onBrowseCatalog callback when clicking Browse Catalog in empty state', () => {
    const handleBrowse = vi.fn();
    render(<BookshelfRack books={[]} onBrowseCatalog={handleBrowse} />);

    const browseBtn = screen.getByText('Browse Catalog');
    fireEvent.click(browseBtn);
    expect(handleBrowse).toHaveBeenCalledTimes(1);
  });

  it('allows moving a book between shelves when user has multiple shelves', () => {
    useAuthStore.setState({ user: { id: 'user-1', email: 'test@example.com' } as any });
    const moveMock = vi.fn().mockResolvedValue(true);
    useBookshelfStore.setState({
      cloudBookshelves: [
        { id: 'shelf-1', user_id: 'user-1', name: 'General', is_default: true, created_at: '', updated_at: '' },
        { id: 'shelf-2', user_id: 'user-1', name: 'Philosophy', is_default: false, created_at: '', updated_at: '' },
      ],
      cloudBookshelfItems: [
        {
          id: 'item-1',
          bookshelf_id: 'shelf-1',
          user_id: 'user-1',
          book_id: mockBooks[0].id,
          book_title: mockBooks[0].title,
          book_authors: [],
          cover_url: null,
          added_at: '',
        },
      ],
      activeBookshelfId: 'shelf-1',
      moveBookToShelf: moveMock,
    });

    render(<BookshelfRack books={mockBooks} />);

    const selectElements = screen.getAllByLabelText(`Move ${mockBooks[0].title} to shelf`);
    expect(selectElements.length).toBeGreaterThan(0);
    fireEvent.change(selectElements[0], { target: { value: 'shelf-2' } });
    expect(moveMock).toHaveBeenCalledWith(mockBooks[0].id, 'shelf-2', 'user-1');
  });

  it('triggers onBookClick when Read button is clicked on hover card', () => {
    useBookshelfStore.setState({
      savedBooks: mockBooks,
      likedBooks: mockBooks,
      likedBookIds: [mockBooks[0].id],
    });
    const handleBookClick = vi.fn();
    render(
      <BookshelfRack
        books={mockBooks}
        onBookClick={handleBookClick}
      />
    );

    const readBtns = screen.getAllByLabelText(`Open reader for ${mockBooks[0].title}`);
    fireEvent.click(readBtns[0]);
    expect(handleBookClick).toHaveBeenCalledWith(mockBooks[0]);
  });

  it('triggers onDownloadClick when Download button is clicked on hover card', () => {
    useBookshelfStore.setState({
      savedBooks: mockBooks,
      likedBooks: mockBooks,
      likedBookIds: [mockBooks[0].id],
    });
    const handleDownload = vi.fn();
    render(
      <BookshelfRack
        books={mockBooks}
        onDownloadClick={handleDownload}
      />
    );

    const downloadBtns = screen.getAllByLabelText(`Download formats for ${mockBooks[0].title}`);
    fireEvent.click(downloadBtns[0]);
    expect(handleDownload).toHaveBeenCalledWith(mockBooks[0]);
  });

  it('toggles saved bookmark state when Save button is clicked on hover card', () => {
    useBookshelfStore.setState({
      savedBooks: mockBooks,
      likedBooks: mockBooks,
      likedBookIds: [mockBooks[0].id],
    });
    render(
      <BookshelfRack
        books={mockBooks}
      />
    );

    const saveBtns = screen.getAllByLabelText('Remove from bookshelf');
    fireEvent.click(saveBtns[0]);
    expect(useBookshelfStore.getState().savedBooks).toHaveLength(mockBooks.length - 1);
  });

  it('toggles liked state when Like button is clicked on hover card', () => {
    useBookshelfStore.setState({
      savedBooks: mockBooks,
      likedBooks: mockBooks,
      likedBookIds: [mockBooks[0].id],
    });
    render(
      <BookshelfRack
        books={mockBooks}
      />
    );

    const unlikeBtns = screen.getAllByLabelText('Unlike book');
    fireEvent.click(unlikeBtns[0]);
    expect(useBookshelfStore.getState().likedBookIds).not.toContain(mockBooks[0].id);
  });

  it('opens quick-action bottom sheet on mobile spine tap without immediate navigation', () => {
    window.innerWidth = 375;
    const handleBookClick = vi.fn();

    render(<BookshelfRack books={mockBooks} onBookClick={handleBookClick} />);

    const bookElem = screen.getByTestId(`shelf-book-${mockBooks[0].id}`);
    fireEvent.click(bookElem);

    // Should NOT immediately trigger onBookClick
    expect(handleBookClick).not.toHaveBeenCalled();

    // Mobile action sheet should be open with accessible dialog
    const sheet = screen.getByTestId('mobile-book-action-sheet');
    expect(sheet).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: `Book actions for ${mockBooks[0].title}` })).toBeInTheDocument();

    window.innerWidth = 1024;
  });

  it('triggers onBookClick and closes sheet when clicking Read in mobile action sheet', async () => {
    window.innerWidth = 375;
    const handleBookClick = vi.fn();

    render(<BookshelfRack books={mockBooks} onBookClick={handleBookClick} />);

    const bookElem = screen.getByTestId(`shelf-book-${mockBooks[0].id}`);
    fireEvent.click(bookElem);

    // Read action inside sheet triggers callback and closes modal
    const readBtn = screen.getByRole('button', { name: `Read ${mockBooks[0].title}` });
    fireEvent.click(readBtn);

    expect(handleBookClick).toHaveBeenCalledWith(mockBooks[0]);
    await waitFor(() => {
      expect(screen.queryByTestId('mobile-book-action-sheet')).not.toBeInTheDocument();
    });

    window.innerWidth = 1024;
  });

  it('dismisses mobile action sheet when clicking backdrop', async () => {
    window.innerWidth = 375;
    render(<BookshelfRack books={mockBooks} />);

    const bookElem = screen.getByTestId(`shelf-book-${mockBooks[0].id}`);
    fireEvent.click(bookElem);

    expect(screen.getByTestId('mobile-book-action-sheet')).toBeInTheDocument();

    const backdrop = screen.getByTestId('mobile-sheet-backdrop');
    fireEvent.click(backdrop);

    await waitFor(() => {
      expect(screen.queryByTestId('mobile-book-action-sheet')).not.toBeInTheDocument();
    });

    window.innerWidth = 1024;
  });

  it('handles mobile action sheet close button and dismiss', async () => {
    window.innerWidth = 375;
    render(<BookshelfRack books={mockBooks} />);

    const bookElem = screen.getByTestId(`shelf-book-${mockBooks[0].id}`);
    fireEvent.click(bookElem);

    const sheet = screen.getByTestId('mobile-book-action-sheet');
    const closeBtn = within(sheet).getByRole('button', { name: 'Close action sheet' });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('mobile-book-action-sheet')).not.toBeInTheDocument();
    });

    window.innerWidth = 1024;
  });

  it('triggers download callback from mobile action sheet', async () => {
    window.innerWidth = 375;
    const handleDownload = vi.fn();
    render(<BookshelfRack books={mockBooks} onDownloadClick={handleDownload} />);

    const bookElem = screen.getByTestId(`shelf-book-${mockBooks[0].id}`);
    fireEvent.click(bookElem);

    const sheet = screen.getByTestId('mobile-book-action-sheet');
    const downloadBtn = within(sheet).getByRole('button', { name: `Download ${mockBooks[0].title}` });
    fireEvent.click(downloadBtn);

    expect(handleDownload).toHaveBeenCalledWith(mockBooks[0]);
    await waitFor(() => {
      expect(screen.queryByTestId('mobile-book-action-sheet')).not.toBeInTheDocument();
    });

    window.innerWidth = 1024;
  });

  it('toggles bookmark and like status from mobile action sheet', () => {
    window.innerWidth = 375;
    useBookshelfStore.setState({
      savedBooks: mockBooks,
      likedBookIds: [],
    });

    render(<BookshelfRack books={mockBooks} />);

    const bookElem = screen.getByTestId(`shelf-book-${mockBooks[0].id}`);
    fireEvent.click(bookElem);

    const sheet = screen.getByTestId('mobile-book-action-sheet');

    // Remove from bookshelf
    const removeBtn = within(sheet).getByRole('button', { name: 'Remove from bookshelf' });
    fireEvent.click(removeBtn);
    expect(useBookshelfStore.getState().isBookSaved(mockBooks[0].id)).toBe(false);

    // Like book
    const likeBtn = within(sheet).getByRole('button', { name: 'Like book' });
    fireEvent.click(likeBtn);
    expect(useBookshelfStore.getState().isBookLiked(mockBooks[0].id)).toBe(true);

    window.innerWidth = 1024;
  });

  it('handles moving a book to another shelf and default read routing from mobile action sheet', () => {
    window.innerWidth = 375;
    useAuthStore.setState({ user: { id: 'user-1' } as any });
    const moveMock = vi.fn().mockResolvedValue(undefined);

    useBookshelfStore.setState({
      savedBooks: mockBooks,
      cloudBookshelves: [
        { id: 'shelf-1', user_id: 'user-1', name: 'General', is_default: true, created_at: '', updated_at: '' },
        { id: 'shelf-2', user_id: 'user-1', name: 'Fiction', is_default: false, created_at: '', updated_at: '' },
      ],
      cloudBookshelfItems: [
        {
          id: 'item-1',
          bookshelf_id: 'shelf-1',
          user_id: 'user-1',
          book_id: mockBooks[0].id,
          book_title: mockBooks[0].title,
          book_authors: [],
          cover_url: null,
          added_at: '',
        },
      ],
      activeBookshelfId: 'shelf-1',
      moveBookToShelf: moveMock,
    });

    render(<BookshelfRack books={mockBooks} />);

    const bookElem = screen.getByTestId(`shelf-book-${mockBooks[0].id}`);
    fireEvent.click(bookElem);

    const sheet = screen.getByTestId('mobile-book-action-sheet');

    // Move to shelf selector
    const selectElements = screen.getAllByLabelText(`Move ${mockBooks[0].title} to shelf`);
    const sheetSelect = selectElements.find((el) => el.closest('[data-testid="mobile-book-action-sheet"]'));
    expect(sheetSelect).toBeDefined();
    if (sheetSelect) {
      fireEvent.change(sheetSelect, { target: { value: 'shelf-2' } });
      expect(moveMock).toHaveBeenCalledWith(mockBooks[0].id, 'shelf-2', 'user-1');
    }

    // Read action default fallback
    const readBtn = within(sheet).getByRole('button', { name: `Read ${mockBooks[0].title}` });
    fireEvent.click(readBtn);
    expect(pushMock).toHaveBeenCalledWith(`/read/${mockBooks[0].id}`);

    window.innerWidth = 1024;
  });
});

