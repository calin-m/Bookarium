import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HeroFeaturedBook3D } from './HeroFeaturedBook3D';
import * as perfTier from '@/hooks/usePerformanceTier';
import * as touchHook from '@/hooks/useTouchDevice';

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
  quotes: [
    {
      chapterLabel: 'Chapter I • The Opening Incipit',
      openingLine:
        '“It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.”',
      secondaryQuote:
        '“She is tolerable; but not handsome enough to tempt me; and I am in no humour at present to give consequence to young ladies that are slighted by other men.”',
      quoteExcerpt:
        '“I declare after all there is no enjoyment like reading! How much sooner one tires of any thing than of a book! When I have a house of my own, I shall be miserable if I have not an excellent library.”',
      rightPageQuote2:
        '“You have bewitched me, body and soul, and I love, I love, I love you. I never wish to be parted from you from this day on.”',
      commentary:
        'Elizabeth Bennet on intellectual independence, wit, and the social comedy of Regency England.',
    },
    {
      chapterLabel: 'Chapter XXXIV • Darcy’s Confession',
      openingLine:
        '“In vain I have struggled. It will not do. My feelings will not be repressed. You must allow me to tell you how ardently I admire and love you.”',
      secondaryQuote:
        '“Had you behaved in a more gentlemanlike manner, you could not have spared me the concern which I might have felt in refusing you.”',
      quoteExcerpt:
        '“I could easily forgive his pride, if he had not mortified mine.”',
      rightPageQuote2:
        '“There is a stubbornness about me that never can bear to be frightened at the will of others. My courage always rises at every attempt to intimidate me.”',
      commentary:
        'The dramatic turning point at Hunsford Parsonage where prejudice and pride collide head-on.',
    },
  ],
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

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });
    const copyBlock2D = screen.getByTestId('hero-2d-copy-meta-1342');
    expect(copyBlock2D).toHaveAttribute('data-tooltip', 'Pride and Prejudice — by Jane Austen');
    fireEvent.click(copyBlock2D);
    fireEvent.keyDown(copyBlock2D, { key: 'Enter' });
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringMatching(/\/read\/1342$/));
    expect(screen.getByTestId('copy-book-link-indicator-1342')).toHaveTextContent('Copied!');
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

  it('dismisses open volume when clicking or tapping outside the 3D book stage', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
    renderWithClient(<HeroFeaturedBook3D featuredBook={mockFeaturedBook} />);

    const stage = screen.getByRole('button', { name: /click to pin open volume/i });
    fireEvent.click(stage);
    expect(stage.className).toContain('book-open');

    // Tapping outside stage on document dismisses open book
    const outsideElement = document.createElement('div');
    document.body.appendChild(outsideElement);
    fireEvent.pointerDown(outsideElement);

    expect(stage.className).toContain('book-closed');
    document.body.removeChild(outsideElement);
  });

  it('dismisses open volume when clicking the explicit close button on open spread', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
    renderWithClient(<HeroFeaturedBook3D featuredBook={mockFeaturedBook} />);

    const stage = screen.getByRole('button', { name: /click to pin open volume/i });
    fireEvent.click(stage);
    expect(stage.className).toContain('book-open');

    const closeBtn = screen.getByTestId('hero-book-close-btn');
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);

    expect(stage.className).toContain('book-closed');
  });

  it('dynamically adapts fluid kinematics CSS variables across tablet landscape and desktop resolutions', () => {
    // 1024px iPad landscape
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    renderWithClient(<HeroFeaturedBook3D featuredBook={mockFeaturedBook} />);

    const stage = screen.getByRole('button', { name: /click to pin open volume/i });
    expect(stage.style.getPropertyValue('--hero-open-scale')).toBe('0.61');
    expect(stage.style.getPropertyValue('--hero-open-tx')).toBe('73px');

    // 1142px Lenovo Tab Plus 2K landscape
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1142 });
    fireEvent(window, new Event('resize'));
    expect(stage.style.getPropertyValue('--hero-open-scale')).toBe('0.69');
    expect(stage.style.getPropertyValue('--hero-open-tx')).toBe('83px');

    // 1280px iPad Pro / Galaxy Tab / laptop
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
    fireEvent(window, new Event('resize'));
    expect(stage.style.getPropertyValue('--hero-open-scale')).toBe('0.78');
    expect(stage.style.getPropertyValue('--hero-open-tx')).toBe('93px');

    // 1536px Wide Desktop
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1536 });
    fireEvent(window, new Event('resize'));
    expect(stage.style.getPropertyValue('--hero-open-scale')).toBe('0.84');
    expect(stage.style.getPropertyValue('--hero-open-tx')).toBe('115px');
  });

  it('prevents synthesized touch hover from overriding closed state on touch devices', () => {
    vi.spyOn(touchHook, 'useTouchDevice').mockReturnValue(true);
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1142 });

    renderWithClient(<HeroFeaturedBook3D featuredBook={mockFeaturedBook} />);
    const stage = screen.getByRole('button', { name: /click to pin open volume/i });

    // Open book by clicking
    fireEvent.click(stage);
    expect(stage.className).toContain('book-open');

    // Close book by clicking
    fireEvent.click(stage);
    expect(stage.className).toContain('book-closed');

    // Synthesized mouseEnter on touch screen MUST NOT reset closed state
    fireEvent.mouseEnter(stage);
    expect(stage.className).toContain('book-closed');
  });

  it('renders multi-quote Catalog-aligned spreads, supports ArrowRight shuffle when open, and handles 3D copy-link actions', () => {
    vi.spyOn(perfTier, 'usePerformanceTier').mockReturnValue({
      tier: 'high',
      allowHeavyMotion: true,
      enablePrefetching: true,
      cores: 8,
    });
    vi.spyOn(touchHook, 'useTouchDevice').mockReturnValue(false);
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });

    renderWithClient(<HeroFeaturedBook3D featuredBook={mockFeaturedBook} />);
    const stage = screen.getByRole('button', { name: /click to pin open volume/i });

    // Open book
    fireEvent.click(stage);
    expect(stage.className).toContain('book-open');

    // Verify secondaryQuote, rightPageQuote2, and commentary are rendered without double quotation marks
    expect(screen.getAllByText(/no enjoyment like reading/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/You have bewitched me/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Elizabeth Bennet on intellectual independence/i)[0]).toBeInTheDocument();

    // 3D copy-link click and keyDown
    const copyBlocks3D = screen.getAllByTestId('hero-3d-copy-meta-1342');
    fireEvent.click(copyBlocks3D[0]);
    fireEvent.keyDown(copyBlocks3D[0], { key: 'Enter' });

    // Clicking a child element inside [data-copy-book-id] stops stage toggle via handleBookClick guard
    const childHeading = copyBlocks3D[0].querySelector('h3')!;
    fireEvent.click(childHeading);
    expect(stage.className).toContain('book-open');

    // ArrowRight keyDown shuffles to next passage when book is open
    fireEvent.keyDown(stage, { key: 'ArrowRight' });
    expect(screen.getAllByText(/Darcy’s Confession/i)[0]).toBeInTheDocument();

    // Verify Left and Right page bodies enforce overflow-hidden without overflow-y-auto or -mx-1 scrollbar triggers
    const leftPageBody = screen.getAllByTestId('hero-book-left-page-body')[0];
    const rightPageBody = screen.getAllByTestId('hero-book-right-page-body')[0];
    expect(leftPageBody.className).toContain('overflow-hidden');
    expect(leftPageBody.className).not.toContain('overflow-y-auto');
    expect(rightPageBody.className).toContain('overflow-hidden');
    expect(rightPageBody.className).not.toContain('overflow-y-auto');
    expect(copyBlocks3D[0].className).not.toContain('-mx-1');
  });

  it('adaptively scales Left Page title typography for long (>36 chars) and very long (>55 chars) titles', () => {
    const longTitleBook = {
      ...mockFeaturedBook,
      title: 'The Strange Case of Dr. Jekyll and Mr. Hyde', // 43 chars (>36)
    };
    const { unmount } = renderWithClient(<HeroFeaturedBook3D featuredBook={longTitleBook} />);
    const longCopyBlock = screen.getAllByTestId('hero-3d-copy-meta-1342')[0];
    expect(longCopyBlock.querySelector('h3')?.className).toContain('text-base sm:text-lg');
    unmount();

    const veryLongTitleBook = {
      ...mockFeaturedBook,
      title: 'Alice’s Adventures in Wonderland and Through the Looking-Glass', // 62 chars (>55)
    };
    renderWithClient(<HeroFeaturedBook3D featuredBook={veryLongTitleBook} />);
    const veryLongCopyBlock = screen.getAllByTestId('hero-3d-copy-meta-1342')[0];
    expect(veryLongCopyBlock.querySelector('h3')?.className).toContain('text-sm sm:text-base');
  });

  it('dynamically renders 3 concise quotes on Left and Right pages and selects a fitting cover quote', () => {
    const conciseHeroBook = {
      ...mockFeaturedBook,
      title: 'Lyrical Ballads',
      quotes: [
        {
          chapterLabel: 'Canto I',
          openingLine: '“Come forth into the light of things, let Nature be your teacher.”',
          secondaryQuote: '“Poetry is the spontaneous overflow of powerful feelings.”',
          leftPageQuote2: '“The child is father of the man.”',
          quoteExcerpt: '“Water, water, every where, nor any drop to drink.”',
          rightPageQuote2: '“He prayeth best, who loveth best all things both great and small.”',
          tertiaryQuote: '“Beauty is truth, truth beauty.”',
          commentary: 'Romantic Era Verse.',
        },
      ],
    };

    renderWithClient(<HeroFeaturedBook3D featuredBook={conciseHeroBook} />);
    expect(screen.getByTestId('hero-book-cover-quote')).toHaveTextContent(
      '“Water, water, every where, nor any drop to drink.”'
    );
    expect(screen.getByTestId('hero-book-tertiary-quote')).toHaveTextContent(
      '“The child is father of the man.”'
    );
    expect(screen.getByTestId('hero-book-right-quote-3')).toHaveTextContent(
      '“Beauty is truth, truth beauty.”'
    );
  });

  it('holds quote areas invisible until the quote pool settles, then reveals them once', () => {
    vi.spyOn(perfTier, 'usePerformanceTier').mockReturnValue({
      tier: 'high',
      allowHeavyMotion: true,
      enablePrefetching: true,
      cores: 8,
    });
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });

    const { rerender } = renderWithClient(
      <HeroFeaturedBook3D featuredBook={mockFeaturedBook} isQuoteDataReady={false} />
    );

    const coverQuoteBox = () => screen.getByTestId('hero-book-cover-quote').parentElement!;
    const leftQuotes = () => screen.getAllByTestId('hero-book-left-quotes')[0];
    const rightQuotes = () => screen.getAllByTestId('hero-book-right-page-body')[0];

    for (const el of [coverQuoteBox(), leftQuotes(), rightQuotes()]) {
      expect(el.className).toContain('opacity-0');
      expect(el.className).not.toContain('animate-ink-appear');
    }

    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <HeroFeaturedBook3D featuredBook={mockFeaturedBook} isQuoteDataReady={true} />
      </QueryClientProvider>
    );

    for (const el of [coverQuoteBox(), leftQuotes(), rightQuotes()]) {
      expect(el.className).toContain('animate-ink-appear');
      expect(el.className).not.toContain('opacity-0');
    }
  });

  it('does not fade the cover or right page on first paint, and only animates the content wrapper after a user shuffle', () => {
    vi.spyOn(perfTier, 'usePerformanceTier').mockReturnValue({
      tier: 'high',
      allowHeavyMotion: true,
      enablePrefetching: true,
      cores: 8,
    });
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });

    renderWithClient(<HeroFeaturedBook3D featuredBook={mockFeaturedBook} />);

    const coverWrapper = () => screen.getByTestId('hero-book-cover-quote').parentElement!.parentElement!;
    expect(coverWrapper().className).not.toContain('animate-ink-appear');

    fireEvent.click(screen.getByTestId('hero-book-shuffle-btn'));

    // After a shuffle the remounted wrapper animates, while the quote boxes no longer double-animate inside it
    expect(coverWrapper().className).toContain('animate-ink-appear');
    expect(screen.getByTestId('hero-book-cover-quote').parentElement!.className).not.toContain(
      'animate-ink-appear'
    );
  });
});
