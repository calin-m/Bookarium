import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BookmarkCard } from './BookmarkCard';
import type { ActiveReadingVolume } from '@/types/book.types';

const mockVolume: ActiveReadingVolume = {
  book: {
    id: 1342,
    title: 'Pride and Prejudice',
    authors: ['Jane Austen'],
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
  it('renders book metadata, progress bar, and reading coordinates', () => {
    render(<BookmarkCard volume={mockVolume} />);

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByText('Jane Austen')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText(/Chapter 4 • Page 12/i)).toBeInTheDocument();

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '45');
    expect(progressBar).toHaveAttribute('aria-label', 'Pride and Prejudice reading progress');
  });

  it('triggers onResume callback when Resume button is clicked', () => {
    const handleResume = vi.fn();
    render(<BookmarkCard volume={mockVolume} onResume={handleResume} />);

    const resumeBtn = screen.getByRole('button', { name: /Resume reading Pride and Prejudice/i });
    fireEvent.click(resumeBtn);

    expect(handleResume).toHaveBeenCalledWith(1342);
  });

  it('handles status changes from select dropdown', () => {
    const handleStatusChange = vi.fn();
    render(<BookmarkCard volume={mockVolume} onStatusChange={handleStatusChange} />);

    const select = screen.getByLabelText(/Change reading status for Pride and Prejudice/i);
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
});

