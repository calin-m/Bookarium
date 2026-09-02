import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

  it('should render brand and navigation items', () => {
    render(<Navbar activeView="catalog" />);
    expect(screen.getByText(/Bookarium/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Catalog' })).toBeInTheDocument();
    expect(screen.getByLabelText('Bookshelf')).toBeInTheDocument();
    expect(screen.getByLabelText('Liked Books')).toBeInTheDocument();
  });

  it('should fill bookmark icon when books are saved to bookshelf', () => {
    useBookshelfStore.getState().toggleSaveBook(mockBooks[0]);
    const { container } = render(<Navbar activeView="catalog" />);
    const bookmarkSvg = container.querySelector('svg.lucide-bookmark');
    expect(bookmarkSvg).toHaveClass('fill-primary');
  });

  it('should fill heart icon when books are liked in favorites', () => {
    useBookshelfStore.getState().toggleLikeBook(mockBooks[0].id);
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

    const brand = screen.getByText(/Bookarium/i);
    fireEvent.click(brand);
    expect(handleViewChange).toHaveBeenCalledWith('catalog');
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
});

