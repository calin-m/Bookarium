import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { EditorialQuoteSection } from './EditorialQuoteSection';
import { useReaderStore } from '@/stores/useReaderStore';
import {
  getHourlyHeroBook,
  getDailyEditorialBook,
} from '@/config/featured-books';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('EditorialQuoteSection component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReaderStore.setState({ currentBook: null, isOpen: false });
  });

  it('renders section landmark, Classic of the Day badge, and book details', () => {
    render(<EditorialQuoteSection />);

    expect(screen.getByRole('region', { name: /Classic of the Day/i })).toBeInTheDocument();
    expect(screen.getByText(/Classic of the Day/i)).toBeInTheDocument();
    expect(screen.getByTestId('editorial-classic-card')).toBeInTheDocument();
    expect(screen.getByText(/Preserved for Public Humanity/i)).toBeInTheDocument();

    const currentHero = getHourlyHeroBook();
    const expectedBook = getDailyEditorialBook(currentHero.id);

    expect(screen.getByText(expectedBook.title)).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(expectedBook.author, 'i')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(new RegExp(expectedBook.quoteExcerpt, 'i'))).toBeInTheDocument();
  });

  it('navigates to reader and dispatches openReader on button click', () => {
    render(<EditorialQuoteSection />);

    const currentHero = getHourlyHeroBook();
    const expectedBook = getDailyEditorialBook(currentHero.id);

    const button = screen.getByRole('button', { name: new RegExp(`Start reading ${expectedBook.title}`, 'i') });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);

    expect(mockPush).toHaveBeenCalledWith(`/read/${expectedBook.id}`);
    const currentBook = useReaderStore.getState().currentBook;
    expect(currentBook).not.toBeNull();
    expect(currentBook?.id).toBe(expectedBook.id);
    expect(currentBook?.title).toBe(expectedBook.title);
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
});
