import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEYS } from '@/config/site-config';
import { createClient } from '@/lib/supabase/client';
import { useHasMounted } from '@/hooks/useHasMounted';
import { cleanBookTitle, isPlaceholderTitle, isPlaceholderAuthor } from '@/lib/book-metadata';
import { formatAuthorNames } from '@/lib/utils';

export type HighlightColor = 'yellow' | 'amber' | 'mint' | 'rose';

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

export interface AnnotationOutboxAction {
  id: string;
  type: 'UPSERT_ANNOTATION' | 'DELETE_ANNOTATION';
  payload: Record<string, any>;
  timestamp: string;
}

export const MAX_ANNOTATION_TEXT_LENGTH = 5000;
export const MAX_ANNOTATION_NOTE_LENGTH = 2000;

export interface AnnotationState {
  annotations: Annotation[];
  outbox: AnnotationOutboxAction[];
  tombstones: string[];
  isSyncing: boolean;

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
      outbox: [],
      tombstones: [],
      isSyncing: false,

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
            if (action.type === 'DELETE_ANNOTATION') {
              const { error } = await supabase
                .from('user_annotations')
                .delete()
                .eq('id', action.payload.id)
                .eq('user_id', userId);
              if (error) throw error;
            } else if (action.type === 'UPSERT_ANNOTATION') {
              const { error } = await supabase
                .from('user_annotations')
                .upsert(
                  {
                    ...action.payload,
                    user_id: userId,
                  } as any,
                  { onConflict: 'id' }
                );
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
          const nextAnnotations = state.annotations.map((ann) => {
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
          });

          return modified ? { annotations: nextAnnotations } : state;
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
            .map((row: any) => ({
              id: row.id,
              userId: row.user_id,
              bookId: row.book_id,
              chapterIndex: row.chapter_index,
              chapterPage: row.chapter_page,
              selectedText: row.selected_text,
              color: row.color as HighlightColor,
              note: row.note || undefined,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
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
        set({ annotations: [], outbox: [], tombstones: [] });
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
  const isSyncing = useAnnotationStore((s) => s.isSyncing);
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
    isSyncing: hasMounted ? isSyncing : false,
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
