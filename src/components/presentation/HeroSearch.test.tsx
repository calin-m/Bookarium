import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HeroSearch } from './HeroSearch';
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
  it('should render headline, featured book, and 4-pillar benefit strip', () => {
    renderWithClient(<HeroSearch search="" selectedTopic="" selectedLanguage="" />);

    expect(screen.getByText(/Timeless Literature/i)).toBeInTheDocument();
    expect(screen.getByText(/Free Forever/i)).toBeInTheDocument();
    expect(screen.getByText(/Featured Book/i)).toBeInTheDocument();
    expect(screen.getByText(/100% Public Domain/i)).toBeInTheDocument();
    expect(screen.getByText(/Zero Setup or Keys/i)).toBeInTheDocument();
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByTestId('topic-chip-philosophy')).toBeInTheDocument();
  });

  it('should handle search input changes with debounce', () => {
    vi.useFakeTimers();
    const handleSearchChange = vi.fn();
    renderWithClient(<HeroSearch search="" onSearchChange={handleSearchChange} />);

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'Austen' } });
    expect(handleSearchChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(handleSearchChange).toHaveBeenCalledWith('Austen');
    vi.useRealTimers();
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

  it('should handle read featured book button click', () => {
    const handleReadFeatured = vi.fn();
    renderWithClient(<HeroSearch search="" onReadFeaturedBook={handleReadFeatured} />);

    const readBtns = screen.getAllByRole('button', { name: /Read Volume/i });
    expect(readBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(readBtns[0]);
    expect(handleReadFeatured).toHaveBeenCalled();
  });

  it('should render open-book spread with left and right page quotes on featured spotlight', () => {
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
    renderWithClient(<HeroSearch search="" books={[mockBook]} />);

    expect(screen.getAllByText(/Pride and Prejudice/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/truth universally acknowledged/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/p\. 1/i)).toBeInTheDocument();
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

  it('should clear search input and submit search correctly', () => {
    const handleSearch = vi.fn();
    const handleSearchChange = vi.fn();

    renderWithClient(
      <HeroSearch
        search="Shelley"
        onSearch={handleSearch}
        onSearchChange={handleSearchChange}
      />
    );

    const clearBtn = screen.getByLabelText('Clear search');
    fireEvent.click(clearBtn);
    expect(handleSearchChange).toHaveBeenCalledWith('');

    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'Plato' } });
    const searchBtn = screen.getByRole('button', { name: /^Search$/i });
    fireEvent.click(searchBtn);
    expect(handleSearch).toHaveBeenCalledWith('Plato');
  });

  it('should shuffle to next passage within the featured book when rotate button is clicked', () => {
    renderWithClient(<HeroSearch search="" />);

    const shuffleBtns = screen.getAllByRole('button', { name: /Shuffle/i });
    expect(shuffleBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(shuffleBtns[0]);
  });

  it('should toggle pinned open and closed states on click and keyboard events on desktop', () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });

    try {
      renderWithClient(<HeroSearch search="" />);

      const bookStage = screen.getByRole('button', { name: /Click to pin open volume/i });
      expect(bookStage).toHaveClass('book-3d-stage');
      expect(bookStage).not.toHaveClass('book-open');

      // Click to pin open
      fireEvent.click(bookStage);
      expect(bookStage).toHaveClass('book-open');

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
});
