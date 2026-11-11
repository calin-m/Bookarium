import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SymposiumPactsSubTab } from './SymposiumPactsSubTab';

describe('SymposiumPactsSubTab', () => {
  it('renders symposium creation trigger and active reading pacts with leave confirmation', () => {
    const onOpenNewSymposiumModal = vi.fn();
    const onRequestLeaveSymposium = vi.fn();

    render(
      <SymposiumPactsSubTab
        userId="user-1"
        activeSymposiums={[
          {
            id: 'symp-1',
            book_id: 1342,
            book_title: 'Pride and Prejudice',
            host_id: 'user-1',
            host_username: 'austen',
            host_display_name: 'Jane Austen',
            fellow_id: 'user-2',
            fellow_username: 'shelley',
            fellow_display_name: 'Mary Shelley',
            host_chapter: 2,
            host_progress: 40,
            fellow_chapter: 3,
            fellow_progress: 55,
            status: 'active',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ]}
        isOffline={false}
        isBookOffline={() => true}
        onOpenNewSymposiumModal={onOpenNewSymposiumModal}
        onRequestLeaveSymposium={onRequestLeaveSymposium}
      />
    );

    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('55%')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /New Symposium Pact/i })
    );
    expect(onOpenNewSymposiumModal).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Leave Symposium/i }));
    expect(onRequestLeaveSymposium).toHaveBeenCalledWith({
      sessionId: 'symp-1',
      bookTitle: 'Pride and Prejudice',
      fellowLabel: 'Mary Shelley (@shelley)',
    });
  });
});
