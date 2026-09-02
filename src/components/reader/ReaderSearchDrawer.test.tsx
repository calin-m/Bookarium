import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ReaderSearchDrawer } from './ReaderSearchDrawer';
import type { ChapterSection } from '@/lib/gutenberg-parser';

const mockChapters: ChapterSection[] = [
  {
    id: 1,
    title: 'CHAPTER I',
    displayTitle: 'Chapter I: The Arrival',
    content: 'It is a truth universally acknowledged that a single man in possession of a good fortune must be in want of a wife.',
    startPageNumber: 1,
    pageCount: 1,
  },
  {
    id: 2,
    title: 'CHAPTER II',
    displayTitle: 'Chapter II: Netherfield Park',
    content: 'Mr. Bennet was among the earliest of those who waited on Mr. Bingley at Netherfield.',
    startPageNumber: 2,
    pageCount: 1,
  },
];

describe('ReaderSearchDrawer', () => {
  it('renders search drawer with input when isOpen is true', () => {
    render(
      <ReaderSearchDrawer
        isOpen={true}
        onClose={vi.fn()}
        chapters={mockChapters}
        onSelectMatch={vi.fn()}
        bookTitle="Pride and Prejudice"
      />
    );

    expect(screen.getByText('Search in Volume')).toBeInTheDocument();
    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search phrase, character, or quote/i)).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ReaderSearchDrawer
        isOpen={false}
        onClose={vi.fn()}
        chapters={mockChapters}
        onSelectMatch={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('Search in Volume')).not.toBeInTheDocument();
  });

  it('updates search query, shows match count, and renders result cards', () => {
    render(
      <ReaderSearchDrawer
        isOpen={true}
        onClose={vi.fn()}
        chapters={mockChapters}
        onSelectMatch={vi.fn()}
      />
    );

    const input = screen.getByRole('textbox', { name: /search book text/i });
    fireEvent.change(input, { target: { value: 'Bingley' } });

    expect(screen.getByText(/1 match across 1 chapter/i)).toBeInTheDocument();
    expect(screen.getByText('Chapter II: Netherfield Park')).toBeInTheDocument();
  });

  it('clears search query when clear button is clicked', () => {
    render(
      <ReaderSearchDrawer
        isOpen={true}
        onClose={vi.fn()}
        chapters={mockChapters}
        onSelectMatch={vi.fn()}
      />
    );

    const input = screen.getByRole('textbox', { name: /search book text/i });
    fireEvent.change(input, { target: { value: 'Bingley' } });

    const clearBtn = screen.getByRole('button', { name: /clear search query/i });
    fireEvent.click(clearBtn);

    expect(screen.getByText(/Type at least 2 characters/i)).toBeInTheDocument();
  });

  it('calls onSelectMatch and onClose when clicking a search match card', () => {
    const handleSelectMatch = vi.fn();
    const handleClose = vi.fn();

    render(
      <ReaderSearchDrawer
        isOpen={true}
        onClose={handleClose}
        chapters={mockChapters}
        onSelectMatch={handleSelectMatch}
      />
    );

    const input = screen.getByRole('textbox', { name: /search book text/i });
    fireEvent.change(input, { target: { value: 'truth' } });

    const matchBtn = screen.getByTestId('search-match-match-0-0-8');
    fireEvent.click(matchBtn);

    expect(handleSelectMatch).toHaveBeenCalledWith(0, 1);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('shows empty feedback when no matches are found', () => {
    render(
      <ReaderSearchDrawer
        isOpen={true}
        onClose={vi.fn()}
        chapters={mockChapters}
        onSelectMatch={vi.fn()}
      />
    );

    const input = screen.getByRole('textbox', { name: /search book text/i });
    fireEvent.change(input, { target: { value: 'NonExistentWordXYZ' } });

    expect(screen.getByText(/No matches found for/i)).toBeInTheDocument();
  });

  it('closes drawer on Escape key press', () => {
    const handleClose = vi.fn();

    render(
      <ReaderSearchDrawer
        isOpen={true}
        onClose={handleClose}
        chapters={mockChapters}
        onSelectMatch={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('closes drawer when clicking the backdrop', () => {
    const handleClose = vi.fn();

    render(
      <ReaderSearchDrawer
        isOpen={true}
        onClose={handleClose}
        chapters={mockChapters}
        onSelectMatch={vi.fn()}
      />
    );

    const backdrop = screen.getByTestId('search-backdrop');
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});

