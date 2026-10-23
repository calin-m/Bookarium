/**
 * Bookshelf Cloud Synchronization & Custom Shelf Engine - Bookarium
 *
 * Coordinates offline outbox flushing, tombstone-aware multi-device shelf & favorite
 * reconciliation, Last-Write-Wins (LWW) curation merging, and custom shelf CRUD operations.
 */

import type { GutendexBook, ReadingStatus } from '@/types/book.types';
import { createClient } from '@/lib/supabase/client';
import type { Bookshelf, BookshelfItem, Database } from '@/types/database.types';
import { toGutendexBookFromCloudRow, toCloudBookInsert } from '@/lib/adapters/book.adapter';

export type OutboxActionInput =
  | {
      type: 'DELETE_BOOK';
      payload: { bookshelf_id: string; book_id: number };
    }
  | {
      type: 'INSERT_BOOK';
      payload: {
        bookshelf_id: string;
        user_id: string;
        book_id: number;
        book_title: string;
        book_authors: string[];
        cover_url: string | null;
      };
    }
  | {
      type: 'DELETE_FAVORITE';
      payload: { user_id: string; book_id: number };
    }
  | {
      type: 'UPSERT_FAVORITE';
      payload: {
        user_id: string;
        book_id: number;
        book_title: string;
        book_authors: string[];
        cover_url: string | null;
      };
    }
  | {
      type: 'UPSERT_CURATION';
      payload: {
        user_id: string;
        book_id: number;
        rating?: number | null;
        reading_status?: ReadingStatus | null;
        updated_at?: string;
      };
    }
  | {
      type: 'DELETE_CURATION';
      payload: { user_id: string; book_id: number };
    };

export type OutboxAction = OutboxActionInput & {
  id: string;
  timestamp: string;
};

export interface BookshelfSyncSlice {
  savedBooks: GutendexBook[];
  favoriteBooks: GutendexBook[];
  favoriteBookIds: number[];
  bookRatings: Record<number, number>;
  bookStatuses: Record<number, ReadingStatus>;
  curationHistory: Record<number, string>;
  deletedBookIds: Record<number, string>;
  deletedFavoriteBookIds: Record<number, string>;
  lastFavoritesSyncAt: string | null;
  lastBookshelfSyncAt: string | null;
  cloudBookshelves: Bookshelf[];
  cloudBookshelfItems: BookshelfItem[];
  activeBookshelfId: string | null;
  isSyncing: boolean;
  outbox: OutboxAction[];
  flushOutbox: (userId: string) => Promise<void>;
}

export type BookshelfGetState = () => BookshelfSyncSlice;
export type BookshelfSetState = (partial: Partial<BookshelfSyncSlice>) => void;

type OutboxDispatcher = (
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) => PromiseLike<{ error: unknown }>;

const OUTBOX_DISPATCHERS: Record<OutboxAction['type'], OutboxDispatcher> = {
  DELETE_BOOK: (sb, p) =>
    sb
      .from('bookshelf_items')
      .delete()
      .eq('bookshelf_id', String(p.bookshelf_id))
      .eq('book_id', Number(p.book_id)),
  DELETE_FAVORITE: (sb, p) =>
    sb
      .from('user_favorites')
      .delete()
      .eq('user_id', String(p.user_id))
      .eq('book_id', Number(p.book_id)),
  INSERT_BOOK: (sb, p) =>
    sb
      .from('bookshelf_items')
      .upsert(p as Database['public']['Tables']['bookshelf_items']['Insert'], {
        onConflict: 'bookshelf_id,book_id',
      }),
  UPSERT_FAVORITE: (sb, p) =>
    sb
      .from('user_favorites')
      .upsert(p as Database['public']['Tables']['user_favorites']['Insert'], {
        onConflict: 'user_id,book_id',
      }),
  UPSERT_CURATION: (sb, p) =>
    sb
      .from('user_book_curation')
      .upsert(p as Database['public']['Tables']['user_book_curation']['Insert'], {
        onConflict: 'user_id,book_id',
      }),
  DELETE_CURATION: (sb, p) =>
    sb
      .from('user_book_curation')
      .delete()
      .eq('user_id', String(p.user_id))
      .eq('book_id', Number(p.book_id)),
};

/**
 * Defensively applies primary created_at ordering and deterministic secondary book_id tie-breaking.
 * Resilient against single-order unit test mocks.
 */
export function applyDeterministicItemOrdering<
  T extends { order?: (col: string, opts?: { ascending?: boolean }) => T }
>(query: T): T {
  if (typeof query?.order === 'function') {
    const firstOrdered = query.order('created_at', { ascending: false });
    if (typeof firstOrdered?.order === 'function') {
      return firstOrdered.order('book_id', { ascending: true });
    }
    return firstOrdered;
  }
  return query;
}

/**
 * Flushes pending offline outbox actions to Supabase, retaining only failed mutations.
 */
export async function executeFlushOutbox(
  userId: string,
  get: BookshelfGetState,
  set: BookshelfSetState
): Promise<void> {
  const { outbox } = get();
  if (outbox.length === 0 || !userId) return;

  const supabase = createClient();
  const remaining: OutboxAction[] = [];

  for (const action of outbox) {
    try {
      const dispatcher = OUTBOX_DISPATCHERS[action.type];
      if (dispatcher) {
        const { error } = await dispatcher(supabase, action.payload);
        if (error) throw error;
      }
    } catch {
      remaining.push(action);
    }
  }
  set({ outbox: remaining });
}

/**
 * Synchronizes shelves, saved items, favorites, and LWW curation state with Supabase.
 */
export async function executeBookshelfCloudSync(
  userId: string,
  get: BookshelfGetState,
  set: BookshelfSetState
): Promise<void> {
  if (!userId) return;
  set({ isSyncing: true });

  // Flush any pending offline mutations first
  await get().flushOutbox(userId);

  try {
    const supabase = createClient();

    // 1. Fetch user shelves
    const { data: shelves } = await supabase
      .from('bookshelves')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    let currentDefaultShelf: Bookshelf | undefined;

    if (shelves && shelves.length > 0) {
      const uniqueMap = new Map<string, Bookshelf>();
      for (const s of shelves as Bookshelf[]) {
        if (!uniqueMap.has(s.id)) {
          uniqueMap.set(s.id, s);
        }
      }
      const dedupedShelves = Array.from(uniqueMap.values());
      set({ cloudBookshelves: dedupedShelves });
      currentDefaultShelf = dedupedShelves.find((s) => s.is_default) || dedupedShelves[0];
      set({ activeBookshelfId: currentDefaultShelf.id });

      // 2. Fetch items for shelves
      const itemsQuery = supabase
        .from('bookshelf_items')
        .select('*')
        .eq('user_id', userId);
      const { data: items, error: itemsError } = await applyDeterministicItemOrdering(itemsQuery);

      if (itemsError) {
        console.error('Failed to sync bookshelf items from cloud:', itemsError);
      } else {
        set({
          cloudBookshelves: dedupedShelves,
          cloudBookshelfItems: (items || []) as BookshelfItem[],
        });

        const reconstructedBooks: GutendexBook[] = (items || []).map(toGutendexBookFromCloudRow);

        // Tombstone-aware merge: filter out remote items that have been deleted locally
        const { lastBookshelfSyncAt, deletedBookIds = {} } = get();
        const activeReconstructed = reconstructedBooks.filter((b) => !deletedBookIds[b.id]);

        // Propagate deletions: if remote contains items that were tombstoned locally, remove them from cloud
        const itemsToDelete = (items || []).filter(
          (item: BookshelfItem) => deletedBookIds[item.book_id]
        );
        for (const delItem of itemsToDelete) {
          await supabase.from('bookshelf_items').delete().eq('id', delItem.id);
        }

        let finalSavedBooks: GutendexBook[];

        if (!lastBookshelfSyncAt) {
          // Initial sync (e.g. migrating guest session to authenticated account):
          // Merge local guest books into remote books and upload unsynced ones
          const localSaved = get().savedBooks.filter((b) => !deletedBookIds[b.id]);
          const merged = [...activeReconstructed];
          const unSyncedLocalBooks: GutendexBook[] = [];

          for (const lb of localSaved) {
            if (!merged.some((b) => b.id === lb.id)) {
              merged.push(lb);
              unSyncedLocalBooks.push(lb);
            }
          }
          finalSavedBooks = merged;

          // Bidirectional Sync: push local books missing from cloud to the database
          if (unSyncedLocalBooks.length > 0 && currentDefaultShelf?.id) {
            const inserts = unSyncedLocalBooks.map((b) =>
              toCloudBookInsert(b, userId, currentDefaultShelf!.id)
            );

            await supabase.from('bookshelf_items').upsert(inserts, {
              onConflict: 'bookshelf_id,book_id',
            });

            const updatedItemsQuery = supabase
              .from('bookshelf_items')
              .select('*')
              .eq('user_id', userId);
            const { data: updatedItems } = await applyDeterministicItemOrdering(updatedItemsQuery);
            if (updatedItems) {
              set({ cloudBookshelfItems: updatedItems as BookshelfItem[] });
            }
          }
        } else {
          // Device has previously synced: Cloud is authoritative for multi-device deletions.
          finalSavedBooks = activeReconstructed;
        }

        set({
          savedBooks: finalSavedBooks,
          lastBookshelfSyncAt: new Date().toISOString(),
        });
      }
    } else {
      // Create default 'General' shelf for user
      const { data: newDefault } = await supabase
        .from('bookshelves')
        .insert({
          user_id: userId,
          name: 'General',
          is_default: true,
        })
        .select()
        .single();

      if (newDefault) {
        currentDefaultShelf = newDefault as Bookshelf;
        set({
          cloudBookshelves: [currentDefaultShelf],
          activeBookshelfId: currentDefaultShelf.id,
          cloudBookshelfItems: [],
        });

        const { lastBookshelfSyncAt, deletedBookIds = {} } = get();
        if (!lastBookshelfSyncAt) {
          const localSaved = get().savedBooks.filter((b) => !deletedBookIds[b.id]);
          if (localSaved.length > 0) {
            const inserts = localSaved.map((b) =>
              toCloudBookInsert(b, userId, currentDefaultShelf!.id)
            );

            await supabase.from('bookshelf_items').upsert(inserts, {
              onConflict: 'bookshelf_id,book_id',
            });

            const newDefaultItemsQuery = supabase
              .from('bookshelf_items')
              .select('*')
              .eq('user_id', userId);
            const { data: updatedItems } = await applyDeterministicItemOrdering(newDefaultItemsQuery);
            if (updatedItems) {
              set({ cloudBookshelfItems: updatedItems as BookshelfItem[] });
            }
          }
        }
        set({ lastBookshelfSyncAt: new Date().toISOString() });
      }
    }

    // 3. Fetch user favorites
    const favoritesQuery = supabase
      .from('user_favorites')
      .select('*')
      .eq('user_id', userId);
    const { data: favorites, error: favoritesError } = await applyDeterministicItemOrdering(favoritesQuery);

    if (favoritesError) {
      console.error('Failed to sync favorites from cloud:', favoritesError);
    } else {
      const reconstructedFavorites: GutendexBook[] = (favorites || []).map(toGutendexBookFromCloudRow);

      // Reconcile favorites with tombstone awareness and sync anchor
      const { lastFavoritesSyncAt, deletedFavoriteBookIds = {} } = get();
      const localFavorites = get().favoriteBooks || [];

      const activeReconstructedFavorites = reconstructedFavorites.filter(
        (b) => !deletedFavoriteBookIds[b.id]
      );

      // Propagate deletions: if remote contains items that were tombstoned locally, remove them from cloud
      const favsToDelete = (favorites || []).filter(
        (item: { book_id: number }) => deletedFavoriteBookIds[item.book_id]
      );
      for (const delFav of favsToDelete) {
        await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', userId)
          .eq('book_id', delFav.book_id);
      }

      let finalFavorites: GutendexBook[];

      if (!lastFavoritesSyncAt) {
        const unSyncedFavorites: GutendexBook[] = [];
        const mergedFavorites = [...activeReconstructedFavorites];

        for (const lb of localFavorites) {
          if (!deletedFavoriteBookIds[lb.id] && !mergedFavorites.some((b) => b.id === lb.id)) {
            mergedFavorites.push(lb);
            unSyncedFavorites.push(lb);
          }
        }
        finalFavorites = mergedFavorites;

        if (unSyncedFavorites.length > 0) {
          const favoriteInserts = unSyncedFavorites.map((b) => toCloudBookInsert(b, userId));

          await supabase.from('user_favorites').upsert(favoriteInserts, {
            onConflict: 'user_id,book_id',
          });
        }
      } else {
        finalFavorites = activeReconstructedFavorites;
      }

      const finalFavoriteIds = finalFavorites.map((b) => b.id);
      set({
        favoriteBooks: finalFavorites,
        favoriteBookIds: finalFavoriteIds,
        lastFavoritesSyncAt: new Date().toISOString(),
      });
    }

    // 4. Fetch user curation (ratings & statuses)
    const { data: curations } = await supabase
      .from('user_book_curation')
      .select('*')
      .eq('user_id', userId);

    const localRatings = { ...(get().bookRatings || {}) };
    const localStatuses = { ...(get().bookStatuses || {}) };
    const localHistory = { ...(get().curationHistory || {}) };

    const remoteMap = new Map<number, Database['public']['Tables']['user_book_curation']['Row']>();
    for (const item of curations || []) {
      remoteMap.set(item.book_id, item);
    }

    const unSyncedCurations: Array<{
      user_id: string;
      book_id: number;
      rating: number | null;
      reading_status: ReadingStatus | null;
      updated_at: string;
    }> = [];

    // 4a. Reconcile remote items using Last-Write-Wins (LWW)
    for (const item of curations || []) {
      const bId = item.book_id;
      const localTimestamp = localHistory[bId];
      const remoteTimestamp = item.updated_at || item.created_at;

      const isRemoteNewer =
        !localTimestamp ||
        (remoteTimestamp && new Date(remoteTimestamp).getTime() >= new Date(localTimestamp).getTime());

      if (isRemoteNewer) {
        if (item.rating !== null && item.rating !== undefined) {
          localRatings[bId] = item.rating;
        } else {
          delete localRatings[bId];
        }
        if (item.reading_status) {
          localStatuses[bId] = item.reading_status as ReadingStatus;
        } else {
          delete localStatuses[bId];
        }
        localHistory[bId] = remoteTimestamp || new Date().toISOString();
      } else {
        unSyncedCurations.push({
          user_id: userId,
          book_id: bId,
          rating: localRatings[bId] ?? null,
          reading_status: localStatuses[bId] ?? null,
          updated_at: localTimestamp,
        });
      }
    }

    // 4b. Push local guest curations that do not exist remotely
    const allLocalCurationBookIds = Array.from(
      new Set([...Object.keys(localRatings), ...Object.keys(localStatuses)]).values()
    ).map(Number);

    for (const bId of allLocalCurationBookIds) {
      if (!remoteMap.has(bId)) {
        const localTimestamp = localHistory[bId] || new Date().toISOString();
        localHistory[bId] = localTimestamp;
        unSyncedCurations.push({
          user_id: userId,
          book_id: bId,
          rating: localRatings[bId] ?? null,
          reading_status: localStatuses[bId] ?? null,
          updated_at: localTimestamp,
        });
      }
    }

    set({
      bookRatings: localRatings,
      bookStatuses: localStatuses,
      curationHistory: localHistory,
    });

    if (unSyncedCurations.length > 0) {
      await supabase.from('user_book_curation').upsert(unSyncedCurations, {
        onConflict: 'user_id,book_id',
      });
    }
  } catch {
    // Graceful offline fallback
  } finally {
    set({ isSyncing: false });
  }
}

/**
 * Migrates local guest books and favorites into Supabase when a guest authenticates.
 */
export async function executeMigrateLocalBooksToCloud(
  userId: string,
  get: BookshelfGetState,
  set: BookshelfSetState
): Promise<void> {
  const { savedBooks, favoriteBooks = [], cloudBookshelves } = get();
  if (!userId) return;

  try {
    const supabase = createClient();

    if (savedBooks.length > 0) {
      const targetShelfId =
        cloudBookshelves.find((s) => s.is_default)?.id || cloudBookshelves[0]?.id;
      if (targetShelfId) {
        const inserts = savedBooks.map((b) => toCloudBookInsert(b, userId, targetShelfId));

        await supabase.from('bookshelf_items').upsert(inserts, {
          onConflict: 'bookshelf_id,book_id',
        });
      }
    }

    if (favoriteBooks.length > 0) {
      const favoriteInserts = favoriteBooks.map((b) => toCloudBookInsert(b, userId));

      await supabase.from('user_favorites').upsert(favoriteInserts, {
        onConflict: 'user_id,book_id',
      });
      set({ lastFavoritesSyncAt: new Date().toISOString() });
    }
  } catch {
    // Non-blocking fallback
  }
}

/**
 * Creates a new custom named shelf in Supabase and activates it locally.
 */
export async function executeCreateCloudBookshelf(
  name: string,
  userId: string,
  isPublic = true,
  get: BookshelfGetState,
  set: BookshelfSetState
): Promise<Bookshelf | null> {
  const trimmed = name.trim();
  if (!trimmed || !userId || trimmed.toLowerCase() === 'general') return null;

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('bookshelves')
      .insert({
        user_id: userId,
        name: name.trim(),
        is_default: false,
        is_public: isPublic,
      })
      .select()
      .single();

    if (!error && data) {
      const newShelf = data as Bookshelf;
      set({
        cloudBookshelves: [...get().cloudBookshelves, newShelf],
        activeBookshelfId: newShelf.id,
      });
      return newShelf;
    }
  } catch {
    // Non-blocking fallback
  }
  return null;
}

/**
 * Renames a custom shelf and optionally updates its public visibility in Supabase.
 */
export async function executeUpdateCloudBookshelf(
  shelfId: string,
  name: string,
  userId: string,
  isPublic: boolean | undefined,
  get: BookshelfGetState,
  set: BookshelfSetState
): Promise<boolean> {
  if (!shelfId || !name.trim() || !userId) return false;

  try {
    const supabase = createClient();
    const payload: { name: string; is_public?: boolean } = { name: name.trim() };
    if (isPublic !== undefined) {
      payload.is_public = isPublic;
    }
    const { error } = await supabase
      .from('bookshelves')
      .update(payload)
      .eq('id', shelfId)
      .eq('user_id', userId);

    if (!error) {
      set({
        cloudBookshelves: get().cloudBookshelves.map((s) =>
          s.id === shelfId
            ? { ...s, name: name.trim(), ...(isPublic !== undefined ? { is_public: isPublic } : {}) }
            : s
        ),
      });
      return true;
    }
  } catch {
    // Non-blocking fallback
  }
  return false;
}

/**
 * Updates only the public/private visibility flag of a bookshelf.
 */
export async function executeUpdateBookshelfPrivacy(
  shelfId: string,
  isPublic: boolean,
  userId: string,
  get: BookshelfGetState,
  set: BookshelfSetState
): Promise<boolean> {
  if (!shelfId || !userId) return false;

  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('bookshelves')
      .update({ is_public: isPublic })
      .eq('id', shelfId)
      .eq('user_id', userId);

    if (!error) {
      set({
        cloudBookshelves: get().cloudBookshelves.map((s) =>
          s.id === shelfId ? { ...s, is_public: isPublic } : s
        ),
      });
      return true;
    }
  } catch {
    // Non-blocking fallback
  }
  return false;
}

/**
 * Deletes a custom shelf and safely reassigns its books to the default General shelf.
 */
export async function executeDeleteCloudBookshelf(
  shelfId: string,
  userId: string,
  get: BookshelfGetState,
  set: BookshelfSetState
): Promise<boolean> {
  if (!shelfId || !userId) return false;

  try {
    const supabase = createClient();
    const nextShelves = get().cloudBookshelves.filter((s) => s.id !== shelfId);
    const defaultShelf = nextShelves.find((s) => s.is_default) || nextShelves[0];

    if (defaultShelf) {
      await supabase
        .from('bookshelf_items')
        .update({ bookshelf_id: defaultShelf.id })
        .eq('bookshelf_id', shelfId)
        .eq('user_id', userId);
    } else {
      await supabase
        .from('bookshelf_items')
        .delete()
        .eq('bookshelf_id', shelfId)
        .eq('user_id', userId);
    }

    const { error } = await supabase
      .from('bookshelves')
      .delete()
      .eq('id', shelfId)
      .eq('user_id', userId);

    if (!error) {
      set({
        cloudBookshelves: nextShelves,
        activeBookshelfId: defaultShelf?.id || null,
        cloudBookshelfItems: get().cloudBookshelfItems.map((item) =>
          item.bookshelf_id === shelfId && defaultShelf
            ? { ...item, bookshelf_id: defaultShelf.id }
            : item
        ),
      });
      return true;
    }
  } catch {
    // Non-blocking fallback
  }
  return false;
}

/**
 * Moves a book between shelves locally and persists the change to Supabase.
 */
export async function executeMoveBookToShelf(
  bookId: number,
  targetShelfId: string,
  userId: string,
  get: BookshelfGetState,
  set: BookshelfSetState
): Promise<boolean> {
  if (!bookId || !targetShelfId) return false;

  const { cloudBookshelfItems, savedBooks } = get();
  const existingItem = cloudBookshelfItems.find((i) => i.book_id === bookId);
  const bookObj = savedBooks.find((b) => b.id === bookId);

  let nextItems: BookshelfItem[];
  if (existingItem) {
    nextItems = cloudBookshelfItems.map((item) =>
      item.book_id === bookId ? { ...item, bookshelf_id: targetShelfId } : item
    );
  } else {
    const insertPayload = bookObj
      ? toCloudBookInsert(bookObj, userId || '', targetShelfId)
      : {
          book_authors: [],
          cover_url: null,
          book_title: '',
          book_id: bookId,
          bookshelf_id: targetShelfId,
          user_id: userId || '',
        };
    nextItems = [
      ...cloudBookshelfItems,
      {
        id: `item-${bookId}-${targetShelfId}`,
        bookshelf_id: targetShelfId,
        user_id: userId || '',
        book_id: bookId,
        book_title: bookObj?.title || '',
        book_authors: insertPayload.book_authors,
        cover_url: insertPayload.cover_url,
        created_at: new Date().toISOString(),
        added_at: new Date().toISOString(),
      },
    ];
  }

  // Instant local update
  set({ cloudBookshelfItems: nextItems });

  if (userId) {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('bookshelf_items')
        .update({ bookshelf_id: targetShelfId })
        .eq('book_id', bookId)
        .eq('user_id', userId);

      if (error && bookObj) {
        const insertPayload = toCloudBookInsert(bookObj, userId, targetShelfId);
        await supabase.from('bookshelf_items').insert(insertPayload);
      }
    } catch {
      // Non-blocking fallback
    }
  }
  return true;
}

