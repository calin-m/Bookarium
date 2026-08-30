import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ReaderPage, { parseGutenbergChapters } from './page';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { mockBooks } from '@/mocks/handlers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '1342' }),
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

CHAPTER I.

It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.

CHAPTER II.

Mr. Bennet was among the earliest of those who waited on Mr. Darcy. He had always intended to visit him, though to the last always assuring his wife that he should not go; and till the evening after the visit was paid she had no knowledge of it.

*** END OF THE PROJECT GUTENBERG EBOOK PRIDE AND PREJUDICE ***`;

vi.mock('@/hooks/queries/useBookContent', () => ({
  useBookContent: () => ({
    data: chapterSampleText,
    isLoading: false,
  }),
}));

describe('Dedicated Reader Page (/read/[id])', () => {
  beforeEach(() => {
    useBookshelfStore.getState().clearBookshelf();
    useReaderStore.getState().setFontSize(18);
    useReaderStore.getState().setTheme('light');
  });

  it('should render editorial header, book title, author, and back to library link', () => {
    render(<ReaderPage />);

    expect(screen.getAllByText(/Pride and Prejudice/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Austen/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText('Back to Library')).toBeInTheDocument();
    expect(screen.getByTestId('reader-surface')).toBeInTheDocument();
  });

  it('should allow modifying font size in top bar', () => {
    render(<ReaderPage />);

    expect(screen.getByText('18px')).toBeInTheDocument();
    const increaseBtn = screen.getByLabelText('Increase font size');
    fireEvent.click(increaseBtn);
    expect(screen.getByText('20px')).toBeInTheDocument();

    const decreaseBtn = screen.getByLabelText('Decrease font size');
    fireEvent.click(decreaseBtn);
    expect(screen.getByText('18px')).toBeInTheDocument();
  });

  it('should toggle reading themes between light, sepia, and dark', () => {
    render(<ReaderPage />);

    const sepiaBtn = screen.getByLabelText('Sepia reader theme');
    fireEvent.click(sepiaBtn);
    expect(useReaderStore.getState().theme).toBe('sepia');

    const darkBtn = screen.getByLabelText('Dark reader theme');
    fireEvent.click(darkBtn);
    expect(useReaderStore.getState().theme).toBe('dark');

    const lightBtn = screen.getByLabelText('Light reader theme');
    fireEvent.click(lightBtn);
    expect(useReaderStore.getState().theme).toBe('light');
  });

  it('should toggle font families between serif, sans, and mono', () => {
    render(<ReaderPage />);

    const sansBtn = screen.getByRole('button', { name: /^sans$/i });
    fireEvent.click(sansBtn);
    expect(useReaderStore.getState().fontFamily).toBe('sans');

    const monoBtn = screen.getByRole('button', { name: /^mono$/i });
    fireEvent.click(monoBtn);
    expect(useReaderStore.getState().fontFamily).toBe('mono');

    const serifBtn = screen.getByRole('button', { name: /^serif$/i });
    fireEvent.click(serifBtn);
    expect(useReaderStore.getState().fontFamily).toBe('serif');
  });

  it('should toggle reader width between compact and comfortable', () => {
    render(<ReaderPage />);

    const compactBtn = screen.getByLabelText('Compact margin');
    fireEvent.click(compactBtn);

    const comfortableBtn = screen.getByLabelText('Comfortable margin');
    fireEvent.click(comfortableBtn);
  });

  it('should toggle bookmarking book to personal shelf', () => {
    render(<ReaderPage />);

    const bookmarkBtn = screen.getByLabelText('Add Bookmark');
    fireEvent.click(bookmarkBtn);
    expect(useBookshelfStore.getState().isBookSaved(1342)).toBe(true);

    const removeBookmarkBtn = screen.getByLabelText('Remove Bookmark');
    fireEvent.click(removeBookmarkBtn);
    expect(useBookshelfStore.getState().isBookSaved(1342)).toBe(false);
  });

  it('should navigate through simulated book pages with buttons, input, and keyboard', () => {
    render(<ReaderPage />);

    const nextBtn = screen.getByLabelText('Next Page');
    expect(nextBtn).toBeInTheDocument();
    fireEvent.click(nextBtn);

    const prevBtn = screen.getByLabelText('Previous Page');
    fireEvent.click(prevBtn);

    const pageInput = screen.getByLabelText('Current Page Number');
    fireEvent.change(pageInput, { target: { value: '2' } });

    // Trigger keyboard page navigation
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'PageDown' });
    fireEvent.keyDown(window, { key: 'PageUp' });
  });

  it('should switch between Paginated book pages mode and Continuous Scroll mode', () => {
    render(<ReaderPage />);

    const scrollModeBtn = screen.getByLabelText('Scroll Mode');
    fireEvent.click(scrollModeBtn);

    expect(screen.getByLabelText('Book Pages Mode')).toBeInTheDocument();

    const surface = screen.getByTestId('reader-surface');
    fireEvent.scroll(surface, { target: { scrollTop: 100 } });

    const nextChBtn = screen.getByRole('button', { name: /Next Chapter/i });
    fireEvent.click(nextChBtn);

    const prevChBtn = screen.getByRole('button', { name: /Prev Chapter/i });
    fireEvent.click(prevChBtn);
    
    const pagesModeBtn = screen.getByLabelText('Book Pages Mode');
    fireEvent.click(pagesModeBtn);
  });

  it('should navigate through chapters using TOC drawer and close it', () => {
    render(<ReaderPage />);

    // Open Table of Contents
    const tocBtn = screen.getByLabelText('Table of Contents');
    fireEvent.click(tocBtn);

    expect(screen.getByText('Table of Contents')).toBeInTheDocument();
    expect(screen.getAllByText(/CHAPTER I\./i).length).toBeGreaterThanOrEqual(1);

    // Select Chapter II from TOC
    const chapter2Btns = screen.getAllByText(/CHAPTER II\./i);
    fireEvent.click(chapter2Btns[chapter2Btns.length - 1]);

    // Verify Chapter II content is visible
    expect(screen.getByText(/Mr. Bennet was among the earliest/i)).toBeInTheDocument();

    // Open TOC again and close with close button
    fireEvent.click(screen.getByLabelText('Table of Contents'));
    const closeTocBtn = screen.getByLabelText('Close Table of Contents');
    fireEvent.click(closeTocBtn);
    expect(screen.queryByText('Table of Contents')).not.toBeInTheDocument();
  });

  it('should open and close download formats drawer', () => {
    render(<ReaderPage />);

    const downloadBtn = screen.getByLabelText('Download formats');
    fireEvent.click(downloadBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  describe('parseGutenbergChapters utility', () => {
    it('should handle null, undefined, and empty string', () => {
      expect(parseGutenbergChapters(null)).toEqual([]);
      expect(parseGutenbergChapters(undefined)).toEqual([]);
      expect(parseGutenbergChapters('')).toEqual([]);
    });

    it('should parse plain text without start/end markers', () => {
      const raw = 'Simple text without headings';
      const sections = parseGutenbergChapters(raw);
      expect(sections.length).toBe(1);
      expect(sections[0].title).toBe('Title & Preamble');
    });

    it('should parse text with preamble, chapters, and license', () => {
      const fullText = `Preamble info\n\nCHAPTER 1. Start\n\nSome body\n\n*** END OF THIS PROJECT GUTENBERG EBOOK ***\nLicense info`;
      const sections = parseGutenbergChapters(fullText);
      expect(sections.length).toBeGreaterThanOrEqual(2);
    });
  });
});
