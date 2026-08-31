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
    expect(screen.getByText(/Section 6 of 61/i)).toBeInTheDocument();
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

  it('toggles metadata view between literary title/author and Gutenberg volume info', () => {
    render(<ReaderHeader {...defaultProps} />);

    // Default: Literary title and author
    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByText('Jane Austen')).toBeInTheDocument();

    const toggleBtn = screen.getByLabelText(/Switch to Gutenberg Archive Volume Info/i);
    fireEvent.click(toggleBtn);

    // Toggled: Gutenberg Volume metadata
    expect(screen.getByText('Gutenberg Volume #1342')).toBeInTheDocument();
    expect(screen.getByText('Project Gutenberg Public Domain Archive')).toBeInTheDocument();

    // Toggle back
    const toggleBackBtn = screen.getByLabelText(/Switch to Literary Title & Author/i);
    fireEvent.click(toggleBackBtn);

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByText('Jane Austen')).toBeInTheDocument();
  });
});
