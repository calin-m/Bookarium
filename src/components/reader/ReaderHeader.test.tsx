import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ReaderHeader } from './ReaderHeader';

describe('ReaderHeader', () => {
  const defaultProps = {
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    bookId: 1342,
    progress: 45,
    onBack: vi.fn(),
    isTocOpen: false,
    onToggleToc: vi.fn(),
    isControlsOpen: false,
    onToggleControls: vi.fn(),
    totalChapters: 61,
    currentChapterIndex: 5,
    theme: 'sepia' as const,
    fontSize: 18,
    onFontSizeChange: vi.fn(),
    readingMode: 'paginated' as const,
    onReadingModeChange: vi.fn(),
    onThemeChange: vi.fn(),
  };

  it('renders book title, author, and progress metrics correctly', () => {
    render(<ReaderHeader {...defaultProps} />);

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByText('Jane Austen')).toBeInTheDocument();
    expect(screen.getByText('45% Volume Progress')).toBeInTheDocument();
    expect(screen.getByText('Section 6 of 61')).toBeInTheDocument();
  });

  it('triggers onBack when back button is clicked', () => {
    const onBack = vi.fn();
    render(<ReaderHeader {...defaultProps} onBack={onBack} />);

    fireEvent.click(screen.getByLabelText('Back to Catalog'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('triggers onToggleToc and onToggleControls when respective buttons are clicked', () => {
    const onToggleToc = vi.fn();
    const onToggleControls = vi.fn();

    render(
      <ReaderHeader
        {...defaultProps}
        onToggleToc={onToggleToc}
        onToggleControls={onToggleControls}
      />
    );

    fireEvent.click(screen.getByLabelText('Table of Contents'));
    expect(onToggleToc).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Typography & Theme Controls'));
    expect(onToggleControls).toHaveBeenCalledTimes(1);
  });

  it('triggers quick desktop controls for font size, line height, theme, and reading mode', () => {
    const onFontSizeChange = vi.fn();
    const onLineHeightChange = vi.fn();
    const onThemeChange = vi.fn();
    const onReadingModeChange = vi.fn();

    render(
      <ReaderHeader
        {...defaultProps}
        fontSize={18}
        onFontSizeChange={onFontSizeChange}
        lineHeight={1.4}
        onLineHeightChange={onLineHeightChange}
        onThemeChange={onThemeChange}
        onReadingModeChange={onReadingModeChange}
      />
    );

    fireEvent.click(screen.getByLabelText('Increase Font Size'));
    expect(onFontSizeChange).toHaveBeenCalledWith(20);

    fireEvent.click(screen.getByLabelText('Decrease Font Size'));
    expect(onFontSizeChange).toHaveBeenCalledWith(16);

    fireEvent.click(screen.getByLabelText('Toggle Line Spacing Preset'));
    expect(onLineHeightChange).toHaveBeenCalledWith(1.8);

    fireEvent.click(screen.getByLabelText('Dark Theme'));
    expect(onThemeChange).toHaveBeenCalledWith('dark');

    fireEvent.click(screen.getByLabelText('Light Theme'));
    expect(onThemeChange).toHaveBeenCalledWith('light');

    fireEvent.click(screen.getByText('Scroll'));
    expect(onReadingModeChange).toHaveBeenCalledWith('scroll');
  });
});
