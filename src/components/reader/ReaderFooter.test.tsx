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
    isPrevDisabled: false,
    isNextDisabled: false,
    readingMode: 'paginated' as const,
  };

  it('renders global volume pagination and chapter title', () => {
    render(<ReaderFooter {...defaultProps} />);

    expect(screen.getByText('Chapter 5')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('901')).toBeInTheDocument();
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

  it('renders continuous flow indicator when in scroll mode', () => {
    render(
      <ReaderFooter
        {...defaultProps}
        readingMode="scroll"
      />
    );

    expect(screen.getByText('Continuous Flow Mode')).toBeInTheDocument();
    expect(screen.queryByLabelText('Previous Page')).not.toBeInTheDocument();
  });
});

