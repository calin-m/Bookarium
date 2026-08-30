import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ReaderTocDrawer } from './ReaderTocDrawer';

describe('ReaderTocDrawer', () => {
  const chaptersMock = [
    { id: 0, title: 'Title & Preamble', displayTitle: 'Title & Preamble', content: '...', startPageNumber: 1, pageCount: 2 },
    { id: 1, title: 'Chapter 1: Loomings', displayTitle: 'Chapter 1: Loomings', content: '...', startPageNumber: 3, pageCount: 5 },
    { id: 2, title: 'Chapter 2: The Carpet-Bag', displayTitle: 'Chapter 2: The Carpet-Bag', content: '...', startPageNumber: 8, pageCount: 4 },
  ];

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    chapters: chaptersMock,
    activeChapterIndex: 1,
    onSelectChapter: vi.fn(),
    bookTitle: 'Moby Dick',
  };

  it('renders table of contents with chapters and starting page badges', () => {
    render(<ReaderTocDrawer {...defaultProps} />);

    expect(screen.getByText('Table of Contents')).toBeInTheDocument();
    expect(screen.getByText('Moby Dick')).toBeInTheDocument();
    expect(screen.getByText('Chapter 1: Loomings')).toBeInTheDocument();
    expect(screen.getByText('p. 3')).toBeInTheDocument();
    expect(screen.getByText('p. 8')).toBeInTheDocument();
  });

  it('filters chapters based on search query', () => {
    render(<ReaderTocDrawer {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search chapters or sections...');
    fireEvent.change(searchInput, { target: { value: 'Carpet' } });

    expect(screen.getByText('Chapter 2: The Carpet-Bag')).toBeInTheDocument();
    expect(screen.queryByText('Chapter 1: Loomings')).not.toBeInTheDocument();
  });

  it('calls onSelectChapter and onClose when a chapter item is clicked', () => {
    const onSelectChapter = vi.fn();
    const onClose = vi.fn();

    render(
      <ReaderTocDrawer
        {...defaultProps}
        onSelectChapter={onSelectChapter}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByText('Chapter 2: The Carpet-Bag'));
    expect(onSelectChapter).toHaveBeenCalledWith(2);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<ReaderTocDrawer {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });
});

