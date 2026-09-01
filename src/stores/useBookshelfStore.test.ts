import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBookshelfStore, useHydratedBookshelf } from './useBookshelfStore';
import { mockBooks } from '@/mocks/handlers';

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

describe('useBookshelfStore', () => {
  beforeEach(() => {
    useBookshelfStore.getState().clearBookshelf();
  });

  it('should initialize with empty collections', () => {
    const state = useBookshelfStore.getState();
    expect(state.savedBooks).toEqual([]);
    expect(state.readingQueue).toEqual([]);
    expect(state.likedBookIds).toEqual([]);
    expect(state.recentBooks).toEqual([]);
  });

  it('should toggle save book in bookshelf', () => {
    const book = mockBooks[0];
    const store = useBookshelfStore.getState();

    expect(store.isBookSaved(book.id)).toBe(false);

    store.toggleSaveBook(book);
    expect(useBookshelfStore.getState().savedBooks).toHaveLength(1);
    expect(useBookshelfStore.getState().isBookSaved(book.id)).toBe(true);

    useBookshelfStore.getState().toggleSaveBook(book);
    expect(useBookshelfStore.getState().savedBooks).toHaveLength(0);
    expect(useBookshelfStore.getState().isBookSaved(book.id)).toBe(false);
  });

  it('should manage reading queue', () => {
    const book1 = mockBooks[0];
    const book2 = mockBooks[1];

    useBookshelfStore.getState().addToQueue(book1);
    useBookshelfStore.getState().addToQueue(book2);
    // duplicate addition should be ignored
    useBookshelfStore.getState().addToQueue(book1);

    expect(useBookshelfStore.getState().readingQueue).toHaveLength(2);
    expect(useBookshelfStore.getState().isInQueue(book1.id)).toBe(true);

    useBookshelfStore.getState().removeFromQueue(book1.id);
    expect(useBookshelfStore.getState().readingQueue).toHaveLength(1);
    expect(useBookshelfStore.getState().isInQueue(book1.id)).toBe(false);
  });

  it('should toggle like status and store likedBooks', () => {
    const book = mockBooks[0];
    expect(useBookshelfStore.getState().isBookLiked(book.id)).toBe(false);

    useBookshelfStore.getState().toggleLikeBook(book);
    expect(useBookshelfStore.getState().isBookLiked(book.id)).toBe(true);
    expect(useBookshelfStore.getState().likedBooks).toHaveLength(1);
    expect(useBookshelfStore.getState().likedBooks[0].id).toBe(book.id);

    useBookshelfStore.getState().toggleLikeBook(book);
    expect(useBookshelfStore.getState().isBookLiked(book.id)).toBe(false);
    expect(useBookshelfStore.getState().likedBooks).toHaveLength(0);

    // Also support ID-based toggle for backward compatibility
    useBookshelfStore.getState().toggleLikeBook(book.id);
    expect(useBookshelfStore.getState().isBookLiked(book.id)).toBe(true);
    useBookshelfStore.getState().toggleLikeBook(book.id);
    expect(useBookshelfStore.getState().isBookLiked(book.id)).toBe(false);
  });

  it('should sync and clear liked books', () => {
    const book = mockBooks[0];
    useBookshelfStore.setState({ likedBookIds: [book.id], likedBooks: [] });

    useBookshelfStore.getState().syncLikedBooks([book]);
    expect(useBookshelfStore.getState().likedBooks).toHaveLength(1);
    expect(useBookshelfStore.getState().likedBooks[0].id).toBe(book.id);

    useBookshelfStore.getState().clearLikedBooks();
    expect(useBookshelfStore.getState().likedBooks).toHaveLength(0);
    expect(useBookshelfStore.getState().likedBookIds).toHaveLength(0);
  });

  describe('useHydratedBookshelf', () => {
    it('returns live hydrated state and reactive actions', () => {
      const book = mockBooks[0];
      const { result } = renderHook(() => useHydratedBookshelf());

      expect(result.current.hasMounted).toBe(true);
      expect(result.current.isSaved(book.id)).toBe(false);
      expect(result.current.isLiked(book.id)).toBe(false);
      expect(result.current.savedCount).toBe(0);

      act(() => {
        result.current.toggleSaveBook(book);
        result.current.toggleLikeBook(book);
      });

      expect(result.current.isSaved(book.id)).toBe(true);
      expect(result.current.isLiked(book.id)).toBe(true);
      expect(result.current.savedCount).toBe(1);
      expect(result.current.likedCount).toBe(1);

      act(() => {
        result.current.addToQueue(book);
      });
      expect(result.current.queueCount).toBe(1);
      expect(result.current.readingQueue).toHaveLength(1);

      act(() => {
        result.current.removeFromQueue(book.id);
      });
      expect(result.current.queueCount).toBe(0);

      act(() => {
        result.current.clearBookshelf();
      });
      expect(result.current.savedCount).toBe(0);
      expect(result.current.likedCount).toBe(0);
    });

    it('handles activeBookshelfId selection and cloud bookshelf list', () => {
      const { result } = renderHook(() => useHydratedBookshelf());
      expect(result.current.cloudBookshelves).toEqual([]);
      expect(result.current.activeBookshelfId).toBeNull();

      act(() => {
        result.current.setActiveBookshelfId('shelf-123');
      });
      expect(useBookshelfStore.getState().activeBookshelfId).toBe('shelf-123');
    });

    it('handles syncWithCloud fetching bookshelves and items', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'bookshelves') {
          return {
            select: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockReturnValueOnce({
                order: vi.fn().mockResolvedValueOnce({
                  data: [{ id: 'shelf-1', user_id: 'user-1', name: 'Favorites', is_default: true, created_at: '', updated_at: '' }],
                }),
              }),
            }),
          };
        }
        if (table === 'bookshelf_items') {
          return {
            select: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockResolvedValueOnce({
                data: [
                  {
                    id: 'item-1',
                    bookshelf_id: 'shelf-1',
                    user_id: 'user-1',
                    book_id: 11,
                    book_title: 'Alice in Wonderland',
                    book_authors: ['Lewis Carroll'],
                    cover_url: 'https://example.com/cover.jpg',
                    added_at: '',
                  },
                ],
              }),
            }),
          };
        }
        return {};
      });

      const { result } = renderHook(() => useHydratedBookshelf());
      await act(async () => {
        await result.current.syncWithCloud('user-1');
      });

      expect(useBookshelfStore.getState().cloudBookshelves).toHaveLength(1);
      expect(useBookshelfStore.getState().savedBooks).toHaveLength(1);
      expect(useBookshelfStore.getState().savedBooks[0].title).toBe('Alice in Wonderland');
    });

    it('handles createCloudBookshelf and migrateLocalBooksToCloud', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'bookshelves') {
          return {
            insert: vi.fn().mockReturnValueOnce({
              select: vi.fn().mockReturnValueOnce({
                single: vi.fn().mockResolvedValueOnce({
                  data: { id: 'shelf-custom', user_id: 'user-1', name: 'Sci-Fi', is_default: false },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'bookshelf_items') {
          return {
            upsert: vi.fn().mockResolvedValueOnce({ error: null }),
          };
        }
        return {};
      });

      const { result } = renderHook(() => useHydratedBookshelf());
      let newShelf: any;
      await act(async () => {
        newShelf = await result.current.createCloudBookshelf('Sci-Fi', 'user-1');
      });

      expect(newShelf?.name).toBe('Sci-Fi');
      expect(useBookshelfStore.getState().cloudBookshelves.some((s) => s.name === 'Sci-Fi')).toBe(true);

      useBookshelfStore.setState({ savedBooks: [mockBooks[0]] });
      await act(async () => {
        await useBookshelfStore.getState().migrateLocalBooksToCloud('user-1');
      });
    });
  });
});

