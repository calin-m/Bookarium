import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAnnotationStore } from './useAnnotationStore';

// Mock Supabase client
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) });
const mockDelete = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) });
const mockSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  }),
});
const mockUpsert = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'user_annotations') {
        return {
          insert: mockInsert,
          update: mockUpdate,
          delete: mockDelete,
          select: mockSelect,
          upsert: mockUpsert,
        };
      }
      return {};
    },
  }),
}));

describe('useAnnotationStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAnnotationStore.getState().clearAllAnnotations();
  });

  it('initializes with empty annotations and outbox', () => {
    const state = useAnnotationStore.getState();
    expect(state.annotations).toEqual([]);
    expect(state.outbox).toEqual([]);
    expect(state.isSyncing).toBe(false);
  });

  it('adds an annotation in guest mode (offline/local only)', async () => {
    const annotation = await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'It is a truth universally acknowledged...',
      color: 'yellow',
      note: 'Famous opening line',
    });

    expect(annotation.id).toBeDefined();
    expect(annotation.bookId).toBe(1342);
    expect(annotation.selectedText).toBe('It is a truth universally acknowledged...');
    expect(annotation.color).toBe('yellow');
    expect(annotation.note).toBe('Famous opening line');

    const stored = useAnnotationStore.getState().annotations;
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(annotation.id);
    expect(mockInsert).not.toHaveBeenCalled(); // Zero network in guest mode
  });

  it('updates an annotation note', async () => {
    const created = await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      chapterIndex: 1,
      chapterPage: 2,
      selectedText: 'Pride and prejudice quote',
      color: 'mint',
    });

    expect(created.note).toBeUndefined();

    await useAnnotationStore.getState().updateAnnotationNote(created.id, 'My revised note');

    const updated = useAnnotationStore.getState().annotations.find((a) => a.id === created.id);
    expect(updated?.note).toBe('My revised note');
  });

  it('updates an annotation color without creating duplicates', async () => {
    const created = await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      chapterIndex: 1,
      chapterPage: 2,
      selectedText: 'Unique sentence to highlight',
      color: 'yellow',
    });

    expect(created.color).toBe('yellow');
    expect(useAnnotationStore.getState().annotations).toHaveLength(1);

    await useAnnotationStore.getState().updateAnnotationColor(created.id, 'mint');

    const updated = useAnnotationStore.getState().annotations.find((a) => a.id === created.id);
    expect(updated?.color).toBe('mint');
    expect(useAnnotationStore.getState().annotations).toHaveLength(1);
  });

  it('deduplicates addAnnotation on identical text by updating color and note', async () => {
    const first = await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Duplicate check text',
      color: 'yellow',
      note: 'First note',
    });

    expect(useAnnotationStore.getState().annotations).toHaveLength(1);

    // Call addAnnotation on the exact same text with amber and new note
    const second = await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Duplicate check text',
      color: 'amber',
      note: 'Updated note',
    });

    expect(second.id).toBe(first.id);
    expect(second.color).toBe('amber');
    expect(second.note).toBe('Updated note');
    expect(useAnnotationStore.getState().annotations).toHaveLength(1);
  });

  it('syncs color update to Supabase when userId is provided and queues outbox on error', async () => {
    const created = await useAnnotationStore.getState().addAnnotation(
      {
        bookId: 1342,
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'Cloud color sync test',
        color: 'yellow',
      },
      'user-123'
    );

    await useAnnotationStore.getState().updateAnnotationColor(created.id, 'rose', 'user-123');

    const updated = useAnnotationStore.getState().annotations.find((a) => a.id === created.id);
    expect(updated?.color).toBe('rose');

    // Test offline outbox fallback when Supabase fails
    mockUpdate.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockRejectedValue(new Error('Network offline')),
      }),
    });

    await useAnnotationStore.getState().updateAnnotationColor(created.id, 'mint', 'user-123');
    const outbox = useAnnotationStore.getState().outbox;
    expect(outbox.some((o) => o.type === 'UPSERT_ANNOTATION')).toBe(true);
  });

  it('deletes an annotation', async () => {
    const created = await useAnnotationStore.getState().addAnnotation({
      bookId: 84,
      chapterIndex: 2,
      chapterPage: 1,
      selectedText: 'Frankenstein quote',
      color: 'rose',
    });

    expect(useAnnotationStore.getState().annotations).toHaveLength(1);

    await useAnnotationStore.getState().deleteAnnotation(created.id);

    expect(useAnnotationStore.getState().annotations).toHaveLength(0);
  });

  it('filters annotations by book and page correctly', async () => {
    await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Book 1342 P1',
      color: 'yellow',
    });
    await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      chapterIndex: 0,
      chapterPage: 2,
      selectedText: 'Book 1342 P2',
      color: 'amber',
    });
    await useAnnotationStore.getState().addAnnotation({
      bookId: 84,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Book 84 P1',
      color: 'mint',
    });

    const book1342All = useAnnotationStore.getState().getAnnotationsForBook(1342);
    expect(book1342All).toHaveLength(2);

    const book1342Page1 = useAnnotationStore.getState().getAnnotationsForPage(1342, 0, 1);
    expect(book1342Page1).toHaveLength(1);
    expect(book1342Page1[0].selectedText).toBe('Book 1342 P1');

    const book84All = useAnnotationStore.getState().getAnnotationsForBook(84);
    expect(book84All).toHaveLength(1);
  });

  it('syncs to Supabase when userId is provided', async () => {
    const userId = 'user-123';
    await useAnnotationStore.getState().addAnnotation(
      {
        bookId: 1342,
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'Synced quote',
        color: 'yellow',
      },
      userId
    );

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: userId,
        book_id: 1342,
        selected_text: 'Synced quote',
        color: 'yellow',
      })
    );
  });

  it('queues outbox mutation on Supabase error and flushes on reconnect', async () => {
    mockInsert.mockRejectedValueOnce(new Error('Network offline'));
    const userId = 'user-123';

    await useAnnotationStore.getState().addAnnotation(
      {
        bookId: 1342,
        chapterIndex: 0,
        chapterPage: 1,
        selectedText: 'Offline quote',
        color: 'amber',
      },
      userId
    );

    expect(useAnnotationStore.getState().outbox).toHaveLength(1);
    expect(useAnnotationStore.getState().outbox[0].type).toBe('UPSERT_ANNOTATION');

    // Network restored
    mockUpsert.mockResolvedValueOnce({ error: null });
    await useAnnotationStore.getState().flushOutbox(userId);

    expect(mockUpsert).toHaveBeenCalled();
    expect(useAnnotationStore.getState().outbox).toHaveLength(0);
  });

  it('syncWithCloud merges remote notes and uploads un-synced guest notes', async () => {
    // 1. User created a note as guest
    const guestNote = await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      chapterIndex: 1,
      chapterPage: 1,
      selectedText: 'Guest note before login',
      color: 'mint',
    });

    // 2. Remote database already has another note
    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'remote-1',
              user_id: 'user-123',
              book_id: 84,
              chapter_index: 0,
              chapter_page: 1,
              selected_text: 'Cloud note',
              color: 'rose',
              note: 'From another device',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          error: null,
        }),
      }),
    });

    // 3. User logs in -> syncWithCloud('user-123')
    await useAnnotationStore.getState().syncWithCloud('user-123');

    const merged = useAnnotationStore.getState().annotations;
    expect(merged).toHaveLength(2);
    expect(merged.some((a) => a.id === guestNote.id)).toBe(true);
    expect(merged.some((a) => a.id === 'remote-1')).toBe(true);

    // Assert that guest note was automatically uploaded to cloud!
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: guestNote.id,
          user_id: 'user-123',
          selected_text: 'Guest note before login',
        }),
      ]),
      { onConflict: 'id' }
    );
  });

  it('updates annotation note with userId and falls back to outbox on network error', async () => {
    const ann = await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Test text',
      color: 'yellow',
    });

    // Success cloud update
    await useAnnotationStore.getState().updateAnnotationNote(ann.id, 'New note', 'user-123');
    expect(mockUpdate).toHaveBeenCalled();

    // Error fallback to outbox
    mockUpdate.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockRejectedValueOnce(new Error('Network offline')),
      }),
    });
    await useAnnotationStore.getState().updateAnnotationNote(ann.id, 'Offline update', 'user-123');
    expect(useAnnotationStore.getState().outbox.some((o) => o.type === 'UPSERT_ANNOTATION')).toBe(true);
  });

  it('deletes annotation with userId and falls back to outbox on network error', async () => {
    const ann = await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'To be deleted',
      color: 'rose',
    });

    // Error fallback to outbox
    mockDelete.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockRejectedValueOnce(new Error('Delete error')),
      }),
    });

    await useAnnotationStore.getState().deleteAnnotation(ann.id, 'user-123');
    expect(useAnnotationStore.getState().annotations).toHaveLength(0);
    expect(useAnnotationStore.getState().outbox.some((o) => o.type === 'DELETE_ANNOTATION')).toBe(true);

    // Flush outbox with DELETE_ANNOTATION
    mockDelete.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({ error: null }),
      }),
    });
    await useAnnotationStore.getState().flushOutbox('user-123');
    expect(useAnnotationStore.getState().outbox).toHaveLength(0);
  });

  it('handles syncWithCloud with empty userId or network error safely', async () => {
    // Empty user ID
    await useAnnotationStore.getState().syncWithCloud('');
    expect(mockSelect).not.toHaveBeenCalled();

    // Supabase error during sync
    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockRejectedValueOnce(new Error('Supabase unreachable')),
      }),
    });
    await useAnnotationStore.getState().syncWithCloud('user-123');
    expect(useAnnotationStore.getState().isSyncing).toBe(false);
  });
});

