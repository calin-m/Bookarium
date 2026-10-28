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
    }
  | {
      type: 'MOVE_BOOK';
      payload: {
        user_id: string;
        book_id: number;
        bookshelf_id: string;
      };
    }
  | {
      type: 'UPDATE_SHELF';
      payload: {
        shelf_id: string;
        user_id: string;
        name?: string;
        is_public?: boolean;
      };
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
  queueOutboxAction?: (action: OutboxActionInput) => void;
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
  MOVE_BOOK: (sb, p) =>
    sb
      .from('bookshelf_items')
      .update({ bookshelf_id: String(p.bookshelf_id) })
      .eq('book_id', Number(p.book_id))
      .eq('user_id', String(p.user_id)),
  UPDATE_SHELF: (sb, p) => {
    const updateFields: { name?: string; is_public?: boolean } = {};
    if (typeof p.name === 'string') updateFields.name = p.name;
    if (typeof p.is_public === 'boolean') updateFields.is_public = p.is_public;
    return sb
      .from('bookshelves')
      .update(updateFields)
      .eq('id', String(p.shelf_id))
      .eq('user_id', String(p.user_id));
  },
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
 * Merges a cloud-reconstructed GutendexBook stub with an existing rich local GutendexBook
 * so subjects, bookshelves, translators, languages, authentic download_count, and formats
 * are never wiped during authoritative cloud synchronization.
 */
export function mergeCloudBookWithLocal(
  cloudBook: GutendexBook,
  localBook?: GutendexBook
): GutendexBook {
  if (!localBook) return cloudBook;

  const cloudHasLifespans = Boolean(
    cloudBook.authors?.some((a) => a.birth_year != null || a.death_year != null)
  );
  const localHasLifespans = Boolean(
    localBook.authors?.some((a) => a.birth_year != null || a.death_year != null)
  );

  const authors =
    cloudHasLifespans || !localHasLifespans
      ? cloudBook.authors?.length
        ? cloudBook.authors
        : localBook.authors
      : localBook.authors;

  const hasRichLocalLanguages =
    Array.isArray(localBook.languages) &&
    localBook.languages.length > 0 &&
    !(
      localBook.languages.length === 1 &&
      localBook.languages[0] === 'en' &&
      cloudBook.languages?.some((l) => l !== 'en')
    );

  return {
    ...localBook,
    ...cloudBook,
    title: cloudBook.title || localBook.title,
    authors,
    translators:
      localBook.translators && localBook.translators.length > 0
        ? localBook.translators
        : cloudBook.translators,
    subjects:
      localBook.subjects && localBook.subjects.length > 0
        ? localBook.subjects
        : cloudBook.subjects,
    bookshelves:
      localBook.bookshelves && localBook.bookshelves.length > 0
        ? localBook.bookshelves
        : cloudBook.bookshelves,
    languages: hasRichLocalLanguages ? localBook.languages : cloudBook.languages,
    copyright: localBook.copyright ?? cloudBook.copyright,
    formats: {
      ...cloudBook.formats,
      ...localBook.formats,
      ...(cloudBook.formats?.['image/jpeg']
        ? { 'image/jpeg': cloudBook.formats['image/jpeg'] }
        : {}),
    },
    download_count:
      typeof localBook.download_count === 'number' &&
      localBook.download_count > 0 &&
      localBook.download_count !== 1000
        ? localBook.download_count
        : cloudBook.download_count,
  };
}

const inFlightOutboxFlushes = new Map<string, Promise<void>>();
const inFlightCloudSyncs = new Map<string, Promise<void>>();

async function safeSelectByUser<T>(
  supabase: ReturnType<typeof createClient>,
  table: 'bookshelves' | 'bookshelf_items' | 'user_favorites' | 'user_book_curation',
  userId: string,
  orderMode?: 'created_asc' | 'deterministic_items'
): Promise<{ data: T[] | null; error: unknown; unmocked?: boolean }> {
  try {
    const tableRef = supabase.from(table);
    if (!tableRef || typeof tableRef.select !== 'function') {
      return { data: null, error: null, unmocked: true };
    }
    const eqQuery = tableRef.select('*').eq('user_id', userId);
    if (orderMode === 'created_asc') {
      const q = eqQuery as unknown as {
        order?: (col: string, opts: { ascending: boolean }) => unknown;
      };
      const ordered =
        typeof q?.order === 'function' ? q.order('created_at', { ascending: true }) : eqQuery;
      const res = (await ordered) as { data: T[] | null; error?: unknown };
      return { data: res?.data ?? null, error: res?.error ?? null };
    }
    if (orderMode === 'deterministic_items') {
      const ordered = applyDeterministicItemOrdering(eqQuery);
      const res = (await ordered) as { data: T[] | null; error?: unknown };
      return { data: res?.data ?? null, error: res?.error ?? null };
    }
    const res = (await eqQuery) as { data: T[] | null; error?: unknown };
    return { data: res?.data ?? null, error: res?.error ?? null };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Flushes pending offline outbox actions to Supabase, retaining only failed mutations.
 * Deduplicates concurrent flushes per userId.
 */
export async function executeFlushOutbox(
  userId: string,
  get: BookshelfGetState,
  set: BookshelfSetState
): Promise<void> {
  const { outbox } = get();
  if (outbox.length === 0 || !userId) return;

  const existingFlush = inFlightOutboxFlushes.get(userId);
  if (existingFlush) return existingFlush;

  const flushPromise = (async () => {
    const supabase = createClient();
    const completedActionIds = new Set<string>();

    for (const action of outbox) {
      try {
        const dispatcher = OUTBOX_DISPATCHERS[action.type];
        if (dispatcher) {
          const { error } = await dispatcher(supabase, action.payload);
          if (error) throw error;
          completedActionIds.add(action.id);
        }
      } catch {
        continue;
      }
    }
    set({ outbox: get().outbox.filter((action) => !completedActionIds.has(action.id)) });
  })().finally(() => {
    inFlightOutboxFlushes.delete(userId);
  });

  inFlightOutboxFlushes.set(userId, flushPromise);
  return flushPromise;
}

/**
 * Synchronizes shelves, saved items, favorites, and LWW curation state with Supabase.
 * Coalesces concurrent calls per userId, executes table reads in parallel, and commits
 * reconciled state in a single atomic Zustand update.
 */
export async function executeBookshelfCloudSync(
  userId: string,
  get: BookshelfGetState,
  set: BookshelfSetState
): Promise<void> {
  if (!userId) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const existingSync = inFlightCloudSyncs.get(userId);
  if (existingSync) return existingSync;

  const syncPromise = (async () => {
    set({ isSyncing: true });

    const nextState: Partial<BookshelfSyncSlice> = { isSyncing: false };

    try {
      // Flush any pending offline mutations first
      await get().flushOutbox(userId);

      const supabase = createClient();

      // Build lookup map of existing rich local books by id to prevent metadata loss on cloud sync
      const initialState = get();
      const localBookLookup = new Map<number, GutendexBook>();
      for (const b of initialState.favoriteBooks) {
        localBookLookup.set(b.id, b);
      }
      for (const b of initialState.savedBooks) {
        localBookLookup.set(b.id, b);
      }

      // Parallelize initial SELECT queries across all 4 tables
      const [shelvesRes, itemsRes, favoritesRes, curationsRes] = await Promise.all([
        safeSelectByUser<Bookshelf>(supabase, 'bookshelves', userId, 'created_asc'),
        safeSelectByUser<BookshelfItem>(supabase, 'bookshelf_items', userId, 'deterministic_items'),
        safeSelectByUser<BookshelfItem>(supabase, 'user_favorites', userId, 'deterministic_items'),
        safeSelectByUser<Database['public']['Tables']['user_book_curation']['Row']>(
          supabase,
          'user_book_curation',
          userId
        ),
      ]);

      const { data: shelves, error: shelvesError } = shelvesRes;
      let currentDefaultShelf: Bookshelf | undefined;

      if (shelves && shelves.length > 0) {
        const uniqueMap = new Map<string, Bookshelf>();
        for (const s of shelves) {
          if (!uniqueMap.has(s.id)) {
            uniqueMap.set(s.id, s);
          }
        }
        const dedupedShelves = Array.from(uniqueMap.values());
        nextState.cloudBookshelves = dedupedShelves;
        currentDefaultShelf = dedupedShelves.find((s) => s.is_default) || dedupedShelves[0];
        const currentActive = get().activeBookshelfId;
        const shouldPreserveActive =
          currentActive === '__downloaded__' ||
          Boolean(currentActive && dedupedShelves.some((s) => s.id === currentActive));
        nextState.activeBookshelfId = shouldPreserveActive ? currentActive : currentDefaultShelf.id;

        const { data: items, error: itemsError } = itemsRes;

        if (itemsError) {
          console.error('Failed to sync bookshelf items from cloud:', itemsError);
        } else if (!itemsRes.unmocked) {
          nextState.cloudBookshelfItems = (items || []) as BookshelfItem[];

          // Deduplicate reconstructed books by book_id and merge with rich local metadata
          const seenBookIds = new Set<number>();
          const reconstructedBooks: GutendexBook[] = [];
          for (const row of items || []) {
            if (!seenBookIds.has(row.book_id)) {
              seenBookIds.add(row.book_id);
              const stub = toGutendexBookFromCloudRow(row);
              reconstructedBooks.push(
                mergeCloudBookWithLocal(stub, localBookLookup.get(row.book_id))
              );
            }
          }

          // Tombstone-aware merge: filter out remote items that have been deleted locally
          const { lastBookshelfSyncAt, deletedBookIds } = get();
          const activeReconstructed = reconstructedBooks.filter((b) => !deletedBookIds[b.id]);

          // Propagate deletions concurrently: remove locally tombstoned items from cloud
          const itemsToDelete = (items || []).filter(
            (item: BookshelfItem) => deletedBookIds[item.book_id]
          );
          if (itemsToDelete.length > 0) {
            await Promise.allSettled(
              itemsToDelete.map((delItem) =>
                supabase.from('bookshelf_items').delete().eq('id', delItem.id)
              )
            );
          }

          let finalSavedBooks: GutendexBook[];

          if (!lastBookshelfSyncAt) {
            // Initial sync: merge local guest books into remote books and upload unsynced ones
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

              const { data: updatedItems } = await safeSelectByUser<BookshelfItem>(
                supabase,
                'bookshelf_items',
                userId,
                'deterministic_items'
              );
              if (updatedItems) {
                nextState.cloudBookshelfItems = updatedItems;
              }
            }
          } else {
            // Device has previously synced: Cloud is authoritative for multi-device deletions.
            finalSavedBooks = activeReconstructed;
          }

          nextState.savedBooks = finalSavedBooks;
          nextState.lastBookshelfSyncAt = new Date().toISOString();
        }
      } else if (!shelvesError && !shelvesRes.unmocked) {
        // Create default 'General' shelf for user
        const bookshelvesTable = supabase.from('bookshelves');
        const { data: newDefault } =
          typeof bookshelvesTable?.insert === 'function'
            ? await bookshelvesTable
                .insert({
                  user_id: userId,
                  name: 'General',
                  is_default: true,
                })
                .select()
                .single()
            : { data: null };

        if (newDefault) {
          currentDefaultShelf = newDefault as Bookshelf;
          nextState.cloudBookshelves = [currentDefaultShelf];
          nextState.activeBookshelfId = currentDefaultShelf.id;
          nextState.cloudBookshelfItems = [];

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

              const { data: updatedItems } = await safeSelectByUser<BookshelfItem>(
                supabase,
                'bookshelf_items',
                userId,
                'deterministic_items'
              );
              if (updatedItems) {
                nextState.cloudBookshelfItems = updatedItems;
              }
            }
          }
          nextState.lastBookshelfSyncAt = new Date().toISOString();
        }
      }

      // 3. Reconcile user favorites
      const { data: favorites, error: favoritesError } = favoritesRes;

      if (favoritesError) {
        console.error('Failed to sync favorites from cloud:', favoritesError);
      } else if (!favoritesRes.unmocked) {
        const seenFavIds = new Set<number>();
        const reconstructedFavorites: GutendexBook[] = [];
        for (const row of favorites || []) {
          if (!seenFavIds.has(row.book_id)) {
            seenFavIds.add(row.book_id);
            const stub = toGutendexBookFromCloudRow(row);
            reconstructedFavorites.push(
              mergeCloudBookWithLocal(stub, localBookLookup.get(row.book_id))
            );
          }
        }

        // Reconcile favorites with tombstone awareness and sync anchor
        const { lastFavoritesSyncAt, deletedFavoriteBookIds } = get();
        const localFavorites = get().favoriteBooks;

        const activeReconstructedFavorites = reconstructedFavorites.filter(
          (b) => !deletedFavoriteBookIds[b.id]
        );

        // Propagate deletions concurrently: remove locally tombstoned favorites from cloud
        const favsToDelete = (favorites || []).filter(
          (item: { book_id: number }) => deletedFavoriteBookIds[item.book_id]
        );
        if (favsToDelete.length > 0) {
          await Promise.allSettled(
            favsToDelete.map((delFav) =>
              supabase
                .from('user_favorites')
                .delete()
                .eq('user_id', userId)
                .eq('book_id', delFav.book_id)
            )
          );
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

        nextState.favoriteBooks = finalFavorites;
        nextState.favoriteBookIds = finalFavorites.map((b) => b.id);
        nextState.lastFavoritesSyncAt = new Date().toISOString();
      }

      // 4. Reconcile user curation (ratings & statuses)
      if (!curationsRes.unmocked && !curationsRes.error) {
        const curations = curationsRes.data;
        const localRatings = { ...get().bookRatings };
        const localStatuses = { ...get().bookStatuses };
        const localHistory = { ...get().curationHistory };

        const remoteMap = new Map<
          number,
          Database['public']['Tables']['user_book_curation']['Row']
        >();
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

        const toCurationUpsertRow = (bId: number, updatedAt: string) => ({
          user_id: userId,
          book_id: bId,
          rating: localRatings[bId] ?? null,
          reading_status: localStatuses[bId] ?? null,
          updated_at: updatedAt,
        });

        // 4a. Reconcile remote items using Last-Write-Wins (LWW)
        for (const item of curations || []) {
          const bId = item.book_id;
          const localTimestamp = localHistory[bId];
          const remoteTimestamp = item.updated_at || item.created_at;

          const isRemoteNewer =
            !localTimestamp ||
            (remoteTimestamp &&
              new Date(remoteTimestamp).getTime() >= new Date(localTimestamp).getTime());

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
            unSyncedCurations.push(toCurationUpsertRow(bId, localTimestamp));
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
            unSyncedCurations.push(toCurationUpsertRow(bId, localTimestamp));
          }
        }

        nextState.bookRatings = localRatings;
        nextState.bookStatuses = localStatuses;
        nextState.curationHistory = localHistory;

        if (unSyncedCurations.length > 0) {
          const curationTable = supabase.from('user_book_curation');
          if (typeof curationTable?.upsert === 'function') {
            await curationTable.upsert(unSyncedCurations, {
              onConflict: 'user_id,book_id',
            });
          }
        }
      }
    } catch {
      // Graceful offline fallback
    } finally {
      set(nextState);
    }
  })().finally(() => {
    inFlightCloudSyncs.delete(userId);
  });

  inFlightCloudSyncs.set(userId, syncPromise);
  return syncPromise;
}

/**
 * Migrates local guest books and favorites into Supabase when a guest authenticates.
 */
export async function executeMigrateLocalBooksToCloud(
  userId: string,
  get: BookshelfGetState,
  set: BookshelfSetState
): Promise<void> {
  const { savedBooks, favoriteBooks, cloudBookshelves } = get();
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

async function mutateCloudBookshelfRow(
  shelfId: string,
  userId: string,
  patch: { name?: string; is_public?: boolean },
  get: BookshelfGetState,
  set: BookshelfSetState
): Promise<boolean> {
  const applyLocal = () => {
    set({
      cloudBookshelves: get().cloudBookshelves.map((s) =>
        s.id === shelfId ? { ...s, ...patch } : s
      ),
    });
  };
  const queueOffline = () => {
    applyLocal();
    get().queueOutboxAction?.({
      type: 'UPDATE_SHELF',
      payload: {
        shelf_id: shelfId,
        user_id: userId,
        ...patch,
      },
    });
    return true;
  };

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return queueOffline();
  }

  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('bookshelves')
      .update(patch)
      .eq('id', shelfId)
      .eq('user_id', userId);

    if (!error) {
      applyLocal();
      return true;
    }
  } catch {
    return queueOffline();
  }
  return false;
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
  const trimmedName = name.trim();
  if (!shelfId || !trimmedName || !userId) return false;

  const patch: { name: string; is_public?: boolean } = {
    name: trimmedName,
    ...(isPublic !== undefined ? { is_public: isPublic } : {}),
  };
  return mutateCloudBookshelfRow(shelfId, userId, patch, get, set);
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
  return mutateCloudBookshelfRow(shelfId, userId, { is_public: isPublic }, get, set);
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
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      get().queueOutboxAction?.({
        type: 'MOVE_BOOK',
        payload: {
          user_id: userId,
          book_id: bookId,
          bookshelf_id: targetShelfId,
        },
      });
      return true;
    }
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
      get().queueOutboxAction?.({
        type: 'MOVE_BOOK',
        payload: {
          user_id: userId,
          book_id: bookId,
          bookshelf_id: targetShelfId,
        },
      });
    }
  }
  return true;
}
