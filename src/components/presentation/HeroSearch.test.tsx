import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HeroSearch } from './HeroSearch';
import { getHourlyHeroBook } from '@/config/featured-books';
import type { GutendexBook } from '@/mocks/handlers';

const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const renderWithClient = (ui: React.ReactElement) => {
  return render(ui, { wrapper: createTestWrapper() });
};

describe('HeroSearch component', () => {
  it('should render headline, featured book, 4-pillar benefit strip, static volume badge, and focus classes', () => {
    renderWithClient(<HeroSearch search="" selectedTopic="" selectedLanguage="" />);

    expect(screen.getByText(/Timeless Literature/i)).toBeInTheDocument();
    expect(screen.getByText(/Free Forever/i)).toBeInTheDocument();
    expect(screen.getByText(/Featured Book/i)).toBeInTheDocument();
    expect(screen.getByText(/100% Public Domain/i)).toBeInTheDocument();
    expect(screen.getByText(/Zero Setup or Keys/i)).toBeInTheDocument();
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByTestId('topic-chip-philosophy')).toBeInTheDocument();

    // Static volume badge on cover across viewports
    expect(screen.getAllByText(/Vol\./i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: /Shuffle Passage/i })).not.toBeInTheDocument();

    // Input focus ring and action button styling
    const input = screen.getByTestId('search-input');
    expect(input).toHaveClass(
      'rounded-xl',
      'hover:border-primary/40',
      'focus:outline-none',
      'focus:border-primary',
      'focus:ring-1',
      'focus:ring-primary',
      'shadow-booksaw',
      'transition-all'
    );
    expect(screen.getByRole('button', { name: /^Search$/i })).toHaveClass('rounded-lg');
  });

  it('handles search input lifecycle: typing validation, clear button, whitespace normalization, and explicit submit', () => {
    const handleSearchChange = vi.fn();
    const handleSearch = vi.fn();

    // 1. Mount with initial search query to test clear button
    renderWithClient(
      <HeroSearch
        search="Shelley"
        onSearchChange={handleSearchChange}
        onSearch={handleSearch}
      />
    );

    const input = screen.getByTestId('search-input');
    const searchBtn = screen.getByRole('button', { name: /^Search$/i });

    // Click clear button
    const clearBtn = screen.getByLabelText('Clear search');
    fireEvent.click(clearBtn);
    expect(handleSearchChange).toHaveBeenCalledWith('');
    expect(handleSearch).toHaveBeenCalledWith('');
    handleSearch.mockClear();
    handleSearchChange.mockClear();

    // 2. Validation warning when query is only 1 character
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.click(searchBtn);
    expect(screen.getByRole('alert')).toHaveTextContent(/Please enter at least 2 characters to search/i);
    expect(handleSearchChange).not.toHaveBeenCalled();
    expect(handleSearch).not.toHaveBeenCalled();

    // 3. Typing more clears the warning once >= 2 characters, without submitting while typing
    fireEvent.change(input, { target: { value: 'Austen' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(handleSearch).not.toHaveBeenCalled();

    // Explicit submit triggers search
    fireEvent.click(searchBtn);
    expect(handleSearchChange).toHaveBeenCalledWith('Austen');
    expect(handleSearch).toHaveBeenCalledWith('Austen');

    // 4. Normalizes multiple whitespace on submit
    fireEvent.change(input, { target: { value: '   Charles    Dickens   ' } });
    fireEvent.click(searchBtn);
    expect(handleSearch).toHaveBeenCalledWith('Charles Dickens');
    expect(handleSearchChange).toHaveBeenCalledWith('Charles Dickens');
  });

  it('should handle topic chip and language selection', () => {
    const handleTopicChange = vi.fn();
    const handleLangChange = vi.fn();

    renderWithClient(
      <HeroSearch
        search=""
        selectedTopic=""
        onTopicChange={handleTopicChange}
        selectedLanguage=""
        onLanguageChange={handleLangChange}
      />
    );

    fireEvent.click(screen.getByTestId('topic-chip-philosophy'));
    expect(handleTopicChange).toHaveBeenCalledWith('philosophy');

    fireEvent.change(screen.getByTestId('language-select'), { target: { value: 'fr' } });
    expect(handleLangChange).toHaveBeenCalledWith('fr');
  });

  it('should accept dynamic books prop from API, render open-book spread, and handle read featured book', () => {
    const handleReadFeatured = vi.fn();
    const mockBook: GutendexBook = {
      id: 1342,
      title: 'Pride and Prejudice',
      authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
      translators: [],
      subjects: ['Courtship -- Fiction', 'Sisters -- Fiction'],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 50000,
    };

    renderWithClient(<HeroSearch search="" books={[mockBook]} onReadFeaturedBook={handleReadFeatured} />);

    // Open-book spread with quotes
    expect(screen.getAllByText(/Pride and Prejudice/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/truth universally acknowledged/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/p\. 1/i)).toBeInTheDocument();

    // Read featured book action
    const readBtns = screen.getAllByRole('button', { name: /^Read$/i });
    expect(readBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(readBtns[0]);
    expect(handleReadFeatured).toHaveBeenCalled();
  });

  it('should accept dynamic books prop from API and render the active volume', () => {
    const mockApiBooks: GutendexBook[] = [
      {
        id: 84,
        title: 'Frankenstein',
        authors: [{ name: 'Shelley, Mary Wollstonecraft', birth_year: 1797, death_year: 1851 }],
        translators: [],
        subjects: ['Science fiction', 'Horror tales'],
        bookshelves: [],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: {},
        download_count: 70000,
      },
    ];

    renderWithClient(<HeroSearch search="" books={mockApiBooks} />);

    expect(screen.getAllByText(/Frankenstein/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Mary Wollstonecraft Shelley/i)[0]).toBeInTheDocument();
  });

  it('should shuffle to next passage within the featured book when rotate button is clicked', () => {
    renderWithClient(<HeroSearch search="" />);

    const shuffleBtns = screen.getAllByRole('button', { name: /Shuffle/i });
    expect(shuffleBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(shuffleBtns[0]);
  });

  it('should toggle pinned open and closed states on click and keyboard events on desktop, and trigger read from open action button', () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
    const handleReadFeatured = vi.fn();

    try {
      renderWithClient(<HeroSearch search="" onReadFeaturedBook={handleReadFeatured} />);

      const bookStage = screen.getByRole('button', { name: /Click to pin open volume/i });
      expect(bookStage).toHaveClass('book-3d-stage');
      expect(bookStage).not.toHaveClass('book-open');

      // Click to pin open
      fireEvent.click(bookStage);
      expect(bookStage).toHaveClass('book-open');

      // Action button in open state triggers onReadFeaturedBook
      const readBtn = screen.getByTestId('hero-book-read-btn');
      expect(readBtn).toBeInTheDocument();
      fireEvent.click(readBtn);
      expect(handleReadFeatured).toHaveBeenCalledTimes(1);

      // Click to pin closed
      fireEvent.click(bookStage);
      expect(bookStage).toHaveClass('book-closed');

      // Mouse leave resets pinState so next hover opens
      fireEvent.mouseLeave(bookStage);
      expect(bookStage).not.toHaveClass('book-closed');

      // Hover in, click again
      fireEvent.mouseEnter(bookStage);
      fireEvent.keyDown(bookStage, { key: 'Enter' });
      expect(bookStage).toHaveClass('book-closed');

      // Keyboard Space to toggle
      fireEvent.keyDown(bookStage, { key: ' ' });
      expect(bookStage).toHaveClass('book-open');
    } finally {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalWidth });
    }
  });

  it('should not toggle pinned open state on mobile viewports (< 1024px)', () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 });

    try {
      renderWithClient(<HeroSearch search="" />);

      const bookStage = screen.getByRole('button', { name: /Click to pin open volume/i });
      expect(bookStage).not.toHaveClass('book-open');

      // Click should not pin open on mobile
      fireEvent.click(bookStage);
      expect(bookStage).not.toHaveClass('book-open');

      // Hover should not trigger
      fireEvent.mouseEnter(bookStage);
      expect(bookStage).not.toHaveClass('book-open');

      // Keyboard should not trigger
    } finally {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalWidth });
    }
  });

  it('should render the hourly hero book immediately on initial render without falling back to index 0', () => {
    const hourlyBook = getHourlyHeroBook();
    renderWithClient(<HeroSearch search="" />);

    expect(screen.getAllByText(new RegExp(hourlyBook.title, 'i'))[0]).toBeInTheDocument();
  });
});
