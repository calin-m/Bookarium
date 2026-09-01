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
    onThemeChange: vi.fn(),
  };

  it('renders book title, author, and progress metrics correctly', () => {
    render(<ReaderHeader {...defaultProps} />);

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByText('Jane Austen')).toBeInTheDocument();
    expect(screen.getByText(/Section 6\/61/i)).toBeInTheDocument();
    expect(screen.getByText(/45% Progress/i)).toBeInTheDocument();
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

  it('triggers right-side theme controls for light, sepia, and dark', () => {
    const onThemeChange = vi.fn();

    render(
      <ReaderHeader
        {...defaultProps}
        onThemeChange={onThemeChange}
      />
    );

    fireEvent.click(screen.getByLabelText('Dark Theme'));
    expect(onThemeChange).toHaveBeenCalledWith('dark');

    fireEvent.click(screen.getByLabelText('Light Theme'));
    expect(onThemeChange).toHaveBeenCalledWith('light');

    fireEvent.click(screen.getByLabelText('Sepia Theme'));
    expect(onThemeChange).toHaveBeenCalledWith('sepia');
  });

  it('opens and closes the Gutenberg Archive volume info modal', () => {
    render(<ReaderHeader {...defaultProps} />);

    // Default: Literary title and author visible
    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByText('Jane Austen')).toBeInTheDocument();

    const infoBtn = screen.getByLabelText(/View Gutenberg Archive Volume Info/i);
    fireEvent.click(infoBtn);

    // Modal opens with detailed metadata
    expect(screen.getByText('Public Domain Masterwork')).toBeInTheDocument();
    expect(screen.getByText('View on Gutenberg.org')).toBeInTheDocument();

    // Close modal via close button
    const closeBtn = screen.getByLabelText('Close Information Modal');
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Public Domain Masterwork')).not.toBeInTheDocument();
  });

  it('sanitizes and renders extra long titles and multiline strings gracefully', () => {
    const longTitle = 'The German Classics of the Nineteenth and Twentieth Centuries,\r\nMasterpieces of German Literature Translated into English. in Twenty Volumes, Volume 01';
    const longAuthor = 'Kuno Francke\r\nand William Guild Howard';

    render(
      <ReaderHeader
        {...defaultProps}
        title={longTitle}
        author={longAuthor}
        bookId={59828}
      />
    );

    const expectedCleanTitle = 'The German Classics of the Nineteenth and Twentieth Centuries, Masterpieces of German Literature Translated into English. in Twenty Volumes, Volume 01';
    const expectedCleanAuthor = 'Kuno Francke and William Guild Howard';

    expect(screen.getByText(expectedCleanTitle)).toBeInTheDocument();
    expect(screen.getByText(expectedCleanAuthor)).toBeInTheDocument();
  });

  it('filters out placeholder author strings and falls back to featured fixture', () => {
    render(
      <ReaderHeader
        {...defaultProps}
        author="Classic Masterwork"
        bookId={64317}
      />
    );

    expect(screen.getByText('F. Scott Fitzgerald')).toBeInTheDocument();
    expect(screen.queryByText('Classic Masterwork')).not.toBeInTheDocument();
  });
});
