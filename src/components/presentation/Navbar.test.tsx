import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Navbar } from './Navbar';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { mockBooks } from '@/mocks/handlers';

describe('Navbar component', () => {
  beforeEach(() => {
    useBookshelfStore.getState().clearBookshelf();
    useThemeStore.setState({ theme: 'light' });
    document.documentElement.className = '';
  });

  it('should render brand and navigation items with responsive title classes', () => {
    render(<Navbar activeView="catalog" />);
    const brandText = screen.getByText(/Bookarium/i);
    expect(brandText).toBeInTheDocument();
    expect(brandText).toHaveClass('min-[375px]:inline', 'text-xs');
    expect(screen.getByRole('button', { name: 'Catalog' })).toBeInTheDocument();
    expect(screen.getByLabelText('Bookshelf')).toBeInTheDocument();
    expect(screen.getByLabelText('Favorites')).toBeInTheDocument();
    expect(screen.getByLabelText('Notebook')).toBeInTheDocument();
    expect(screen.getByLabelText('Bookmarks')).toBeInTheDocument();
  });

  it('should fill highlighter icon when annotations are saved in notebook', async () => {
    const { useAnnotationStore } = await import('@/stores/useAnnotationStore');
    await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Test quote',
      color: 'yellow',
    });

    const { container } = render(<Navbar activeView="catalog" />);
    const highlighterSvg = container.querySelector('svg.lucide-highlighter');
    expect(highlighterSvg).toHaveClass('fill-amber-500');
    expect(highlighterSvg).toHaveClass('text-amber-500');
    expect(screen.queryByTestId('navbar-notebook-badge')).not.toBeInTheDocument();
    useAnnotationStore.getState().clearAllAnnotations();
  });

  it('triggers onViewChange with notebook when Notebook tab is clicked', () => {
    const handleViewChange = vi.fn();
    render(<Navbar activeView="catalog" onViewChange={handleViewChange} />);

    const notebookBtn = screen.getByLabelText('Notebook');
    fireEvent.click(notebookBtn);
    expect(handleViewChange).toHaveBeenCalledWith('notebook');
  });

  it('applies active styling when activeView is notebook', () => {
    render(<Navbar activeView="notebook" />);
    const notebookBtn = screen.getByLabelText('Notebook');
    expect(notebookBtn).toHaveClass('font-bold');
    expect(notebookBtn).toHaveClass('border-amber-500');
  });

  it('triggers onViewChange with bookmarks when Bookmarks tab is clicked', () => {
    const handleViewChange = vi.fn();
    render(<Navbar activeView="catalog" onViewChange={handleViewChange} />);

    const bookmarksBtn = screen.getByLabelText('Bookmarks');
    fireEvent.click(bookmarksBtn);
    expect(handleViewChange).toHaveBeenCalledWith('bookmarks');
  });

  it('applies active styling when activeView is bookmarks', () => {
    render(<Navbar activeView="bookmarks" />);
    const bookmarksBtn = screen.getByLabelText('Bookmarks');
    expect(bookmarksBtn).toHaveClass('font-bold');
    expect(bookmarksBtn).toHaveClass('border-indigo-500');
  });

  it('should fill library icon when books are saved to bookshelf', () => {
    useBookshelfStore.getState().toggleSaveBook(mockBooks[0]);
    const { container } = render(<Navbar activeView="catalog" />);
    const librarySvg = container.querySelector('svg.lucide-library');
    expect(librarySvg).toHaveClass('fill-primary');
  });

  it('should fill heart icon when books are favorited', () => {
    useBookshelfStore.getState().toggleFavoriteBook(mockBooks[0]);
    const { container } = render(<Navbar activeView="catalog" />);
    const heartSvg = container.querySelector('svg.lucide-heart');
    expect(heartSvg).toHaveClass('fill-destructive');
  });

  it('should trigger onViewChange callback when clicking tabs', () => {
    const handleViewChange = vi.fn();
    render(<Navbar activeView="catalog" onViewChange={handleViewChange} />);

    const bookshelfBtn = screen.getByLabelText('Bookshelf');
    fireEvent.click(bookshelfBtn);
    expect(handleViewChange).toHaveBeenCalledWith('bookshelf');

    const favoritesBtn = screen.getByLabelText('Favorites');
    fireEvent.click(favoritesBtn);
    expect(handleViewChange).toHaveBeenCalledWith('favorites');

    const brand = screen.getByText(/Bookarium/i);
    fireEvent.click(brand);
    expect(handleViewChange).toHaveBeenCalledWith('catalog');
  });

  it('applies active styling when activeView is favorites', () => {
    render(<Navbar activeView="favorites" />);
    const favoritesBtn = screen.getByLabelText('Favorites');
    expect(favoritesBtn).toHaveClass('font-bold');
    expect(favoritesBtn).toHaveClass('border-destructive');
  });

  it('should cycle through themes when clicking theme button', () => {
    render(<Navbar activeView="catalog" />);
    const themeBtn = screen.getByRole('button', { name: /Current theme:/i });

    // Light -> Sepia
    fireEvent.click(themeBtn);
    expect(useThemeStore.getState().theme).toBe('sepia');
    expect(document.documentElement.classList.contains('sepia')).toBe(true);

    // Sepia -> Dark
    fireEvent.click(themeBtn);
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Dark -> Light
    fireEvent.click(themeBtn);
    expect(useThemeStore.getState().theme).toBe('light');
  });

  it('renders Sign In button for guests and triggers openAuthModal', () => {
    render(<Navbar activeView="catalog" />);
    const signInBtn = screen.getByRole('button', { name: /Sign In/i });
    expect(signInBtn).toBeInTheDocument();
  });

  it('renders direct Account Link when user is authenticated', async () => {
    const { useAuthStore } = await import('@/stores/useAuthStore');
    useAuthStore.setState({
      user: { id: 'u1', email: 'reader@bookarium.test' } as any,
      profile: { display_name: 'Test Reader' } as any,
    });

    render(<Navbar activeView="catalog" />);
    const userLink = screen.getByLabelText('User Account');
    expect(userLink).toBeInTheDocument();
    expect(userLink).toHaveAttribute('href', '/account');
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  it('handles keyboard Enter and Space on brand logo to navigate back to catalog', () => {
    const handleViewChange = vi.fn();
    render(<Navbar activeView="bookshelf" onViewChange={handleViewChange} />);

    const brand = screen.getByLabelText('Bookarium logo, click to refresh catalog');
    fireEvent.keyDown(brand, { key: 'Enter' });
    expect(handleViewChange).toHaveBeenCalledWith('catalog');

    fireEvent.keyDown(brand, { key: ' ' });
    expect(handleViewChange).toHaveBeenCalledWith('catalog');
  });

  it('applies -translate-y-full when isVisible is false', () => {
    const { container } = render(<Navbar activeView="catalog" isVisible={false} />);
    const header = container.querySelector('header');
    expect(header).toHaveClass('-translate-y-full');
    expect(header).toHaveClass('pointer-events-none');
  });

  it('applies translate-y-0 when isVisible is true', () => {
    const { container } = render(<Navbar activeView="catalog" isVisible={true} />);
    const header = container.querySelector('header');
    expect(header).toHaveClass('translate-y-0');
  });

  it('renders active account button styling when activeView is account', async () => {
    const { useAuthStore } = await import('@/stores/useAuthStore');
    useAuthStore.setState({
      user: { id: 'u1', email: 'reader@bookarium.test' } as any,
      profile: { display_name: 'Test Reader' } as any,
    });

    render(<Navbar activeView="account" />);
    const userLink = screen.getByLabelText('User Account');
    expect(userLink).toHaveClass('border-primary');
    expect(userLink).toHaveClass('text-primary');
  });

  it('renders active Sign In button styling for guests when activeView is account', async () => {
    const { useAuthStore } = await import('@/stores/useAuthStore');
    useAuthStore.setState({
      user: null,
      profile: null,
    });

    render(<Navbar activeView="account" />);
    const signInBtn = screen.getByRole('button', { name: /Sign In/i });
    expect(signInBtn).toHaveClass('bg-primary');
  });

  it('renders GitHub repository link with target _blank on the header', () => {
    render(<Navbar activeView="catalog" />);
    const githubLink = screen.getByRole('link', { name: /View Bookarium repository on GitHub/i });
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute('href', 'https://github.com/calin-m/Bookarium');
    expect(githubLink).toHaveAttribute('target', '_blank');
    expect(githubLink).toHaveClass('hidden', 'min-[320px]:inline-flex');
  });

  it('renders dynamic active view masthead subtitle with section theme color and responsive classes', () => {
    const { rerender } = render(<Navbar activeView="catalog" />);
    let subtitle = screen.getByTestId('navbar-active-view-subtitle');
    expect(subtitle).toBeInTheDocument();
    expect(subtitle).toHaveTextContent('Catalog');
    expect(subtitle).toHaveClass('text-primary', 'md:hidden', 'min-[375px]:inline');

    rerender(<Navbar activeView="favorites" />);
    subtitle = screen.getByTestId('navbar-active-view-subtitle');
    expect(subtitle).toHaveTextContent('Favorites');
    expect(subtitle).toHaveClass('text-destructive');

    rerender(<Navbar activeView="notebook" />);
    subtitle = screen.getByTestId('navbar-active-view-subtitle');
    expect(subtitle).toHaveTextContent('Notebook');
    expect(subtitle).toHaveClass('text-amber-600');

    rerender(<Navbar activeView="bookmarks" />);
    subtitle = screen.getByTestId('navbar-active-view-subtitle');
    expect(subtitle).toHaveTextContent('Bookmarks');
    expect(subtitle).toHaveClass('text-indigo-600');

    rerender(<Navbar activeView="account" />);
    subtitle = screen.getByTestId('navbar-active-view-subtitle');
    expect(subtitle).toHaveTextContent('Account');
    expect(subtitle).toHaveClass('text-primary');
  });
});

