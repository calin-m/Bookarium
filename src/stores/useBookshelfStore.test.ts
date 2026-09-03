import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBookshelfStore, useHydratedBookshelf, useSavedBooksCount, useIsBookSaved } from './useBookshelfStore';
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

  it('should call Supabase upsert and delete on toggleLikeBook with userId', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockEqBook = vi.fn().mockResolvedValue({ error: null });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqBook });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEqUser });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_favorites') {
        return {
          upsert: mockUpsert,
          delete: mockDelete,
        };
      }
      return {};
    });

    const book = mockBooks[0];
    // Like with userId
    await act(async () => {
      await useBookshelfStore.getState().toggleLikeBook(book, 'user-1');
    });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        book_id: book.id,
        book_title: book.title,
      })
    );

    // Unlike with userId
    await act(async () => {
      await useBookshelfStore.getState().toggleLikeBook(book, 'user-1');
    });
    expect(mockDelete).toHaveBeenCalled();
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
        if (table === 'user_favorites') {
          return {
            select: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockReturnValueOnce({
                order: vi.fn().mockResolvedValueOnce({
                  data: [
                    {
                      user_id: 'user-1',
                      book_id: 84,
                      book_title: 'Frankenstein',
                      book_authors: ['Mary Wollstonecraft Shelley'],
                      cover_url: 'https://example.com/frankenstein.jpg',
                      created_at: '',
                    },
                  ],
                }),
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
      expect(useBookshelfStore.getState().likedBooks).toHaveLength(1);
      expect(useBookshelfStore.getState().likedBooks[0].title).toBe('Frankenstein');
      expect(useBookshelfStore.getState().likedBookIds).toContain(84);
    });

    it('bidirectionally pushes unsynced local books and favorites to Supabase during syncWithCloud', async () => {
      const itemsUpsertMock = vi.fn().mockResolvedValue({ error: null });
      const favsUpsertMock = vi.fn().mockResolvedValue({ error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'bookshelves') {
          return {
            select: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockReturnValueOnce({
                order: vi.fn().mockResolvedValueOnce({
                  data: [{ id: 'shelf-gen', user_id: 'user-1', name: 'General', is_default: true, created_at: '', updated_at: '' }],
                }),
              }),
            }),
          };
        }
        if (table === 'bookshelf_items') {
          return {
            select: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockResolvedValueOnce({
                data: [], // cloud is currently empty
              }),
            }),
            upsert: itemsUpsertMock,
          };
        }
        if (table === 'user_favorites') {
          return {
            select: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockReturnValueOnce({
                order: vi.fn().mockResolvedValueOnce({
                  data: [], // cloud is currently empty
                }),
              }),
            }),
            upsert: favsUpsertMock,
          };
        }
        return {};
      });

      // Populate local store with books from guest session
      useBookshelfStore.setState({
        savedBooks: [mockBooks[0]],
        likedBooks: [mockBooks[1]],
        likedBookIds: [mockBooks[1].id],
      });

      await act(async () => {
        await useBookshelfStore.getState().syncWithCloud('user-1');
      });

      // Verify books were uploaded to Supabase
      expect(itemsUpsertMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            bookshelf_id: 'shelf-gen',
            user_id: 'user-1',
            book_id: mockBooks[0].id,
            book_title: mockBooks[0].title,
          }),
        ]),
        { onConflict: 'bookshelf_id,book_id' }
      );

      // Verify favorites were uploaded to Supabase
      expect(favsUpsertMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            user_id: 'user-1',
            book_id: mockBooks[1].id,
            book_title: mockBooks[1].title,
          }),
        ]),
        { onConflict: 'user_id,book_id' }
      );
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

    it('handles updateCloudBookshelf and deleteCloudBookshelf', async () => {
      useBookshelfStore.setState({
        cloudBookshelves: [
          { id: 'shelf-1', user_id: 'user-1', name: 'Main', is_default: true, created_at: '', updated_at: '' },
          { id: 'shelf-2', user_id: 'user-1', name: 'Philosophy', is_default: false, created_at: '', updated_at: '' },
        ],
        activeBookshelfId: 'shelf-2',
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'bookshelves') {
          return {
            update: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockReturnValueOnce({
                eq: vi.fn().mockResolvedValueOnce({ error: null }),
              }),
            }),
            delete: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockReturnValueOnce({
                eq: vi.fn().mockResolvedValueOnce({ error: null }),
              }),
            }),
          };
        }
        if (table === 'bookshelf_items') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const { result } = renderHook(() => useHydratedBookshelf());

      let updateSuccess = false;
      await act(async () => {
        updateSuccess = await result.current.updateCloudBookshelf('shelf-2', 'Greek Philosophy', 'user-1');
      });
      expect(updateSuccess).toBe(true);
      expect(useBookshelfStore.getState().cloudBookshelves.find((s) => s.id === 'shelf-2')?.name).toBe('Greek Philosophy');

      let deleteSuccess = false;
      await act(async () => {
        deleteSuccess = await result.current.deleteCloudBookshelf('shelf-2', 'user-1');
      });
      expect(deleteSuccess).toBe(true);
      expect(useBookshelfStore.getState().cloudBookshelves).toHaveLength(1);
      expect(useBookshelfStore.getState().activeBookshelfId).toBe('shelf-1');
    });

    it('handles moveBookToShelf properly', async () => {
      useBookshelfStore.setState({
        cloudBookshelfItems: [
          {
            id: 'item-1',
            bookshelf_id: 'shelf-1',
            user_id: 'user-1',
            book_id: 84,
            book_title: 'Frankenstein',
            book_authors: ['Mary Shelley'],
            cover_url: null,
            added_at: '',
          },
        ],
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'bookshelf_items') {
          return {
            update: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockReturnValueOnce({
                eq: vi.fn().mockResolvedValueOnce({ error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const { result } = renderHook(() => useHydratedBookshelf());
      let moveSuccess = false;
      await act(async () => {
        moveSuccess = await result.current.moveBookToShelf(84, 'shelf-2', 'user-1');
      });

      expect(moveSuccess).toBe(true);
      expect(useBookshelfStore.getState().cloudBookshelfItems[0].bookshelf_id).toBe('shelf-2');
    });

    it('creates a new bookshelf item if book is not in cloudBookshelfItems yet', async () => {
      useBookshelfStore.setState({
        cloudBookshelfItems: [],
        savedBooks: [
          {
            id: 1342,
            title: 'Pride and Prejudice',
            authors: [{ name: 'Jane Austen', birth_year: null, death_year: null }],
            translators: [],
            subjects: [],
            bookshelves: [],
            languages: ['en'],
            copyright: false,
            media_type: 'Text',
            formats: { 'image/jpeg': 'https://example.com/cover.jpg' },
            download_count: 5000,
          },
        ],
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'bookshelf_items') {
          return {
            update: vi.fn().mockReturnValueOnce({
              eq: vi.fn().mockReturnValueOnce({
                eq: vi.fn().mockResolvedValueOnce({ error: { message: 'not found' } }),
              }),
            }),
            insert: vi.fn().mockResolvedValueOnce({ error: null }),
          };
        }
        return {};
      });

      const { result } = renderHook(() => useHydratedBookshelf());
      let moveSuccess = false;
      await act(async () => {
        moveSuccess = await result.current.moveBookToShelf(1342, 'shelf-2', 'user-1');
      });

      expect(moveSuccess).toBe(true);
      expect(useBookshelfStore.getState().cloudBookshelfItems).toHaveLength(1);
      expect(useBookshelfStore.getState().cloudBookshelfItems[0].book_id).toBe(1342);
      expect(useBookshelfStore.getState().cloudBookshelfItems[0].bookshelf_id).toBe('shelf-2');
    });

    it('queues offline actions to outbox when Supabase network rejects and flushes them on syncWithCloud', async () => {
      // 1. Setup store with a saved book and default shelf
      useBookshelfStore.setState({
        cloudBookshelves: [{ id: 'shelf-1', user_id: 'user-1', name: 'General', is_default: true, created_at: '', updated_at: '' }],
        activeBookshelfId: 'shelf-1',
        savedBooks: [mockBooks[0]],
        cloudBookshelfItems: [{
          id: 'item-1',
          bookshelf_id: 'shelf-1',
          user_id: 'user-1',
          book_id: mockBooks[0].id,
          book_title: mockBooks[0].title,
          book_authors: [],
          cover_url: null,
          added_at: '',
        }],
      });

      // 2. Simulate offline network failure on deletion
      const deleteEqMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockRejectedValueOnce(new Error('Network Offline')),
      });
      mockFrom.mockReturnValue({
        delete: vi.fn().mockReturnValue({ eq: deleteEqMock }),
      });

      // Toggle to delete while offline
      await useBookshelfStore.getState().toggleSaveBook(mockBooks[0], 'user-1');

      // Assert it was queued to the outbox
      const outbox = useBookshelfStore.getState().outbox;
      expect(outbox).toHaveLength(1);
      expect(outbox[0].type).toBe('DELETE_BOOK');
      expect(outbox[0].payload.book_id).toBe(mockBooks[0].id);

      // 3. Now simulate reconnection and flush
      const successfulDeleteEq = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'bookshelf_items') {
          return {
            delete: vi.fn().mockReturnValue({ eq: successfulDeleteEq }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [] }),
            }),
          };
        }
        if (table === 'bookshelves') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [{ id: 'shelf-1', user_id: 'user-1', name: 'General', is_default: true }] }),
              }),
            }),
          };
        }
        if (table === 'user_favorites') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          };
        }
        return {};
      });

      await useBookshelfStore.getState().flushOutbox('user-1');
      expect(useBookshelfStore.getState().outbox).toHaveLength(0);
    });
  });

  describe('Atomic Selector Hooks', () => {
    it('returns saved books count via useSavedBooksCount', () => {
      const { result } = renderHook(() => useSavedBooksCount());
      expect(result.current).toBe(0);

      act(() => {
        useBookshelfStore.getState().toggleSaveBook(mockBooks[0]);
      });

      const { result: updated } = renderHook(() => useSavedBooksCount());
      expect(updated.current).toBe(1);
    });

    it('returns isSaved status via useIsBookSaved', () => {
      const { result } = renderHook(() => useIsBookSaved(mockBooks[0].id));
      expect(result.current).toBe(false);

      act(() => {
        useBookshelfStore.getState().toggleSaveBook(mockBooks[0]);
      });

      const { result: updated } = renderHook(() => useIsBookSaved(mockBooks[0].id));
      expect(updated.current).toBe(true);
    });
  });
});


