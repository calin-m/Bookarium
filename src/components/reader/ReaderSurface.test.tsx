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

  it('renders chapter heading and page content', () => {
    render(<ReaderSurface {...defaultProps} />);

    expect(screen.getByText('Chapter 1: Loomings')).toBeInTheDocument();
    expect(screen.getByText('Call me Ishmael. Some years ago...')).toBeInTheDocument();
    expect(screen.getByText('Section 1 of 5')).toBeInTheDocument();
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

