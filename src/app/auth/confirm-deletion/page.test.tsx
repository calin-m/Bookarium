import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConfirmDeletionPage from './page';
import { useAuthStore } from '@/stores/useAuthStore';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('ConfirmDeletionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state when isLoading is true', () => {
    useAuthStore.setState({
      user: null,
      isLoading: true,
    });

    render(<ConfirmDeletionPage />);
    expect(screen.getByText(/Verifying secure deletion link/i)).toBeInTheDocument();
  });

  it('renders expired/invalid link state when unauthenticated', () => {
    useAuthStore.setState({
      user: null,
      isLoading: false,
    });

    render(<ConfirmDeletionPage />);
    expect(screen.getByText('Link Expired or Invalid')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Go to Profile/i })).toBeInTheDocument();
  });

  it('renders authenticated confirmation portal and handles successful deletion', async () => {
    const mockDeleteAccount = vi.fn().mockResolvedValue({ error: null });

    useAuthStore.setState({
      user: { id: 'u-del', email: 'delete-me@bookarium.test' } as any,
      isLoading: false,
      deleteAccount: mockDeleteAccount,
    });

    render(<ConfirmDeletionPage />);

    expect(screen.getByText('Confirm Account Deletion')).toBeInTheDocument();
    expect(screen.getByText('delete-me@bookarium.test')).toBeInTheDocument();
    expect(screen.getByText(/Final Warning: Permanent Data Loss/i)).toBeInTheDocument();

    const deleteBtn = screen.getByRole('button', { name: /Permanently Delete Account/i });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalled();
      expect(screen.getByText('Account Permanently Deleted')).toBeInTheDocument();
    });
  });

  it('renders error message if deleteAccount fails', async () => {
    const mockDeleteAccount = vi.fn().mockResolvedValue({ error: { message: 'Network deletion error' } });

    useAuthStore.setState({
      user: { id: 'u-del', email: 'delete-me@bookarium.test' } as any,
      isLoading: false,
      deleteAccount: mockDeleteAccount,
    });

    render(<ConfirmDeletionPage />);

    const deleteBtn = screen.getByRole('button', { name: /Permanently Delete Account/i });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText('Network deletion error')).toBeInTheDocument();
    });
  });
});

