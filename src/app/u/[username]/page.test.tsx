import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PublicScholarProfilePage from './page';
import { useAuthStore } from '@/stores/useAuthStore';

const mockPush = vi.fn();
let mockParams = { username: 'jane_austen' };

vi.mock('next/navigation', () => ({
  useParams: () => mockParams,
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => `/u/${mockParams.username}`,
}));

vi.mock('@/components/presentation/Footer', () => ({
  Footer: () => <footer data-testid="footer-mock">Bookarium Footer</footer>,
}));

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

describe('PublicScholarProfilePage (/u/[username])', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = { username: 'jane_austen' };
    useAuthStore.setState({ user: null, profile: null });
  });

  it('renders public scholar profile with habits, accolades, and bookshelves', async () => {
    const mockProfile = {
      id: 'user-scholar-1',
      display_name: 'Jane Austen',
      username: 'jane_austen',
      bio: 'Classical novelist of the Regency era.',
      is_public: true,
      show_streak: true,
      show_challenge: true,
      show_bookshelves: true,
      created_at: '2025-01-01T00:00:00.000Z',
    };

    const mockAccolades = [
      {
        accolade_id: 'streak-bronze',
        unlocked_at: '2025-02-01T00:00:00.000Z',
        is_pinned: true,
      },
    ];

    const mockHabits = {
      current_streak: 7,
      longest_streak: 14,
      active_dates: ['2025-02-01', '2025-02-02'],
      annual_goal: 20,
      completed_books_count: 5,
    };

    const mockShelves = [
      {
        id: 'shelf-1',
        name: 'Regency Classics',
        description: 'Selected 19th-century works',
      },
    ];

    const mockItems = [
      {
        bookshelf_id: 'shelf-1',
        book_id: 1342,
        book_title: 'Pride and Prejudice',
        book_authors: ['Jane Austen'],
      },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            ilike: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'user_accolades') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: mockAccolades, error: null }),
            }),
          }),
        };
      }
      if (table === 'user_reading_habits') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockHabits, error: null }),
            }),
          }),
        };
      }
      if (table === 'bookshelves') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockShelves, error: null }),
            }),
          }),
        };
      }
      if (table === 'bookshelf_items') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: mockItems, error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });

    render(<PublicScholarProfilePage />);

    expect(screen.getByRole('status', { name: /loading scholar sanctuary/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Jane Austen' })).toBeInTheDocument();
    });

    expect(screen.getByText('@jane_austen')).toBeInTheDocument();
    expect(screen.getByText('Classical novelist of the Regency era.', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Reading Consistency')).toBeInTheDocument();
    expect(screen.getByText('Regency Classics')).toBeInTheDocument();
    expect(screen.getByText('Pride and Prejudice')).toBeInTheDocument();
  });

  it('renders PrivateProfileNotice when profile does not exist in Supabase', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        ilike: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });

    render(<PublicScholarProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /scholar sanctuary not found/i })).toBeInTheDocument();
    });

    expect(screen.queryByText('@jane_austen')).not.toBeInTheDocument();
  });

  it('renders PrivateProfileNotice when profile has is_public = false', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        ilike: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'u-private',
                display_name: 'Private Reader',
                username: 'jane_austen',
                is_public: false,
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    render(<PublicScholarProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /scholar sanctuary not found/i })).toBeInTheDocument();
    });

    expect(screen.queryByText('@jane_austen')).not.toBeInTheDocument();
  });

  it('resolves authenticated user profile from local store fallback when viewing own public profile', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        ilike: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    useAuthStore.setState({
      user: { id: 'u-auth-self' } as any,
      profile: {
        id: 'u-auth-self',
        display_name: 'Local Scholar Self',
        username: 'jane_austen',
        bio: 'Local fallback bio',
        is_public: true,
        show_streak: false,
        show_challenge: false,
        show_bookshelves: false,
        created_at: '2026-01-01T00:00:00Z',
      } as any,
    });

    render(<PublicScholarProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Local Scholar Self' })).toBeInTheDocument();
    });
  });

  it('filters out private bookshelves and respects show_saved_books and show_custom_shelves toggles', async () => {
    const mockProfile = {
      id: 'user-scholar-1',
      display_name: 'Jane Austen',
      username: 'jane_austen',
      is_public: true,
      show_streak: false,
      show_challenge: false,
      show_bookshelves: true,
      show_saved_books: false, // General shelf should be hidden
      show_custom_shelves: true, // Custom shelves allowed
      created_at: '2025-01-01T00:00:00.000Z',
    };

    const mockShelves = [
      { id: 'shelf-gen', name: 'General', is_default: true, is_public: true },
      { id: 'shelf-pub', name: 'Public Classics', is_default: false, is_public: true },
      { id: 'shelf-priv', name: 'Private Notes', is_default: false, is_public: false },
    ];

    const mockItems = [
      { bookshelf_id: 'shelf-pub', book_id: 1342, book_title: 'Pride and Prejudice', book_authors: ['Jane Austen'] },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            ilike: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'user_accolades') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === 'bookshelves') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockShelves, error: null }),
            }),
          }),
        };
      }
      if (table === 'bookshelf_items') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: mockItems, error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });

    render(<PublicScholarProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Public Classics')).toBeInTheDocument();
    });

    // General shelf is hidden because show_saved_books = false
    expect(screen.queryByText('General')).not.toBeInTheDocument();
    // Private shelf is hidden because is_public = false
    expect(screen.queryByText('Private Notes')).not.toBeInTheDocument();
  });
});

