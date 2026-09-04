import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BookmarkCard } from './BookmarkCard';
import type { ActiveReadingVolume } from '@/types/book.types';
import { useReaderStore } from '@/stores/useReaderStore';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockVolume: ActiveReadingVolume = {
  book: {
    id: 1342,
    title: 'Pride and Prejudice',
    authors: ['Austen, Jane'],
    subjects: ['Fiction'],
    languages: ['en'],
    coverUrl: 'https://example.com/cover.jpg',
    epubUrl: null,
    htmlUrl: null,
    txtUrl: null,
    downloadCount: 4000,
  },
  progressPercent: 45,
  lastReadAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
  chapterIndex: 3,
  chapterPage: 12,
  globalPage: 48,
  status: 'in_progress',
  bookmarksCount: 1,
};

describe('BookmarkCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReaderStore.setState({ currentBook: null });
  });

  it('renders book metadata, formatted author names, progress bar, and reading coordinates', () => {
    render(<BookmarkCard volume={mockVolume} />);

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    // 'Austen, Jane' is formatted to 'Jane Austen' via formatAuthorNames
    expect(screen.getByText('Jane Austen')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText(/Chapter 4 • Page 12/i)).toBeInTheDocument();

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '45');
    expect(progressBar).toHaveAttribute('aria-label', 'Pride and Prejudice reading progress');
  });

  it('triggers onResume callback and warms reader store when Resume button is clicked', () => {
    const handleResume = vi.fn();
    render(<BookmarkCard volume={mockVolume} onResume={handleResume} />);

    const resumeBtn = screen.getByRole('button', { name: /^Resume reading Pride and Prejudice$/i });
    fireEvent.click(resumeBtn);

    expect(handleResume).toHaveBeenCalledWith(1342);
    expect(useReaderStore.getState().currentBook?.id).toBe(1342);
  });

  it('triggers onResume and warms reader store when cover thumbnail is clicked or activated via keyboard', () => {
    const handleResume = vi.fn();
    render(<BookmarkCard volume={mockVolume} onResume={handleResume} />);

    const coverBtn = screen.getByRole('button', { name: /Resume reading Pride and Prejudice \(cover\)/i });
    fireEvent.click(coverBtn);
    expect(handleResume).toHaveBeenCalledTimes(1);
    expect(useReaderStore.getState().currentBook?.id).toBe(1342);

    // Keyboard navigation (Enter and Space)
    fireEvent.keyDown(coverBtn, { key: 'Enter' });
    expect(handleResume).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(coverBtn, { key: ' ' });
    expect(handleResume).toHaveBeenCalledTimes(3);
  });

  it('falls back to router.push when onResume is not provided', () => {
    render(<BookmarkCard volume={mockVolume} />);

    const resumeBtn = screen.getByRole('button', { name: /^Resume reading Pride and Prejudice$/i });
    fireEvent.click(resumeBtn);

    expect(mockPush).toHaveBeenCalledWith('/read/1342');
    expect(useReaderStore.getState().currentBook?.id).toBe(1342);
  });

  it('renders offline badge when isOffline is true', () => {
    const { rerender } = render(<BookmarkCard volume={mockVolume} isOffline={false} />);
    expect(screen.queryByLabelText('Available offline')).not.toBeInTheDocument();

    rerender(<BookmarkCard volume={mockVolume} isOffline={true} />);
    expect(screen.getByLabelText('Available offline')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('handles status changes from harmonized select dropdown', () => {
    const handleStatusChange = vi.fn();
    render(<BookmarkCard volume={mockVolume} onStatusChange={handleStatusChange} />);

    const select = screen.getByLabelText(/Change reading status for Pride and Prejudice/i);
    expect(screen.getByRole('option', { name: 'Reading' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Finished' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'On Hold' })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'completed' } });
    expect(handleStatusChange).toHaveBeenCalledWith(1342, 'completed');
  });

  it('triggers onClear when delete action is clicked', () => {
    const handleClear = vi.fn();
    render(<BookmarkCard volume={mockVolume} onClear={handleClear} />);

    const deleteBtn = screen.getByLabelText(/Remove Pride and Prejudice from reading ledger/i);
    fireEvent.click(deleteBtn);

    expect(handleClear).toHaveBeenCalledWith(1342);
  });

  it('renders fallback state when cover image triggers onError', () => {
    render(<BookmarkCard volume={mockVolume} />);
    const img = screen.getByAltText('Cover of Pride and Prejudice');
    fireEvent.error(img);

    expect(screen.getByText('Pride and Prejudice', { selector: 'span' })).toBeInTheDocument();
  });

  it('applies solid border and canonical booksaw shadow styling', () => {
    render(<BookmarkCard volume={mockVolume} />);
    const article = screen.getByRole('article', { name: /Reading ledger entry for Pride and Prejudice/i });
    expect(article).toHaveClass('border', 'border-border', 'shadow-booksaw');
  });

  it('rounds floating-point progress to the nearest integer and applies rounded-full pill styling', () => {
    const unroundedVolume: ActiveReadingVolume = {
      ...mockVolume,
      progressPercent: 0.5780346820809248,
    };
    render(<BookmarkCard volume={unroundedVolume} />);

    expect(screen.getByText('1%')).toBeInTheDocument();
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '1');

    const badge = screen.getByText('In Progress').parentElement;
    expect(badge).toHaveClass('rounded-full', 'border-border');
  });

  it('displays relative time formatted via canonical formatRelativeTime', () => {
    render(<BookmarkCard volume={mockVolume} />);
    expect(screen.getByText('30m ago')).toBeInTheDocument();
  });
});

