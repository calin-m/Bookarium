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

vi.mock('@/hooks/queries/useBookTranslations', () => ({
  useBookTranslations: () => ({
    translations: [
      {
        bookId: 1342,
        title: 'Pride and Prejudice',
        languageCode: 'en',
        languageLabel: 'English',
        isCurrent: true,
      },
      {
        bookId: 67890,
        title: 'Orgueil et Préjugés',
        languageCode: 'fr',
        languageLabel: 'French (Français)',
        isCurrent: false,
      },
    ],
    currentLanguage: 'English',
    isLoading: false,
    isError: false,
  }),
}));

describe('Dedicated Reader Page (/read/[id])', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBookshelfStore.getState().clearBookshelf();
    useReaderStore.getState().setFontSize(18);
    useReaderStore.getState().setTheme('light');
    useReaderStore.setState({
      readingProgress: {},
      readingPositions: {},
    });
  });

  it('renders header, reading surface, and sticky footer with metadata', () => {
    render(<BookReaderPage />);

    expect(screen.getAllByText(/Pride and Prejudice/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Austen/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText('Back to Catalog')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Table of Contents')[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText('Typography & Theme Controls')[0]).toBeInTheDocument();
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

    const contentsBtn = screen.getAllByLabelText('Table of Contents')[0];
    fireEvent.click(contentsBtn);

    expect(screen.getByRole('dialog', { name: /Table of Contents/i })).toBeInTheDocument();

    const closeBtn = screen.getByLabelText('Close Table of Contents');
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('dialog', { name: /Table of Contents/i })).not.toBeInTheDocument();
  });

  it('opens and closes appearance controls popover', () => {
    render(<BookReaderPage />);

    const appearanceBtn = screen.getAllByLabelText('Typography & Theme Controls')[0];
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
    const themeBtn = screen.getAllByLabelText(/Current theme: light/i)[0];
    fireEvent.click(themeBtn);
    expect(useReaderStore.getState().theme).toBe('sepia');

    // Sepia -> Dark
    const sepiaThemeBtn = screen.getAllByLabelText(/Current theme: sepia/i)[0];
    fireEvent.click(sepiaThemeBtn);
    expect(useReaderStore.getState().theme).toBe('dark');

    // Dark -> Light
    const darkThemeBtn = screen.getAllByLabelText(/Current theme: dark/i)[0];
    fireEvent.click(darkThemeBtn);
    expect(useReaderStore.getState().theme).toBe('light');
  });

  it('handles quick font size adjustments', () => {
    render(<BookReaderPage />);

    const appearanceBtn = screen.getAllByLabelText('Typography & Theme Controls')[0];
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

  it('automatically resumes at saved chapter and page, renders resume toast, and handles restart', async () => {
    // Pre-populate saved position at Chapter 2 (index 2), page 1
    useReaderStore.getState().saveReadingPosition(1342, {
      chapterIndex: 2,
      chapterPage: 1,
      globalPage: 3,
      lastReadAt: new Date().toISOString(),
    });

    render(<BookReaderPage />);

    // Should show resume notice
    const resumeNotice = await screen.findByTestId('resume-notice');
    expect(resumeNotice).toBeInTheDocument();
    expect(screen.getByText(/Resumed at/i)).toBeInTheDocument();
    expect(screen.getAllByText(/CHAPTER 2/i).length).toBeGreaterThanOrEqual(1);

    // Click Restart button
    const restartBtn = screen.getByRole('button', { name: /Restart/i });
    fireEvent.click(restartBtn);

    // Resets to beginning
    expect(screen.getAllByText(/Title & Preamble/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId('resume-notice')).not.toBeInTheDocument();
  });

  it('renders language and translation dropdown in reader and navigates on translation selection', () => {
    render(<BookReaderPage />);

    const langBtn = screen.getAllByLabelText('Language Editions & Translations')[0];
    expect(langBtn).toBeInTheDocument();
    fireEvent.click(langBtn);

    expect(screen.getAllByText('French (Français)')[0]).toBeInTheDocument();
    const frenchBtn = screen.getAllByRole('button', { name: /French \(Français\)/i })[0];
    fireEvent.click(frenchBtn);

    expect(mockPush).toHaveBeenCalledWith('/read/67890');
  });

  it('opens In-Book Search Drawer, finds matching phrase, and jumps to chapter on selection', () => {
    render(<BookReaderPage />);

    const searchBtn = screen.getAllByLabelText('Search in Book')[0];
    fireEvent.click(searchBtn);

    expect(screen.getByRole('dialog', { name: /Search in Volume/i })).toBeInTheDocument();

    const input = screen.getByRole('textbox', { name: /search book text/i });
    fireEvent.change(input, { target: { value: 'Darcy' } });

    expect(screen.getByText(/1 match across 1 chapter/i)).toBeInTheDocument();
    const matchCard = screen.getByText('Darcy').closest('button');
    expect(matchCard).not.toBeNull();
    fireEvent.click(matchCard!);

    // Should navigate to Chapter 2 and close search drawer
    expect(screen.queryByRole('dialog', { name: /Search in Volume/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/CHAPTER 2/i).length).toBeGreaterThanOrEqual(1);
  });

  it('toggles In-Book Search Drawer using Ctrl+F keyboard shortcut', () => {
    render(<BookReaderPage />);

    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    expect(screen.getByRole('dialog', { name: /Search in Volume/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /Search in Volume/i })).not.toBeInTheDocument();
  });

  it('enforces mutual exclusivity between all 4 reader modals (TOC, Search, Controls, Language)', () => {
    render(<BookReaderPage />);

    // 1. Open TOC
    const tocBtn = screen.getAllByLabelText('Table of Contents')[0];
    fireEvent.click(tocBtn);
    expect(screen.getByRole('dialog', { name: /Table of Contents/i })).toBeInTheDocument();

    // 2. Open Search -> closes TOC
    const searchBtn = screen.getAllByLabelText('Search in Book')[0];
    fireEvent.click(searchBtn);
    expect(screen.queryByRole('dialog', { name: /Table of Contents/i })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /Search in Volume/i })).toBeInTheDocument();

    // 3. Open Controls -> closes Search
    const controlsBtn = screen.getAllByLabelText('Typography & Theme Controls')[0];
    fireEvent.click(controlsBtn);
    expect(screen.queryByRole('dialog', { name: /Search in Volume/i })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Reading Controls/i })).toBeInTheDocument();

    // 4. Open Language Drawer -> closes Controls
    const langBtn = screen.getAllByLabelText('Language Editions & Translations')[0];
    fireEvent.click(langBtn);
    expect(screen.queryByRole('region', { name: /Reading Controls/i })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /Language Editions & Translations/i })).toBeInTheDocument();

    // 5. Re-click Language Drawer -> closes Language Drawer
    fireEvent.click(langBtn);
    expect(screen.queryByRole('dialog', { name: /Language Editions & Translations/i })).not.toBeInTheDocument();
  });
});
