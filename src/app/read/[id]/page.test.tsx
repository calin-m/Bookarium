import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import BookReaderPage from './page';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { mockBooks } from '@/mocks/handlers';

const mockPush = vi.fn();
const mockBack = vi.fn();

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '1342' }),
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

// Mock useBooks and useBookContent
vi.mock('@/hooks/queries/useBooks', () => ({
  useBooks: () => ({
    data: {
      count: 1,
      results: [mockBooks[0]],
      source: 'upstream',
    },
    isLoading: false,
  }),
}));

const chapterSampleText = `*** START OF THE PROJECT GUTENBERG EBOOK PRIDE AND PREJUDICE ***

Title: Pride and Prejudice
Author: Jane Austen

CHAPTER 1

It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.

CHAPTER 2

Mr. Bennet was among the earliest of those who waited on Mr. Darcy. He had always intended to visit him, though to the last always assuring his wife that he should not go; and till the evening after the visit was paid she had no knowledge of it.

*** END OF THE PROJECT GUTENBERG EBOOK PRIDE AND PREJUDICE ***`;

vi.mock('@/hooks/queries/useBookContent', () => ({
  useBookContent: () => ({
    data: chapterSampleText,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

describe('Dedicated Reader Page (/read/[id])', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBookshelfStore.getState().clearBookshelf();
    useReaderStore.getState().setFontSize(18);
    useReaderStore.getState().setTheme('light');
  });

  it('renders header, reading surface, and sticky footer with metadata', () => {
    render(<BookReaderPage />);

    expect(screen.getAllByText(/Pride and Prejudice/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Austen/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText('Back to Catalog')).toBeInTheDocument();
    expect(screen.getByLabelText('Table of Contents')).toBeInTheDocument();
    expect(screen.getByLabelText('Typography & Theme Controls')).toBeInTheDocument();
  });

  it('navigates back to previous scroll position when back button is clicked', () => {
    Object.defineProperty(window, 'history', {
      writable: true,
      value: { length: 3 },
    });

    render(<BookReaderPage />);

    fireEvent.click(screen.getByLabelText('Back to Catalog'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('falls back to router.push("/") when history length is <= 1', () => {
    Object.defineProperty(window, 'history', {
      writable: true,
      value: { length: 1 },
    });

    render(<BookReaderPage />);

    fireEvent.click(screen.getByLabelText('Back to Catalog'));
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('opens and closes Table of Contents drawer', () => {
    render(<BookReaderPage />);

    const contentsBtn = screen.getByLabelText('Table of Contents');
    fireEvent.click(contentsBtn);

    expect(screen.getByRole('dialog', { name: /Table of Contents/i })).toBeInTheDocument();

    const closeBtn = screen.getByLabelText('Close Table of Contents');
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('dialog', { name: /Table of Contents/i })).not.toBeInTheDocument();
  });

  it('opens and closes appearance controls popover', () => {
    render(<BookReaderPage />);

    const appearanceBtn = screen.getByLabelText('Typography & Theme Controls');
    fireEvent.click(appearanceBtn);

    expect(screen.getByRole('region', { name: /Reading Controls/i })).toBeInTheDocument();

    const closeBtn = screen.getByLabelText('Close Appearance Controls');
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('region', { name: /Reading Controls/i })).not.toBeInTheDocument();
  });

  it('navigates between chapters using footer Next/Prev buttons', () => {
    render(<BookReaderPage />);

    // Initially in Preamble (Section 1)
    expect(screen.getAllByText(/Title & Preamble/i).length).toBeGreaterThanOrEqual(1);

    const nextBtn = screen.getByLabelText('Next Page');
    fireEvent.click(nextBtn);

    // Moves to Chapter 1
    expect(screen.getAllByText(/CHAPTER 1/i).length).toBeGreaterThanOrEqual(1);

    // Moves to Chapter 2
    fireEvent.click(nextBtn);
    expect(screen.getAllByText(/CHAPTER 2/i).length).toBeGreaterThanOrEqual(1);

    const prevBtn = screen.getByLabelText('Previous Page');
    fireEvent.click(prevBtn);

    expect(screen.getAllByText(/CHAPTER 1/i).length).toBeGreaterThanOrEqual(1);
  });

  it('supports keyboard navigation via ArrowLeft and ArrowRight', () => {
    render(<BookReaderPage />);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getAllByText(/CHAPTER 1/i).length).toBeGreaterThanOrEqual(1);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getAllByText(/CHAPTER 2/i).length).toBeGreaterThanOrEqual(1);

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getAllByText(/CHAPTER 1/i).length).toBeGreaterThanOrEqual(1);
  });

  it('handles quick theme cycling from the header', () => {
    render(<BookReaderPage />);

    // Starts at light theme (set in beforeEach)
    const themeBtn = screen.getByLabelText(/Current theme: light/i);
    fireEvent.click(themeBtn);
    expect(useReaderStore.getState().theme).toBe('sepia');

    // Sepia -> Dark
    const sepiaThemeBtn = screen.getByLabelText(/Current theme: sepia/i);
    fireEvent.click(sepiaThemeBtn);
    expect(useReaderStore.getState().theme).toBe('dark');

    // Dark -> Light
    const darkThemeBtn = screen.getByLabelText(/Current theme: dark/i);
    fireEvent.click(darkThemeBtn);
    expect(useReaderStore.getState().theme).toBe('light');
  });

  it('handles quick font size adjustments', () => {
    render(<BookReaderPage />);

    const appearanceBtn = screen.getByLabelText('Typography & Theme Controls');
    fireEvent.click(appearanceBtn);

    const fontSlider = screen.getByLabelText('Font size in pixels');
    fireEvent.change(fontSlider, { target: { value: '22' } });
    expect(useReaderStore.getState().fontSize).toBe(22);
  });

  it('handles page jump input directly from footer', () => {
    render(<BookReaderPage />);

    const pageInput = screen.getByLabelText('Current Page Number');
    fireEvent.change(pageInput, { target: { value: '3' } });

    expect(screen.getAllByText(/CHAPTER 2/i).length).toBeGreaterThanOrEqual(1);
  });

  it('sets reading progress to 0% on page 1 and updates progress as reader advances', () => {
    render(<BookReaderPage />);

    // On initial page (page 1)
    expect(useReaderStore.getState().getProgress(1342)).toBe(0);

    // Advance to next page
    const nextBtn = screen.getByLabelText('Next Page');
    fireEvent.click(nextBtn);
    expect(useReaderStore.getState().getProgress(1342)).toBeGreaterThan(0);
  });
});
