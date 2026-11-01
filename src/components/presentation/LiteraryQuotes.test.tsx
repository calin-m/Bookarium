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
    expect(section).toHaveClass('py-10', 'sm:py-16');

    const headerDivider = container.querySelector('.border-b');
    expect(headerDivider).toHaveClass('pb-6', 'sm:pb-8');
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

    // Rapid consecutive clicks to cover clearTimeout(shuffleTimerRef.current) and timer callback, ending on 3rd click ([id:4, id:5, id:6])
    act(() => {
      fireEvent.click(shuffleBtn);
    });
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

  it('expands anthology cards from Supabase public.books.quotes when useFeaturedQuotes or useQuoteEnrichedBooks returns spreads', async () => {
    const { vi } = await import('vitest');
    const useBooksModule = await import('@/hooks/queries/useBooks');

    const quotesSpy = vi.spyOn(useBooksModule, 'useFeaturedQuotes').mockReturnValue({
      data: {
        1342: [
          {
            chapterLabel: 'Passage I • Pride and Prejudice',
            openingLine: '“Primary Supabase Pride opening line with over twenty five letters.”',
            quoteExcerpt: '“Primary Supabase Pride quote excerpt with over twenty five letters.”',
          },
          {
            chapterLabel: 'Passage II • Pride and Prejudice',
            openingLine: '“Secondary Supabase Pride opening line with over twenty five letters.”',
            quoteExcerpt: '“Secondary Supabase Pride quote excerpt with over twenty five letters.”',
          },
        ],
      },
    } as unknown as ReturnType<typeof useBooksModule.useFeaturedQuotes>);

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
              openingLine: '“My father’s family name being Pirrip and my Christian name Philip.”',
              quoteExcerpt: '“Suffering has been stronger than all other teaching in my life.”',
            },
          ],
        },
      ],
    } as unknown as ReturnType<typeof useBooksModule.useQuoteEnrichedBooks>);

    render(<LiteraryQuotes />);
    expect(
      screen.getByText(/Primary Supabase Pride quote excerpt with over twenty five letters/i)
    ).toBeInTheDocument();

    enrichedSpy.mockRestore();
    quotesSpy.mockRestore();
  });
});

