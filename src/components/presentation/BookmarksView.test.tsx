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
});

