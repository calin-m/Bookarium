import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  applyDeterministicItemOrdering,
  executeFlushOutbox,
  executeBookshelfCloudSync,
  executeCreateCloudBookshelf,
  executeUpdateCloudBookshelf,
  executeUpdateBookshelfPrivacy,
  executeDeleteCloudBookshelf,
  executeMoveBookToShelf,
  executeMigrateLocalBooksToCloud,
  type BookshelfSyncSlice,
} from './bookshelf-cloud-sync';

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

describe('bookshelf-cloud-sync', () => {
  let state: BookshelfSyncSlice;
  const get = () => state;
  const set = (partial: Partial<BookshelfSyncSlice>) => {
    state = { ...state, ...partial };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    state = {
      savedBooks: [],
      favoriteBooks: [],
      favoriteBookIds: [],
      bookRatings: {},
      bookStatuses: {},
      curationHistory: {},
      deletedBookIds: {},
      deletedFavoriteBookIds: {},
      lastFavoritesSyncAt: null,
      lastBookshelfSyncAt: null,
      cloudBookshelves: [],
      cloudBookshelfItems: [],
      activeBookshelfId: null,
      isSyncing: false,
      outbox: [],
      flushOutbox: async () => {},
    };
  });

  it('applies deterministic item ordering when order method is single-level or chainable', () => {
    const secondOrder = vi.fn().mockReturnValue('ordered-twice');
    const firstOrder = vi.fn().mockReturnValue({ order: secondOrder });
    const res1 = applyDeterministicItemOrdering({ order: firstOrder });
    expect(firstOrder).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(secondOrder).toHaveBeenCalledWith('book_id', { ascending: true });
    expect(res1).toBe('ordered-twice');

    const singleOrder = vi.fn().mockReturnValue('ordered-once');
    expect(applyDeterministicItemOrdering({ order: singleOrder })).toBe('ordered-once');

    const noOrder = {};
    expect(applyDeterministicItemOrdering(noOrder)).toBe(noOrder);
  });

  it('flushes outbox actions and retains only actions that fail', async () => {
    state.outbox = [
      {
        id: '1',
        timestamp: '',
        type: 'DELETE_BOOK',
        payload: { bookshelf_id: 's1', book_id: 1342 },
      },
      {
        id: '2',
        timestamp: '',
        type: 'DELETE_CURATION',
        payload: { user_id: 'u1', book_id: 84 },
      },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'bookshelf_items') {
        return {
          delete: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          }),
        };
      }
      return {
        delete: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ error: new Error('DB fail') }),
          }),
        }),
      };
    });

    await executeFlushOutbox('u1', get, set);
    expect(state.outbox).toHaveLength(1);
    expect(state.outbox[0].id).toBe('2');
  });

  it('executes custom shelf creation, rename, privacy toggle, move, migration, and deletion', async () => {
    // Reject invalid shelf names
    expect(await executeCreateCloudBookshelf('  ', 'u1', true, get, set)).toBeNull();
    expect(await executeCreateCloudBookshelf('General', 'u1', true, get, set)).toBeNull();

    // Create shelf
    mockFrom.mockReturnValue({
      insert: () => ({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: { id: 'shelf-2', user_id: 'u1', name: 'Poetry', is_default: false, is_public: true },
              error: null,
            }),
        }),
      }),
      update: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
      delete: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
      upsert: () => Promise.resolve({ error: null }),
    });

    const created = await executeCreateCloudBookshelf('Poetry', 'u1', true, get, set);
    expect(created?.name).toBe('Poetry');
    expect(state.activeBookshelfId).toBe('shelf-2');

    // Rename shelf
    const renamed = await executeUpdateCloudBookshelf('shelf-2', 'Epic Poetry', 'u1', false, get, set);
    expect(renamed).toBe(true);
    expect(state.cloudBookshelves[0].name).toBe('Epic Poetry');
    expect(state.cloudBookshelves[0].is_public).toBe(false);

    // Privacy toggle
    const privUpdated = await executeUpdateBookshelfPrivacy('shelf-2', true, 'u1', get, set);
    expect(privUpdated).toBe(true);
    expect(state.cloudBookshelves[0].is_public).toBe(true);

    // Move book to shelf
    const moved = await executeMoveBookToShelf(1342, 'shelf-2', 'u1', get, set);
    expect(moved).toBe(true);
    expect(state.cloudBookshelfItems).toHaveLength(1);

    // Migrate local books
    state.savedBooks = [{ id: 1342, title: 'Pride and Prejudice', authors: [], translators: [], subjects: [], bookshelves: [], languages: ['en'], copyright: false, media_type: 'Text', formats: {}, download_count: 1 }];
    state.favoriteBooks = state.savedBooks;
    await executeMigrateLocalBooksToCloud('u1', get, set);
    expect(state.lastFavoritesSyncAt).not.toBeNull();

    // Delete shelf
    const deleted = await executeDeleteCloudBookshelf('shelf-2', 'u1', get, set);
    expect(deleted).toBe(true);
    expect(state.cloudBookshelves).toHaveLength(0);
  });

  it('dispatches all 6 outbox action types and handles empty outbox', async () => {
    await executeFlushOutbox('u1', get, set);
    expect(mockFrom).not.toHaveBeenCalled();

    state.outbox = [
      { id: 'a1', timestamp: '', type: 'DELETE_FAVORITE', payload: { user_id: 'u1', book_id: 1342 } },
      {
        id: 'a2',
        timestamp: '',
        type: 'INSERT_BOOK',
        payload: {
          bookshelf_id: 's1',
          user_id: 'u1',
          book_id: 1342,
          book_title: 'Pride',
          book_authors: ['Austen'],
          cover_url: null,
        },
      },
      {
        id: 'a3',
        timestamp: '',
        type: 'UPSERT_FAVORITE',
        payload: {
          user_id: 'u1',
          book_id: 1342,
          book_title: 'Pride',
          book_authors: ['Austen'],
          cover_url: null,
        },
      },
      {
        id: 'a4',
        timestamp: '',
        type: 'UPSERT_CURATION',
        payload: {
          user_id: 'u1',
          book_id: 1342,
          rating: 5,
          reading_status: 'finished',
        },
      },
    ];

    mockFrom.mockReturnValue({
      delete: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
      upsert: () => Promise.resolve({ error: null }),
    });

    await executeFlushOutbox('u1', get, set);
    expect(state.outbox).toHaveLength(0);
  });

  it('synchronizes shelves, tombstones, favorites, and LWW curation in executeBookshelfCloudSync', async () => {
    await executeBookshelfCloudSync('', get, set);
    expect(mockFrom).not.toHaveBeenCalled();

    // Case 1: User has existing shelves, tombstoned book & favorite, and mixed LWW curations
    state.savedBooks = [
      {
        id: 2701,
        title: 'Moby Dick',
        authors: [],
        translators: [],
        subjects: [],
        bookshelves: [],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: {},
        download_count: 10,
      },
    ];
    state.favoriteBooks = state.savedBooks;
    state.deletedBookIds = { 999: '2026-10-01T00:00:00Z' };
    state.deletedFavoriteBookIds = { 888: '2026-10-01T00:00:00Z' };
    state.bookRatings = { 1342: 5, 84: 4, 2701: 5 };
    state.bookStatuses = { 1342: 'finished', 84: 'currently_reading', 2701: 'want_to_read' };
    state.curationHistory = {
      1342: '2026-10-01T00:00:00Z', // Older than remote -> remote wins (clears rating/status)
      84: '2026-10-20T00:00:00Z',   // Newer than remote -> local wins (pushed to cloud)
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'bookshelves') {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    { id: 's-def', user_id: 'u1', name: 'General', is_default: true },
                    { id: 's-def', user_id: 'u1', name: 'General', is_default: true }, // duplicate ID
                  ],
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === 'bookshelf_items') {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    { id: 'bi-1', bookshelf_id: 's-def', user_id: 'u1', book_id: 1342, book_title: 'Pride', book_authors: ['Austen'] },
                    { id: 'bi-del', bookshelf_id: 's-def', user_id: 'u1', book_id: 999, book_title: 'Deleted', book_authors: [] },
                  ],
                  error: null,
                }),
            }),
          }),
          delete: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
          upsert: () => Promise.resolve({ error: null }),
        };
      }
      if (table === 'user_favorites') {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    { user_id: 'u1', book_id: 1342, book_title: 'Pride', book_authors: ['Austen'] },
                    { user_id: 'u1', book_id: 888, book_title: 'Deleted Fav', book_authors: [] },
                  ],
                  error: null,
                }),
            }),
          }),
          delete: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          }),
          upsert: () => Promise.resolve({ error: null }),
        };
      }
      if (table === 'user_book_curation') {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [
                  {
                    user_id: 'u1',
                    book_id: 1342,
                    rating: null,
                    reading_status: null,
                    updated_at: '2026-10-10T00:00:00Z',
                  },
                  {
                    user_id: 'u1',
                    book_id: 84,
                    rating: 2,
                    reading_status: 'want_to_read',
                    updated_at: '2026-10-05T00:00:00Z',
                  },
                ],
                error: null,
              }),
          }),
          upsert: () => Promise.resolve({ error: null }),
        };
      }
      return {};
    });

    await executeBookshelfCloudSync('u1', get, set);
    expect(state.cloudBookshelves).toHaveLength(1);
    expect(state.savedBooks.map((b) => b.id)).toEqual([1342, 2701]);
    expect(state.favoriteBookIds).toEqual([1342, 2701]);
    expect(state.bookRatings[1342]).toBeUndefined();
    expect(state.bookRatings[84]).toBe(4);
    expect(state.bookRatings[2701]).toBe(5);

    // Case 2: User has NO existing shelves (creates default 'General' shelf) and subsequent sync with lastBookshelfSyncAt set
    state.lastBookshelfSyncAt = null;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'bookshelves') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: 's-new-def', user_id: 'u1', name: 'General', is_default: true },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === 'bookshelf_items') {
        return {
          upsert: () => Promise.resolve({ error: null }),
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: [{ id: 'bi-1', bookshelf_id: 's-new-def', user_id: 'u1', book_id: 1342, book_title: 'Pride', book_authors: [] }],
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === 'user_favorites') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === 'user_book_curation') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
          upsert: () => Promise.resolve({ error: null }),
        };
      }
      return {};
    });

    await executeBookshelfCloudSync('u1', get, set);
    expect(state.activeBookshelfId).toBe('s-new-def');
  });

  it('covers shelf deletion reassignment to defaultShelf, moveBookToShelf existing item & error fallback, and validation guards', async () => {
    expect(await executeUpdateCloudBookshelf('', 'Name', 'u1', true, get, set)).toBe(false);
    expect(await executeUpdateBookshelfPrivacy('', true, 'u1', get, set)).toBe(false);
    expect(await executeDeleteCloudBookshelf('', 'u1', get, set)).toBe(false);
    expect(await executeMoveBookToShelf(0, '', 'u1', get, set)).toBe(false);

    state.cloudBookshelves = [
      { id: 's-def', user_id: 'u1', name: 'General', is_default: true, created_at: '', updated_at: '' },
      { id: 's-custom', user_id: 'u1', name: 'Custom', is_default: false, created_at: '', updated_at: '' },
    ];
    state.cloudBookshelfItems = [
      {
        id: 'item-1',
        bookshelf_id: 's-def',
        user_id: 'u1',
        book_id: 1342,
        book_title: 'Pride',
        book_authors: [],
        cover_url: null,
        added_at: '',
      },
    ];
    state.savedBooks = [
      {
        id: 84,
        title: 'Frankenstein',
        authors: [],
        translators: [],
        subjects: [],
        bookshelves: [],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: {},
        download_count: 1,
      },
    ];

    const insertSpy = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      update: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ error: new Error('Row missing') }),
        }),
      }),
      insert: insertSpy,
      delete: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
    });

    // Move existing item (1342) to s-custom
    await executeMoveBookToShelf(1342, 's-custom', 'u1', get, set);
    expect(state.cloudBookshelfItems.find((i) => i.book_id === 1342)?.bookshelf_id).toBe('s-custom');

    // Move non-existing item (84) where update returns error -> falls back to insert
    await executeMoveBookToShelf(84, 's-custom', 'u1', get, set);
    expect(insertSpy).toHaveBeenCalled();

    // Delete s-custom -> reassigns items on s-custom to s-def
    await executeDeleteCloudBookshelf('s-custom', 'u1', get, set);
    expect(state.cloudBookshelfItems.every((i) => i.bookshelf_id === 's-def')).toBe(true);
  });
});

