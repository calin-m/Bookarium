import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  applyDeterministicItemOrdering,
  mergeCloudBookWithLocal,
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
    const queuedDuringFlush = {
      id: '3',
      timestamp: '',
      type: 'DELETE_FAVORITE' as const,
      payload: { user_id: 'u1', book_id: 1342 },
    };
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
    state.queueOutboxAction = (action) => {
      state.outbox = [...state.outbox, { ...action, id: queuedDuringFlush.id, timestamp: queuedDuringFlush.timestamp }];
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'bookshelf_items') {
        return {
          delete: () => ({
            eq: () => ({
              eq: () =>
                Promise.resolve().then(() => {
                  state.queueOutboxAction?.(queuedDuringFlush);
                  return { error: null };
                }),
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
    expect(state.outbox.map((action) => action.id)).toEqual(['2', '3']);
  });

  it('resets syncing state when flushing the outbox rejects', async () => {
    const onLineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    state.flushOutbox = vi.fn().mockRejectedValue(new Error('Outbox flush failed'));

    await executeBookshelfCloudSync('u1', get, set);

    expect(state.isSyncing).toBe(false);
    onLineSpy.mockRestore();
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

  it('dispatches MOVE_BOOK and UPDATE_SHELF outbox actions and handles offline / error outbox queuing', async () => {
    const queued: unknown[] = [];
    state.queueOutboxAction = (action) => {
      queued.push(action);
    };
    state.cloudBookshelves = [
      { id: 's-1', user_id: 'u1', name: 'Poetry', is_default: false, is_public: true, created_at: '', updated_at: '' },
      { id: 's-2', user_id: 'u1', name: 'Drama', is_default: false, is_public: false, created_at: '', updated_at: '' },
    ];

    state.outbox = [
      {
        id: 'm1',
        timestamp: '',
        type: 'MOVE_BOOK',
        payload: { user_id: 'u1', book_id: 1342, bookshelf_id: 's-1' },
      },
      {
        id: 'u1',
        timestamp: '',
        type: 'UPDATE_SHELF',
        payload: { shelf_id: 's-1', user_id: 'u1', name: 'Modern Poetry', is_public: false },
      },
    ];

    mockFrom.mockReturnValue({
      update: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
    });

    await executeFlushOutbox('u1', get, set);
    expect(state.outbox).toHaveLength(0);

    // Offline queuing for executeBookshelfCloudSync, executeUpdateCloudBookshelf, executeUpdateBookshelfPrivacy, executeMoveBookToShelf
    const onLineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await executeBookshelfCloudSync('u1', get, set);
    expect(state.isSyncing).toBe(false);

    expect(await executeUpdateCloudBookshelf('s-1', 'Offline Poetry', 'u1', true, get, set)).toBe(true);
    expect(state.cloudBookshelves.find((s) => s.id === 's-1')?.name).toBe('Offline Poetry');
    expect(await executeUpdateBookshelfPrivacy('s-1', false, 'u1', get, set)).toBe(true);
    expect(state.cloudBookshelves.find((s) => s.id === 's-1')?.is_public).toBe(false);
    expect(await executeMoveBookToShelf(9999, 's-1', 'u1', get, set)).toBe(true);
    expect(queued).toHaveLength(3);

    onLineSpy.mockReturnValue(true);

    // Network exception catch blocks queuing outbox actions
    mockFrom.mockImplementation(() => {
      throw new Error('Network disconnected');
    });
    expect(await executeUpdateCloudBookshelf('s-1', 'Catch Poetry', 'u1', undefined, get, set)).toBe(true);
    expect(await executeUpdateBookshelfPrivacy('s-1', true, 'u1', get, set)).toBe(true);
    expect(await executeMoveBookToShelf(1342, 's-2', 'u1', get, set)).toBe(true);
    expect(queued).toHaveLength(6);

    onLineSpy.mockRestore();
  });

  it('handles subsequent cloud sync (authoritative mode), __downloaded__ active shelf preservation, and query error branches', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    state.activeBookshelfId = '__downloaded__';
    state.lastBookshelfSyncAt = '2026-10-01T00:00:00Z';
    state.lastFavoritesSyncAt = '2026-10-01T00:00:00Z';

    // First pass: trigger itemsError and favoritesError + remote curation with non-null rating & status
    mockFrom.mockImplementation((table: string) => {
      if (table === 'bookshelves') {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: [{ id: 's-def', user_id: 'u1', name: 'General', is_default: true }],
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
              order: () => Promise.resolve({ data: null, error: new Error('Items query error') }),
            }),
          }),
        };
      }
      if (table === 'user_favorites') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: null, error: new Error('Favorites query error') }),
            }),
          }),
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
                    rating: 5,
                    reading_status: 'finished',
                    updated_at: '2026-10-15T00:00:00Z',
                  },
                ],
                error: null,
              }),
          }),
        };
      }
      return {};
    });

    await executeBookshelfCloudSync('u1', get, set);
    expect(state.activeBookshelfId).toBe('__downloaded__');
    expect(state.bookRatings[1342]).toBe(5);
    expect(state.bookStatuses[1342]).toBe('finished');
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);

    // Second pass: authoritative sync when lastBookshelfSyncAt & lastFavoritesSyncAt are set and queries succeed
    mockFrom.mockImplementation((table: string) => {
      if (table === 'bookshelves') {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: [{ id: 's-def', user_id: 'u1', name: 'General', is_default: true }],
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
                  data: [{ id: 'bi-1', bookshelf_id: 's-def', user_id: 'u1', book_id: 84, book_title: 'Frankenstein', book_authors: ['Shelley'] }],
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
              order: () =>
                Promise.resolve({
                  data: [{ user_id: 'u1', book_id: 84, book_title: 'Frankenstein', book_authors: ['Shelley'] }],
                  error: null,
                }),
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
    expect(state.savedBooks.map((b) => b.id)).toEqual([84]);
    expect(state.favoriteBookIds).toEqual([84]);

    consoleErrorSpy.mockRestore();
  });

  it('preserves rich local metadata in mergeCloudBookWithLocal, deduplicates multi-shelf books, and coalesces concurrent syncs', async () => {
    const cloudBook = {
      id: 1342,
      title: 'Pride and Prejudice',
      authors: [{ name: 'Jane Austen', birth_year: null, death_year: null }],
      translators: [],
      subjects: [],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: { 'image/jpeg': 'https://cloud.example/cover.jpg' },
      download_count: 0,
    };
    const localBook = {
      id: 1342,
      title: 'Pride and Prejudice',
      authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
      translators: [{ name: 'Translator', birth_year: 1800, death_year: 1870 }],
      subjects: ['Domestic fiction', 'Courtship -- Fiction'],
      bookshelves: ['Best Books Ever Listings'],
      languages: ['en', 'fr'],
      copyright: false,
      media_type: 'Text',
      formats: {
        'text/plain; charset=utf-8': 'https://www.gutenberg.org/ebooks/1342.txt.utf-8',
        'image/jpeg': 'https://local.example/cover.jpg',
      },
      download_count: 54210,
    };

    expect(mergeCloudBookWithLocal(cloudBook, undefined)).toBe(cloudBook);
    const merged = mergeCloudBookWithLocal(cloudBook, localBook);
    expect(merged.authors[0].birth_year).toBe(1775);
    expect(merged.subjects).toEqual(['Domestic fiction', 'Courtship -- Fiction']);
    expect(merged.bookshelves).toEqual(['Best Books Ever Listings']);
    expect(merged.translators).toHaveLength(1);
    expect(merged.languages).toEqual(['en', 'fr']);
    expect(merged.download_count).toBe(54210);
    expect(merged.formats['text/plain; charset=utf-8']).toBe('https://www.gutenberg.org/ebooks/1342.txt.utf-8');
    expect(merged.formats['image/jpeg']).toBe('https://cloud.example/cover.jpg');

    state.savedBooks = [localBook];
    state.lastBookshelfSyncAt = '2026-10-01T00:00:00Z';

    let selectCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'bookshelves') {
        return {
          select: () => ({
            eq: () => ({
              order: () => {
                selectCount++;
                return Promise.resolve({
                  data: [
                    { id: 's-def', user_id: 'u1', name: 'General', is_default: true },
                    { id: 's-custom', user_id: 'u1', name: 'Classics', is_default: false },
                  ],
                  error: null,
                });
              },
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
                    { id: 'bi-1', bookshelf_id: 's-def', user_id: 'u1', book_id: 1342, book_title: 'Pride and Prejudice', book_authors: ['Jane Austen'] },
                    { id: 'bi-2', bookshelf_id: 's-custom', user_id: 'u1', book_id: 1342, book_title: 'Pride and Prejudice', book_authors: ['Jane Austen'] },
                  ],
                  error: null,
                }),
            }),
          }),
        };
      }
      return {};
    });

    await Promise.all([
      executeBookshelfCloudSync('u1', get, set),
      executeBookshelfCloudSync('u1', get, set),
    ]);

    expect(selectCount).toBe(1);
    expect(state.savedBooks).toHaveLength(1);
    expect(state.savedBooks[0].subjects).toEqual(['Domestic fiction', 'Courtship -- Fiction']);
    expect(state.savedBooks[0].authors[0].birth_year).toBe(1775);
  });
});
