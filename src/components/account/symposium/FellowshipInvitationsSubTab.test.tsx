import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FellowshipInvitationsSubTab } from './FellowshipInvitationsSubTab';

describe('FellowshipInvitationsSubTab', () => {
  it('renders incoming and outgoing circle and symposium invitations and invokes action handlers', () => {
    const onAcceptCircleInvite = vi.fn();
    const onDeclineCircleInvite = vi.fn();
    const onCancelCircleInvite = vi.fn();
    const onAcceptSymposiumInvite = vi.fn();
    const onDeclineSymposiumInvite = vi.fn();
    const onCancelSymposiumInvite = vi.fn();

    render(
      <FellowshipInvitationsSubTab
        userId="u-1"
        pendingCircles={[
          {
            id: 'inv-in-1',
            requester_id: 'u-2',
            recipient_id: 'u-1',
            requester_username: 'shelley',
            requester_display_name: 'Mary Shelley',
            recipient_username: 'austen',
            recipient_display_name: 'Jane Austen',
            status: 'pending',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
          {
            id: 'inv-out-1',
            requester_id: 'u-1',
            recipient_id: 'u-3',
            requester_username: 'austen',
            requester_display_name: 'Jane Austen',
            recipient_username: 'byron',
            recipient_display_name: 'Lord Byron',
            status: 'pending',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ]}
        pendingSymposiums={[
          {
            id: 'symp-in-1',
            book_id: 1342,
            book_title: 'Pride and Prejudice',
            host_id: 'u-2',
            host_username: 'shelley',
            host_display_name: 'Mary Shelley',
            fellow_id: 'u-1',
            fellow_username: 'austen',
            fellow_display_name: 'Jane Austen',
            host_chapter: 0,
            host_progress: 0,
            fellow_chapter: 0,
            fellow_progress: 0,
            status: 'pending',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ]}
        isOffline={false}
        onAcceptCircleInvite={onAcceptCircleInvite}
        onDeclineCircleInvite={onDeclineCircleInvite}
        onCancelCircleInvite={onCancelCircleInvite}
        onAcceptSymposiumInvite={onAcceptSymposiumInvite}
        onDeclineSymposiumInvite={onDeclineSymposiumInvite}
        onCancelSymposiumInvite={onCancelSymposiumInvite}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Accept Fellow/i }));
    expect(onAcceptCircleInvite).toHaveBeenCalledWith('inv-in-1');

    fireEvent.click(screen.getByRole('button', { name: /Cancel Request/i }));
    expect(onCancelCircleInvite).toHaveBeenCalledWith({
      circleId: 'inv-out-1',
      fellowLabel: 'Lord Byron (@byron)',
    });

    fireEvent.click(screen.getByRole('button', { name: /Accept Pact/i }));
    expect(onAcceptSymposiumInvite).toHaveBeenCalledWith('symp-in-1');
  });
});
