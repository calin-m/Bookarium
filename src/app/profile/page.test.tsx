import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProfilePage from './page';
import { useAuthStore } from '@/stores/useAuthStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useThemeStore.setState({ theme: 'light' });
  });

  it('renders guest prompt when unauthenticated', () => {
    useAuthStore.setState({
      user: null,
      profile: null,
      isLoading: false,
    });

    render(<ProfilePage />);

    expect(screen.getByText('Guest Reader')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In \/ Sign Up/i })).toBeInTheDocument();
  });

  it('renders authenticated profile and handles saving display name', async () => {
    const mockUpdateProfile = vi.fn().mockResolvedValue({ error: null });

    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test', created_at: '2026-01-01T00:00:00Z' } as any,
      profile: { id: 'u1', display_name: 'Jane Austen' } as any,
      isLoading: false,
      updateProfile: mockUpdateProfile,
    });

    useBookshelfStore.setState({
      savedBooks: [{ id: 1, title: 'Pride and Prejudice', authors: [], formats: {} } as any],
      likedBookIds: [1, 2],
      cloudBookshelves: [{ id: 's1', user_id: 'u1', name: 'Favorites', is_default: true, created_at: '', updated_at: '' }],
    });

    render(<ProfilePage />);

    expect(screen.getAllByText('Jane Austen').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('austen@bookarium.test')).toBeInTheDocument();

    const input = screen.getByLabelText('Display Name');
    fireEvent.change(input, { target: { value: 'Jane Austen CBE' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
    expect(mockUpdateProfile).toHaveBeenCalledWith({ display_name: 'Jane Austen CBE' });
  });

  it('handles theme change and sign out', async () => {
    const mockSignOut = vi.fn().mockResolvedValue(undefined);
    const mockUpdateProfile = vi.fn().mockResolvedValue({ error: null });

    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test' } as any,
      profile: { id: 'u1', display_name: 'Jane' } as any,
      isLoading: false,
      signOut: mockSignOut,
      updateProfile: mockUpdateProfile,
    });

    render(<ProfilePage />);

    // Click Sepia theme
    const sepiaBtn = screen.getByRole('button', { name: /Sepia/i });
    fireEvent.click(sepiaBtn);
    expect(useThemeStore.getState().theme).toBe('sepia');
    expect(mockUpdateProfile).toHaveBeenCalledWith({ preferred_theme: 'sepia' });

    // Click Sign Out
    const signOutBtn = screen.getAllByRole('button', { name: /Sign Out/i })[0];
    fireEvent.click(signOutBtn);
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('renders Navbar and Footer with working navigation handlers', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test' } as any,
      profile: { id: 'u1', display_name: 'Jane' } as any,
      isLoading: false,
    });

    render(<ProfilePage />);

    // Check Navbar & Brand
    expect(screen.getByLabelText('Bookarium logo, click to refresh catalog')).toBeInTheDocument();
    const catalogBtn = screen.getByRole('button', { name: 'Catalog' });
    fireEvent.click(catalogBtn);
    expect(mockPush).toHaveBeenCalledWith('/');

    // Check Bookshelf Navigation
    const bookshelfBtn = screen.getByLabelText('Bookshelf');
    fireEvent.click(bookshelfBtn);
    expect(mockPush).toHaveBeenCalledWith('/?view=bookshelf');

    // Check Footer
    expect(screen.getByLabelText('Bookarium GitHub by calin-m')).toBeInTheDocument();
  });

  it('handles toggling catalog sticky scroll navigation setting', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test' } as any,
      profile: { id: 'u1', display_name: 'Jane' } as any,
      isLoading: false,
    });

    render(<ProfilePage />);

    expect(screen.getByText('Smart Auto-Hide Active')).toBeInTheDocument();

    const alwaysFixedBtn = screen.getByRole('button', { name: /Always Fixed/i });
    fireEvent.click(alwaysFixedBtn);

    expect(screen.getByText('Always Fixed Active')).toBeInTheDocument();

    const smartAutoHideBtn = screen.getByRole('button', { name: /Smart Auto-Hide/i });
    fireEvent.click(smartAutoHideBtn);

    expect(screen.getByText('Smart Auto-Hide Active')).toBeInTheDocument();
  });

  it('accurately calculates and renders custom shelves count excluding default shelf', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test' } as any,
      profile: { id: 'u1', display_name: 'Jane' } as any,
      isLoading: false,
    });

    useBookshelfStore.setState({
      cloudBookshelves: [
        { id: 's0', user_id: 'u1', name: 'General', is_default: true, created_at: '', updated_at: '' },
        { id: 's1', user_id: 'u1', name: 'Philosophy', is_default: false, created_at: '', updated_at: '' },
        { id: 's2', user_id: 'u1', name: 'Gothic Tales', is_default: false, created_at: '', updated_at: '' },
      ],
    });

    render(<ProfilePage />);

    expect(screen.getByText('Custom Shelves')).toBeInTheDocument();
    expect(screen.getByTestId('custom-shelves-count')).toHaveTextContent('2');
  });
});