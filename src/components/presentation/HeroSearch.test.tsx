import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { Zap } from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HeroSearch, HeroFeatureTypewriter } from './HeroSearch';
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
    const { container } = renderWithClient(<HeroSearch search="" selectedTopic="" selectedLanguage="" />);

    const section = container.querySelector('section');
    expect(section).toHaveClass(
      'min-h-[460px]',
      'sm:min-h-[calc(100dvh-7.6875rem)]',
      'pt-6',
      'sm:pt-8',
      'pb-6',
      'sm:pb-8'
    );

    expect(screen.getByText(/Timeless Literature/i)).toBeInTheDocument();
    expect(screen.getByText(/Free Forever/i)).toBeInTheDocument();
    expect(screen.getByText(/Featured Book/i)).toBeInTheDocument();
    expect(screen.getAllByText(/100% Public Domain/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Zero Setup or Keys/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByText(/Explore Topics/i)).toBeInTheDocument();
    expect(screen.getByTestId('topic-chip-philosophy')).toBeInTheDocument();

    // Static volume badge on cover across viewports
    expect(screen.getAllByText(/Vol\./i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: /Shuffle Passage/i })).not.toBeInTheDocument();

    // Input focus ring, placeholder copy, and action button styling
    const input = screen.getByTestId('search-input');
    expect(input).toHaveAttribute('placeholder', 'Search 70,000+ books by title or author...');
    expect(input).toHaveClass(
      'rounded-xl',
      'hover:border-primary/40',
      'focus:outline-none',
      'focus:border-primary',
      'focus:ring-1',
      'focus:ring-primary',
      'shadow-booksaw',
      'placeholder:truncate',
      'transition-all'
    );
    expect(screen.getByRole('button', { name: /^Search$/i })).toHaveClass('rounded-lg');

    // Horizontal swipeable topic carousel container with data-no-swipe isolation
    const topicsContainer = screen.getByTestId('hero-topics-container');
    expect(topicsContainer).toHaveAttribute('data-no-swipe');
    expect(topicsContainer).toHaveClass('overflow-x-auto', 'no-scrollbar', 'lg:flex-wrap', 'select-none');
  });

  it('supports mouse drag-to-scroll, wheel translation, and accidental click suppression on topics carousel', () => {
    const handleTopicChange = vi.fn();
    renderWithClient(<HeroSearch search="" onTopicChange={handleTopicChange} />);

    const topicsContainer = screen.getByTestId('hero-topics-container');
    topicsContainer.scrollLeft = 0;

    // 1. Mouse wheel translation
    const wheelEvent = new WheelEvent('wheel', {
      deltaY: 60,
      deltaX: 0,
      cancelable: true,
      bubbles: true,
    });
    topicsContainer.dispatchEvent(wheelEvent);
    expect(topicsContainer.scrollLeft).toBe(60);

    // 2. Drag scrolling (> 5px threshold)
    fireEvent.mouseDown(topicsContainer, { button: 0, clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 60 }); // dx = -40px
    expect(topicsContainer.scrollLeft).toBe(100);
    expect(topicsContainer).toHaveClass('cursor-grabbing');

    // 3. Accidental click during drag is suppressed
    const chip = screen.getByTestId('topic-chip-philosophy');
    fireEvent.click(chip);
    expect(handleTopicChange).not.toHaveBeenCalled();

    // 4. Mouse up ends drag
    fireEvent.mouseUp(window);
    expect(topicsContainer).not.toHaveClass('cursor-grabbing');

    // 5. Normal click without drag triggers topic change
    fireEvent.click(chip);
    expect(handleTopicChange).toHaveBeenCalledWith('philosophy');
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

  it('keeps Featured Book stable and decoupled when topic or language filter changes', async () => {
    const useBooksModule = await import('@/hooks/queries/useBooks');
    const mockBookEnglish = {
      id: 1400,
      title: 'Great Expectations',
      authors: [{ name: 'Dickens, Charles', birth_year: 1812, death_year: 1870 }],
      translators: [],
      subjects: ['Bildungsromans'],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 35000,
      quotes: [
        {
          chapterLabel: 'Passage I • Great Expectations',
          openingLine: '“My father’s family name being Pirrip.”',
          quoteExcerpt: '“Suffering has been stronger than all other teaching.”',
        },
      ],
    };

    const enrichedSpy = vi.spyOn(useBooksModule, 'useQuoteEnrichedBooks').mockReturnValue({
      data: [mockBookEnglish],
    } as unknown as ReturnType<typeof useBooksModule.useQuoteEnrichedBooks>);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <HeroSearch search="" selectedTopic="" selectedLanguage="" />
      </QueryClientProvider>
    );

    expect(screen.getAllByText(/Great Expectations/i)[0]).toBeInTheDocument();

    // Changing language to French does not alter or re-swap the editorial featured book
    rerender(
      <QueryClientProvider client={queryClient}>
        <HeroSearch search="" selectedTopic="" selectedLanguage="fr" />
      </QueryClientProvider>
    );
    expect(screen.getAllByText(/Great Expectations/i)[0]).toBeInTheDocument();

    // Changing topic to Philosophy does not alter or re-swap the editorial featured book
    rerender(
      <QueryClientProvider client={queryClient}>
        <HeroSearch search="" selectedTopic="philosophy" selectedLanguage="fr" />
      </QueryClientProvider>
    );
    expect(screen.getAllByText(/Great Expectations/i)[0]).toBeInTheDocument();

    enrichedSpy.mockRestore();
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

  it('synchronizes controlled search prop on rerender and supports featuredBook prop with or without rawBook', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const customFeatured = {
      id: 35,
      title: 'The Time Machine',
      author: 'H. G. Wells',
      year: '1895',
      primarySubject: 'Science Fiction',
      license: 'CC0 / Public Domain',
      volumeNumber: 'Vol. 35',
      quoteExcerpt: 'Face this world.',
      openingLine: 'The Time Traveller was expounding a recondite matter to us.',
    };

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <HeroSearch search="initial" featuredBook={customFeatured} />
      </QueryClientProvider>
    );

    expect(screen.getByDisplayValue('initial')).toBeInTheDocument();
    expect(screen.getAllByText(/The Time Machine/i)[0]).toBeInTheDocument();

    const customWithRawBook = {
      ...customFeatured,
      title: 'The War of the Worlds',
      rawBook: {
        id: 36,
        title: 'The War of the Worlds',
        authors: [{ name: 'Wells, H. G.', birth_year: 1866, death_year: 1946 }],
        translators: [],
        subjects: ['Science fiction'],
        bookshelves: [],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: {},
        download_count: 45000,
      },
    };

    rerender(
      <QueryClientProvider client={queryClient}>
        <HeroSearch search="updated query" featuredBook={customWithRawBook} />
      </QueryClientProvider>
    );

    expect(screen.getByDisplayValue('updated query')).toBeInTheDocument();
    expect(screen.getAllByText(/The War of the Worlds/i)[0]).toBeInTheDocument();
  });

  it('selects Featured Book from the full useQuoteEnrichedBooks pool using exclusively database quotes', async () => {
    const useBooksModule = await import('@/hooks/queries/useBooks');
    const enrichedSpy = vi.spyOn(useBooksModule, 'useQuoteEnrichedBooks').mockReturnValue({
      data: [
        {
          id: 1400,
          title: 'Great Expectations',
          authors: [{ name: 'Dickens, Charles', birth_year: 1812, death_year: 1870 }],
          translators: [],
          subjects: ['Bildungsromans'],
          bookshelves: [],
          languages: ['en'],
          copyright: false,
          media_type: 'Text',
          formats: {},
          download_count: 35000,
          quotes: [
            {
              chapterLabel: 'Passage I • Great Expectations',
              openingLine: '“My father’s family name being Pirrip.”',
              quoteExcerpt: '“Suffering has been stronger than all other teaching.”',
            },
            {
              chapterLabel: 'Passage II • Great Expectations',
              openingLine: '“Pause you who read this.”',
              quoteExcerpt: '“Think for a moment of the long chain of iron or gold.”',
            },
          ],
        },
      ],
    } as unknown as ReturnType<typeof useBooksModule.useQuoteEnrichedBooks>);

    renderWithClient(<HeroSearch search="" />);
    expect(screen.getByText(/Featured Book/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Great Expectations/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Suffering has been stronger than all other teaching/i)[0]).toBeInTheDocument();
    enrichedSpy.mockRestore();
  });

  it('locks the active Featured Book within the same hour across background pool updates to prevent refresh swaps', async () => {
    const useBooksModule = await import('@/hooks/queries/useBooks');
    const bookA = {
      id: 1400,
      title: 'Great Expectations',
      authors: [{ name: 'Dickens, Charles', birth_year: 1812, death_year: 1870 }],
      translators: [],
      subjects: ['Bildungsromans'],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 35000,
      quotes: [
        {
          chapterLabel: 'Passage I • Great Expectations',
          openingLine: '“My father’s family name being Pirrip.”',
          quoteExcerpt: '“Suffering has been stronger than all other teaching.”',
        },
      ],
    };
    const bookB = {
      ...bookA,
      id: 98,
      title: 'A Tale of Two Cities',
      download_count: 45000,
      quotes: [
        {
          chapterLabel: 'Passage I • Two Cities',
          openingLine: '“It was the best of times.”',
          quoteExcerpt: '“It was the season of Light.”',
        },
      ],
    };

    const enrichedSpy = vi
      .spyOn(useBooksModule, 'useQuoteEnrichedBooks')
      .mockReturnValueOnce({
        data: [bookA],
      } as unknown as ReturnType<typeof useBooksModule.useQuoteEnrichedBooks>)
      .mockReturnValue({
        data: [bookB, bookA],
      } as unknown as ReturnType<typeof useBooksModule.useQuoteEnrichedBooks>);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <HeroSearch search="" />
      </QueryClientProvider>
    );

    expect(screen.getAllByText(/Great Expectations/i)[0]).toBeInTheDocument();

    // Background re-render with expanded pool keeps Great Expectations locked for the active hour
    rerender(
      <QueryClientProvider client={queryClient}>
        <HeroSearch search=" Dickens" />
      </QueryClientProvider>
    );
    expect(screen.getAllByText(/Great Expectations/i)[0]).toBeInTheDocument();

    enrichedSpy.mockRestore();
  });

  it('enforces multi-screen responsive grid hierarchy across mobile, tablet, and desktop viewports', () => {
    const { container } = renderWithClient(<HeroSearch search="" />);

    // 1. Root Section Viewport Fold Alignment
    const section = container.querySelector('section');
    expect(section).toHaveClass('min-h-[460px]', 'sm:min-h-[calc(100dvh-7.6875rem)]');

    // 2. Booksaw Split Grid (Single-column mobile -> 12-column desktop split)
    const heroGrid = container.querySelector('.grid.grid-cols-1.lg\\:grid-cols-12');
    expect(heroGrid).toBeInTheDocument();
    expect(heroGrid).toHaveClass('grid-cols-1', 'lg:grid-cols-12');

    // 3. Left editorial column & Right 3D book spotlight column ratios
    const leftCol = heroGrid?.querySelector('.lg\\:col-span-7');
    const rightCol = heroGrid?.querySelector('.lg\\:col-span-5');
    expect(leftCol).toBeInTheDocument();
    expect(rightCol).toBeInTheDocument();

    // 4. Desktop 4-Pillar Benefit Strip (hidden on stacked viewports < 1280px, 4-col single row on desktop >= 1280px)
    const desktopPillarsGrid = container.querySelector('.hidden.xl\\:grid.xl\\:grid-cols-4');
    expect(desktopPillarsGrid).toBeInTheDocument();
    expect(desktopPillarsGrid).toHaveClass('hidden', 'xl:grid', 'xl:grid-cols-4', 'mt-auto');

    // 5. Intermediate Paired 2-Card Typewriter Ticker (640px – 1279px)
    const intermediateTickerGrid = container.querySelector('.hidden.sm\\:grid.sm\\:grid-cols-2.xl\\:hidden');
    expect(intermediateTickerGrid).toBeInTheDocument();
    expect(screen.getByTestId('hero-feature-typewriter-left')).toBeInTheDocument();
    expect(screen.getByTestId('hero-feature-typewriter-right')).toBeInTheDocument();

    // 6. Mobile Viewport Zero-CLS Typewriter Ticker (< 640px)
    const mobileTicker = screen.getByTestId('hero-feature-typewriter');
    expect(mobileTicker).toBeInTheDocument();
    expect(mobileTicker.parentElement).toHaveClass('block', 'sm:hidden');
    expect(mobileTicker).toHaveClass('h-[72px]', 'sm:h-[76px]', 'overflow-hidden');

    // 7. Accessible sr-only list for screen readers and SEO
    const srOnly = container.querySelector('.sr-only');
    expect(srOnly).toBeInTheDocument();
    expect(srOnly).toHaveTextContent(/100% Public Domain/i);
    expect(srOnly).toHaveTextContent(/Zero Setup or Keys/i);
    expect(srOnly).toHaveTextContent(/Multi-Format Downloads/i);
    expect(srOnly).toHaveTextContent(/Offline Reading Shelf/i);

    // 8. Full-Width Alignment for Description and Search Input Across All Resolutions
    const desc = screen.getByText(/Explore humanity's greatest public domain books/i);
    expect(desc).toHaveClass('w-full');

    const form = container.querySelector('form');
    expect(form).toHaveClass('w-full');
  });

  describe('HeroFeatureTypewriter component', () => {
    it('supports custom feature subsets for paired 2-column layout', () => {
      const subset = [
        { icon: Zap, title: 'Left Col 1', desc: 'Desc 1' },
        { icon: Zap, title: 'Left Col 2', desc: 'Desc 2' },
      ];
      render(<HeroFeatureTypewriter features={subset} testId="custom-ticker" />);
      expect(screen.getByTestId('custom-ticker')).toBeInTheDocument();
      expect(screen.getByText('Left Col 1')).toBeInTheDocument();
      expect(screen.getByText('Desc 1')).toBeInTheDocument();
    });
    it('renders initial Feature 1 statically for instant 0-CLS SSR hydration parity', () => {
      render(<HeroFeatureTypewriter />);
      const ticker = screen.getByTestId('hero-feature-typewriter');
      expect(ticker).toHaveClass('h-[72px]', 'sm:h-[76px]', 'overflow-hidden');
      expect(screen.getByText('100% Public Domain')).toBeInTheDocument();
      expect(screen.getByText('Pure Zero-Copyright (CC0) works.')).toBeInTheDocument();
    });

    it('cycles through states via fake timers: pause -> backspace -> pause_empty -> typing -> next feature', async () => {
      vi.useFakeTimers();
      const { unmount } = render(<HeroFeatureTypewriter />);

      // Initial state: Feature 1 full text
      expect(screen.getByText('100% Public Domain')).toBeInTheDocument();
      expect(screen.getByText('Pure Zero-Copyright (CC0) works.')).toBeInTheDocument();

      // Step through discrete timers across React state updates until Feature 2 is typed
      for (let i = 0; i < 150; i++) {
        act(() => {
          vi.advanceTimersToNextTimer();
        });
        if (screen.queryByText('Zero Setup or Keys')) {
          break;
        }
      }

      expect(screen.getByText('Zero Setup or Keys')).toBeInTheDocument();
      unmount();
      vi.useRealTimers();
    });

    it('bypasses typewriter character slicing when prefers-reduced-motion is active', () => {
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      render(<HeroFeatureTypewriter />);
      expect(screen.getByText('100% Public Domain')).toBeInTheDocument();
      expect(screen.getByText('Pure Zero-Copyright (CC0) works.')).toBeInTheDocument();
      window.matchMedia = originalMatchMedia;
    });

    it('auto-advances features every 5000ms when prefers-reduced-motion is active without character slicing', () => {
      vi.useFakeTimers();
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { unmount } = render(<HeroFeatureTypewriter />);
      expect(screen.getByText('100% Public Domain')).toBeInTheDocument();
      expect(screen.getByText('Pure Zero-Copyright (CC0) works.')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getByText('Zero Setup or Keys')).toBeInTheDocument();
      expect(screen.getByText('No accounts, paywalls, or tokens.')).toBeInTheDocument();

      unmount();
      window.matchMedia = originalMatchMedia;
      vi.useRealTimers();
    });

    it('steps through title typing, description typing, and backspace transitions seamlessly', () => {
      vi.useFakeTimers();
      const { unmount } = render(<HeroFeatureTypewriter />);

      // Pause period before deleting
      act(() => {
        vi.advanceTimersByTime(3600);
      });

      // Step until all characters are deleted and next feature is typed
      for (let i = 0; i < 200; i++) {
        act(() => {
          vi.advanceTimersToNextTimer();
        });
        if (screen.queryByText('No accounts, paywalls, or tokens.')) {
          break;
        }
      }

      // Advance one more tick to transition typing_desc -> paused
      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(screen.getByText('Zero Setup or Keys')).toBeInTheDocument();
      expect(screen.getByText('No accounts, paywalls, or tokens.')).toBeInTheDocument();
      unmount();
      vi.useRealTimers();
    });

    it('handles matchMedia throwing gracefully in reduced-motion listeners', () => {
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockImplementation(() => {
        throw new Error('matchMedia not supported');
      });

      render(<HeroFeatureTypewriter />);
      expect(screen.getByText('100% Public Domain')).toBeInTheDocument();

      window.matchMedia = originalMatchMedia;
    });

    it('enriches a custom featuredBook prop with database quotes when available in quote pool', async () => {
      const useBooksModule = await import('@/hooks/queries/useBooks');
      const customFeatured = {
        id: 1400,
        title: 'Custom Great Expectations',
        author: 'Charles Dickens',
        year: '1861',
        primarySubject: 'Fiction',
        coverUrl: 'https://example.com/cover.jpg',
        openingLine: '“Custom opening line.”',
        quoteExcerpt: '“Custom quote excerpt.”',
        volumeNumber: 'Vol. I',
        license: 'Public Domain',
      };

      const dbMatch = {
        id: 1400,
        title: 'Custom Great Expectations',
        authors: [{ name: 'Dickens, Charles', birth_year: 1812, death_year: 1870 }],
        translators: [],
        subjects: ['Fiction'],
        bookshelves: [],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: {},
        download_count: 50000,
        quotes: [
          {
            chapterLabel: 'Passage I • Database Edition',
            openingLine: '“Database Opening.”',
            quoteExcerpt: '“Database Excerpt.”',
          },
        ],
      };

      const enrichedSpy = vi
        .spyOn(useBooksModule, 'useQuoteEnrichedBooks')
        .mockReturnValue({
          data: [dbMatch],
        } as unknown as ReturnType<typeof useBooksModule.useQuoteEnrichedBooks>);

      renderWithClient(<HeroSearch search="" featuredBook={customFeatured} />);

      expect(screen.getAllByText(/Custom Great Expectations/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Database Excerpt/i)[0]).toBeInTheDocument();

      enrichedSpy.mockRestore();
    });

    it('cleanly tears down timers on unmount without errors or state leaks', () => {
      vi.useFakeTimers();
      const { unmount } = render(<HeroFeatureTypewriter />);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(() => unmount()).not.toThrow();
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      vi.useRealTimers();
    });
  });
});
