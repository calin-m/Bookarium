import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEYS } from '@/config/site-config';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.types';
import { useFellowshipStore, isPlaceholderUsername } from '@/stores/useFellowshipStore';
import { useHasMounted } from '@/hooks/useHasMounted';
import { cleanBookTitle, isPlaceholderTitle, isPlaceholderAuthor } from '@/lib/book-metadata';
import { formatAuthorNames } from '@/lib/utils';

export type HighlightColor = 'yellow' | 'amber' | 'mint' | 'rose';
export type MarginaliaSourceFilter = 'all' | 'mine' | 'fellows';

export interface Annotation {
  id: string;
  userId?: string;
  bookId: number;
  bookTitle?: string;
  bookAuthor?: string;
  language?: string;
  chapterIndex: number;
  chapterPage: number;
  selectedText: string;
  color: HighlightColor;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FellowAnnotation extends Annotation {
  isFellow: true;
  fellowUsername: string;
  fellowDisplayName?: string;
}

export interface AnnotationOutboxAction {
  id: string;
  type: 'UPSERT_ANNOTATION' | 'DELETE_ANNOTATION';
  payload: Record<string, unknown>;
  timestamp: string;
}

export const MAX_ANNOTATION_TEXT_LENGTH = 5000;
export const MAX_ANNOTATION_NOTE_LENGTH = 2000;

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
  fetchFellowAnnotationsForBook: (
    bookId: number,
    currentUserId?: string,
    fellowScholarsMap?: Record<string, { username: string; display_name?: string | null }>
  ) => Promise<FellowAnnotation[]>;
  enrichFellowAnnotations: (
    fellowScholarsMap?: Record<string, { username: string; display_name?: string | null }>
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

function setOrUpdateFellowMapEntry(
  map: Record<string, { username: string; display_name?: string | null }>,
  userId: string,
  username: string,
  displayName?: string | null
) {
  const existing = map[userId];
  if (!existing) {
    map[userId] = {
      username,
      display_name: displayName || undefined,
    };
    return;
  }

  const existingIsPlaceholder = isPlaceholderUsername(existing.username);
  const nextIsPlaceholder = isPlaceholderUsername(username);

  // If existing already has a real handle and incoming is a placeholder, retain existing real handle
  const resolvedUsername =
    existingIsPlaceholder && !nextIsPlaceholder
      ? username
      : !existingIsPlaceholder && nextIsPlaceholder
      ? existing.username
      : username || existing.username;
  const displayNameIsPlaceholder =
    !displayName || isPlaceholderUsername(displayName);
  const existingDisplayNameIsPlaceholder =
    !existing.display_name || isPlaceholderUsername(existing.display_name);

  const resolvedDisplayName =
    !displayNameIsPlaceholder
      ? displayName
      : !existingDisplayNameIsPlaceholder
      ? existing.display_name
      : displayName || existing.display_name;

  map[userId] = {
    username: resolvedUsername,
    display_name: resolvedDisplayName || undefined,
  };
}

/**
 * Builds a lookup map of scholar identities (`user_id -> { username, display_name }`)
 * from `useFellowshipStore` (`symposiums` and `circles`) merged with any explicit caller map.
 */
export function buildFellowScholarsMap(
  explicitMap?: Record<string, { username: string; display_name?: string | null }>
): Record<string, { username: string; display_name?: string | null }> {
  const map: Record<string, { username: string; display_name?: string | null }> = {};
  const fellowshipState = useFellowshipStore.getState();

  for (const circle of fellowshipState.circles || []) {
    if (circle.requester_id && circle.requester_username) {
      setOrUpdateFellowMapEntry(
        map,
        circle.requester_id,
        circle.requester_username,
        circle.requester_display_name
      );
    }
    if (circle.recipient_id && circle.recipient_username) {
      setOrUpdateFellowMapEntry(
        map,
        circle.recipient_id,
        circle.recipient_username,
        circle.recipient_display_name
      );
    }
  }

  for (const sym of fellowshipState.symposiums || []) {
    if (sym.host_id && sym.host_username) {
      setOrUpdateFellowMapEntry(
        map,
        sym.host_id,
        sym.host_username,
        sym.host_display_name
      );
    }
    if (sym.fellow_id && sym.fellow_username) {
      setOrUpdateFellowMapEntry(
        map,
        sym.fellow_id,
        sym.fellow_username,
        sym.fellow_display_name
      );
    }
  }

  if (explicitMap) {
    for (const [uid, info] of Object.entries(explicitMap)) {
      if (info && info.username) {
        setOrUpdateFellowMapEntry(map, uid, info.username, info.display_name);
      }
    }
  }

  return map;
}

type AnnotationOutboxDispatcher = (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  payload: Record<string, unknown>
) => PromiseLike<{ error: unknown }>;

const ANNOTATION_OUTBOX_DISPATCHERS: Record<
  AnnotationOutboxAction['type'],
  AnnotationOutboxDispatcher
> = {
  DELETE_ANNOTATION: (sb, userId, p) =>
    sb.from('user_annotations').delete().eq('id', String(p.id)).eq('user_id', userId),
  UPSERT_ANNOTATION: (sb, userId, p) =>
    sb.from('user_annotations').upsert(
      { ...p, user_id: userId } as Database['public']['Tables']['user_annotations']['Insert'],
      { onConflict: 'id' }
    ),
};

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
        const fellowshipSymposiums = useFellowshipStore.getState().symposiums || [];

        set((state) => {
          let modified = false;
          const nextFellowAnnotations = state.fellowAnnotations.map((fa) => {
            const directInfo = fa.userId ? resolvedMap[fa.userId] : undefined;
            let resolvedUsername = directInfo?.username;
            let resolvedDisplayName = directInfo?.display_name || undefined;

            if (!resolvedUsername && fa.bookId) {
              const matchingSym = fellowshipSymposiums.find(
                (s) =>
                  s.book_id === fa.bookId &&
                  (s.status === 'active' || s.status === 'completed') &&
                  (!fa.userId || s.host_id === fa.userId || s.fellow_id === fa.userId)
              );
              if (matchingSym) {
                const isFellowTheHost = fa.userId ? matchingSym.host_id === fa.userId : false;
                resolvedUsername = isFellowTheHost
                  ? matchingSym.host_username
                  : matchingSym.fellow_username;
                resolvedDisplayName =
                  (isFellowTheHost
                    ? matchingSym.host_display_name
                    : matchingSym.fellow_display_name) || undefined;
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

        try {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, username, display_name')
            .in('id', missingUids);

          if (Array.isArray(profilesData) && profilesData.length > 0) {
            const profileMap = new Map<
              string,
              { username: string | null; display_name: string | null }
            >();
            for (const p of profilesData) {
              profileMap.set(p.id, { username: p.username, display_name: p.display_name });
            }

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
        } catch {
          // Non-blocking
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
          const resolvedMap = buildFellowScholarsMap(fellowScholarsMap);

          // Also cross-reference active/completed symposiums for this volume if any row user_id is missing
          const fellowshipSymposiums = useFellowshipStore.getState().symposiums || [];
          const bookSymposium = fellowshipSymposiums.find(
            (s) =>
              s.book_id === bookId &&
              (s.status === 'active' || s.status === 'completed') &&
              (s.host_id === currentUserId || s.fellow_id === currentUserId)
          );
          if (bookSymposium) {
            const companionId =
              bookSymposium.host_id === currentUserId
                ? bookSymposium.fellow_id
                : bookSymposium.host_id;
            const companionUsername =
              bookSymposium.host_id === currentUserId
                ? bookSymposium.fellow_username
                : bookSymposium.host_username;
            const companionDisplayName =
              bookSymposium.host_id === currentUserId
                ? bookSymposium.fellow_display_name
                : bookSymposium.host_display_name;
            if (companionId && companionUsername && !resolvedMap[companionId]) {
              resolvedMap[companionId] = {
                username: companionUsername,
                display_name: companionDisplayName || undefined,
              };
            }
          }

          // Fallback profile lookup for any fellow user_id still absent from resolvedMap or with placeholder handle
          const missingIds = Array.from(
            new Set(
              rows
                .map((r) => String(r.user_id || ''))
                .filter(
                  (uid) =>
                    uid &&
                    (!resolvedMap[uid]?.username ||
                      isPlaceholderUsername(resolvedMap[uid]?.username))
                )
            )
          );
          if (missingIds.length > 0) {
            try {
              const { data: profilesData } = await supabase
                .from('profiles')
                .select('id, username, display_name')
                .in('id', missingIds);
              if (Array.isArray(profilesData)) {
                for (const prof of profilesData as Array<{
                  id: string;
                  username: string | null;
                  display_name: string | null;
                }>) {
                  if (prof.id && (prof.username || prof.display_name)) {
                    resolvedMap[prof.id] = {
                      username: prof.username || prof.display_name || 'fellow_scholar',
                      display_name: prof.display_name || undefined,
                    };
                  }
                }
              }
            } catch {
              // Non-blocking if profiles query is unavailable or offline
            }
          }

          const mapped: FellowAnnotation[] = rows.map((row: Record<string, unknown>) => {
            const fellowUserId = String(row.user_id);
            const fellowInfo = resolvedMap[fellowUserId];
            return {
              id: String(row.id),
              userId: fellowUserId,
              bookId: Number(row.book_id),
              chapterIndex: Number(row.chapter_index),
              chapterPage: Number(row.chapter_page),
              selectedText: String(row.selected_text),
              color: (row.color as HighlightColor) || 'amber',
              note: (row.note as string) || undefined,
              createdAt: String(row.created_at),
              updatedAt: String(row.updated_at),
              isFellow: true,
              fellowUsername: fellowInfo?.username || 'fellow_scholar',
              fellowDisplayName: fellowInfo?.display_name || undefined,
            };
          });

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
        const { outbox } = get();
        if (outbox.length === 0 || !userId) return;

        const supabase = createClient();
        const remaining: AnnotationOutboxAction[] = [];

        for (const action of outbox) {
          try {
            const dispatcher = ANNOTATION_OUTBOX_DISPATCHERS[action.type];
            if (dispatcher) {
              const { error } = await dispatcher(supabase, userId, action.payload);
              if (error) throw error;
            }
          } catch {
            remaining.push(action);
          }
        }

        set({ outbox: remaining });
      },

      addAnnotation: async (data, userId) => {
        const trimmedText = data.selectedText.trim().slice(0, MAX_ANNOTATION_TEXT_LENGTH);
        const trimmedNote = data.note ? data.note.trim().slice(0, MAX_ANNOTATION_NOTE_LENGTH) : undefined;
        // Check if an annotation for the same or overlapping passage already exists in this book
        const existing = get().annotations.find(
          (a) =>
            a.bookId === data.bookId &&
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
            set((state) => ({
              annotations: state.annotations.map((a) =>
                a.id === existing.id ? { ...a, selectedText: trimmedText } : a
              ),
            }));
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
          const dbPayload = {
            id: newAnnotation.id,
            user_id: userId,
            book_id: newAnnotation.bookId,
            chapter_index: newAnnotation.chapterIndex,
            chapter_page: newAnnotation.chapterPage,
            selected_text: newAnnotation.selectedText,
            color: newAnnotation.color,
            note: newAnnotation.note || null,
            created_at: newAnnotation.createdAt,
            updated_at: newAnnotation.updatedAt,
          };

          try {
            const supabase = createClient();
            const { error } = await supabase.from('user_annotations').insert(dbPayload);
            if (error) throw error;
          } catch {
            get().queueOutboxAction({
              type: 'UPSERT_ANNOTATION',
              payload: dbPayload,
            });
          }
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
        if (userId) {
          const target = get().annotations.find((a) => a.id === id);
          if (target) {
            const dbPayload = {
              id: target.id,
              user_id: userId,
              book_id: target.bookId,
              chapter_index: target.chapterIndex,
              chapter_page: target.chapterPage,
              selected_text: target.selectedText,
              color,
              note: target.note || null,
              created_at: target.createdAt,
              updated_at: now,
            };

            try {
              const supabase = createClient();
              const { error } = await supabase
                .from('user_annotations')
                .update({ color, updated_at: now })
                .eq('id', id)
                .eq('user_id', userId);
              if (error) throw error;
            } catch {
              get().queueOutboxAction({
                type: 'UPSERT_ANNOTATION',
                payload: dbPayload,
              });
            }
          }
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
        if (userId) {
          const target = get().annotations.find((a) => a.id === id);
          if (target) {
            const dbPayload = {
              id: target.id,
              user_id: userId,
              book_id: target.bookId,
              chapter_index: target.chapterIndex,
              chapter_page: target.chapterPage,
              selected_text: target.selectedText,
              color: target.color,
              note: trimmedNote || null,
              updated_at: now,
            };

            try {
              const supabase = createClient();
              const { error } = await supabase
                .from('user_annotations')
                .update({ note: trimmedNote || null, updated_at: now })
                .eq('id', id)
                .eq('user_id', userId);
              if (error) throw error;
            } catch {
              get().queueOutboxAction({
                type: 'UPSERT_ANNOTATION',
                payload: dbPayload,
              });
            }
          }
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
          const currentTombstones = get().tombstones || [];

          // Fetch cloud annotations
          const { data, error } = await supabase
            .from('user_annotations')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          if (error) throw error;

          const remoteAnnotations: Annotation[] = (data || [])
            .map((row: Record<string, unknown>) => ({
              id: String(row.id),
              userId: String(row.user_id),
              bookId: Number(row.book_id),
              chapterIndex: Number(row.chapter_index),
              chapterPage: Number(row.chapter_page),
              selectedText: String(row.selected_text),
              color: row.color as HighlightColor,
              note: (row.note as string) || undefined,
              createdAt: String(row.created_at),
              updatedAt: String(row.updated_at),
            }))
            .filter((r) => !currentTombstones.includes(r.id));

          // Merge: Preserve any local guest annotations that don't exist remotely and are not tombstoned
          const localAnnotations = get().annotations.filter((la) => !currentTombstones.includes(la.id));
          const merged = [...remoteAnnotations];
          const unSyncedGuestAnnotations: Annotation[] = [];

          for (const la of localAnnotations) {
            if (!merged.some((r) => r.id === la.id)) {
              merged.push(la);
              unSyncedGuestAnnotations.push(la);
            }
          }

          set({ annotations: merged });

          // Bidirectional sync: upload guest annotations to Supabase
          if (unSyncedGuestAnnotations.length > 0) {
            const inserts = unSyncedGuestAnnotations.map((a) => ({
              id: a.id,
              user_id: userId,
              book_id: a.bookId,
              chapter_index: a.chapterIndex,
              chapter_page: a.chapterPage,
              selected_text: a.selectedText,
              color: a.color,
              note: a.note || null,
              created_at: a.createdAt,
              updated_at: a.updatedAt,
            }));

            await supabase.from('user_annotations').upsert(inserts, { onConflict: 'id' });
          }
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

  return {
    hasMounted,
    annotations: hasMounted ? annotations : [],
    fellowAnnotations: hasMounted ? fellowAnnotations : [],
    marginaliaSourceFilter: hasMounted ? marginaliaSourceFilter : ('all' as MarginaliaSourceFilter),
    spoilerShieldEnabled: hasMounted ? spoilerShieldEnabled : true,
    isSyncing: hasMounted ? isSyncing : false,
    setMarginaliaSourceFilter,
    setSpoilerShieldEnabled,
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
