import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AccountLibraryStats } from './AccountLibraryStats';
import { ROUTES } from '@/config/routes';

describe('AccountLibraryStats', () => {
  it('renders library statistics with links and values including notes and quotes', () => {
    render(
      <AccountLibraryStats
        savedCount={5}
        favoriteCount={12}
        customShelvesCount={3}
        annotationCount={8}
        bookmarksCount={4}
      />
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Library' })).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByTestId('notes-quotes-count')).toHaveTextContent('8');
    expect(screen.getByTestId('custom-shelves-count')).toHaveTextContent('3');
    expect(screen.getByTestId('bookmarks-count')).toHaveTextContent('4');

    const links = screen.getAllByRole('link');
    expect(links.length).toBe(6); // Open Bookshelf, Shelved, Favorites, Notes & Quotes, Custom Shelves, Bookmarks
    expect(screen.getByLabelText('View Saved Notes & Quotes in Notebook')).toHaveAttribute(
      'href',
      ROUTES.NOTEBOOK
    );
    expect(screen.getByLabelText('View Reading Bookmarks in Bookmarks')).toHaveAttribute(
      'href',
      ROUTES.BOOKMARKS
    );
  });

  it('renders default 0 for annotationCount and bookmarksCount when omitted', () => {
    render(
      <AccountLibraryStats
        savedCount={0}
        favoriteCount={0}
        customShelvesCount={0}
      />
    );

    expect(screen.getByTestId('notes-quotes-count')).toHaveTextContent('0');
    expect(screen.getByTestId('bookmarks-count')).toHaveTextContent('0');
  });

  it('applies theme-tokenized hover border and focus classes on each library card', () => {
    render(
      <AccountLibraryStats
        savedCount={2}
        favoriteCount={4}
        customShelvesCount={1}
        annotationCount={3}
        bookmarksCount={2}
      />
    );

    const shelvedLink = screen.getByLabelText('View Shelved Volumes in Bookshelf');
    const favoritesLink = screen.getByLabelText('View Favorite Titles in Favorites');
    const notesLink = screen.getByLabelText('View Saved Notes & Quotes in Notebook');
    const shelvesLink = screen.getByLabelText('View Custom Shelves in Bookshelf');
    const bookmarksLink = screen.getByLabelText('View Reading Bookmarks in Bookmarks');

    expect(shelvedLink).toHaveClass('hover:border-primary');
    expect(favoritesLink).toHaveClass('hover:border-destructive');
    expect(notesLink).toHaveClass('hover:border-amber-500');
    expect(shelvesLink).toHaveClass('hover:border-primary');
    expect(bookmarksLink).toHaveClass('hover:border-indigo-500');
  });

  it('renders all 5 library cards with uniform horizontal flex layout', () => {
    render(
      <AccountLibraryStats
        savedCount={1}
        favoriteCount={2}
        customShelvesCount={3}
        annotationCount={4}
        bookmarksCount={5}
      />
    );

    const cards = [
      screen.getByLabelText('View Shelved Volumes in Bookshelf'),
      screen.getByLabelText('View Favorite Titles in Favorites'),
      screen.getByLabelText('View Saved Notes & Quotes in Notebook'),
      screen.getByLabelText('View Custom Shelves in Bookshelf'),
      screen.getByLabelText('View Reading Bookmarks in Bookmarks'),
    ];

    cards.forEach((card) => {
      expect(card).toHaveClass('flex');
      expect(card).toHaveClass('items-center');
      expect(card).toHaveClass('justify-between');
    });
  });

  it('renders clean vertical flex column layout for all library cards', () => {
    render(
      <AccountLibraryStats
        savedCount={1}
        favoriteCount={2}
        customShelvesCount={3}
      />
    );

    const stack = screen.getByTestId('account-library-stack');
    expect(stack).toHaveClass('flex', 'flex-col', 'gap-2.5', 'sm:gap-3');

    const cards = [
      screen.getByLabelText('View Shelved Volumes in Bookshelf'),
      screen.getByLabelText('View Favorite Titles in Favorites'),
      screen.getByLabelText('View Custom Shelves in Bookshelf'),
    ];

    cards.forEach((card) => {
      expect(card).toHaveClass('w-full');
      expect(card).not.toHaveClass('snap-center');
    });
  });

  it('calculates active card with equal scroll progression stepper in single-column mode', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    render(
      <AccountLibraryStats
        savedCount={1}
        favoriteCount={2}
        customShelvesCount={3}
        annotationCount={4}
        bookmarksCount={5}
      />
    );

    const stack = screen.getByTestId('account-library-stack');
    const cards = Array.from(stack.children).filter((el) => el.tagName === 'A') as HTMLElement[];

    // vh = 800, height = 300, startTop = 600, endTop = -140, totalRange = 740
    // Test slot 2 (progress ~0.5 -> top = 230)
    vi.spyOn(stack, 'getBoundingClientRect').mockReturnValue({
      top: 230,
      bottom: 530,
      left: 0,
      right: 375,
      width: 375,
      height: 300,
      x: 0,
      y: 230,
      toJSON: () => {},
    });

    fireEvent.scroll(window);

    expect(cards[2]).toHaveAttribute('data-active', 'true');
    expect(cards[2]).toHaveClass('max-lg:border-amber-500');
    expect(cards[2]).toHaveClass('max-lg:bg-muted/60');
    expect(cards[0]).toHaveAttribute('data-active', 'false');

    // Test slot 0 (progress ~0.06 -> top = 550)
    vi.spyOn(stack, 'getBoundingClientRect').mockReturnValue({
      top: 550,
      bottom: 850,
      left: 0,
      right: 375,
      width: 375,
      height: 300,
      x: 0,
      y: 550,
      toJSON: () => {},
    });

    fireEvent.scroll(window);

    expect(cards[0]).toHaveAttribute('data-active', 'true');
    expect(cards[0]).toHaveClass('max-lg:border-primary');
    expect(cards[2]).toHaveAttribute('data-active', 'false');

    // Test slot 4 (progress ~0.88 -> top = -50)
    vi.spyOn(stack, 'getBoundingClientRect').mockReturnValue({
      top: -50,
      bottom: 250,
      left: 0,
      right: 375,
      width: 375,
      height: 300,
      x: 0,
      y: -50,
      toJSON: () => {},
    });

    fireEvent.scroll(window);

    expect(cards[4]).toHaveAttribute('data-active', 'true');
    expect(cards[4]).toHaveClass('max-lg:border-indigo-500');
    expect(cards[0]).toHaveAttribute('data-active', 'false');
  });

  it('prioritizes mouse hover over scroll position on narrow desktop windows', () => {
    Object.defineProperty(window, 'innerWidth', { value: 600, configurable: true });

    render(
      <AccountLibraryStats
        savedCount={1}
        favoriteCount={2}
        customShelvesCount={3}
      />
    );

    const stack = screen.getByTestId('account-library-stack');
    const cards = Array.from(stack.children).filter((el) => el.tagName === 'A') as HTMLElement[];

    // Hover over Favorite Titles (card 1)
    fireEvent.mouseEnter(cards[1]);

    expect(cards[1]).toHaveAttribute('data-active', 'true');
    expect(cards[1]).toHaveClass('max-lg:border-destructive');
    expect(cards[0]).toHaveAttribute('data-active', 'false');

    // Mouse leave resets hover
    fireEvent.mouseLeave(cards[1]);

    expect(cards[1]).toHaveAttribute('data-active', 'false');
  });

  it('resets active spotlight when library container is scrolled outside focal travel range', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    render(
      <AccountLibraryStats
        savedCount={1}
        favoriteCount={2}
        customShelvesCount={3}
      />
    );

    const stack = screen.getByTestId('account-library-stack');
    const cards = Array.from(stack.children).filter((el) => el.tagName === 'A') as HTMLElement[];

    // Container is completely below focal start: top = 700 (> startTop 600)
    vi.spyOn(stack, 'getBoundingClientRect').mockReturnValue({
      top: 700,
      bottom: 1000,
      left: 0,
      right: 375,
      width: 375,
      height: 300,
      x: 0,
      y: 700,
      toJSON: () => {},
    });

    fireEvent.scroll(window);

    cards.forEach((card) => {
      expect(card).toHaveAttribute('data-active', 'false');
    });

    // Container is completely above focal end: top = -200 (< endTop -140)
    vi.spyOn(stack, 'getBoundingClientRect').mockReturnValue({
      top: -200,
      bottom: 100,
      left: 0,
      right: 375,
      width: 375,
      height: 300,
      x: 0,
      y: -200,
      toJSON: () => {},
    });

    fireEvent.scroll(window);

    cards.forEach((card) => {
      expect(card).toHaveAttribute('data-active', 'false');
    });
  });

  it('disables scroll focal spotlight on widescreen desktop displays', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    render(
      <AccountLibraryStats
        savedCount={1}
        favoriteCount={2}
        customShelvesCount={3}
      />
    );

    const stack = screen.getByTestId('account-library-stack');
    const cards = Array.from(stack.children).filter((el) => el.tagName === 'A') as HTMLElement[];

    fireEvent.scroll(window);

    cards.forEach((card) => {
      expect(card).toHaveAttribute('data-active', 'false');
    });
  });

  it('cleans up scroll and resize listeners when component unmounts', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(
      <AccountLibraryStats
        savedCount={1}
        favoriteCount={2}
        customShelvesCount={3}
      />
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});


