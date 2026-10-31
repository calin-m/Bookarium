import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEYS } from '@/config/site-config';
import { createClient } from '@/lib/supabase/client';
import type { SymposiumSessionRow } from '@/types/database.types';
import {
  useFellowshipStore,
  isPlaceholderUsername,
  fetchScholarProfilesMap,
} from '@/stores/useFellowshipStore';
import { useHasMounted } from '@/hooks/useHasMounted';
import { cleanBookTitle, isPlaceholderTitle, isPlaceholderAuthor } from '@/lib/book-metadata';
import { formatAuthorNames } from '@/lib/utils';
import {
  type HighlightColor,
  type MarginaliaSourceFilter,
  type Annotation,
  type FellowAnnotation,
  type AnnotationOutboxAction,
  MAX_ANNOTATION_TEXT_LENGTH,
  MAX_ANNOTATION_NOTE_LENGTH,
  mapRowToFellowAnnotation,
  buildFellowScholarsMap,
  resolveFellowIdentityMap,
  ANNOTATION_OUTBOX_DISPATCHERS,
  toAnnotationDbRow,
  syncAnnotationMutation,
} from '@/lib/annotation-cloud-sync';

export {
  type HighlightColor,
  type MarginaliaSourceFilter,
  type Annotation,
  type FellowAnnotation,
  type AnnotationOutboxAction,
  MAX_ANNOTATION_TEXT_LENGTH,
  MAX_ANNOTATION_NOTE_LENGTH,
  buildFellowScholarsMap,
};

export interface AnnotationState {
  annotations: Annotation[];
  fellowAnnotations: FellowAnnotation[];
  marginaliaSourceFilter: MarginaliaSourceFilter;
  spoilerShieldEnabled: boolean;
  outbox: AnnotationOutboxAction[];
  tombstones: string[];
  isSyncing: boolean;

  setMarginaliaSourceFilter: (filter: MarginaliaSourceFilter) => void;
  setSpoilerShieldEnabled: (enabled: boolean) => void;
  fetchAllFellowAnnotations: (
    currentUserId?: string,
    fellowScholarsMap?: Record<string, { username: string; display_name?: string | null }>
  ) => Promise<FellowAnnotation[]>;
  fetchFellowAnnotationsForBook: (
    bookId: number,
    currentUserId?: string,
    fellowScholarsMap?: Record<string, { username: string; display_name?: string | null }>
  ) => Promise<FellowAnnotation[]>;
  enrichFellowAnnotations: (
    fellowScholarsMap?: Record<string, { username: string; display_name?: string | null }>
  ) => void;
  pruneFellowAnnotationsByFellow: (fellowUserId: string) => void;
  pruneFellowAnnotationsForSymposium: (bookId: number, fellowUserId?: string) => void;
  reconcileFellowAnnotationsWithSymposiums: (
    symposiums: SymposiumSessionRow[],
    currentUserId: string
  ) => void;
  resolveStaleFellowProfiles: () => Promise<void>;
  getFellowAnnotationsForBook: (bookId: number) => FellowAnnotation[];

  queueOutboxAction: (action: Omit<AnnotationOutboxAction, 'id' | 'timestamp'>) => void;
  flushOutbox: (userId: string) => Promise<void>;

  addAnnotation: (
    data: {
      bookId: number;
      bookTitle?: string;
      bookAuthor?: string;
      language?: string;
      chapterIndex: number;
      chapterPage: number;
      selectedText: string;
      color: HighlightColor;
      note?: string;
    },
    userId?: string
  ) => Promise<Annotation>;

  updateAnnotationColor: (id: string, color: HighlightColor, userId?: string) => Promise<boolean>;
  updateAnnotationNote: (id: string, note: string, userId?: string) => Promise<boolean>;
  deleteAnnotation: (id: string, userId?: string) => Promise<boolean>;

  getAnnotationsForBook: (bookId: number) => Annotation[];
  getAnnotationsForPage: (bookId: number, chapterIndex: number, chapterPage: number) => Annotation[];

  syncWithCloud: (userId: string) => Promise<void>;
  updateBookMetadata: (bookId: number, title: string, author?: string) => void;
  clearAllAnnotations: () => void;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `ann-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useAnnotationStore = create<AnnotationState>()(
  persist(
    (set, get) => ({
      annotations: [],
      fellowAnnotations: [],
      marginaliaSourceFilter: 'all',
      spoilerShieldEnabled: true,
      outbox: [],
      tombstones: [],
      isSyncing: false,

      setMarginaliaSourceFilter: (filter) => {
        set({ marginaliaSourceFilter: filter });
      },

      setSpoilerShieldEnabled: (enabled) => {
        set({ spoilerShieldEnabled: enabled });
      },

      getFellowAnnotationsForBook: (bookId) => {
        return get().fellowAnnotations.filter((a) => a.bookId === bookId);
      },

      enrichFellowAnnotations: (fellowScholarsMap) => {
        const resolvedMap = buildFellowScholarsMap(fellowScholarsMap);
        const fellowshipSymposiums = useFellowshipStore.getState().symposiums;

        set((state) => {
          let modified = false;
          const nextFellowAnnotations = state.fellowAnnotations.map((fa) => {
            const directInfo = fa.userId ? resolvedMap[fa.userId] : undefined;
            let resolvedUsername = directInfo?.username;
            let resolvedDisplayName = directInfo?.display_name || undefined;

            if (!resolvedUsername && !fa.userId && fa.bookId) {
              const matchingSym = fellowshipSymposiums.find(
                (s) =>
                  s.book_id === fa.bookId &&
                  (s.status === 'active' || s.status === 'completed')
              );
              if (matchingSym) {
                resolvedUsername = matchingSym.fellow_username;
                resolvedDisplayName = matchingSym.fellow_display_name || undefined;
              }
            }

            const currentIsPlaceholder = isPlaceholderUsername(fa.fellowUsername);
            const resolvedIsPlaceholder = isPlaceholderUsername(resolvedUsername);

            if (
              resolvedUsername &&
              (currentIsPlaceholder ||
                (!resolvedIsPlaceholder && fa.fellowUsername !== resolvedUsername) ||
                (!fa.fellowDisplayName && resolvedDisplayName))
            ) {
              modified = true;
              return {
                ...fa,
                fellowUsername: resolvedUsername,
                fellowDisplayName: resolvedDisplayName || fa.fellowDisplayName,
              };
            }
            return fa;
          });

          return modified ? { fellowAnnotations: nextFellowAnnotations } : state;
        });
      },

      pruneFellowAnnotationsByFellow: (fellowUserId) => {
        if (!fellowUserId) return;
        set((state) => {
          const filtered = state.fellowAnnotations.filter((fa) => fa.userId !== fellowUserId);
          return filtered.length !== state.fellowAnnotations.length
            ? { fellowAnnotations: filtered }
            : state;
        });
      },

      pruneFellowAnnotationsForSymposium: (bookId, fellowUserId) => {
        if (!bookId) return;
        set((state) => {
          const filtered = state.fellowAnnotations.filter((fa) => {
            if (fa.bookId !== bookId) return true;
            if (fellowUserId && fa.userId && fa.userId !== fellowUserId) return true;
            return false;
          });
          return filtered.length !== state.fellowAnnotations.length
            ? { fellowAnnotations: filtered }
            : state;
        });
      },

      reconcileFellowAnnotationsWithSymposiums: (symposiums, currentUserId) => {
        if (!currentUserId || !Array.isArray(symposiums)) return;
        const activeBookFellowPairs = new Map<number, Set<string>>();
        for (const sym of symposiums) {
          if (sym.status !== 'active' && sym.status !== 'completed') continue;
          const partnerId =
            sym.host_id === currentUserId
              ? sym.fellow_id
              : sym.fellow_id === currentUserId
                ? sym.host_id
                : null;
          if (!partnerId) continue;
          if (!activeBookFellowPairs.has(sym.book_id)) {
            activeBookFellowPairs.set(sym.book_id, new Set());
          }
          activeBookFellowPairs.get(sym.book_id)!.add(partnerId);
        }

        set((state) => {
          const filtered = state.fellowAnnotations.filter((fa) => {
            const allowedPartners = activeBookFellowPairs.get(fa.bookId);
            if (!allowedPartners || allowedPartners.size === 0) return false;
            if (fa.userId) return allowedPartners.has(fa.userId);
            return true;
          });
          return filtered.length !== state.fellowAnnotations.length
            ? { fellowAnnotations: filtered }
            : state;
        });
      },

      resolveStaleFellowProfiles: async () => {
        const { fellowAnnotations } = get();
        const placeholderAnnotations = fellowAnnotations.filter(
          (fa) => fa.userId && isPlaceholderUsername(fa.fellowUsername)
        );
        if (placeholderAnnotations.length === 0) return;

        const missingUids = Array.from(
          new Set(placeholderAnnotations.map((fa) => fa.userId as string))
        );
        const supabase = createClient();
        if (!supabase) return;

        const profileMap = await fetchScholarProfilesMap(supabase, missingUids);
        if (profileMap.size > 0) {
          set((state) => {
            let modified = false;
            const nextFellowAnnotations = state.fellowAnnotations.map((fa) => {
              if (fa.userId && profileMap.has(fa.userId)) {
                const p = profileMap.get(fa.userId)!;
                if (p.username && isPlaceholderUsername(fa.fellowUsername)) {
                  modified = true;
                  return {
                    ...fa,
                    fellowUsername: p.username,
                    fellowDisplayName: p.display_name || fa.fellowDisplayName,
                  };
                }
              }
              return fa;
            });
            return modified ? { fellowAnnotations: nextFellowAnnotations } : state;
          });
        }
      },

      fetchAllFellowAnnotations: async (currentUserId, fellowScholarsMap) => {
        if (!currentUserId) return [];
        try {
          const supabase = createClient();
          const { data, error } = await supabase
            .from('user_annotations')
            .select('*')
            .neq('user_id', currentUserId)
            .order('created_at', { ascending: false });

          if (error) throw error;

          const rows = (data || []) as Record<string, unknown>[];
          const resolvedMap = await resolveFellowIdentityMap(
            rows,
            currentUserId,
            fellowScholarsMap,
            supabase
          );

          const currentFellow = get().fellowAnnotations;
          const currentOwn = get().annotations;
          const bookMetaMap = new Map<number, { title?: string; author?: string }>();
          for (const a of currentOwn) {
            if (a.bookTitle || a.bookAuthor) {
              bookMetaMap.set(a.bookId, { title: a.bookTitle, author: a.bookAuthor });
            }
          }
          for (const fa of currentFellow) {
            if ((fa.bookTitle || fa.bookAuthor) && !bookMetaMap.has(fa.bookId)) {
              bookMetaMap.set(fa.bookId, { title: fa.bookTitle, author: fa.bookAuthor });
            }
          }

          const mapped: FellowAnnotation[] = rows.map((row: Record<string, unknown>) =>
            mapRowToFellowAnnotation(row, resolvedMap, bookMetaMap.get(Number(row.book_id)))
          );

          set({ fellowAnnotations: mapped });
          return mapped;
        } catch {
          return get().fellowAnnotations;
        }
      },

      fetchFellowAnnotationsForBook: async (bookId, currentUserId, fellowScholarsMap) => {
        if (!currentUserId || !bookId) return [];
        try {
          const supabase = createClient();
          const { data, error } = await supabase
            .from('user_annotations')
            .select('*')
            .eq('book_id', bookId)
            .neq('user_id', currentUserId)
            .order('created_at', { ascending: false });

          if (error) throw error;

          const rows = (data || []) as Record<string, unknown>[];
          const resolvedMap = await resolveFellowIdentityMap(
            rows,
            currentUserId,
            fellowScholarsMap,
            supabase
          );

          const mapped: FellowAnnotation[] = rows.map((row: Record<string, unknown>) =>
            mapRowToFellowAnnotation(row, resolvedMap)
          );

          set((state) => ({
            fellowAnnotations: [
              ...state.fellowAnnotations.filter((fa) => fa.bookId !== bookId),
              ...mapped,
            ],
          }));

          return mapped;
        } catch {
          return get().fellowAnnotations.filter((fa) => fa.bookId === bookId);
        }
      },

      queueOutboxAction: (action) => {
        const item: AnnotationOutboxAction = {
          ...action,
          id: generateId(),
          timestamp: new Date().toISOString(),
        };
        set((state) => ({ outbox: [...state.outbox, item] }));
      },

      flushOutbox: async (userId: string) => {
        const snapshot = [...get().outbox];
        if (snapshot.length === 0 || !userId) return;

        const supabase = createClient();
        const completedActionIds = new Set<string>();

        for (const action of snapshot) {
          try {
            const dispatcher = ANNOTATION_OUTBOX_DISPATCHERS[action.type];
            if (dispatcher) {
              const { error } = await dispatcher(supabase, userId, action.payload);
              if (error) throw error;
            }
            completedActionIds.add(action.id);
          } catch {
            // Keep failed action in outbox for retry
          }
        }

        if (completedActionIds.size > 0) {
          set((state) => ({
            outbox: state.outbox.filter((item) => !completedActionIds.has(item.id)),
          }));
        }
      },

      addAnnotation: async (data, userId) => {
        const trimmedText = data.selectedText.trim().slice(0, MAX_ANNOTATION_TEXT_LENGTH);
        const trimmedNote = data.note ? data.note.trim().slice(0, MAX_ANNOTATION_NOTE_LENGTH) : undefined;
        // Check if an annotation for the same or overlapping passage already exists in this book and chapter
        const existing = get().annotations.find(
          (a) =>
            a.bookId === data.bookId &&
            a.chapterIndex === data.chapterIndex &&
            (a.selectedText.trim() === trimmedText ||
              a.selectedText.trim().includes(trimmedText) ||
              trimmedText.includes(a.selectedText.trim()))
        );
        if (existing) {
          if (data.color !== existing.color) {
            await get().updateAnnotationColor(existing.id, data.color, userId);
          }
          if (trimmedNote !== undefined && trimmedNote !== (existing.note || '')) {
            await get().updateAnnotationNote(existing.id, trimmedNote, userId);
          }
          if (trimmedText.length > existing.selectedText.length) {
            const now = new Date().toISOString();
            const expanded: Annotation = {
              ...existing,
              selectedText: trimmedText,
              updatedAt: now,
            };
            set((state) => ({
              annotations: state.annotations.map((a) =>
                a.id === existing.id ? expanded : a
              ),
            }));
            if (userId) {
              await syncAnnotationMutation(
                expanded,
                userId,
                (sb) =>
                  sb
                    .from('user_annotations')
                    .update({ selected_text: trimmedText, updated_at: now })
                    .eq('id', existing.id)
                    .eq('user_id', userId),
                get().queueOutboxAction
              );
            }
          }
          return get().annotations.find((a) => a.id === existing.id) || existing;
        }

        const now = new Date().toISOString();
        const newAnnotation: Annotation = {
          id: generateId(),
          userId,
          bookId: data.bookId,
          bookTitle: data.bookTitle?.trim() || undefined,
          bookAuthor: data.bookAuthor?.trim() || undefined,
          language: data.language?.trim() || undefined,
          chapterIndex: data.chapterIndex,
          chapterPage: data.chapterPage,
          selectedText: trimmedText,
          color: data.color,
          note: trimmedNote,
          createdAt: now,
          updatedAt: now,
        };

        // 1. Optimistic local update
        set((state) => ({
          annotations: [newAnnotation, ...state.annotations],
        }));

        // 2. Cloud synchronization if logged in
        if (userId) {
          await syncAnnotationMutation(
            newAnnotation,
            userId,
            (sb, dbPayload) => sb.from('user_annotations').insert(dbPayload),
            get().queueOutboxAction
          );
        }

        return newAnnotation;
      },

      updateAnnotationColor: async (id, color, userId) => {
        const now = new Date().toISOString();

        // 1. Optimistic local update
        set((state) => ({
          annotations: state.annotations.map((a) =>
            a.id === id ? { ...a, color, updatedAt: now } : a
          ),
        }));

        // 2. Cloud synchronization if logged in
        const target = userId ? get().annotations.find((a) => a.id === id) : undefined;
        if (userId && target) {
          await syncAnnotationMutation(
            target,
            userId,
            (sb) =>
              sb
                .from('user_annotations')
                .update({ color, updated_at: now })
                .eq('id', id)
                .eq('user_id', userId),
            get().queueOutboxAction
          );
        }

        return true;
      },

      updateAnnotationNote: async (id, note, userId) => {
        const now = new Date().toISOString();
        const trimmedNote = note.trim().slice(0, MAX_ANNOTATION_NOTE_LENGTH);

        // 1. Optimistic local update
        set((state) => ({
          annotations: state.annotations.map((a) =>
            a.id === id ? { ...a, note: trimmedNote || undefined, updatedAt: now } : a
          ),
        }));

        // 2. Cloud synchronization if logged in
        const target = userId ? get().annotations.find((a) => a.id === id) : undefined;
        if (userId && target) {
          await syncAnnotationMutation(
            target,
            userId,
            (sb) =>
              sb
                .from('user_annotations')
                .update({ note: trimmedNote || null, updated_at: now })
                .eq('id', id)
                .eq('user_id', userId),
            get().queueOutboxAction
          );
        }

        return true;
      },

      deleteAnnotation: async (id, userId) => {
        // 1. Optimistic local update & tombstone record to prevent zombie resurrection
        set((state) => ({
          annotations: state.annotations.filter((a) => a.id !== id),
          tombstones: state.tombstones.includes(id) ? state.tombstones : [...state.tombstones, id],
        }));

        // 2. Cloud synchronization if logged in
        if (userId) {
          try {
            const supabase = createClient();
            const { error } = await supabase
              .from('user_annotations')
              .delete()
              .eq('id', id)
              .eq('user_id', userId);
            if (error) throw error;
          } catch {
            get().queueOutboxAction({
              type: 'DELETE_ANNOTATION',
              payload: { id },
            });
          }
        }

        return true;
      },

      getAnnotationsForBook: (bookId) => {
        return get().annotations.filter((a) => a.bookId === bookId);
      },

      getAnnotationsForPage: (bookId, chapterIndex, chapterPage) => {
        return get().annotations.filter(
          (a) =>
            a.bookId === bookId &&
            a.chapterIndex === chapterIndex &&
            a.chapterPage === chapterPage
        );
      },

      updateBookMetadata: (bookId, title, author) => {
        if (!bookId || bookId <= 0 || !title) return;
        const cleanedTitle = cleanBookTitle(title);
        if (!cleanedTitle || isPlaceholderTitle(cleanedTitle)) return;

        const formattedAuthor = author ? formatAuthorNames(author).replace(/^by\s+/i, '').trim() : '';
        const cleanedAuthor = formattedAuthor && !isPlaceholderAuthor(formattedAuthor) ? formattedAuthor : undefined;

        set((state) => {
          let modified = false;
          const enrichItem = <T extends Annotation>(ann: T): T => {
            if (ann.bookId !== bookId) return ann;

            const missingOrPlaceholderTitle = !ann.bookTitle || isPlaceholderTitle(cleanBookTitle(ann.bookTitle));
            const missingOrPlaceholderAuthor = !ann.bookAuthor || isPlaceholderAuthor(ann.bookAuthor);

            const shouldUpdateTitle = missingOrPlaceholderTitle;
            const shouldUpdateAuthor = missingOrPlaceholderAuthor && Boolean(cleanedAuthor);

            if (shouldUpdateTitle || shouldUpdateAuthor) {
              modified = true;
              return {
                ...ann,
                bookTitle: shouldUpdateTitle ? cleanedTitle : ann.bookTitle,
                bookAuthor: shouldUpdateAuthor && cleanedAuthor ? cleanedAuthor : ann.bookAuthor,
              };
            }
            return ann;
          };

          const nextAnnotations = state.annotations.map(enrichItem);
          const nextFellowAnnotations = state.fellowAnnotations.map(enrichItem);

          return modified
            ? { annotations: nextAnnotations, fellowAnnotations: nextFellowAnnotations }
            : state;
        });
      },

      syncWithCloud: async (userId) => {
        if (!userId) return;
        set({ isSyncing: true });

        // Flush any pending offline mutations first
        await get().flushOutbox(userId);

        try {
          const supabase = createClient();

          // Fetch cloud annotations
          const { data, error } = await supabase
            .from('user_annotations')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          if (error) throw error;

          const currentTombstones = get().tombstones;
          const localAnnotations = get().annotations.filter((la) => !currentTombstones.includes(la.id));
          const localMetaMap = new Map<string, { bookTitle?: string; bookAuthor?: string; language?: string }>();
          for (const la of localAnnotations) {
            localMetaMap.set(la.id, {
              bookTitle: la.bookTitle,
              bookAuthor: la.bookAuthor,
              language: la.language,
            });
          }

          const remoteAnnotations: Annotation[] = (data || [])
            .map((row: Record<string, unknown>) => {
              const id = String(row.id);
              const meta = localMetaMap.get(id);
              return {
                id,
                userId: String(row.user_id),
                bookId: Number(row.book_id),
                bookTitle: meta?.bookTitle,
                bookAuthor: meta?.bookAuthor,
                language: meta?.language,
                chapterIndex: Number(row.chapter_index),
                chapterPage: Number(row.chapter_page),
                selectedText: String(row.selected_text),
                color: row.color as HighlightColor,
                note: (row.note as string) || undefined,
                createdAt: String(row.created_at),
                updatedAt: String(row.updated_at),
              };
            })
            .filter((r) => !currentTombstones.includes(r.id));

          // Merge: Preserve any local guest annotations that don't exist remotely and apply LWW when local is newer
          const merged = [...remoteAnnotations];
          const unSyncedGuestAnnotations: Annotation[] = [];

          for (const la of localAnnotations) {
            const remoteIdx = merged.findIndex((r) => r.id === la.id);
            if (remoteIdx === -1) {
              merged.push(la);
              unSyncedGuestAnnotations.push(la);
            } else {
              const remoteItem = merged[remoteIdx];
              const localTime = new Date(la.updatedAt).getTime();
              const remoteTime = new Date(remoteItem.updatedAt).getTime();
              if (localTime > remoteTime) {
                merged[remoteIdx] = la;
                unSyncedGuestAnnotations.push(la);
              }
            }
          }

          set({ annotations: merged });

          // Bidirectional sync: upload guest annotations to Supabase
          if (unSyncedGuestAnnotations.length > 0) {
            const inserts = unSyncedGuestAnnotations.map((a) => toAnnotationDbRow(a, userId));
            await supabase.from('user_annotations').upsert(inserts, { onConflict: 'id' });
          }

          // Automatically fetch all Fellow annotations across active symposiums
          await get().fetchAllFellowAnnotations(userId);
        } catch {
          // Graceful non-blocking fallback for offline or unmigrated instances
        } finally {
          set({ isSyncing: false });
        }
      },

      clearAllAnnotations: () => {
        set({
          annotations: [],
          fellowAnnotations: [],
          marginaliaSourceFilter: 'all',
          spoilerShieldEnabled: true,
          outbox: [],
          tombstones: [],
        });
      },
    }),
    {
      name: STORAGE_KEYS.ANNOTATIONS,
      storage: createJSONStorage(() => localStorage),
    }
  )
);

/**
 * SSR-safe selector hook for accessing annotations state with hydration guard.
 */
export function useHydratedAnnotations() {
  const hasMounted = useHasMounted();
  const annotations = useAnnotationStore((s) => s.annotations);
  const fellowAnnotations = useAnnotationStore((s) => s.fellowAnnotations);
  const marginaliaSourceFilter = useAnnotationStore((s) => s.marginaliaSourceFilter);
  const spoilerShieldEnabled = useAnnotationStore((s) => s.spoilerShieldEnabled);
  const isSyncing = useAnnotationStore((s) => s.isSyncing);
  const setMarginaliaSourceFilter = useAnnotationStore((s) => s.setMarginaliaSourceFilter);
  const setSpoilerShieldEnabled = useAnnotationStore((s) => s.setSpoilerShieldEnabled);
  const fetchAllFellowAnnotations = useAnnotationStore((s) => s.fetchAllFellowAnnotations);
  const fetchFellowAnnotationsForBook = useAnnotationStore((s) => s.fetchFellowAnnotationsForBook);
  const enrichFellowAnnotations = useAnnotationStore((s) => s.enrichFellowAnnotations);
  const getFellowAnnotationsForBook = useAnnotationStore((s) => s.getFellowAnnotationsForBook);
  const addAnnotation = useAnnotationStore((s) => s.addAnnotation);
  const updateAnnotationColor = useAnnotationStore((s) => s.updateAnnotationColor);
  const updateAnnotationNote = useAnnotationStore((s) => s.updateAnnotationNote);
  const deleteAnnotation = useAnnotationStore((s) => s.deleteAnnotation);
  const getAnnotationsForBook = useAnnotationStore((s) => s.getAnnotationsForBook);
  const getAnnotationsForPage = useAnnotationStore((s) => s.getAnnotationsForPage);
  const syncWithCloud = useAnnotationStore((s) => s.syncWithCloud);
  const updateBookMetadata = useAnnotationStore((s) => s.updateBookMetadata);
  const clearAllAnnotations = useAnnotationStore((s) => s.clearAllAnnotations);

  const hydratedState = hasMounted
    ? {
        annotations,
        fellowAnnotations,
        marginaliaSourceFilter,
        spoilerShieldEnabled,
        isSyncing,
      }
    : {
        annotations: [] as Annotation[],
        fellowAnnotations: [] as FellowAnnotation[],
        marginaliaSourceFilter: 'all' as MarginaliaSourceFilter,
        spoilerShieldEnabled: true,
        isSyncing: false,
      };

  return {
    hasMounted,
    ...hydratedState,
    setMarginaliaSourceFilter,
    setSpoilerShieldEnabled,
    fetchAllFellowAnnotations,
    fetchFellowAnnotationsForBook,
    enrichFellowAnnotations,
    getFellowAnnotationsForBook,
    addAnnotation,
    updateAnnotationColor,
    updateAnnotationNote,
    deleteAnnotation,
    getAnnotationsForBook,
    getAnnotationsForPage,
    syncWithCloud,
    updateBookMetadata,
    clearAllAnnotations,
  };
}

/**
 * Lightweight primitive selector hook for the personal annotation count in navigation badges.
 */
export function useHydratedAnnotationCount(): { annotationCount: number; hasMounted: boolean } {
  const hasMounted = useHasMounted();
  const count = useAnnotationStore((s) => s.annotations.length);
  return {
    annotationCount: hasMounted ? count : 0,
    hasMounted,
  };
}
