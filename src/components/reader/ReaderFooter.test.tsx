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

    expect(screen.getAllByText('Chapter 5').length).toBeGreaterThanOrEqual(1);
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

  it('renders mobile quick tools and dispatches drawer and theme actions', () => {
    const onToggleToc = vi.fn();
    const onToggleSearch = vi.fn();
    const onToggleSpeech = vi.fn();
    const onToggleAnnotations = vi.fn();
    const onToggleControls = vi.fn();
    const onToggleTranslations = vi.fn();
    const onThemeChange = vi.fn();

    render(
      <ReaderFooter
        {...defaultProps}
        onToggleToc={onToggleToc}
        onToggleSearch={onToggleSearch}
        onToggleSpeech={onToggleSpeech}
        onToggleAnnotations={onToggleAnnotations}
        onToggleControls={onToggleControls}
        onToggleTranslations={onToggleTranslations}
        onThemeChange={onThemeChange}
      />
    );

    // Chapter title TOC trigger
    const tocTrigger = screen.getByTestId('footer-toc-trigger');
    fireEvent.click(tocTrigger);
    expect(onToggleToc).toHaveBeenCalledTimes(1);

    // Search button
    fireEvent.click(screen.getByLabelText('Search in Book'));
    expect(onToggleSearch).toHaveBeenCalledTimes(1);

    // Speech button
    fireEvent.click(screen.getByLabelText('Read Aloud Narration'));
    expect(onToggleSpeech).toHaveBeenCalledTimes(1);

    // Notes button
    fireEvent.click(screen.getByLabelText('Notes & Highlights'));
    expect(onToggleAnnotations).toHaveBeenCalledTimes(1);

    // Controls button
    fireEvent.click(screen.getByLabelText('Typography & Theme Controls'));
    expect(onToggleControls).toHaveBeenCalledTimes(1);

    // Translations button
    fireEvent.click(screen.getByLabelText('Language Editions & Translations'));
    expect(onToggleTranslations).toHaveBeenCalledTimes(1);

    // Theme cycle button (sepia -> dark)
    fireEvent.click(screen.getByLabelText('Current theme: sepia. Click to switch theme.'));
    expect(onThemeChange).toHaveBeenCalledWith('dark');
  });

  it('renders Prev and Next buttons with visible labels and accessible touch target classes', () => {
    render(<ReaderFooter {...defaultProps} />);

    const prevBtn = screen.getByLabelText('Previous Page');
    expect(prevBtn).toHaveTextContent('Prev');
    expect(prevBtn.className).toContain('min-h-[42px]');

    const nextBtn = screen.getByLabelText('Next Page');
    expect(nextBtn).toHaveTextContent('Next');
    expect(nextBtn.className).toContain('min-h-[42px]');
  });
});
