import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PublicProfileView,
  type PublicScholarProfile,
  type PublicReadingHabits,
  type PublicBookshelfWithItems,
} from './PublicProfileView';

const mockProfile: PublicScholarProfile = {
  id: 'user-scholar-1',
  display_name: 'Jane Austen',
  username: 'jane_austen',
  bio: 'A quiet observer of human manners and classical literature.',
  is_public: true,
  show_streak: true,
  show_challenge: true,
  show_bookshelves: true,
  created_at: '2025-06-15T00:00:00.000Z',
};

const mockHabits: PublicReadingHabits = {
  current_streak: 14,
  longest_streak: 30,
  active_days: 42,
  annual_goal: 25,
  completed_books_count: 10,
};

const mockBookshelves: PublicBookshelfWithItems[] = [
  {
    id: 'shelf-1',
    name: 'Victorian Favorites',
    description: 'Cherished classics from the 19th century',
    items: [
      {
        book_id: 1342,
        book_title: 'Pride and Prejudice',
        book_authors: ['Jane Austen'],
      },
    ],
  },
];

describe('PublicProfileView', () => {
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });
  });

  it('renders public scholar view with profile info, telemetry, and bookshelves', () => {
    render(
      <PublicProfileView
        profile={mockProfile}
        habits={mockHabits}
        bookshelves={mockBookshelves}
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Jane Austen' })).toBeInTheDocument();
    expect(screen.getByText('@jane_austen')).toBeInTheDocument();
    expect(screen.getByText(/scholar since june 2025/i)).toBeInTheDocument();
    expect(
      screen.getByText(/a quiet observer of human manners and classical literature/i)
    ).toBeInTheDocument();

    // Telemetry
    expect(screen.getByText('Reading Consistency')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('Annual Reading Challenge')).toBeInTheDocument();
    expect(screen.getByText('10 / 25')).toBeInTheDocument();

    // Bookshelves
    expect(screen.getByText('Victorian Favorites')).toBeInTheDocument();
    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /read work/i })).toHaveAttribute('href', '/read/1342');
  });

  it('renders PrivateProfileNotice when is_public is false', () => {
    render(
      <PublicProfileView
        profile={{ ...mockProfile, is_public: false }}
        habits={mockHabits}
      />
    );

    expect(screen.getByRole('region', { name: /scholar sanctuary not found/i })).toBeInTheDocument();
    expect(screen.queryByText('Reading Consistency')).not.toBeInTheDocument();
  });

  it('enforces strict Zero-PII guarantee (no email or sensitive fields)', () => {
    const { container } = render(
      <PublicProfileView
        profile={mockProfile}
        habits={mockHabits}
        bookshelves={mockBookshelves}
      />
    );

    // Verify no email pattern is rendered
    expect(container.textContent).not.toMatch(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/);
    expect(screen.queryByText(/user-scholar-1/i)).not.toBeInTheDocument();
  });

  it('respects granular privacy toggles by omitting telemetry and bookshelves', () => {
    render(
      <PublicProfileView
        profile={{
          ...mockProfile,
          show_streak: false,
          show_challenge: false,
          show_bookshelves: false,
        }}
        habits={mockHabits}
        bookshelves={mockBookshelves}
      />
    );

    expect(screen.queryByText('Reading Consistency')).not.toBeInTheDocument();
    expect(screen.queryByText('Annual Reading Challenge')).not.toBeInTheDocument();
    expect(screen.queryByText('Public Bookshelves & Preserved Works')).not.toBeInTheDocument();
    expect(screen.queryByText('Victorian Favorites')).not.toBeInTheDocument();
  });

  it('falls back to username handle when display_name is missing', () => {
    render(
      <PublicProfileView
        profile={{ ...mockProfile, display_name: null }}
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: '@jane_austen' })).toBeInTheDocument();
  });

  it('falls back to Bookarium Scholar when both display_name and username are missing', () => {
    render(
      <PublicProfileView
        profile={{ ...mockProfile, display_name: null, username: null }}
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Bookarium Scholar' })).toBeInTheDocument();
  });

  it('copies public profile link when share button is clicked', () => {
    render(<PublicProfileView profile={mockProfile} />);

    const shareBtn = screen.getByRole('button', { name: /share scholar profile link/i });
    fireEvent.click(shareBtn);

    expect(writeTextMock).toHaveBeenCalled();
    expect(screen.getByText('Link Copied')).toBeInTheDocument();
  });

  it('renders Invite to Reader Circle button for authenticated visitor and dispatches invite', async () => {
    const { useAuthStore } = await import('@/stores/useAuthStore');
    const { useFellowshipStore } = await import('@/stores/useFellowshipStore');
    const sendInviteMock = vi.fn().mockResolvedValue({ error: null, circle: null });
    act(() => {
      useAuthStore.setState({
        user: { id: 'visitor-user-2', email: 'visitor@bookarium.test' } as unknown as ReturnType<typeof useAuthStore.getState>['user'],
      });
      useFellowshipStore.setState({
        circles: [],
        inviteFellowByUsername: sendInviteMock,
      } as unknown as Partial<ReturnType<typeof useFellowshipStore.getState>>);
    });

    render(<PublicProfileView profile={mockProfile} />);

    const inviteBtn = screen.getByTestId('public-profile-invite-circle-btn');
    expect(inviteBtn).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(inviteBtn);
    });

    await waitFor(() => {
      expect(sendInviteMock).toHaveBeenCalledWith('jane_austen');
      expect(screen.getByTestId('public-profile-circle-pending-btn')).toBeInTheDocument();
    });

    act(() => {
      useAuthStore.setState({ user: null });
      useFellowshipStore.getState().clearFellowshipState();
    });
  });

  it('renders Start Symposium button when visitor is already an accepted Fellow Scholar and closes modal', async () => {
    const { useAuthStore } = await import('@/stores/useAuthStore');
    const { useFellowshipStore } = await import('@/stores/useFellowshipStore');
    act(() => {
      useAuthStore.setState({
        user: { id: 'visitor-user-2', email: 'visitor@bookarium.test' } as unknown as ReturnType<typeof useAuthStore.getState>['user'],
      });
      useFellowshipStore.setState({
        circles: [
          {
            id: 'circle-1',
            requester_id: 'visitor-user-2',
            requester_username: 'visitor_scholar',
            requester_display_name: 'Visitor Scholar',
            recipient_id: 'user-scholar-1',
            recipient_username: 'jane_austen',
            recipient_display_name: 'Jane Austen',
            status: 'accepted',
            created_at: '2026-10-15T10:00:00Z',
            updated_at: '2026-10-15T10:00:00Z',
          },
        ],
      });
    });

    render(<PublicProfileView profile={mockProfile} />);

    const symposiumBtn = screen.getByTestId('public-profile-start-symposium-btn');
    expect(symposiumBtn).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(symposiumBtn);
    });

    const modal = await screen.findByTestId('symposium-invite-modal');
    expect(modal).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Close modal/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('symposium-invite-modal')).not.toBeInTheDocument();

    act(() => {
      useAuthStore.setState({ user: null });
      useFellowshipStore.getState().clearFellowshipState();
    });
  });

  it('renders empty bookshelves message, empty shelf items, and anonymous author fallback', () => {
    const { rerender } = render(
      <PublicProfileView
        profile={{ ...mockProfile, display_name: 'Plato' }}
        bookshelves={[]}
      />
    );
    expect(screen.getByText('PL')).toBeInTheDocument();
    expect(
      screen.getByText('No public bookshelves published by this scholar yet.')
    ).toBeInTheDocument();

    rerender(
      <PublicProfileView
        profile={mockProfile}
        bookshelves={[
          {
            id: 'empty-shelf',
            name: 'Empty Shelf',
            items: [],
          },
          {
            id: 'anon-shelf',
            name: 'Anonymous Shelf',
            items: [
              {
                book_id: 999,
                book_title: 'Beowulf',
                book_authors: [],
              },
              {
                book_id: 1000,
                book_title: 'Sir Gawain',
                book_authors: ['Pearl Poet'],
              },
            ],
          },
        ]}
      />
    );

    expect(
      screen.getByText('This shelf contains no public volumes yet.')
    ).toBeInTheDocument();
    expect(screen.getByText('Anonymous')).toBeInTheDocument();
    expect(screen.getByText('2 books')).toBeInTheDocument();
  });

  it('uses solid border-border across header, telemetry tiles, and bookshelf items without fractional border-border/* or hover:border-primary/40', () => {
    const { container } = render(
      <PublicProfileView
        profile={mockProfile}
        habits={mockHabits}
        bookshelves={mockBookshelves}
      />
    );

    const html = container.innerHTML;
    expect(html).not.toContain('border-border/60');
    expect(html).not.toContain('border-border/80');
    expect(html).not.toContain('border-primary/20');
    expect(html).not.toContain('hover:border-primary/40');
    expect(html).toContain('hover:shadow-booksaw-hover');
  });
});

