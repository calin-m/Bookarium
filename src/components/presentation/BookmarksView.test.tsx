import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BookmarksView } from './BookmarksView';
import { useReaderStore } from '@/stores/useReaderStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import type { GutendexBook } from '@/types/book.types';

const mockBook: GutendexBook = {
  id: 1342,
  title: 'Pride and Prejudice',
  authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
  translators: [],
  subjects: ['England -- Fiction'],
  bookshelves: ['Best Books Ever'],
  languages: ['en'],
  copyright: false,
  media_type: 'Text',
  formats: {
    'image/jpeg': 'https://www.gutenberg.org/cover1342.jpg',
  },
  download_count: 54321,
};

describe('BookmarksView', () => {
  beforeEach(() => {
    useReaderStore.setState({
      readingProgress: {},
      readingPositions: {},
      currentBook: null,
    });
    useBookshelfStore.setState({
      savedBooks: [],
      recentBooks: [],
      bookStatuses: {},
    });
  });

  it('renders empty state when no volumes are in the ledger', () => {
    const handleBrowse = vi.fn();
    render(<BookmarksView onBrowseCatalog={handleBrowse} />);

    expect(screen.getByText('Continue Reading & Bookmarks')).toBeInTheDocument();
    expect(screen.getByText('No active reading volumes yet')).toBeInTheDocument();

    const browseBtn = screen.getByRole('button', { name: /Browse Library Catalog/i });
    fireEvent.click(browseBtn);
    expect(handleBrowse).toHaveBeenCalledTimes(1);
  });

  it('renders active volumes and updates filter tabs', () => {
    useBookshelfStore.setState({
      savedBooks: [mockBook],
      bookStatuses: { 1342: 'currently_reading' },
    });
    useReaderStore.getState().setProgress(1342, 60);
    useReaderStore.getState().saveReadingPosition(1342, {
      chapterIndex: 2,
      chapterPage: 8,
      globalPage: 24,
      lastReadAt: new Date().toISOString(),
    });

    render(<BookmarksView />);

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();

    // Click 'Completed' filter tab
    const completedTab = screen.getByRole('button', { name: /Completed/i });
    fireEvent.click(completedTab);

    expect(screen.getByText(/No volumes marked as completed/i)).toBeInTheDocument();
    expect(screen.queryByText('Pride and Prejudice')).not.toBeInTheDocument();

    // Click 'In Progress' tab
    const inProgressTab = screen.getByRole('button', { name: /In Progress/i });
    fireEvent.click(inProgressTab);

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
  });

  it('filters active volumes using the search bar and supports clearing search', () => {
    useBookshelfStore.setState({
      savedBooks: [mockBook],
      bookStatuses: { 1342: 'currently_reading' },
    });
    useReaderStore.getState().setProgress(1342, 45);

    render(<BookmarksView />);

    const searchInput = screen.getByRole('textbox', { name: /search bookmarks/i });
    expect(searchInput).toBeInTheDocument();

    // Type non-matching search
    fireEvent.change(searchInput, { target: { value: 'Nonexistent Author' } });
    expect(screen.getByText(/No bookmarks matching "Nonexistent Author"/i)).toBeInTheDocument();
    expect(screen.queryByText('Pride and Prejudice')).not.toBeInTheDocument();

    // Click 'Clear Search' button
    const clearSearchBtn = screen.getByRole('button', { name: /Clear Search/i });
    fireEvent.click(clearSearchBtn);

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
  });

  it('opens confirmation modal on Clear Bookmarks, cancels, and clears ledger when confirmed', () => {
    useBookshelfStore.setState({
      savedBooks: [mockBook],
      recentBooks: [mockBook],
      bookStatuses: { 1342: 'currently_reading' },
    });
    useReaderStore.getState().setProgress(1342, 60);
    useReaderStore.getState().saveReadingPosition(1342, {
      chapterIndex: 2,
      chapterPage: 8,
      globalPage: 24,
      lastReadAt: new Date().toISOString(),
    });

    render(<BookmarksView />);

    const clearBookmarksBtn = screen.getByRole('button', { name: /Clear Bookmarks/i });
    expect(clearBookmarksBtn).toBeInTheDocument();
    fireEvent.click(clearBookmarksBtn);

    // Modal dialog is open
    expect(screen.getByTestId('clear-bookmarks-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to clear your reading bookmarks/i)).toBeInTheDocument();

    // Click Cancel
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(screen.queryByTestId('clear-bookmarks-dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();

    // Open modal again and Confirm
    fireEvent.click(screen.getByRole('button', { name: /Clear Bookmarks/i }));
    const confirmBtn = screen.getByRole('button', { name: /Yes, Clear Bookmarks/i });
    fireEvent.click(confirmBtn);

    // Modal closed and ledger is emptied
    expect(screen.queryByTestId('clear-bookmarks-dialog')).not.toBeInTheDocument();
    expect(screen.getByText('No active reading volumes yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Clear Bookmarks/i })).not.toBeInTheDocument();
  });
});

