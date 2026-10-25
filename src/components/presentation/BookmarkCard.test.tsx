import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { BookmarkCard } from './BookmarkCard';
import type { ActiveReadingVolume } from '@/types/book.types';
import { useReaderStore } from '@/stores/useReaderStore';
import { useJurisdictionStore } from '@/stores/useJurisdictionStore';

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
    useJurisdictionStore.setState({ country: 'US', overrideCountry: null });
  });

  it('renders book metadata, formatted author names, progress bar, and reading coordinates', () => {
    render(<BookmarkCard volume={mockVolume} />);

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    // 'Austen, Jane' is formatted to 'Jane Austen' via formatAuthorNames
    expect(screen.getByText('Jane Austen')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText(/Chapter 3 • Page 48/i)).toBeInTheDocument();

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

  it('does not trigger onResume on cover thumbnail or title click, preserving clicks for card activation', () => {
    const handleResume = vi.fn();
    const handleActivate = vi.fn();
    render(<BookmarkCard volume={mockVolume} onResume={handleResume} onActivate={handleActivate} />);

    const cover = screen.getByTestId('bookmark-card-cover');
    fireEvent.click(cover);
    expect(handleResume).not.toHaveBeenCalled();
    expect(handleActivate).toHaveBeenCalledWith(1342);

    const title = screen.getByText('Pride and Prejudice');
    fireEvent.click(title);
    expect(handleResume).not.toHaveBeenCalled();
  });

  it('falls back to router.push when onResume is not provided', () => {
    render(<BookmarkCard volume={mockVolume} />);

    const resumeBtn = screen.getByRole('button', { name: /^Resume reading Pride and Prejudice$/i });
    fireEvent.click(resumeBtn);

    expect(mockPush).toHaveBeenCalledWith('/read/1342');
    expect(useReaderStore.getState().currentBook?.id).toBe(1342);
  });

  it('does not render redundant top offline badge and keeps top meta row focused on reading status', () => {
    const handleToggleOffline = vi.fn();
    render(
      <BookmarkCard
        volume={mockVolume}
        isOffline={true}
        onToggleOffline={handleToggleOffline}
      />
    );
    expect(screen.queryByTestId(`bookmark-card-offline-badge-${mockVolume.book.id}`)).not.toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('applies active styling, highlights title, and triggers onActivate on card click', () => {
    const handleActivate = vi.fn();
    const { rerender } = render(
      <BookmarkCard
        volume={mockVolume}
        isActive={false}
        onActivate={handleActivate}
      />
    );

    const article = screen.getByRole('article', { name: /Reading ledger entry for Pride and Prejudice/i });
    expect(article).toHaveAttribute('data-active', 'false');
    expect(article).toHaveClass('border-border');

    fireEvent.click(article);
    expect(handleActivate).toHaveBeenCalledWith(1342);

    rerender(
      <BookmarkCard
        volume={mockVolume}
        isActive={true}
        onActivate={handleActivate}
      />
    );
    expect(article).toHaveAttribute('data-active', 'true');
    expect(article).toHaveClass('border-primary/50', 'ring-2', 'ring-primary/50');

    const titleHeading = screen.getByRole('heading', { level: 3, name: 'Pride and Prejudice' });
    const titleSpan = titleHeading.querySelector('span');
    expect(titleSpan).toHaveClass('text-primary');
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

    const cover = screen.getByTestId('bookmark-card-cover');
    expect(within(cover).getByText('Pride and Prejudice')).toBeInTheDocument();
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

  it('renders Start and global page coordinate when chapterIndex is 0', () => {
    const startVolume: ActiveReadingVolume = {
      ...mockVolume,
      chapterIndex: 0,
      chapterPage: 1,
      globalPage: 1,
    };
    render(<BookmarkCard volume={startVolume} />);
    expect(screen.getByText(/Start • Page 1/i)).toBeInTheDocument();
  });

  it('renders "Read Again" button with RotateCcw icon and accessible label when status is completed', () => {
    const completedVolume: ActiveReadingVolume = {
      ...mockVolume,
      status: 'completed',
      progressPercent: 100,
    };
    render(<BookmarkCard volume={completedVolume} />);

    expect(
      screen.getByRole('button', { name: /^Read Pride and Prejudice again from beginning$/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Read Again')).toBeInTheDocument();
  });

  it('renders Protected badge and disabled Restricted button when book is restricted under jurisdiction', () => {
    // Agatha Christie (died 1976), restricted in Romania (Life + 70 until 2047)
    useJurisdictionStore.setState({ country: 'RO', overrideCountry: 'RO' });

    const restrictedVolume: ActiveReadingVolume = {
      ...mockVolume,
      book: {
        ...mockVolume.book,
        id: 99999,
        title: 'The Mysterious Affair at Styles',
        authors: ['Christie, Agatha, 1890-1976'],
      },
    };

    const handleResume = vi.fn();
    render(<BookmarkCard volume={restrictedVolume} onResume={handleResume} />);

    expect(screen.getByText('Protected (RO)')).toBeInTheDocument();
    const restrictedBtn = screen.getByRole('button', {
      name: /Reading restricted for The Mysterious Affair at Styles in RO/i,
    });
    expect(restrictedBtn).toBeInTheDocument();
    expect(restrictedBtn).toBeDisabled();

    // Clicking restricted button or cover does not trigger resume
    fireEvent.click(restrictedBtn);
    expect(handleResume).not.toHaveBeenCalled();

    const cover = screen.getByTestId('bookmark-card-cover');
    fireEvent.click(cover);
    expect(handleResume).not.toHaveBeenCalled();

    // Title is rendered as non-navigable text, not active link
    expect(screen.queryByRole('link', { name: 'The Mysterious Affair at Styles' })).not.toBeInTheDocument();
  });

  it('opens SymposiumInviteModal pre-populated with the volume when Invite Fellow to Symposium button is clicked', () => {
    render(<BookmarkCard volume={mockVolume} />);

    const symposiumBtn = screen.getByTestId('bookmark-card-invite-symposium-btn');
    expect(symposiumBtn).toBeInTheDocument();
    fireEvent.click(symposiumBtn);

    expect(screen.getByTestId('symposium-invite-modal')).toBeInTheDocument();
    expect(screen.getByText('Symposium Volume')).toBeInTheDocument();
  });

  it('renders interactive offline toggle button and handles save, remove, and downloading states', () => {
    const handleToggleOffline = vi.fn();

    const { rerender } = render(
      <BookmarkCard
        volume={mockVolume}
        isOffline={false}
        isDownloadingOffline={false}
        onToggleOffline={handleToggleOffline}
      />
    );

    const toggleBtn = screen.getByTestId('bookmark-card-offline-toggle-btn');
    expect(toggleBtn).toHaveAttribute('aria-label', `Save ${mockVolume.book.title} for offline reading`);
    expect(toggleBtn).toHaveClass('hover:border-emerald-500/40', 'hover:text-emerald-600');
    fireEvent.click(toggleBtn);
    expect(handleToggleOffline).toHaveBeenCalledWith(mockVolume.book);

    rerender(
      <BookmarkCard
        volume={mockVolume}
        isOffline={false}
        isDownloadingOffline={true}
        onToggleOffline={handleToggleOffline}
      />
    );
    expect(screen.getByTestId('bookmark-card-offline-toggle-btn')).toBeDisabled();
    expect(screen.getByTestId('bookmark-card-offline-toggle-btn')).toHaveAttribute(
      'aria-label',
      `Downloading ${mockVolume.book.title} for offline reading`
    );

    rerender(
      <BookmarkCard
        volume={mockVolume}
        isOffline={true}
        isDownloadingOffline={false}
        onToggleOffline={handleToggleOffline}
      />
    );
    const offlineReadyBtn = screen.getByTestId('bookmark-card-offline-toggle-btn');
    expect(offlineReadyBtn).toHaveAttribute(
      'aria-label',
      `Remove offline copy of ${mockVolume.book.title}`
    );
    expect(offlineReadyBtn).toHaveClass('border-emerald-500/40', 'text-emerald-600');
    expect(offlineReadyBtn).toHaveClass('hover:border-destructive/60', 'hover:text-destructive');
  });

  it('renders authentic notched bookmark ribbon marker matching reading status and hover interaction', () => {
    const { rerender } = render(<BookmarkCard volume={mockVolume} />);

    const ribbon = screen.getByTestId('bookmark-card-ribbon');
    expect(ribbon).toBeInTheDocument();
    expect(ribbon).toHaveClass('w-4', 'h-7', 'text-primary', 'origin-top', 'group-hover:scale-y-110', 'pointer-events-none');
    expect(ribbon.querySelector('path')).toHaveAttribute('d', 'M0 0 H16 V28 L8 22 L0 28 Z');

    // Completed status -> emerald ribbon
    rerender(<BookmarkCard volume={{ ...mockVolume, status: 'completed' }} />);
    expect(screen.getByTestId('bookmark-card-ribbon')).toHaveClass('text-emerald-500');

    // On hold status -> amber ribbon
    rerender(<BookmarkCard volume={{ ...mockVolume, status: 'on_hold' }} />);
    expect(screen.getByTestId('bookmark-card-ribbon')).toHaveClass('text-amber-500');
  });

  it('triggers onActivate on click, and onDeactivate on mouseLeave on desktop and on blur', () => {
    const handleActivate = vi.fn();
    const handleDeactivate = vi.fn();
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });

    render(
      <BookmarkCard
        volume={mockVolume}
        isActive={true}
        onActivate={handleActivate}
        onDeactivate={handleDeactivate}
      />
    );

    const card = screen.getByRole('article');
    expect(card).toHaveAttribute('data-active', 'true');

    fireEvent.click(card);
    expect(handleActivate).toHaveBeenCalledWith(1342);

    fireEvent.mouseLeave(card);
    expect(handleDeactivate).toHaveBeenCalledWith(1342);

    fireEvent.blur(card);
    expect(handleDeactivate).toHaveBeenCalledTimes(2);

    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalWidth });
  });

  it('displays exact bookmarked line coordinate when bookmarkRow is greater than 0', () => {
    render(<BookmarkCard volume={{ ...mockVolume, bookmarkRow: 8 }} />);
    expect(screen.getByText(/Chapter 3 • Page 48 • Line 9/i)).toBeInTheDocument();
  });
});

