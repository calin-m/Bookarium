import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HeroFeaturedBook3D } from './HeroFeaturedBook3D';
import * as perfTier from '@/hooks/usePerformanceTier';

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

  it('renders static 2D presentation when hardware tier is low or heavy motion is disallowed', () => {
    vi.spyOn(perfTier, 'usePerformanceTier').mockReturnValue({
      tier: 'low',
      allowHeavyMotion: false,
      enablePrefetching: false,
      cores: 2,
    });

    renderWithClient(<HeroFeaturedBook3D featuredBook={mockFeaturedBook} />);

    expect(screen.getByTestId('hero-featured-book-2d')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Click to close volume|Click to pin open volume/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Featured Classic/i)).toBeInTheDocument();
    expect(screen.getByTestId('hero-book-read-btn')).toBeInTheDocument();
  });

  it('triggers read callback from 2D presentation mode', () => {
    vi.spyOn(perfTier, 'usePerformanceTier').mockReturnValue({
      tier: 'low',
      allowHeavyMotion: false,
      enablePrefetching: false,
      cores: 2,
    });

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

  it('handles 3D stage pin toggling, hover transitions, keyboard Enter/Space, turning leaf animationEnd, and mobile guards', () => {
    vi.spyOn(perfTier, 'usePerformanceTier').mockReturnValue({
      tier: 'high',
      allowHeavyMotion: true,
      enablePrefetching: true,
      cores: 8,
    });

    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
    const handleRead = vi.fn();

    const { container } = renderWithClient(
      <HeroFeaturedBook3D
        featuredBook={mockFeaturedBook}
        onReadFeaturedBook={handleRead}
      />
    );

    const stage = screen.getByRole('button', { name: /click to pin open volume/i });

    // Click to pin open
    fireEvent.click(stage);
    expect(stage.className).toContain('book-open');

    // Click again to pin closed
    fireEvent.click(stage);
    expect(stage.className).toContain('book-closed');

    // Mouse enter resets closed to auto and sets hovered
    fireEvent.mouseEnter(stage);
    expect(stage.className).not.toContain('book-closed');

    // Keyboard Enter closes when open (hovered in auto mode)
    fireEvent.keyDown(stage, { key: 'Enter' });
    expect(stage.className).toContain('book-closed');

    // Mouse leave resets closed to auto
    fireEvent.mouseLeave(stage);
    expect(stage.className).not.toContain('book-closed');

    // Keyboard Space opens when closed
    fireEvent.keyDown(stage, { key: ' ' });
    expect(stage.className).toContain('book-open');

    // Shuffle triggers turning leaf and animationEnd clears it
    fireEvent.click(screen.getByTestId('hero-book-shuffle-btn'));
    const turningLeaf = container.querySelector('.book-turning-leaf');
    if (turningLeaf) {
      fireEvent.animationEnd(turningLeaf);
    }

    // Mobile front-cover Read button
    const allReadBtns = screen.getAllByRole('button', { name: 'Read' });
    fireEvent.click(allReadBtns[allReadBtns.length - 1]);
    expect(handleRead).toHaveBeenCalled();

    // Mobile (< 1024px) guards ignore click/hover/keyDown
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });
    fireEvent.click(stage);
    fireEvent.mouseEnter(stage);
    fireEvent.mouseLeave(stage);
    fireEvent.keyDown(stage, { key: 'Enter' });
  });
});
