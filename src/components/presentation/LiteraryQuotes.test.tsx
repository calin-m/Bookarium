import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { LiteraryQuotes } from './LiteraryQuotes';

describe('LiteraryQuotes component', () => {
  it('should render section heading, kicker, and 3 literary quote cards', () => {
    render(<LiteraryQuotes />);

    expect(screen.getByText(/Words That Shaped Humanity/i)).toBeInTheDocument();
    expect(screen.getByText(/TIMELESS VOICES & PASSAGES/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Discover more literary quotes/i)).toBeInTheDocument();

    const readLinks = screen.getAllByRole('link', { name: /Read/i });
    expect(readLinks.length).toBe(3);
  });

  it('should shuffle quotes when clicking Discover More button', () => {
    render(<LiteraryQuotes />);

    const shuffleBtn = screen.getByLabelText(/Discover more literary quotes/i);
    fireEvent.click(shuffleBtn);

    const readLinks = screen.getAllByRole('link', { name: /Read/i });
    expect(readLinks.length).toBe(3);
  });

  it('should have links pointing to valid /read/[id] routes', () => {
    render(<LiteraryQuotes />);

    const links = screen.getAllByRole('link');
    links.forEach((link) => {
      expect(link.getAttribute('href')).toMatch(/\/read\/\d+/);
    });
  });

  it('should cleanly unmount without errors during active shuffle', () => {
    const { unmount } = render(<LiteraryQuotes />);
    const shuffleBtn = screen.getByLabelText(/Discover more literary quotes/i);
    fireEvent.click(shuffleBtn);
    expect(() => unmount()).not.toThrow();
  });

  it('filters out quotes from protected authors in Life+100 jurisdiction (Mexico)', async () => {
    const { useJurisdictionStore } = await import('@/stores/useJurisdictionStore');
    const { act } = await import('@testing-library/react');

    act(() => {
      useJurisdictionStore.getState().setCountry('MX');
    });

    render(<LiteraryQuotes />);

    const shuffleBtn = screen.getByLabelText(/Discover more literary quotes/i);

    // Shuffle 5 times under Mexico jurisdiction; Gatsby and Sherlock Holmes must never appear
    for (let i = 0; i < 5; i++) {
      act(() => {
        fireEvent.click(shuffleBtn);
      });
      expect(screen.queryByText(/The Great Gatsby/i)).toBeNull();
      expect(screen.queryByText(/The Adventures of Sherlock Holmes/i)).toBeNull();
    }

    // Reset back to US
    act(() => {
      useJurisdictionStore.getState().setCountry('US');
    });
  });

  it('maintains strictly unique quote IDs and Project Gutenberg bookIds across all anthology entries', async () => {
    const { LITERARY_QUOTES } = await import('@/config/literary-quotes');
    const quoteIds = LITERARY_QUOTES.map((q) => q.id);
    const bookIds = LITERARY_QUOTES.map((q) => q.bookId);

    expect(new Set(quoteIds).size).toBe(LITERARY_QUOTES.length);
    expect(new Set(bookIds).size).toBe(LITERARY_QUOTES.length);
  });

  it('applies responsive section and balanced header divider spacing classes', () => {
    const { container } = render(<LiteraryQuotes />);
    const section = container.querySelector('section');
    expect(section).toHaveClass('pt-6', 'sm:pt-8', 'pb-10', 'sm:pb-16');

    const headerDivider = container.querySelector('.border-b');
    expect(headerDivider).toHaveClass('pb-6', 'sm:pb-8');

    const quoteCard = container.querySelector('[data-testid^="quote-card-"]');
    expect(quoteCard).toHaveClass('p-5', 'sm:p-8');
  });

  it('displays a single quote card on mobile while preserving multi-card on tablet/desktop, and aligns Discover More on a single row', () => {
    const { container } = render(<LiteraryQuotes />);
    const quoteCards = container.querySelectorAll('[data-testid^="quote-card-"]');
    expect(quoteCards).toHaveLength(3);

    // Card 0 is visible on mobile (flex); cards 1 and 2 are hidden on mobile (<sm) and flex on tablet/desktop (sm:flex)
    expect(quoteCards[0]).toHaveClass('flex');
    expect(quoteCards[0]).not.toHaveClass('hidden');
    expect(quoteCards[1]).toHaveClass('hidden', 'sm:flex');
    expect(quoteCards[2]).toHaveClass('hidden', 'sm:flex');

    const discoverBtn = screen.getByLabelText(/Discover more literary quotes/i);
    expect(discoverBtn).toHaveClass('shrink-0', 'whitespace-nowrap');
  });

  it('handles pre-mount fallback, rapid consecutive shuffles with timer completion, and jurisdiction backfill of shuffled quotes', async () => {
    const { vi } = await import('vitest');
    const { act } = await import('@testing-library/react');
    const hasMountedModule = await import('@/hooks/useHasMounted');
    const { useJurisdictionStore } = await import('@/stores/useJurisdictionStore');

    // 1. Pre-mount fallback (!hasMounted -> LITERARY_QUOTES.slice(0, 3))
    const mountSpy = vi.spyOn(hasMountedModule, 'useHasMounted').mockReturnValueOnce(false);
    const { unmount: unmountPre } = render(<LiteraryQuotes />);
    expect(screen.getAllByRole('link', { name: /Read/i })).toHaveLength(3);
    unmountPre();
    mountSpy.mockRestore();

    // 2. Deterministic shuffle selecting a Life+100 restricted quote (e.g. Sherlock Holmes id=6) then switching US -> MX to trigger backfill
    vi.useFakeTimers();
    const mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);

    act(() => {
      useJurisdictionStore.getState().setCountry('US');
    });

    render(<LiteraryQuotes />);
    const shuffleBtn = screen.getByLabelText(/Discover more literary quotes/i);

    // Rapid consecutive clicks to cover clearTimeout(shuffleTimerRef.current) and timer callback, ending on [id:4, id:5, id:6]
    act(() => {
      fireEvent.click(shuffleBtn);
      fireEvent.click(shuffleBtn);
      vi.advanceTimersByTime(350);
    });

    // Switch to MX so restricted shuffled quote is filtered out and backfilled from safeQuotes pool
    act(() => {
      useJurisdictionStore.getState().setCountry('MX');
    });
    expect(screen.getAllByRole('link', { name: /Read/i })).toHaveLength(3);

    act(() => {
      useJurisdictionStore.getState().setCountry('US');
    });
    mathRandomSpy.mockRestore();
    vi.useRealTimers();
  });

  it('populates anthology cards exclusively from useQuoteEnrichedBooks across 3 distinct books and disables redundant useFeaturedQuotes calls', async () => {
    const { vi } = await import('vitest');
    const useBooksModule = await import('@/hooks/queries/useBooks');

    const quotesSpy = vi.spyOn(useBooksModule, 'useFeaturedQuotes').mockReturnValue({
      data: {},
    } as unknown as ReturnType<typeof useBooksModule.useFeaturedQuotes>);

    const enrichedSpy = vi.spyOn(useBooksModule, 'useQuoteEnrichedBooks').mockReturnValue({
      isPoolSettled: true,
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
              openingLine: '“My father’s family name being Pirrip and my Christian name Philip.”',
              quoteExcerpt: '“Suffering has been stronger than all other teaching in my life.”',
            },
            {
              chapterLabel: 'Passage II • Great Expectations',
              openingLine: '“Take nothing on its looks; take everything on evidence.”',
              quoteExcerpt: '“Heaven knows we need never be ashamed of our tears.”',
            },
          ],
        },
        {
          id: 84,
          title: 'Frankenstein',
          authors: [{ name: 'Shelley, Mary', birth_year: 1797, death_year: 1851 }],
          translators: [],
          subjects: ['Gothic fiction'],
          bookshelves: [],
          languages: ['en'],
          copyright: false,
          media_type: 'Text',
          formats: {},
          download_count: 85000,
          quotes: [
            {
              chapterLabel: 'Passage I • Frankenstein',
              openingLine: '“You will rejoice to hear that no disaster has accompanied the commencement.”',
              quoteExcerpt: '“Beware; for I am fearless, and therefore powerful.”',
            },
            {
              chapterLabel: 'Passage II • Frankenstein',
              openingLine: '“Nothing is so painful to the human mind as a great and sudden change.”',
              quoteExcerpt: '“Life, although it may only be an accumulation of anguish, is dear to me.”',
            },
          ],
        },
        {
          id: 2701,
          title: 'Moby Dick',
          authors: [{ name: 'Melville, Herman', birth_year: 1819, death_year: 1891 }],
          translators: [],
          subjects: ['Whaling'],
          bookshelves: [],
          languages: ['en'],
          copyright: false,
          media_type: 'Text',
          formats: {},
          download_count: 60000,
          quotes: [
            {
              chapterLabel: 'Passage I • Moby Dick',
              openingLine: '“Call me Ishmael. Some years ago—never mind how long precisely.”',
              quoteExcerpt: '“Whenever it is a damp, drizzly November in my soul, I account it high time to get to sea.”',
            },
          ],
        },
      ],
    } as unknown as ReturnType<typeof useBooksModule.useQuoteEnrichedBooks>);

    render(<LiteraryQuotes />);
    // Initial 3 cards must come from the 3 distinct DB books (#1400, #84, #2701)
    expect(
      screen.getByText(/Suffering has been stronger than all other teaching in my life/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Beware; for I am fearless, and therefore powerful/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Whenever it is a damp, drizzly November in my soul/i)
    ).toBeInTheDocument();

    // Because useQuoteEnrichedBooks is populated, useFeaturedQuotes is called with [] and enabled: false
    const requestedIds = quotesSpy.mock.calls[0]?.[0] || [];
    const optionsArg = quotesSpy.mock.calls[0]?.[1];
    expect(requestedIds).toEqual([]);
    expect(optionsArg?.enabled).toBe(false);

    // Clicking Discover More when only 3 books exist (with multiple passages on #1400 & #84) rotates to unseen passages via fallbackBookQuotes
    fireEvent.click(screen.getByLabelText(/Discover more literary quotes/i));
    expect(
      screen.getByText(/Heaven knows we need never be ashamed of our tears/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Life, although it may only be an accumulation of anguish, is dear to me/i)
    ).toBeInTheDocument();

    enrichedSpy.mockRestore();
    quotesSpy.mockRestore();
  });

  it('rotates strictly to 3 unseen books on Discover More when 6+ quote-enriched books exist regardless of per-book passage count', async () => {
    const { vi } = await import('vitest');
    const useBooksModule = await import('@/hooks/queries/useBooks');

    const enrichedSpy = vi.spyOn(useBooksModule, 'useQuoteEnrichedBooks').mockReturnValue({
      isPoolSettled: true,
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
          download_count: 90000,
          quotes: [
            {
              chapterLabel: 'Passage I',
              openingLine: '“My father’s family name being Pirrip.”',
              quoteExcerpt: '“Suffering has been stronger than all other teaching in my life.”',
            },
            {
              chapterLabel: 'Passage II',
              openingLine: '“Take nothing on its looks; take everything on evidence.”',
              quoteExcerpt: '“Heaven knows we need never be ashamed of our tears.”',
            },
          ],
        },
        {
          id: 84,
          title: 'Frankenstein',
          authors: [{ name: 'Shelley, Mary', birth_year: 1797, death_year: 1851 }],
          translators: [],
          subjects: ['Gothic fiction'],
          bookshelves: [],
          languages: ['en'],
          copyright: false,
          media_type: 'Text',
          formats: {},
          download_count: 85000,
          quotes: [
            {
              chapterLabel: 'Passage I',
              openingLine: '“You will rejoice to hear that no disaster has accompanied.”',
              quoteExcerpt: '“Beware; for I am fearless, and therefore powerful.”',
            },
            {
              chapterLabel: 'Passage II',
              openingLine: '“Nothing is so painful to the human mind as a great change.”',
              quoteExcerpt: '“Life, although it may only be an accumulation of anguish, is dear to me.”',
            },
          ],
        },
        {
          id: 2701,
          title: 'Moby Dick',
          authors: [{ name: 'Melville, Herman', birth_year: 1819, death_year: 1891 }],
          translators: [],
          subjects: ['Whaling'],
          bookshelves: [],
          languages: ['en'],
          copyright: false,
          media_type: 'Text',
          formats: {},
          download_count: 80000,
          quotes: [
            {
              chapterLabel: 'Passage I',
              openingLine: '“Call me Ishmael.”',
              quoteExcerpt: '“Whenever it is a damp, drizzly November in my soul, I account it high time to get to sea.”',
            },
            {
              chapterLabel: 'Passage II',
              openingLine: '“There is a wisdom that is woe.”',
              quoteExcerpt: '“It is not down on any map; true places never are in this world.”',
            },
          ],
        },
        {
          id: 1342,
          title: 'Pride and Prejudice',
          authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
          translators: [],
          subjects: ['Courtship'],
          bookshelves: [],
          languages: ['en'],
          copyright: false,
          media_type: 'Text',
          formats: {},
          download_count: 75000,
          quotes: [
            {
              chapterLabel: 'Passage I',
              openingLine: '“It is a truth universally acknowledged.”',
              quoteExcerpt: '“I declare after all there is no enjoyment like reading!”',
            },
            {
              chapterLabel: 'Passage II',
              openingLine: '“Vanity and pride are different things, though the words are often used synonymously.”',
              quoteExcerpt: '“There is a stubbornness about me that never can bear to be frightened at the will of others.”',
            },
          ],
        },
        {
          id: 98,
          title: 'A Tale of Two Cities',
          authors: [{ name: 'Dickens, Charles', birth_year: 1812, death_year: 1870 }],
          translators: [],
          subjects: ['French Revolution'],
          bookshelves: [],
          languages: ['en'],
          copyright: false,
          media_type: 'Text',
          formats: {},
          download_count: 70000,
          quotes: [
            {
              chapterLabel: 'Passage I',
              openingLine: '“It was the best of times, it was the worst of times.”',
              quoteExcerpt: '“It is a far, far better thing that I do, than I have ever done.”',
            },
          ],
        },
        {
          id: 174,
          title: 'The Picture of Dorian Gray',
          authors: [{ name: 'Wilde, Oscar', birth_year: 1854, death_year: 1900 }],
          translators: [],
          subjects: ['Philosophical fiction'],
          bookshelves: [],
          languages: ['en'],
          copyright: false,
          media_type: 'Text',
          formats: {},
          download_count: 65000,
          quotes: [
            {
              chapterLabel: 'Passage I',
              openingLine: '“The studio was filled with the rich odour of roses.”',
              quoteExcerpt: '“The only way to get rid of a temptation is to yield to it.”',
            },
          ],
        },
      ],
    } as unknown as ReturnType<typeof useBooksModule.useQuoteEnrichedBooks>);

    render(<LiteraryQuotes />);
    // Initial render shows 3 distinct books from quoteEnrichedBooks (#1400, #84, #2701, #1342, #98, #174)
    const initialLinks = screen.getAllByRole('link', { name: /Read/i });
    expect(initialLinks).toHaveLength(3);

    // Initial books displayed must be 3 distinct books from the pool
    const renderedTitles = ['Great Expectations', 'Frankenstein', 'Moby Dick', 'Pride and Prejudice', 'A Tale of Two Cities', 'The Picture of Dorian Gray'];
    const initialVisibleTitles = renderedTitles.filter((t) => screen.queryByText(t) !== null);
    expect(initialVisibleTitles).toHaveLength(3);

    // Clicking Discover More must exclude the 3 currently visible books and display the remaining 3 unseen books
    fireEvent.click(screen.getByLabelText(/Discover more literary quotes/i));
    const unseenTitles = renderedTitles.filter((t) => !initialVisibleTitles.includes(t));
    expect(unseenTitles).toHaveLength(3);
    for (const title of unseenTitles) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    for (const title of initialVisibleTitles) {
      expect(screen.queryByText(title)).toBeNull();
    }

    enrichedSpy.mockRestore();
  });

  it('tops up with baseSafeQuotes when quoteEnrichedBooks has fewer than 3 valid books and deduplicates identical quote IDs', async () => {
    const { vi } = await import('vitest');
    const useBooksModule = await import('@/hooks/queries/useBooks');

    const quotesSpy = vi.spyOn(useBooksModule, 'useFeaturedQuotes').mockReturnValue({
      data: {
        1342: [
          {
            chapterLabel: 'Passage I • Pride and Prejudice',
            openingLine: '“It is a truth universally acknowledged that a single man.”',
            quoteExcerpt: '“I declare after all there is no enjoyment like reading!”',
          },
        ],
      },
    } as unknown as ReturnType<typeof useBooksModule.useFeaturedQuotes>);

    // Only 1 book in quoteEnrichedBooks so seenBookIds.size < 3 triggers baseSafeQuotes top-up
    const enrichedSpy = vi.spyOn(useBooksModule, 'useQuoteEnrichedBooks').mockReturnValue({
      isPoolSettled: true,
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
              quoteExcerpt: '“Suffering has been stronger than all other teaching in my life.”',
            },
          ],
        },
      ],
    } as unknown as ReturnType<typeof useBooksModule.useQuoteEnrichedBooks>);

    render(<LiteraryQuotes />);
    // Should render Great Expectations + topped up baseSafeQuotes
    expect(screen.getByText(/Suffering has been stronger than all other teaching in my life/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Read/i })).toHaveLength(3);

    enrichedSpy.mockRestore();
    quotesSpy.mockRestore();
  });

  it('excludes quote-enriched volumes that are restricted in the current user jurisdiction', async () => {
    const { vi } = await import('vitest');
    const useBooksModule = await import('@/hooks/queries/useBooks');
    const copyrightModule = await import('@/lib/copyright-engine');

    const copyrightSpy = vi.spyOn(copyrightModule, 'isBookPublicDomainInJurisdiction').mockImplementation((book) => {
      if (book && 'id' in book && book.id === 9999) {
        return { isAllowed: false, country: 'US', rule: 'US_PUBLIC_DOMAIN', reason: 'Restricted in territory' };
      }
      return { isAllowed: true, country: 'US', rule: 'US_PUBLIC_DOMAIN', reason: 'Public Domain' };
    });

    const enrichedSpy = vi.spyOn(useBooksModule, 'useQuoteEnrichedBooks').mockReturnValue({
      isPoolSettled: true,
      data: [
        {
          id: 9999,
          title: 'Restricted Modern Volume',
          authors: [{ name: 'Restricted Author', birth_year: 1950, death_year: 2020 }],
          translators: [],
          subjects: ['Literature'],
          bookshelves: [],
          languages: ['en'],
          copyright: false,
          media_type: 'Text',
          formats: {},
          download_count: 50000,
          quotes: [
            {
              chapterLabel: 'Passage I',
              openingLine: '“Restricted opening text.”',
              quoteExcerpt: '“Restricted excerpt that should never show.”',
            },
          ],
        },
      ],
    } as unknown as ReturnType<typeof useBooksModule.useQuoteEnrichedBooks>);

    render(<LiteraryQuotes />);

    expect(screen.queryByText(/Restricted excerpt that should never show/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Read/i })).toHaveLength(3);

    enrichedSpy.mockRestore();
    copyrightSpy.mockRestore();
  });

  it('deterministically rotates literary quote trios based on hourlySeed without throwing or duplicating books', async () => {
    const { selectHourlyLiteraryQuotes, LITERARY_QUOTES } = await import(
      '@/config/literary-quotes'
    );

    const hour1 = selectHourlyLiteraryQuotes(LITERARY_QUOTES, 100, 3);
    const hour2 = selectHourlyLiteraryQuotes(LITERARY_QUOTES, 101, 3);

    expect(hour1).toHaveLength(3);
    expect(hour2).toHaveLength(3);

    // Assert that each hour selects distinct books
    const hour1Books = new Set(hour1.map((q) => q.bookId));
    const hour2Books = new Set(hour2.map((q) => q.bookId));
    expect(hour1Books.size).toBe(3);
    expect(hour2Books.size).toBe(3);

    // Assert that advancing by 1 hour produces a shifted selection
    const hour1Ids = hour1.map((q) => q.id);
    const hour2Ids = hour2.map((q) => q.id);
    expect(hour1Ids).not.toEqual(hour2Ids);
  });

  it('holds the quote grid invisible and disables Discover More until the quote pool settles, then reveals once', async () => {
    const { vi } = await import('vitest');
    const useBooksModule = await import('@/hooks/queries/useBooks');

    const enrichedSpy = vi.spyOn(useBooksModule, 'useQuoteEnrichedBooks').mockReturnValue({
      isPoolSettled: false,
      data: undefined,
    } as unknown as ReturnType<typeof useBooksModule.useQuoteEnrichedBooks>);
    const featuredQuotesSpy = vi.spyOn(useBooksModule, 'useFeaturedQuotes').mockReturnValue({
      data: undefined,
    } as unknown as ReturnType<typeof useBooksModule.useFeaturedQuotes>);

    const { rerender } = render(<LiteraryQuotes />);

    const grid = screen.getByTestId('literary-quotes-grid');
    const shuffleBtn = screen.getByLabelText(/Discover more literary quotes/i);
    expect(grid).toHaveAttribute('aria-busy', 'true');
    expect(grid.className).toContain('opacity-0');
    expect(grid.className).not.toContain('animate-ink-appear');
    expect(shuffleBtn).toBeDisabled();
    expect(featuredQuotesSpy).toHaveBeenLastCalledWith(
      expect.any(Array),
      expect.objectContaining({ enabled: false })
    );

    enrichedSpy.mockReturnValue({
      isPoolSettled: true,
      data: undefined,
    } as unknown as ReturnType<typeof useBooksModule.useQuoteEnrichedBooks>);
    rerender(<LiteraryQuotes />);

    expect(screen.getByTestId('literary-quotes-grid')).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByTestId('literary-quotes-grid').className).toContain('animate-ink-appear');
    expect(screen.getByTestId('literary-quotes-grid').className).not.toContain('opacity-0');
    expect(screen.getByLabelText(/Discover more literary quotes/i)).toBeEnabled();
    expect(featuredQuotesSpy).toHaveBeenLastCalledWith(
      expect.any(Array),
      expect.objectContaining({ enabled: true })
    );

    featuredQuotesSpy.mockRestore();
    enrichedSpy.mockRestore();
  });
});

