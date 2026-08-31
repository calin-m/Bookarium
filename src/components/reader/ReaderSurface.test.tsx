import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ReaderSurface } from './ReaderSurface';

describe('ReaderSurface', () => {
  const sampleChapter = {
    id: 1,
    title: 'Chapter 1: Loomings',
    displayTitle: 'Chapter 1: Loomings',
    content: 'Call me Ishmael. Some years ago...',
    startPageNumber: 1,
    pageCount: 3,
  };

  const defaultProps = {
    theme: 'light' as const,
    fontFamily: 'serif' as const,
    fontSize: 18,
    lineHeight: 1.75,
    columnWidth: 'normal' as const,
    readingMode: 'paginated' as const,
    chapter: sampleChapter,
    currentPageText: 'Call me Ishmael. Some years ago...',
    activeChapterIndex: 0,
    totalChapters: 5,
    isLoading: false,
    isError: false,
    onRetry: vi.fn(),
  };

  it('renders archival frontispiece banner on opening section and standard chapter banner on subsequent sections', () => {
    const { rerender } = render(
      <ReaderSurface
        {...defaultProps}
        activeChapterIndex={0}
        bookTitle="Moby Dick"
        bookAuthor="Herman Melville"
      />
    );

    expect(screen.getByText('Moby Dick')).toBeInTheDocument();
    expect(screen.getByText('by Herman Melville')).toBeInTheDocument();
    expect(screen.getByText(/Project Gutenberg Public Domain Edition/i)).toBeInTheDocument();

    // Rerender as Section 2 (Chapter 2)
    rerender(
      <ReaderSurface
        {...defaultProps}
        activeChapterIndex={1}
        chapter={{
          id: 2,
          title: 'Chapter 2: The Carpet-Bag',
          displayTitle: 'Chapter 2: The Carpet-Bag',
          content: 'I stuffed a shirt or two into my old carpet-bag...',
          startPageNumber: 4,
          pageCount: 2,
        }}
      />
    );

    expect(screen.getByText('Chapter 2: The Carpet-Bag')).toBeInTheDocument();
    expect(screen.getByText('Section 2 of 5')).toBeInTheDocument();
  });

  it('applies dynamic fontSize and lineHeight directly to the content body', () => {
    const { rerender } = render(<ReaderSurface {...defaultProps} fontSize={22} lineHeight={2.2} />);

    const contentBody = screen.getByTestId('reader-content-body');
    expect(contentBody).toHaveStyle({
      fontSize: '22px',
      lineHeight: '2.2',
    });

    rerender(<ReaderSurface {...defaultProps} fontSize={14} lineHeight={1.4} />);
    expect(contentBody).toHaveStyle({
      fontSize: '14px',
      lineHeight: '1.4',
    });
  });

  it('renders loading spinner and status message when isLoading is true', () => {
    render(<ReaderSurface {...defaultProps} isLoading={true} />);

    expect(
      screen.getByText(/Fetching Masterwork from Project Gutenberg Mirror/i)
    ).toBeInTheDocument();
  });

  it('renders error alert with retry button when isError is true', () => {
    const onRetry = vi.fn();
    render(<ReaderSurface {...defaultProps} isError={true} onRetry={onRetry} />);

    expect(screen.getByText(/Unable to Load Masterwork Text/i)).toBeInTheDocument();

    const retryBtn = screen.getByText('Retry Connection');
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('applies correct surface theme classes for Sepia and Dark themes', () => {
    const { rerender } = render(<ReaderSurface {...defaultProps} theme="sepia" />);
    expect(screen.getByRole('main')).toHaveClass('reader-surface-sepia');

    rerender(<ReaderSurface {...defaultProps} theme="dark" />);
    expect(screen.getByRole('main')).toHaveClass('reader-surface-dark');
  });
});
