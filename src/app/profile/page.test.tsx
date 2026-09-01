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
      savedBooks: [{ id: 1, title: 'Pride and Prejudice', authors: [], formats: {} } as any],
      likedBookIds: [1, 2, 3],
      cloudBookshelves: [
        { id: 's0', user_id: 'u1', name: 'General', is_default: true, created_at: '', updated_at: '' },
        { id: 's1', user_id: 'u1', name: 'Philosophy', is_default: false, created_at: '', updated_at: '' },
        { id: 's2', user_id: 'u1', name: 'Gothic Tales', is_default: false, created_at: '', updated_at: '' },
      ],
    });

    render(<ProfilePage />);

    expect(screen.getByRole('heading', { level: 2, name: 'Library' })).toBeInTheDocument();
    
    const shelvedLink = screen.getByRole('link', { name: /View Shelved Volumes in Bookshelf/i });
    expect(shelvedLink).toHaveAttribute('href', '/?view=bookshelf');
    expect(screen.getByText('Shelved Volumes')).toBeInTheDocument();

    const favoritesLink = screen.getByRole('link', { name: /View Favorite Titles in Favorites/i });
    expect(favoritesLink).toHaveAttribute('href', '/?view=likes');
    expect(screen.getByText('Favorite Titles')).toBeInTheDocument();

    const customShelvesLink = screen.getByRole('link', { name: /View Custom Shelves in Bookshelf/i });
    expect(customShelvesLink).toHaveAttribute('href', '/?view=bookshelf');
    expect(screen.getByText('Custom Shelves')).toBeInTheDocument();
    expect(screen.getByTestId('custom-shelves-count')).toHaveTextContent('2');
  });

  it('handles password update with validation and success feedback', async () => {
    const mockUpdatePassword = vi.fn().mockResolvedValue({ error: null });

    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test' } as any,
      profile: { id: 'u1', display_name: 'Jane' } as any,
      isLoading: false,
      updatePassword: mockUpdatePassword,
    });

    render(<ProfilePage />);

    expect(screen.getByText('Security & Password')).toBeInTheDocument();

    const newPwdInput = screen.getByLabelText('New Password');
    const confirmPwdInput = screen.getByLabelText('Confirm New Password');
    const updateBtn = screen.getByRole('button', { name: /Update Password/i });

    // Test password mismatch
    fireEvent.change(newPwdInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPwdInput, { target: { value: 'different123' } });
    fireEvent.click(updateBtn);

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(mockUpdatePassword).not.toHaveBeenCalled();

    // Test valid matching passwords
    fireEvent.change(confirmPwdInput, { target: { value: 'password123' } });
    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(mockUpdatePassword).toHaveBeenCalledWith('password123');
      expect(screen.getByText('Password successfully updated')).toBeInTheDocument();
    });
  });

  it('handles Suggest Strong Password in Profile Security card and auto-fills both fields', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test' } as any,
      profile: { id: 'u1', display_name: 'Jane' } as any,
      isLoading: false,
    });

    render(<ProfilePage />);

    const suggestBtn = screen.getByRole('button', { name: /Suggest Strong Password/i });
    expect(suggestBtn).toBeInTheDocument();

    fireEvent.click(suggestBtn);

    const newPwdInput = screen.getByLabelText('New Password') as HTMLInputElement;
    const confirmPwdInput = screen.getByLabelText('Confirm New Password') as HTMLInputElement;

    expect(newPwdInput.value.length).toBeGreaterThanOrEqual(12);
    expect(newPwdInput.value).toBe(confirmPwdInput.value);

    // Live strength meter renders
    expect(screen.getByText('Password strength:')).toBeInTheDocument();
  });

  it('handles delete account flow with email verification dialog and cancellation', async () => {
    const mockRequestAccountDeletion = vi.fn().mockResolvedValue({ error: null });

    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test' } as any,
      profile: { id: 'u1', display_name: 'Jane' } as any,
      isLoading: false,
      requestAccountDeletion: mockRequestAccountDeletion,
    });

    render(<ProfilePage />);

    expect(screen.getByText(/Danger Zone: Delete Account/i)).toBeInTheDocument();

    const deleteBtn = screen.getByRole('button', { name: /Delete Account/i });
    fireEvent.click(deleteBtn);

    // Confirmation dialog appears explaining email verification
    expect(screen.getByText('Request Account Deletion')).toBeInTheDocument();
    expect(screen.getByText('Security Verification Required')).toBeInTheDocument();
    expect(screen.getByText(/For your security, deleting your account requires email confirmation/i)).toBeInTheDocument();

    // Cancel preserves account
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(mockRequestAccountDeletion).not.toHaveBeenCalled();

    // Reopen and send deletion email
    fireEvent.click(deleteBtn);
    const sendLinkBtn = screen.getByRole('button', { name: /Send Deletion Link/i });
    fireEvent.click(sendLinkBtn);

    await waitFor(() => {
      expect(mockRequestAccountDeletion).toHaveBeenCalled();
      expect(screen.getByText('Verification Link Sent')).toBeInTheDocument();
      expect(screen.getByText(/We sent a secure deletion confirmation link to/i)).toBeInTheDocument();
    });

    const closeBtn = screen.getByRole('button', { name: /^Close$/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Verification Link Sent')).not.toBeInTheDocument();
  });

  it('renders BackToTop button on scroll threshold and triggers window scrollTo', () => {
    const scrollToMock = vi.fn();
    window.scrollTo = scrollToMock;

    render(<ProfilePage />);

    // Initially hidden (below 300px threshold)
    expect(screen.queryByRole('button', { name: /Back to top/i })).not.toBeInTheDocument();

    // Scroll past threshold
    window.scrollY = 400;
    fireEvent.scroll(window);

    const backToTopBtn = screen.getByRole('button', { name: /Back to top/i });
    expect(backToTopBtn).toBeInTheDocument();

    fireEvent.click(backToTopBtn);
    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});