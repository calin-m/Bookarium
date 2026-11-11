import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReaderCircleSubTab } from './ReaderCircleSubTab';

describe('ReaderCircleSubTab', () => {
  it('submits scholar invitation handle and triggers symposium and circle removal callbacks', () => {
    const onInviteHandleChange = vi.fn();
    const onInviteSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const onOpenSymposiumWithFellow = vi.fn();
    const onRequestRemoveFellow = vi.fn();

    render(
      <ReaderCircleSubTab
        acceptedFellows={[
          {
            circleId: 'circle-1',
            fellowId: 'user-2',
            username: 'shelley',
            displayName: 'Mary Shelley',
          },
        ]}
        isOffline={false}
        inviteHandle="@byron"
        onInviteHandleChange={onInviteHandleChange}
        isInviting={false}
        inviteError={null}
        inviteSuccess={null}
        onInviteSubmit={onInviteSubmit}
        onOpenSymposiumWithFellow={onOpenSymposiumWithFellow}
        onRequestRemoveFellow={onRequestRemoveFellow}
      />
    );

    fireEvent.change(
      screen.getByLabelText(/Invite Fellow Scholar by @username Handle/i),
      {
        target: { value: '@keats' },
      }
    );
    expect(onInviteHandleChange).toHaveBeenCalledWith('@keats');

    fireEvent.click(
      screen.getByRole('button', { name: /Send Circle Invitation/i })
    );
    expect(onInviteSubmit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Symposium/i }));
    expect(onOpenSymposiumWithFellow).toHaveBeenCalledWith({
      fellowId: 'user-2',
      username: 'shelley',
      displayName: 'Mary Shelley',
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Remove @shelley from Reader Circle',
      })
    );
    expect(onRequestRemoveFellow).toHaveBeenCalledWith({
      circleId: 'circle-1',
      fellowLabel: 'Mary Shelley (@shelley)',
    });
  });
});
