import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountSymposiumSection } from './AccountSymposiumSection';
import { useFellowshipStore } from '@/stores/useFellowshipStore';
import { useAuthStore } from '@/stores/useAuthStore';

describe('AccountSymposiumSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFellowshipStore.getState().clearFellowshipState();
    useAuthStore.setState({
      user: { id: 'u1', email: 'austen@bookarium.test' } as any,
      profile: { id: 'u1', username: 'jane_austen', display_name: 'Jane Austen' } as any,
    });
  });

  it('switches between Active Symposiums, Reader Circle, and Invitations sub-tabs', async () => {
    useFellowshipStore.setState({
      circles: [
        {
          id: 'c-accepted',
          requester_id: 'u1',
          requester_username: 'jane_austen',
          requester_display_name: 'Jane Austen',
          recipient_id: 'u2',
          recipient_username: 'bronte',
          recipient_display_name: 'Charlotte Brontë',
          status: 'accepted',
          created_at: '',
          updated_at: '',
        },
        {
          id: 'c-pending',
          requester_id: 'u3',
          requester_username: 'shelley',
          requester_display_name: 'Mary Shelley',
          recipient_id: 'u1',
          recipient_username: 'jane_austen',
          recipient_display_name: 'Jane Austen',
          status: 'pending',
          created_at: '',
          updated_at: '',
        },
      ],
      symposiums: [
        {
          id: 's-active',
          book_id: 1342,
          book_title: 'Pride and Prejudice',
          host_id: 'u1',
          host_username: 'jane_austen',
          host_display_name: 'Jane Austen',
          fellow_id: 'u2',
          fellow_username: 'bronte',
          fellow_display_name: 'Charlotte Brontë',
          status: 'active',
          host_chapter: 2,
          host_progress: 35,
          fellow_chapter: 4,
          fellow_progress: 60,
          created_at: '',
          updated_at: '',
        },
      ],
    });

    render(<AccountSymposiumSection userId="u1" />);

    // Default sub-tab: Active Symposiums
    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByText('35%')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();

    const section = screen.getByTestId('account-symposium-section');
    expect(section.innerHTML).not.toContain('border-border/60');
    expect(section.innerHTML).not.toContain('border-primary/20');

    // Assert mobile containment on sub-tab bar
    const tablist = screen.getByRole('tablist', { name: /Symposium and Reader Circle sections/i });
    expect(tablist).toHaveClass('min-w-0', 'overflow-hidden', 'max-w-full');
    const tabs = screen.getAllByRole('tab');
    tabs.forEach((tab) => {
      expect(tab).toHaveClass('min-w-0');
    });

    // Switch to Reader Circle sub-tab
    fireEvent.click(screen.getByRole('tab', { name: /Reader Circle/i }));
    expect(screen.getByText('Charlotte Brontë')).toBeInTheDocument();
    expect(screen.getByText('@bronte')).toBeInTheDocument();

    // Switch to Invitations sub-tab and accept incoming request
    fireEvent.click(screen.getByRole('tab', { name: /Invitations/i }));
    expect(screen.getByText(/Mary Shelley \(@shelley\)/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Accept Fellow/i }));

    await waitFor(() => {
      expect(useFellowshipStore.getState().getAcceptedFellows('u1')).toHaveLength(2);
    });
  });

  it('renders empty states when there are zero symposiums, circle fellows, or invitations', () => {
    render(<AccountSymposiumSection userId="u1" />);

    // Empty symposiums
    expect(screen.getByText('No Active Literary Symposiums')).toBeInTheDocument();

    // Switch to Reader Circle -> Empty
    fireEvent.click(screen.getByRole('tab', { name: /Reader Circle/i }));
    expect(screen.getByText(/No connected Fellow Scholars yet/i)).toBeInTheDocument();

    // Switch to Invitations -> Empty
    fireEvent.click(screen.getByRole('tab', { name: /Invitations/i }));
    expect(screen.getByText(/No pending Reader Circle or Symposium invitations/i)).toBeInTheDocument();
  });

  it('handles fellow invitation form submission with error and success banners', async () => {
    render(<AccountSymposiumSection userId="u1" />);

    // Switch to Reader Circle
    fireEvent.click(screen.getByRole('tab', { name: /Reader Circle/i }));

    const input = screen.getByLabelText(/Invite Fellow Scholar/i);
    const submitBtn = screen.getByRole('button', { name: /Send Circle Invitation/i });

    // Empty input submission does nothing
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(submitBtn);
    expect(screen.queryByText(/Fellowship invitation sent/i)).not.toBeInTheDocument();

    // Mock inviteFellowByUsername failure
    const mockStore = useFellowshipStore.getState();
    const originalInvite = mockStore.inviteFellowByUsername;
    mockStore.inviteFellowByUsername = vi.fn().mockResolvedValue({
      error: { message: 'Scholar handle not found.' },
      circle: null,
    });

    fireEvent.change(input, { target: { value: 'unknown_scholar' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Scholar handle not found.')).toBeInTheDocument();
    });

    // Mock inviteFellowByUsername success
    mockStore.inviteFellowByUsername = vi.fn().mockResolvedValue({
      error: null,
      circle: { recipient_username: 'woolf' },
    });

    fireEvent.change(input, { target: { value: 'woolf' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Fellowship invitation sent to @woolf\./i)).toBeInTheDocument();
    });

    mockStore.inviteFellowByUsername = originalInvite;
  });

  it('allows declining an incoming circle invitation', async () => {
    useFellowshipStore.setState({
      circles: [
        {
          id: 'c-decline',
          requester_id: 'u4',
          requester_username: 'dickens',
          requester_display_name: 'Charles Dickens',
          recipient_id: 'u1',
          recipient_username: 'jane_austen',
          recipient_display_name: 'Jane Austen',
          status: 'pending',
          created_at: '',
          updated_at: '',
        },
      ],
    });

    render(<AccountSymposiumSection userId="u1" />);

    fireEvent.click(screen.getByRole('tab', { name: /Invitations/i }));
    expect(screen.getByText(/Charles Dickens \(@dickens\)/i)).toBeInTheDocument();

    const declineBtn = screen.getByRole('button', { name: /Decline/i });
    fireEvent.click(declineBtn);

    await waitFor(() => {
      expect(useFellowshipStore.getState().circles.find((c) => c.id === 'c-decline')).toBeUndefined();
    });
  });
});

