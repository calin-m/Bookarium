import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { BookmarksView } from './BookmarksView';
import { useReaderStore } from '@/stores/useReaderStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import type { GutendexBook } from '@/types/book.types';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    React.createElement(QueryClientProvider, { client: queryClient }, ui)
  );
}

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

let mockOfflineBookIds: number[] = [];
let mockOfflineBooks: GutendexBook[] = [];
const mockDownloadBook = vi.fn();
const mockRemoveBook = vi.fn();
vi.mock('@/hooks/useOfflineBooks', () => ({
  useOfflineBooks: () => ({
    offlineBookIds: mockOfflineBookIds,
    offlineBooks: mockOfflineBooks,
    isBookOffline: (id: number) => mockOfflineBookIds.includes(id),
    downloadBook: mockDownloadBook,
    removeBook: mockRemoveBook,
    downloadingBookId: null,
  }),
}));

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
    vi.clearAllMocks();
    mockOfflineBookIds = [];
    mockOfflineBooks = [];
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
    renderWithClient(<BookmarksView onBrowseCatalog={handleBrowse} />);

    expect(screen.getByRole('heading', { name: 'Bookmarks' })).toBeInTheDocument();
    expect(screen.getByText('Pick up right where you left off across all your volumes.')).toBeInTheDocument();
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

    renderWithClient(<BookmarksView />);

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

    renderWithClient(<BookmarksView />);

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

    renderWithClient(<BookmarksView />);

    const clearBookmarksBtn = screen.getByRole('button', { name: /Clear Bookmarks/i });
    expect(clearBookmarksBtn).toBeInTheDocument();
    fireEvent.click(clearBookmarksBtn);

    // Modal dialog is open
    expect(screen.getByTestId('clear-bookmarks-dialog')).toBeInTheDocument();
    const bulkBackdrop = screen.getByTestId('modal-backdrop');
    expect(bulkBackdrop).toHaveClass('bg-transparent');
    expect(bulkBackdrop).toHaveClass('backdrop-blur-none');
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

  it('opens confirmation modal on removing single bookmark, cancels, and clears volume when confirmed', () => {
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

    renderWithClient(<BookmarksView />);

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    const deleteBtn = screen.getByLabelText(/^Remove Pride and Prejudice from reading ledger$/i);
    fireEvent.click(deleteBtn);

    // Modal dialog is open with transparent backdrop
    expect(screen.getByTestId('remove-bookmark-dialog')).toBeInTheDocument();
    const backdrop = screen.getByTestId('modal-backdrop');
    expect(backdrop).toHaveClass('bg-transparent');
    expect(backdrop).toHaveClass('backdrop-blur-none');
    expect(screen.getByText(/Remove “Pride and Prejudice” from reading ledger\?/i)).toBeInTheDocument();

    // Click Cancel
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(screen.queryByTestId('remove-bookmark-dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();

    // Open modal again and Confirm
    fireEvent.click(screen.getByLabelText(/^Remove Pride and Prejudice from reading ledger$/i));
    const confirmBtn = screen.getByRole('button', { name: /^Remove Bookmark$/i });
    fireEvent.click(confirmBtn);

    // Modal closed and volume is cleared
    expect(screen.queryByTestId('remove-bookmark-dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Pride and Prejudice')).not.toBeInTheDocument();
    expect(screen.getByText('No active reading volumes yet')).toBeInTheDocument();
  });

  it('resumes volume by pre-populating useReaderStore and navigating to reader route', () => {
    useBookshelfStore.setState({
      savedBooks: [mockBook],
      bookStatuses: { 1342: 'currently_reading' },
    });
    useReaderStore.getState().setProgress(1342, 60);

    renderWithClient(<BookmarksView />);

    const resumeBtn = screen.getByRole('button', { name: /^Resume reading Pride and Prejudice$/i });
    fireEvent.click(resumeBtn);

    expect(useReaderStore.getState().currentBook?.id).toBe(1342);
    expect(mockPush).toHaveBeenCalledWith('/read/1342');
  });

  it('passes offline status to BookmarkCard when book is saved in offline storage', () => {
    mockOfflineBookIds = [1342];
    useBookshelfStore.setState({
      savedBooks: [mockBook],
      bookStatuses: { 1342: 'currently_reading' },
    });
    useReaderStore.getState().setProgress(1342, 60);

    renderWithClient(<BookmarksView />);

    const offlineBtn = screen.getByTestId('bookmark-card-offline-toggle-btn');
    expect(offlineBtn).toBeInTheDocument();
    expect(offlineBtn).toHaveAttribute('aria-label', expect.stringMatching(/remove offline copy/i));
    expect(screen.queryByLabelText(/downloaded for offline reading\. click to remove/i)).toBeNull();
  });

  it('allows user to change status of completed volume to reading directly via dropdown', async () => {
    useBookshelfStore.setState({
      savedBooks: [mockBook],
      bookStatuses: { 1342: 'finished' },
    });
    useReaderStore.getState().setProgress(1342, 100);
    useReaderStore.getState().saveReadingPosition(1342, {
      chapterIndex: 10,
      chapterPage: 5,
      globalPage: 120,
      lastReadAt: new Date().toISOString(),
    });

    renderWithClient(<BookmarksView />);

    const statusSelect = screen.getByLabelText(/^Change reading status for Pride and Prejudice$/i);
    expect(statusSelect).toHaveValue('completed');

    await act(async () => {
      fireEvent.change(statusSelect, { target: { value: 'in_progress' } });
    });

    expect(useBookshelfStore.getState().bookStatuses[1342]).toBe('currently_reading');
    expect(useReaderStore.getState().readingProgress[1342]).toBe(0);
    expect(statusSelect).toHaveValue('in_progress');
  });

  it('prompts confirmation when selecting Finished on a volume under 100% progress, handles cancel and confirm', async () => {
    useBookshelfStore.setState({
      savedBooks: [mockBook],
      bookStatuses: { 1342: 'currently_reading' },
    });
    useReaderStore.getState().setProgress(1342, 60);
    useReaderStore.getState().saveReadingPosition(1342, {
      chapterIndex: 3,
      chapterPage: 4,
      globalPage: 45,
      lastReadAt: new Date().toISOString(),
    });

    renderWithClient(<BookmarksView />);

    const statusSelect = screen.getByLabelText(/^Change reading status for Pride and Prejudice$/i);
    expect(statusSelect).toHaveValue('in_progress');

    // Select 'completed' when progress is 60%
    await act(async () => {
      fireEvent.change(statusSelect, { target: { value: 'completed' } });
    });

    // Confirmation dialog opens with transparent backdrop
    const dialog = screen.getByTestId('finish-bookmark-dialog');
    expect(dialog).toBeInTheDocument();
    const backdrop = screen.getByTestId('modal-backdrop');
    expect(backdrop).toHaveClass('bg-transparent');
    expect(backdrop).toHaveClass('backdrop-blur-none');
    expect(within(dialog).getByText(/Mark “Pride and Prejudice” as finished\?/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/advance your recorded reading progress from/i)).toBeInTheDocument();
    expect(within(dialog).getByText('60%')).toBeInTheDocument();

    // Click Cancel
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(screen.queryByTestId('finish-bookmark-dialog')).not.toBeInTheDocument();
    expect(useBookshelfStore.getState().bookStatuses[1342]).toBe('currently_reading');
    expect(useReaderStore.getState().readingProgress[1342]).toBe(60);

    // Select 'completed' again and Confirm
    await act(async () => {
      fireEvent.change(statusSelect, { target: { value: 'completed' } });
    });
    const confirmBtn = screen.getByRole('button', { name: /^Mark as Finished$/i });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    // Modal closes, progress is 100%, and status is finished
    expect(screen.queryByTestId('finish-bookmark-dialog')).not.toBeInTheDocument();
    expect(useBookshelfStore.getState().bookStatuses[1342]).toBe('finished');
    expect(useReaderStore.getState().readingProgress[1342]).toBe(100);
  });

  it('updates status to Finished immediately without modal when volume is already at 100% progress', async () => {
    useBookshelfStore.setState({
      savedBooks: [mockBook],
      bookStatuses: { 1342: 'currently_reading' },
    });
    useReaderStore.getState().setProgress(1342, 100);

    renderWithClient(<BookmarksView />);

    const statusSelect = screen.getByLabelText(/^Change reading status for Pride and Prejudice$/i);

    await act(async () => {
      fireEvent.change(statusSelect, { target: { value: 'completed' } });
    });

    // No modal should be displayed
    expect(screen.queryByTestId('finish-bookmark-dialog')).not.toBeInTheDocument();
    expect(useBookshelfStore.getState().bookStatuses[1342]).toBe('finished');
    expect(useReaderStore.getState().readingProgress[1342]).toBe(100);
  });

  it('hydrates missing book metadata (e.g. Volume #55179) and displays real title and author', async () => {
    useReaderStore.getState().setProgress(55179, 45);
    useReaderStore.getState().saveReadingPosition(55179, {
      chapterIndex: 1,
      chapterPage: 2,
      globalPage: 8,
      lastReadAt: new Date().toISOString(),
    });

    renderWithClient(<BookmarksView />);

    // Wait for the query to resolve and hydrate the card
    await waitFor(() => {
      expect(screen.getByText('The King in Yellow')).toBeInTheDocument();
    });

    expect(screen.getByText('Robert W. Chambers')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('applies adaptive responsive label expansion and tooltip attributes to filter tabs', () => {
    useBookshelfStore.setState({
      savedBooks: [mockBook],
      bookStatuses: { 1342: 'currently_reading' },
    });
    useReaderStore.getState().setProgress(1342, 60);

    renderWithClient(<BookmarksView />);

    // By default, 'all' filter is active
    const allTab = screen.getByTestId('bookmarks-tab-all');
    const inProgressTab = screen.getByTestId('bookmarks-tab-in_progress');
    const completedTab = screen.getByTestId('bookmarks-tab-completed');
    const onHoldTab = screen.getByTestId('bookmarks-tab-on_hold');

    expect(allTab).toHaveAttribute('aria-label', expect.stringContaining('All Volumes'));
    expect(allTab).toHaveAttribute('title', expect.stringContaining('All Volumes'));
    expect(allTab).toHaveAttribute('aria-pressed', 'true');

    // Active tab label has 'inline' class, while inactive has 'hidden md:inline'
    expect(allTab.querySelector('span')).toHaveClass('inline');
    expect(inProgressTab.querySelector('span')).toHaveClass('hidden md:inline');
    expect(completedTab.querySelector('span')).toHaveClass('hidden md:inline');
    expect(onHoldTab.querySelector('span')).toHaveClass('hidden md:inline');

    // Click 'in_progress' tab -> in_progress expands, all collapses
    fireEvent.click(inProgressTab);
    expect(inProgressTab).toHaveAttribute('aria-pressed', 'true');
    expect(inProgressTab.querySelector('span')).toHaveClass('inline');
    expect(allTab.querySelector('span')).toHaveClass('hidden md:inline');
  });

  it('renders completed volume with 100% progress and Read Again action', () => {
    useBookshelfStore.setState({
      savedBooks: [mockBook],
      bookStatuses: { 1342: 'finished' },
    });
    useReaderStore.getState().setProgress(1342, 100);
    useReaderStore.getState().saveReadingPosition(1342, {
      chapterIndex: 0,
      chapterPage: 1,
      globalPage: 1,
      lastReadAt: new Date().toISOString(),
    });

    renderWithClient(<BookmarksView />);

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole('button', { name: /^Read Pride and Prejudice again from beginning$/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Read Again')).toBeInTheDocument();
  });

  it('renders sort dropdown and allows changing sort order', () => {
    useBookshelfStore.setState({
      savedBooks: [mockBook],
      bookStatuses: { 1342: 'currently_reading' },
    });
    useReaderStore.getState().setProgress(1342, 60);

    renderWithClient(<BookmarksView />);

    const sortSelect = screen.getByRole('combobox', { name: 'Sort bookmarks' });
    expect(sortSelect).toBeInTheDocument();
    expect(sortSelect).toHaveValue('recent');

    // Verify 'downloaded' option exists
    expect(screen.getByRole('option', { name: 'Downloaded' })).toBeInTheDocument();

    fireEvent.change(sortSelect, { target: { value: 'title_asc' } });
    expect(sortSelect).toHaveValue('title_asc');

    fireEvent.change(sortSelect, { target: { value: 'downloaded' } });
    expect(sortSelect).toHaveValue('downloaded');
  });

  it('renders pagination when volumes exceed 12 items and navigates between pages', () => {
    // Generate 15 mock books
    const fifteenBooks = Array.from({ length: 15 }, (_, i) => ({
      ...mockBook,
      id: 1000 + i,
      title: `Book Title ${String(i + 1).padStart(2, '0')}`,
    }));

    const positions: Record<number, any> = {};
    const progress: Record<number, number> = {};
    fifteenBooks.forEach((b, i) => {
      positions[b.id] = {
        chapterIndex: 1,
        chapterPage: 2,
        globalPage: 2,
        lastReadAt: new Date(Date.now() - i * 10000).toISOString(),
        bookTitle: b.title,
      };
      progress[b.id] = 10 + i;
    });

    useBookshelfStore.setState({
      savedBooks: fifteenBooks,
    });
    useReaderStore.setState({
      readingPositions: positions,
      readingProgress: progress,
    });

    // Mock window.scrollTo for smartScrollToContent
    const scrollToSpy = vi.fn();
    window.scrollTo = scrollToSpy;
    const scrollSpy = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollSpy;

    renderWithClient(<BookmarksView />);

    // Page 1 should show the first 12 items
    expect(screen.getByText('Book Title 01')).toBeInTheDocument();
    expect(screen.getByText('Book Title 12')).toBeInTheDocument();
    expect(screen.queryByText('Book Title 13')).not.toBeInTheDocument();

    // Top and bottom pagination should both be present
    const topPagination = screen.getByRole('navigation', { name: 'Top bookmarks pagination' });
    expect(topPagination).toBeInTheDocument();
    expect(within(topPagination).getByTestId('top-pagination-indicator')).toHaveTextContent(/1\s*\/\s*2/);

    const paginationNav = screen.getByTestId('pagination-nav');
    expect(paginationNav).toBeInTheDocument();

    // Navigate to Next page (Page 2) via top pagination
    const nextBtn = within(topPagination).getByRole('button', { name: 'Next page' });
    fireEvent.click(nextBtn);

    // Page 2 should show remaining 3 items (13, 14, 15)
    expect(screen.queryByText('Book Title 01')).not.toBeInTheDocument();
    expect(screen.getByText('Book Title 13')).toBeInTheDocument();
    expect(screen.getByText('Book Title 15')).toBeInTheDocument();

    // Verify smart scroll was triggered
    expect(scrollToSpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
  });

  it('applies tightened vertical padding on bookmarks-ledger-section', () => {
    const { container } = renderWithClient(<BookmarksView />);
    const section = container.querySelector('#bookmarks-ledger-section');
    expect(section).toHaveClass('py-6', 'sm:py-12');
  });

  it('activates bookmark card on click and clears active state when clicking outside', () => {
    useBookshelfStore.setState({
      savedBooks: [mockBook],
      bookStatuses: { 1342: 'currently_reading' },
    });
    useReaderStore.getState().setProgress(1342, 60);

    const { container } = renderWithClient(<BookmarksView />);

    const card = container.querySelector('[data-bookmark-card-id="1342"]');
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute('data-active', 'false');

    // Click the card body to activate it
    fireEvent.click(card!);
    expect(card).toHaveAttribute('data-active', 'true');

    // Tap outside the card on the document
    fireEvent.pointerDown(document.body);
    expect(card).toHaveAttribute('data-active', 'false');
  });

  it('handles mobile single-column scroll focus zone on scroll and resize', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 });
    Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 0 });

    useBookshelfStore.setState({
      savedBooks: [mockBook],
      bookStatuses: { 1342: 'currently_reading' },
    });
    useReaderStore.getState().setProgress(1342, 60);

    const { container } = renderWithClient(<BookmarksView />);
    const card = container.querySelector('[data-bookmark-card-id="1342"]') as HTMLElement;
    expect(card).toBeInTheDocument();

    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 400,
      left: 10,
      right: 365,
      width: 355,
      height: 300,
      x: 10,
      y: 100,
      toJSON: () => {},
    });

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(card).toHaveAttribute('data-active', 'true');
  });

  it('filters active volumes to only offline books when Downloaded sort option is selected', () => {
    const secondBook: GutendexBook = {
      ...mockBook,
      id: 84,
      title: 'Frankenstein',
    };

    mockOfflineBookIds = [1342];
    useBookshelfStore.setState({
      savedBooks: [mockBook, secondBook],
    });
    useReaderStore.setState({
      readingPositions: {
        1342: { chapterIndex: 1, chapterPage: 1, globalPage: 5, lastReadAt: new Date().toISOString() },
        84: { chapterIndex: 2, chapterPage: 2, globalPage: 10, lastReadAt: new Date().toISOString() },
      },
      readingProgress: { 1342: 25, 84: 50 },
    });

    renderWithClient(<BookmarksView />);

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByText('Frankenstein')).toBeInTheDocument();

    const sortSelect = screen.getByRole('combobox', { name: 'Sort bookmarks' });
    fireEvent.change(sortSelect, { target: { value: 'downloaded' } });

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.queryByText('Frankenstein')).not.toBeInTheDocument();
  });

  it('renders No downloaded volumes empty state and resets to recent when clicking View All Volumes', () => {
    mockOfflineBookIds = [];
    useBookshelfStore.setState({
      savedBooks: [mockBook],
    });
    useReaderStore.setState({
      readingPositions: {
        1342: { chapterIndex: 1, chapterPage: 1, globalPage: 5, lastReadAt: new Date().toISOString() },
      },
      readingProgress: { 1342: 25 },
    });

    renderWithClient(<BookmarksView />);

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();

    const sortSelect = screen.getByRole('combobox', { name: 'Sort bookmarks' });
    fireEvent.change(sortSelect, { target: { value: 'downloaded' } });

    expect(screen.getByText('No downloaded volumes')).toBeInTheDocument();
    expect(screen.getByText('Volumes saved for offline reading will appear here.')).toBeInTheDocument();

    const viewAllBtn = screen.getByRole('button', { name: 'View All Volumes' });
    fireEvent.click(viewAllBtn);

    expect(screen.queryByText('No downloaded volumes')).not.toBeInTheDocument();
    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
  });

  it('activates card on click and deactivates on mouseLeave on desktop viewports', () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });

    useBookshelfStore.setState({
      savedBooks: [mockBook],
    });
    useReaderStore.setState({
      readingPositions: {
        1342: { chapterIndex: 1, chapterPage: 1, globalPage: 5, lastReadAt: new Date().toISOString() },
      },
      readingProgress: { 1342: 25 },
    });

    renderWithClient(<BookmarksView />);

    const card = screen.getByRole('article');
    expect(card).toHaveAttribute('data-active', 'false');

    fireEvent.click(card);
    expect(card).toHaveAttribute('data-active', 'true');

    fireEvent.mouseLeave(card);
    expect(card).toHaveAttribute('data-active', 'false');

    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalWidth });
  });

  it('renders authentic author name for offline-saved volume on page refresh without reverting to Anonymous', () => {
    mockOfflineBookIds = [1342];
    mockOfflineBooks = [
      {
        ...mockBook,
        authors: [{ name: 'Anonymous', birth_year: null, death_year: null }],
      },
    ];

    useBookshelfStore.setState({
      savedBooks: [mockBook],
    });
    useReaderStore.setState({
      readingPositions: {
        1342: {
          chapterIndex: 1,
          chapterPage: 1,
          globalPage: 5,
          lastReadAt: new Date().toISOString(),
          bookTitle: 'Pride and Prejudice',
          bookAuthors: ['Austen, Jane'],
        },
      },
      readingProgress: { 1342: 25 },
    });

    renderWithClient(<BookmarksView />);

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByText('Jane Austen')).toBeInTheDocument();
    expect(screen.queryByText('Anonymous')).not.toBeInTheDocument();
  });

  it('handles offline download toggle, removal confirmation modal, and resume navigation', async () => {
    mockOfflineBookIds = [];
    mockDownloadBook.mockReset().mockResolvedValue(true);
    mockRemoveBook.mockReset().mockResolvedValue(undefined);

    useBookshelfStore.setState({ savedBooks: [mockBook] });
    useReaderStore.setState({
      readingProgress: { 1342: 40 },
      readingPositions: {
        1342: { chapterIndex: 1, chapterPage: 2, globalPage: 6, lastReadAt: new Date().toISOString() },
      },
    });

    const { unmount } = renderWithClient(<BookmarksView />);

    // 1. Download book offline
    const offlineBtn = screen.getByTestId('bookmark-card-offline-toggle-btn');
    await act(async () => {
      fireEvent.click(offlineBtn);
    });
    expect(mockDownloadBook).toHaveBeenCalled();

    // 2. Resume navigation
    const resumeBtn = screen.getByRole('button', { name: /Resume/i });
    fireEvent.click(resumeBtn);
    expect(mockPush).toHaveBeenCalledWith('/read/1342');

    unmount();

    // 3. Remove offline book with modal
    mockOfflineBookIds = [1342];
    renderWithClient(<BookmarksView />);
    const removeOfflineBtn = screen.getByTestId('bookmark-card-offline-toggle-btn');
    fireEvent.click(removeOfflineBtn);

    // Modal opens
    const modal = screen.getByRole('dialog');
    expect(modal).toBeInTheDocument();
    const cancelModalBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelModalBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Open again and confirm
    fireEvent.click(screen.getByTestId('bookmark-card-offline-toggle-btn'));
    const confirmRemoveBtn = screen.getByRole('button', { name: /Remove Download/i });
    await act(async () => {
      fireEvent.click(confirmRemoveBtn);
    });
    expect(mockRemoveBook).toHaveBeenCalledWith(1342);
  });

  it('paginates volumes when count exceeds page size of 12 and handles mobile scroll focus', () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 });

    const thirteenBooks: GutendexBook[] = Array.from({ length: 13 }, (_, i) => ({
      ...mockBook,
      id: 2000 + i,
      title: `Volume ${i + 1}`,
    }));

    const positions: Record<number, any> = {};
    const progress: Record<number, number> = {};
    thirteenBooks.forEach((b, idx) => {
      positions[b.id] = {
        chapterIndex: 0,
        chapterPage: 1,
        globalPage: 1,
        lastReadAt: new Date(1700000000000 - idx * 10000).toISOString(),
      };
      progress[b.id] = 10;
    });

    useBookshelfStore.setState({ savedBooks: thirteenBooks });
    useReaderStore.setState({ readingPositions: positions, readingProgress: progress });

    renderWithClient(<BookmarksView />);

    // First page shows 12 volumes
    expect(screen.getByText('Volume 1')).toBeInTheDocument();
    expect(screen.getByText('Volume 12')).toBeInTheDocument();
    expect(screen.queryByText('Volume 13')).not.toBeInTheDocument();

    // Go to page 2
    const page2Btn = screen.getByRole('button', { name: /Page 2/i });
    fireEvent.click(page2Btn);
    expect(screen.getByText('Volume 13')).toBeInTheDocument();

    // Trigger mobile scroll event
    fireEvent.scroll(window);
    fireEvent.resize(window);

    // Tap outside cards
    fireEvent.pointerDown(document.body);

    // Removing the sole item on Page 2 automatically clamps back to Page 1
    fireEvent.click(screen.getByLabelText(/^Remove Volume 13 from reading ledger$/i));
    fireEvent.click(screen.getByRole('button', { name: /^Remove Bookmark$/i }));
    expect(screen.queryByText('Volume 13')).not.toBeInTheDocument();
    expect(screen.getByText('Volume 1')).toBeInTheDocument();
    expect(screen.getByText('Volume 12')).toBeInTheDocument();

    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalWidth });
  });

  it('activates closest card in mobile viewport central focus band and bottom boundary on RAF scroll', () => {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    const originalScrollY = window.scrollY;
    const originalScrollHeight = Object.getOwnPropertyDescriptor(document.documentElement, 'scrollHeight');

    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 });
    Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 200 });
    Object.defineProperty(document.documentElement, 'scrollHeight', { writable: true, configurable: true, value: 2500 });

    const rafCallbacks: FrameRequestCallback[] = [];
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    const cafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    const secondBook: GutendexBook = { ...mockBook, id: 84, title: 'Frankenstein' };
    useBookshelfStore.setState({ savedBooks: [mockBook, secondBook] });
    useReaderStore.setState({
      readingPositions: {
        1342: { chapterIndex: 1, chapterPage: 1, globalPage: 5, lastReadAt: '2026-10-26T10:00:00Z' },
        84: { chapterIndex: 1, chapterPage: 2, globalPage: 10, lastReadAt: '2026-10-26T09:00:00Z' },
      },
      readingProgress: { 1342: 30, 84: 50 },
    });

    const { container, unmount } = renderWithClient(<BookmarksView />);
    const card1 = container.querySelector('[data-bookmark-card-id="1342"]') as HTMLElement;
    const card2 = container.querySelector('[data-bookmark-card-id="84"]') as HTMLElement;

    vi.spyOn(card1, 'getBoundingClientRect').mockReturnValue({
      top: 50,
      bottom: 200,
      left: 0,
      right: 350,
      width: 350,
      height: 150,
      x: 0,
      y: 50,
      toJSON: () => {},
    });
    vi.spyOn(card2, 'getBoundingClientRect').mockReturnValue({
      top: 280,
      bottom: 440,
      left: 0,
      right: 350,
      width: 350,
      height: 160,
      x: 0,
      y: 280,
      toJSON: () => {},
    });

    // Fire two consecutive scroll events to trigger cancelAnimationFrame on pending rafId, then flush RAF
    act(() => {
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('scroll'));
      const latest = rafCallbacks[rafCallbacks.length - 1];
      if (latest) latest(16);
    });

    expect(cafSpy).toHaveBeenCalled();
    // Target Y is 800 * 0.45 = 360 -> card2 center is 360, so card2 is activated
    expect(card2).toHaveAttribute('data-active', 'true');

    // Now scroll to bottom boundary (innerHeight 800 + scrollY 1700 >= scrollHeight 2500 - 32)
    Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: 1700 });
    act(() => {
      window.dispatchEvent(new Event('scroll'));
      const latest = rafCallbacks[rafCallbacks.length - 1];
      if (latest) latest(32);
    });
    expect(card2).toHaveAttribute('data-active', 'true');

    unmount();
    rafSpy.mockRestore();
    cafSpy.mockRestore();
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalWidth });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: originalHeight });
    Object.defineProperty(window, 'scrollY', { writable: true, configurable: true, value: originalScrollY });
    if (originalScrollHeight) {
      Object.defineProperty(document.documentElement, 'scrollHeight', originalScrollHeight);
    }
  });

  it('renders empty search feedback and empty filter state with Clear Search / View All actions', () => {
    useBookshelfStore.setState({
      savedBooks: [mockBook],
      bookStatuses: { 1342: 'currently_reading' },
    });
    useReaderStore.setState({
      readingPositions: {
        1342: { chapterIndex: 1, chapterPage: 1, globalPage: 5, lastReadAt: new Date().toISOString() },
      },
      readingProgress: { 1342: 25 },
    });

    renderWithClient(<BookmarksView />);

    // Switch to 'on_hold' tab (0 items)
    fireEvent.click(screen.getByTestId('bookmarks-tab-on_hold'));
    expect(screen.getByText(/No volumes marked as on hold/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View All Volumes' }));
    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();

    // Search for a non-matching query
    const searchInput = screen.getByRole('textbox', { name: 'Search bookmarks' });
    fireEvent.change(searchInput, { target: { value: 'UnmatchedQueryXYZ' } });
    expect(screen.getByText('No bookmarks matching "UnmatchedQueryXYZ"')).toBeInTheDocument();

    // Clear search via empty state button
    fireEvent.click(screen.getByRole('button', { name: 'Clear Search' }));
    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
  });
});


