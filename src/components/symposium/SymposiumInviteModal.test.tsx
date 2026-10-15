import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SymposiumInviteModal } from './SymposiumInviteModal';
import { useFellowshipStore } from '@/stores/useFellowshipStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';

describe('SymposiumInviteModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFellowshipStore.getState().clearFellowshipState();
    useAuthStore.setState({
      user: { id: 'u-host', email: 'austen@bookarium.test' } as any,
      profile: { id: 'u-host', username: 'jane_austen', display_name: 'Jane Austen' } as any,
    });
    useBookshelfStore.setState({
      savedBooks: [
        { id: 1342, title: 'Pride and Prejudice', authors: [], formats: {} } as any,
        { id: 84, title: 'Frankenstein', authors: [], formats: {} } as any,
      ],
    });
  });

  it('renders quick Reader Circle handle invite when no accepted fellows exist', async () => {
    const inviteSpy = vi
      .spyOn(useFellowshipStore.getState(), 'inviteFellowByUsername')
      .mockResolvedValue({
        error: null,
        circle: {
          id: 'c1',
          requester_id: 'u-host',
          requester_username: 'jane_austen',
          requester_display_name: 'Jane Austen',
          recipient_id: 'u-fellow',
          recipient_username: 'shelley',
          recipient_display_name: 'Mary Shelley',
          status: 'pending',
          created_at: '',
          updated_at: '',
        },
      });

    render(
      <SymposiumInviteModal
        isOpen={true}
        onClose={vi.fn()}
        bookId={1342}
        bookTitle="Pride and Prejudice"
      />
    );

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    const input = screen.getByLabelText('Scholar handle to invite');
    fireEvent.change(input, { target: { value: '@shelley' } });
    fireEvent.click(screen.getByRole('button', { name: /Invite/i }));

    await waitFor(() => {
      expect(inviteSpy).toHaveBeenCalledWith('@shelley');
      expect(
        screen.getByText(/Reader Circle invitation dispatched to @shelley/i)
      ).toBeInTheDocument();
    });
  });

  it('dispatches a Literary Symposium pact for an accepted fellow scholar', async () => {
    useFellowshipStore.setState({
      circles: [
        {
          id: 'c1',
          requester_id: 'u-host',
          requester_username: 'jane_austen',
          requester_display_name: 'Jane Austen',
          recipient_id: 'u-fellow',
          recipient_username: 'shelley',
          recipient_display_name: 'Mary Shelley',
          status: 'accepted',
          created_at: '',
          updated_at: '',
        },
      ],
    });

    render(<SymposiumInviteModal isOpen={true} onClose={vi.fn()} />);

    const volumeSelect = screen.getByLabelText('Select volume for Symposium');
    fireEvent.change(volumeSelect, { target: { value: '84' } });

    fireEvent.click(screen.getByRole('button', { name: /Send Symposium Pact/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Literary Symposium invitation sent to @shelley for "Frankenstein"/i)
      ).toBeInTheDocument();
    });
  });
});

