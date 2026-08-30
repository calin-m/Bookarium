import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ReaderFooter } from './ReaderFooter';

describe('ReaderFooter', () => {
  const defaultProps = {
    globalPage: 18,
    totalBookPages: 901,
    chapterTitle: 'Chapter 5',
    chapterPage: 2,
    chapterPageCount: 4,
    onPrevPage: vi.fn(),
    onNextPage: vi.fn(),
    onPageJump: vi.fn(),
    isPrevDisabled: false,
    isNextDisabled: false,
    readingMode: 'paginated' as const,
    theme: 'sepia' as const,
  };

  it('renders global volume pagination and chapter title', () => {
    render(<ReaderFooter {...defaultProps} />);

    expect(screen.getByText('Chapter 5')).toBeInTheDocument();
    const input = screen.getByLabelText('Current Page Number');
    expect(input).toHaveValue(18);
    expect(input).toHaveAttribute('aria-valuemin', '1');
    expect(input).toHaveAttribute('aria-valuemax', '901');
    expect(input).toHaveAttribute('aria-valuenow', '18');
    expect(screen.getByText('of 901')).toBeInTheDocument();
  });

  it('triggers onPrevPage and onNextPage callbacks when buttons are clicked', () => {
    const onPrevPage = vi.fn();
    const onNextPage = vi.fn();

    render(
      <ReaderFooter
        {...defaultProps}
        onPrevPage={onPrevPage}
        onNextPage={onNextPage}
      />
    );

    fireEvent.click(screen.getByLabelText('Previous Page'));
    expect(onPrevPage).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Next Page'));
    expect(onNextPage).toHaveBeenCalledTimes(1);
  });

  it('handles page jump input changes', () => {
    const onPageJump = vi.fn();
    render(<ReaderFooter {...defaultProps} onPageJump={onPageJump} />);

    const input = screen.getByLabelText('Current Page Number');
    fireEvent.change(input, { target: { value: '42' } });
    expect(onPageJump).toHaveBeenCalledWith(42);
  });

  it('disables previous and next buttons when boundary disabled flags are set', () => {
    render(
      <ReaderFooter
        {...defaultProps}
        isPrevDisabled={true}
        isNextDisabled={true}
      />
    );

    expect(screen.getByLabelText('Previous Page')).toBeDisabled();
    expect(screen.getByLabelText('Next Page')).toBeDisabled();
  });

  it('renders continuous flow indicator and chapter navigation when in scroll mode', () => {
    const onSelectChapter = vi.fn();
    render(
      <ReaderFooter
        {...defaultProps}
        readingMode="scroll"
        currentChapterIndex={2}
        totalChapters={10}
        onSelectChapter={onSelectChapter}
      />
    );

    expect(screen.getByText('Chapter 3 of 10')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Previous Chapter'));
    expect(onSelectChapter).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByLabelText('Next Chapter'));
    expect(onSelectChapter).toHaveBeenCalledWith(3);
  });
});
