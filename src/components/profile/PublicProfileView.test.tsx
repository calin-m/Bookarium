import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
});
