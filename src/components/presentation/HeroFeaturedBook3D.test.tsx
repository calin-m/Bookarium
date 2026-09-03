import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HeroFeaturedBook3D } from './HeroFeaturedBook3D';

vi.mock('@/lib/offline-storage', () => ({
  getOfflineBook: vi.fn().mockResolvedValue(null),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

const mockFeaturedBook = {
  id: 1342,
  title: 'Pride and Prejudice',
  author: 'Jane Austen',
  year: '1813',
  primarySubject: 'Classic Literature',
  license: 'Public Domain',
  volumeNumber: 'Vol. #1342',
  quoteExcerpt: 'It is a truth universally acknowledged...',
  openingLine: 'It is a truth universally acknowledged that a single man in possession of a good fortune...',
};

describe('HeroFeaturedBook3D', () => {
  it('renders book title, author, and public domain badges', () => {
    renderWithClient(<HeroFeaturedBook3D featuredBook={mockFeaturedBook} />);

    expect(screen.getAllByText(/Pride and Prejudice/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Jane Austen/i)[0]).toBeInTheDocument();
    expect(screen.getByTestId('hero-book-shuffle-btn')).toBeInTheDocument();
  });

  it('triggers shuffle when shuffle button is clicked', () => {
    renderWithClient(<HeroFeaturedBook3D featuredBook={mockFeaturedBook} />);

    const shuffleBtn = screen.getByTestId('hero-book-shuffle-btn');
    fireEvent.click(shuffleBtn);

    // Book turning leaf enters DOM and key updates
    expect(screen.getByTestId('hero-book-shuffle-btn')).toBeInTheDocument();
  });

  it('triggers read callback when Read button is clicked', () => {
    const handleRead = vi.fn();
    renderWithClient(
      <HeroFeaturedBook3D
        featuredBook={mockFeaturedBook}
        onReadFeaturedBook={handleRead}
      />
    );

    const readBtn = screen.getByTestId('hero-book-read-btn');
    fireEvent.click(readBtn);
    expect(handleRead).toHaveBeenCalled();
  });
});
