import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  applyDeterministicItemOrdering,
  executeFlushOutbox,
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
});

