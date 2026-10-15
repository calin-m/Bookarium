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
});

