import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { EditorialQuoteSection } from './EditorialQuoteSection';
import { useReaderStore } from '@/stores/useReaderStore';
import {
  getHourlyHeroBook,
  getDailyEditorialBook,
  FEATURED_HERO_BOOKS,
} from '@/config/featured-books';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('EditorialQuoteSection component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useReaderStore.setState({ currentBook: null, isOpen: false });
  });

  it('renders section landmark, Classic of the Day badge, and book details', () => {
    const { container } = render(<EditorialQuoteSection />);

    const region = screen.getByRole('region', { name: /Classic of the Day/i });
    expect(region).toBeInTheDocument();
    expect(region).toHaveClass('py-10', 'sm:py-16');

    const cardContainer = container.querySelector('.bg-card');
    expect(cardContainer).toHaveClass('p-6', 'sm:p-12');

    expect(screen.getByText(/Classic of the Day/i)).toBeInTheDocument();
    expect(screen.getByTestId('editorial-classic-card')).toBeInTheDocument();
    expect(screen.getByText(/Preserved for Public Humanity/i)).toBeInTheDocument();

    const currentHero = getHourlyHeroBook();
    const expectedBook = getDailyEditorialBook(currentHero.id);

    expect(screen.getByText(expectedBook.title)).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(expectedBook.author, 'i')).length).toBeGreaterThanOrEqual(1);
    const cleanExcerpt = expectedBook.quoteExcerpt.replace(/^[“"'\s]+|[”"'\s]+$/g, '');
    expect(screen.getByText((content) => content.includes(cleanExcerpt))).toBeInTheDocument();
  });

  it('navigates to reader and dispatches openReader on button click', () => {
    render(<EditorialQuoteSection />);

    const currentHero = getHourlyHeroBook();
    const expectedBook = getDailyEditorialBook(currentHero.id);

    const button = screen.getByRole('button', { name: new RegExp(`Start reading ${expectedBook.title}`, 'i') });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Start Reading');

    fireEvent.click(button);

    expect(mockPush).toHaveBeenCalledWith(`/read/${expectedBook.id}`);
    const currentBook = useReaderStore.getState().currentBook;
    expect(currentBook).not.toBeNull();
    expect(currentBook?.id).toBe(expectedBook.id);
    expect(currentBook?.title).toBe(expectedBook.title);
    const firstAuthor = currentBook?.authors?.[0];
    const authorObj = typeof firstAuthor === 'object' && firstAuthor !== null ? firstAuthor : null;
    expect(authorObj?.birth_year).toBe(expectedBook.authorBirthYear ?? null);
    expect(authorObj?.death_year).toBe(expectedBook.authorDeathYear ?? null);
    expect(currentBook?.translators).toEqual(expectedBook.translators || []);
  });

  it('navigates to reader when tapping or pressing enter on the classic book cover card', () => {
    render(<EditorialQuoteSection />);

    const currentHero = getHourlyHeroBook();
    const expectedBook = getDailyEditorialBook(currentHero.id);

    const card = screen.getByTestId('editorial-classic-card');
    expect(card).toHaveAttribute('role', 'button');
    expect(card).toHaveClass('cursor-pointer');

    // Click card
    fireEvent.click(card);
    expect(mockPush).toHaveBeenCalledWith(`/read/${expectedBook.id}`);

    // Keyboard Enter trigger
    mockPush.mockClear();
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(mockPush).toHaveBeenCalledWith(`/read/${expectedBook.id}`);
  });

  it('filters out books protected in Life+100 jurisdiction (Mexico)', async () => {
    const { useJurisdictionStore } = await import('@/stores/useJurisdictionStore');
    act(() => {
      useJurisdictionStore.getState().setCountry('MX');
    });

    render(<EditorialQuoteSection />);

    // In Mexico, Gatsby, Sherlock Holmes, and The Time Machine must never render
    expect(screen.queryByText('The Great Gatsby')).toBeNull();
    expect(screen.queryByText('The Adventures of Sherlock Holmes')).toBeNull();

    // Reset back to US
    act(() => {
      useJurisdictionStore.getState().setCountry('US');
    });
  });

  it('dynamically avoids collision when heroBookId matches candidate book', () => {
    const rawDailyBook = getDailyEditorialBook(undefined);

    // Pass the raw candidate ID as the heroBookId to force collision avoidance
    render(<EditorialQuoteSection heroBookId={rawDailyBook.id} />);

    // Must NOT render the colliding hero book
    expect(screen.queryByRole('button', { name: new RegExp(`Start reading ${rawDailyBook.title}$`, 'i') })).toBeNull();

    // Must render the alternative book
    const avoidedBook = getDailyEditorialBook(rawDailyBook.id);
    expect(avoidedBook.id).not.toBe(rawDailyBook.id);
    expect(screen.getByText(avoidedBook.title)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(`Start reading ${avoidedBook.title}`, 'i') })).toBeInTheDocument();
  });

  it('accepts custom className and applies it to root section', () => {
    const { container } = render(<EditorialQuoteSection className="custom-test-class" />);
    const section = container.querySelector('section');
    expect(section).toHaveClass('custom-test-class');
  });

  it('selects Classic of the Day strictly from Classics in useQuoteEnrichedBooks and prioritizes database quotes over static quoteExcerpt', async () => {
    const useBooksModule = await import('@/hooks/queries/useBooks');

    const enrichedSpy = vi.spyOn(useBooksModule, 'useQuoteEnrichedBooks').mockReturnValue({
      isPoolSettled: true,
      data: [
        {
          id: 75001,
          title: 'Modern Aviation Manual',
          authors: [{ name: 'Modern, Author', birth_year: 1895, death_year: 1945 }],
          translators: [],
          subjects: ['Aeronautics'],
          bookshelves: ['Technology'],
          languages: ['en'],
          copyright: false,
          media_type: 'Text',
          formats: {},
          download_count: 85000,
          quotes: [
            {
              chapterLabel: 'Chapter I',
              openingLine: '“Modern non-classic quote that should be filtered out of Classic of the Day.”',
              quoteExcerpt: '“Modern non-classic quote that should be filtered out of Classic of the Day.”',
            },
          ],
        },
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
          download_count: 55000,
          quotes: [
            {
              chapterLabel: 'Passage I',
              openingLine: '“Primary Supabase opening line for classic of the day.”',
              quoteExcerpt: '“Primary Supabase quote excerpt for classic of the day.”',
            },
          ],
        },
      ],
    } as unknown as ReturnType<typeof useBooksModule.useQuoteEnrichedBooks>);

    render(<EditorialQuoteSection heroBookId={75001} />);
    expect(screen.getByText('Great Expectations')).toBeInTheDocument();
    expect(screen.queryByText('Modern Aviation Manual')).toBeNull();
    expect(
      screen.getByText((content) =>
        content.includes('Primary Supabase quote excerpt for classic of the day.')
      )
    ).toBeInTheDocument();

    enrichedSpy.mockRestore();
  });

  it('holds the Classic of the Day card invisible until the quote pool settles, then reveals it once', async () => {
    const useBooksModule = await import('@/hooks/queries/useBooks');

    const enrichedSpy = vi.spyOn(useBooksModule, 'useQuoteEnrichedBooks').mockReturnValue({
      isPoolSettled: false,
      data: undefined,
    } as unknown as ReturnType<typeof useBooksModule.useQuoteEnrichedBooks>);

    const { rerender } = render(<EditorialQuoteSection />);

    const body = screen.getByTestId('editorial-classic-body');
    expect(body).toHaveAttribute('aria-busy', 'true');
    expect(body.className).toContain('opacity-0');
    expect(body.className).not.toContain('animate-ink-appear');

    enrichedSpy.mockReturnValue({
      isPoolSettled: true,
      data: undefined,
    } as unknown as ReturnType<typeof useBooksModule.useQuoteEnrichedBooks>);
    rerender(<EditorialQuoteSection />);

    const settledBody = screen.getByTestId('editorial-classic-body');
    expect(settledBody).toHaveAttribute('aria-busy', 'false');
    expect(settledBody.className).toContain('animate-ink-appear');
    expect(settledBody.className).not.toContain('opacity-0');

    enrichedSpy.mockRestore();
  });

  describe.each(FEATURED_HERO_BOOKS)(
    'universal rendering for "$title"',
    (targetBook) => {
      it(`renders title, author, and quote without punctuation or regex issues`, () => {
        const targetIndex = FEATURED_HERO_BOOKS.findIndex((b) => b.id === targetBook.id);
        vi.spyOn(Date, 'now').mockReturnValue(targetIndex * 86400000);

        render(<EditorialQuoteSection heroBookId={-1} />);

        expect(screen.getByText(targetBook.title)).toBeInTheDocument();
        expect(screen.getAllByText(new RegExp(targetBook.author, 'i')).length).toBeGreaterThanOrEqual(1);
        const cleanExcerpt = targetBook.quoteExcerpt.replace(/^[“"'\s]+|[”"'\s]+$/g, '');
        expect(
          screen.getByText((content) => content.includes(cleanExcerpt))
        ).toBeInTheDocument();
      });
    }
  );
});
