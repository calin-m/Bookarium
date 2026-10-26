import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAnnotationStore } from './useAnnotationStore';
import { useFellowshipStore } from './useFellowshipStore';

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
const mockProfilesIn = vi.fn().mockResolvedValue({ data: [], error: null });

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
      if (table === 'profiles') {
        return {
          select: () => ({
            in: mockProfilesIn,
          }),
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

  it('records tombstones on deleteAnnotation and prevents zombie resurrection during sync', async () => {
    const ann = await useAnnotationStore.getState().addAnnotation({
      bookId: 84,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Passage to be permanently removed',
      color: 'yellow',
    });

    expect(useAnnotationStore.getState().annotations).toHaveLength(1);
    expect(useAnnotationStore.getState().tombstones).not.toContain(ann.id);

    // Delete annotation
    await useAnnotationStore.getState().deleteAnnotation(ann.id, 'user-123');
    expect(useAnnotationStore.getState().annotations).toHaveLength(0);
    expect(useAnnotationStore.getState().tombstones).toContain(ann.id);

    // Simulate remote sync where remote returned this annotation or stale data
    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValueOnce({
          data: [
            {
              id: ann.id,
              user_id: 'user-123',
              book_id: 84,
              chapter_index: 0,
              chapter_page: 1,
              selected_text: 'Passage to be permanently removed',
              color: 'yellow',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          error: null,
        }),
      }),
    });

    await useAnnotationStore.getState().syncWithCloud('user-123');

    // Must NOT resurrect the tombstoned annotation
    expect(useAnnotationStore.getState().annotations).toHaveLength(0);
  });

  it('clamps oversized text and note payloads to prevent localStorage quota exhaustion', async () => {
    const hugeText = 'a'.repeat(8000);
    const hugeNote = 'b'.repeat(3000);

    const ann = await useAnnotationStore.getState().addAnnotation({
      bookId: 84,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: hugeText,
      color: 'amber',
      note: hugeNote,
    });

    expect(ann.selectedText.length).toBe(5000);
    expect(ann.note?.length).toBe(2000);

    // Updating note with oversized payload also clamps
    await useAnnotationStore.getState().updateAnnotationNote(ann.id, 'c'.repeat(4000));
    const updated = useAnnotationStore.getState().annotations.find((a) => a.id === ann.id);
    expect(updated?.note?.length).toBe(2000);
  });

  it('updates book metadata for annotations with missing or placeholder metadata', async () => {
    // 1. Annotation with missing metadata
    const ann1 = await useAnnotationStore.getState().addAnnotation({
      bookId: 31635,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'A silent barrier stood between them...',
      color: 'yellow',
    });

    // 2. Annotation with placeholder metadata
    const ann2 = await useAnnotationStore.getState().addAnnotation({
      bookId: 31635,
      bookTitle: 'Gutenberg Volume #31635',
      bookAuthor: 'Project Gutenberg',
      chapterIndex: 1,
      chapterPage: 2,
      selectedText: 'Another dramatic passage in the Alps...',
      color: 'mint',
    });

    // 3. Annotation for a different book with custom title/author
    const annOther = await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      bookTitle: 'Pride and Prejudice',
      bookAuthor: 'Jane Austen',
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Pride passage',
      color: 'rose',
    });

    // Heal metadata
    useAnnotationStore.getState().updateBookMetadata(
      31635,
      'The Project Gutenberg eBook of The Silent Barrier',
      'Tracy, Louis'
    );

    const storeAnnotations = useAnnotationStore.getState().annotations;
    const updated1 = storeAnnotations.find((a) => a.id === ann1.id);
    const updated2 = storeAnnotations.find((a) => a.id === ann2.id);
    const unchanged = storeAnnotations.find((a) => a.id === annOther.id);

    expect(updated1?.bookTitle).toBe('The Silent Barrier');
    expect(updated1?.bookAuthor).toBe('Louis Tracy');

    expect(updated2?.bookTitle).toBe('The Silent Barrier');
    expect(updated2?.bookAuthor).toBe('Louis Tracy');

    expect(unchanged?.bookTitle).toBe('Pride and Prejudice');
    expect(unchanged?.bookAuthor).toBe('Jane Austen');
  });

  it('ignores invalid or placeholder titles when calling updateBookMetadata', async () => {
    const ann = await useAnnotationStore.getState().addAnnotation({
      bookId: 31635,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Some passage',
      color: 'yellow',
    });

    // Placeholder title should be ignored
    useAnnotationStore.getState().updateBookMetadata(31635, 'The Project Gutenberg eBook', 'Unknown');

    const stored = useAnnotationStore.getState().annotations.find((a) => a.id === ann.id);
    expect(stored?.bookTitle).toBeUndefined();
    expect(stored?.bookAuthor).toBeUndefined();
  });

  it('flushes outbox with polymorphic dispatchers for UPSERT and DELETE actions', async () => {
    useAnnotationStore.setState({
      outbox: [
        {
          id: 'outbox-1',
          type: 'UPSERT_ANNOTATION',
          payload: {
            id: 'ann-sync-1',
            book_id: 1342,
            selected_text: 'Synced text',
            color: 'mint',
          },
          timestamp: new Date().toISOString(),
        },
        {
          id: 'outbox-2',
          type: 'DELETE_ANNOTATION',
          payload: {
            id: 'ann-del-1',
          },
          timestamp: new Date().toISOString(),
        },
      ],
    });

    await useAnnotationStore.getState().flushOutbox('user-123');

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ann-sync-1',
        book_id: 1342,
        user_id: 'user-123',
      }),
      { onConflict: 'id' }
    );

    expect(mockDelete).toHaveBeenCalled();
    expect(useAnnotationStore.getState().outbox).toHaveLength(0);
  });

  it('retains failing actions in outbox when dispatcher throws error', async () => {
    mockUpsert.mockResolvedValueOnce({ error: new Error('Network timeout') });

    useAnnotationStore.setState({
      outbox: [
        {
          id: 'outbox-fail',
          type: 'UPSERT_ANNOTATION',
          payload: { id: 'ann-fail' },
          timestamp: new Date().toISOString(),
        },
      ],
    });

    await useAnnotationStore.getState().flushOutbox('user-123');

    expect(useAnnotationStore.getState().outbox).toHaveLength(1);
    expect(useAnnotationStore.getState().outbox[0].id).toBe('outbox-fail');
  });

  it('toggles marginaliaSourceFilter and spoilerShieldEnabled and fetches fellow annotations for a book', async () => {
    useAnnotationStore.getState().setMarginaliaSourceFilter('fellows');
    expect(useAnnotationStore.getState().marginaliaSourceFilter).toBe('fellows');

    useAnnotationStore.getState().setSpoilerShieldEnabled(false);
    expect(useAnnotationStore.getState().spoilerShieldEnabled).toBe(false);

    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        neq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValueOnce({
            data: [
              {
                id: 'fellow-ann-1',
                user_id: 'fellow-user-2',
                book_id: 1342,
                chapter_index: 2,
                chapter_page: 1,
                selected_text: 'Fellow highlight quote',
                color: 'amber',
                note: 'Fellow marginalia note',
                created_at: '2026-10-15T12:00:00Z',
                updated_at: '2026-10-15T12:00:00Z',
              },
            ],
            error: null,
          }),
        }),
      }),
    });

    const fetched = await useAnnotationStore.getState().fetchFellowAnnotationsForBook(
      1342,
      'user-123',
      {
        'fellow-user-2': {
          username: 'plato',
          display_name: 'Plato of Athens',
        },
      }
    );

    expect(fetched).toHaveLength(1);
    expect(fetched[0].isFellow).toBe(true);
    expect(fetched[0].fellowUsername).toBe('plato');
    expect(fetched[0].fellowDisplayName).toBe('Plato of Athens');
    expect(useAnnotationStore.getState().getFellowAnnotationsForBook(1342)).toHaveLength(1);
  });

  it('auto-resolves fellow identity from useFellowshipStore when fellowScholarsMap is omitted and heals cached fellow_scholar entries via enrichFellowAnnotations', async () => {
    const { useFellowshipStore } = await import('@/stores/useFellowshipStore');
    useFellowshipStore.setState({
      circles: [
        {
          id: 'circle-1',
          requester_id: 'user-123',
          requester_username: 'host_reader',
          requester_display_name: 'Host Reader',
          recipient_id: 'fellow-user-99',
          recipient_username: 'hypatia_alexandria',
          recipient_display_name: 'Hypatia of Alexandria',
          status: 'accepted',
          created_at: '2026-10-15T10:00:00Z',
          updated_at: '2026-10-15T10:00:00Z',
        },
      ],
      symposiums: [
        {
          id: 'sym-1',
          book_id: 1342,
          book_title: 'Pride and Prejudice',
          host_id: 'user-123',
          host_username: 'host_reader',
          host_display_name: 'Host Reader',
          fellow_id: 'fellow-user-99',
          fellow_username: 'hypatia_alexandria',
          fellow_display_name: 'Hypatia of Alexandria',
          status: 'active',
          host_chapter: 1,
          host_progress: 25,
          fellow_chapter: 2,
          fellow_progress: 40,
          created_at: '2026-10-15T10:00:00Z',
          updated_at: '2026-10-15T10:00:00Z',
        },
      ],
    });

    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        neq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValueOnce({
            data: [
              {
                id: 'fellow-ann-auto',
                user_id: 'fellow-user-99',
                book_id: 1342,
                chapter_index: 1,
                chapter_page: 2,
                selected_text: 'Auto-resolved fellow quote',
                color: 'amber',
                note: 'Marginalia without explicit map',
                created_at: '2026-10-15T12:00:00Z',
                updated_at: '2026-10-15T12:00:00Z',
              },
            ],
            error: null,
          }),
        }),
      }),
    });

    // Call without 3rd argument (matching Reader page invocation)
    const fetched = await useAnnotationStore.getState().fetchFellowAnnotationsForBook(1342, 'user-123');
    expect(fetched).toHaveLength(1);
    expect(fetched[0].fellowUsername).toBe('hypatia_alexandria');
    expect(fetched[0].fellowDisplayName).toBe('Hypatia of Alexandria');

    // Simulate a legacy cached entry with 'fellow_scholar' and heal via enrichFellowAnnotations
    useAnnotationStore.setState({
      fellowAnnotations: [
        {
          ...fetched[0],
          fellowUsername: 'fellow_scholar',
          fellowDisplayName: undefined,
        },
      ],
    });

    useAnnotationStore.getState().enrichFellowAnnotations();
    const healed = useAnnotationStore.getState().getFellowAnnotationsForBook(1342);
    expect(healed[0].fellowUsername).toBe('hypatia_alexandria');
    expect(healed[0].fellowDisplayName).toBe('Hypatia of Alexandria');
  });

  it('covers fetchFellowAnnotationsForBook profile fallback, early return, error fallback, and enrichFellowAnnotations symposium fallback', async () => {
    const { useFellowshipStore } = await import('@/stores/useFellowshipStore');
    const { renderHook } = await import('@testing-library/react');
    const { useHydratedAnnotations } = await import('./useAnnotationStore');

    // Early return on missing userId or bookId
    expect(await useAnnotationStore.getState().fetchFellowAnnotationsForBook(1342, '')).toEqual([]);
    expect(await useAnnotationStore.getState().fetchFellowAnnotationsForBook(0, 'user-123')).toEqual([]);

    // Profile lookup fallback for unknown fellow user_id
    useFellowshipStore.getState().clearFellowshipState();
    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        neq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValueOnce({
            data: [
              {
                id: 'fellow-unknown-1',
                user_id: 'unknown-scholar-77',
                book_id: 1342,
                chapter_index: 0,
                chapter_page: 1,
                selected_text: 'Socratic wisdom',
                color: '',
                note: '',
                created_at: '2026-10-15T12:00:00Z',
                updated_at: '2026-10-15T12:00:00Z',
              },
            ],
            error: null,
          }),
        }),
      }),
    });
    mockProfilesIn.mockResolvedValueOnce({
      data: [{ id: 'unknown-scholar-77', username: 'socrates', display_name: 'Socrates of Athens' }],
      error: null,
    });

    const resolvedFromProfiles = await useAnnotationStore
      .getState()
      .fetchFellowAnnotationsForBook(1342, 'user-123');
    expect(resolvedFromProfiles[0].fellowUsername).toBe('socrates');
    expect(resolvedFromProfiles[0].fellowDisplayName).toBe('Socrates of Athens');
    expect(resolvedFromProfiles[0].color).toBe('amber');

    // Error fallback returns cached fellowAnnotations for bookId
    mockSelect.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        neq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValueOnce({
            data: null,
            error: new Error('Query failed'),
          }),
        }),
      }),
    });
    const fallbackResult = await useAnnotationStore
      .getState()
      .fetchFellowAnnotationsForBook(1342, 'user-123');
    expect(fallbackResult).toHaveLength(1);

    // enrichFellowAnnotations symposium fallback when userId is absent on cached fellowAnnotation
    useFellowshipStore.setState({
      circles: [],
      symposiums: [
        {
          id: 'sym-fallback',
          book_id: 84,
          book_title: 'Frankenstein',
          host_id: 'host-1',
          host_username: 'mary_shelley',
          host_display_name: 'Mary Shelley',
          fellow_id: 'fellow-2',
          fellow_username: 'percy_shelley',
          fellow_display_name: 'Percy Shelley',
          status: 'active',
          host_chapter: 0,
          host_progress: 10,
          fellow_chapter: 0,
          fellow_progress: 20,
          created_at: '',
          updated_at: '',
        },
      ],
    });
    useAnnotationStore.setState({
      fellowAnnotations: [
        {
          id: 'fa-no-uid',
          bookId: 84,
          chapterIndex: 0,
          chapterPage: 1,
          selectedText: 'Beware; for I am fearless',
          color: 'amber',
          createdAt: '',
          updatedAt: '',
          isFellow: true,
          fellowUsername: 'fellow_scholar',
        },
      ],
    });
    useAnnotationStore.getState().enrichFellowAnnotations();
    expect(useAnnotationStore.getState().fellowAnnotations[0].fellowUsername).toBe('percy_shelley');
    // Calling enrichFellowAnnotations again when already enriched returns state unchanged
    useAnnotationStore.getState().enrichFellowAnnotations();

    // Expanding selectedText on overlapping annotation & useHydratedAnnotations hook
    await useAnnotationStore.getState().addAnnotation({
      bookId: 84,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'fearless',
      color: 'yellow',
    });
    const expanded = await useAnnotationStore.getState().addAnnotation({
      bookId: 84,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Beware; for I am fearless, and therefore powerful.',
      color: 'yellow',
    });
    expect(expanded.selectedText).toBe('Beware; for I am fearless, and therefore powerful.');

    const { result } = renderHook(() => useHydratedAnnotations());
    expect(result.current.hasMounted).toBe(true);
    expect(result.current.annotations.length).toBeGreaterThanOrEqual(1);

    // updateBookMetadata enriches both own annotations and fellowAnnotations for the bookId
    useAnnotationStore.getState().updateBookMetadata(84, 'Frankenstein', 'Mary Wollstonecraft Shelley');
    expect(useAnnotationStore.getState().fellowAnnotations[0].bookTitle).toBe('Frankenstein');
    expect(useAnnotationStore.getState().fellowAnnotations[0].bookAuthor).toBe('Mary Wollstonecraft Shelley');
  });

  it('heals fellowAnnotations stuck on scholar or fellow_scholar via resolveStaleFellowProfiles', async () => {
    mockProfilesIn.mockResolvedValueOnce({
      data: [{ id: 'user-healed-1', username: 'plato_athens', display_name: 'Plato' }],
      error: null,
    });

    useAnnotationStore.setState({
      fellowAnnotations: [
        {
          id: 'fa-stale-1',
          userId: 'user-healed-1',
          bookId: 1342,
          chapterIndex: 0,
          chapterPage: 1,
          selectedText: 'The mind is everything.',
          color: 'amber',
          isFellow: true,
          fellowUsername: 'scholar',
          fellowDisplayName: 'Scholar',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    await useAnnotationStore.getState().resolveStaleFellowProfiles();
    const updated = useAnnotationStore.getState().fellowAnnotations[0];
    expect(updated.fellowUsername).toBe('plato_athens');
    expect(updated.fellowDisplayName).toBe('Plato');
  });

  it('buildFellowScholarsMap retains real handle when merging placeholder companion records', () => {
    useFellowshipStore.setState({
      circles: [
        {
          id: 'c1',
          requester_id: 'user-host',
          recipient_id: 'user-merge-1',
          recipient_username: 'ada_lovelace',
          recipient_display_name: 'Ada Lovelace',
          status: 'accepted',
          created_at: '',
          updated_at: '',
        } as any,
      ],
      symposiums: [
        {
          id: 's1',
          book_id: 1342,
          host_id: 'user-host',
          fellow_id: 'user-merge-1',
          fellow_username: 'scholar',
          fellow_display_name: 'Scholar',
          status: 'active',
        } as any,
      ],
    });

    useAnnotationStore.setState({
      fellowAnnotations: [
        {
          id: 'fa-1',
          userId: 'user-merge-1',
          bookId: 1342,
          chapterIndex: 0,
          chapterPage: 1,
          selectedText: 'Passage',
          color: 'amber',
          isFellow: true,
          fellowUsername: 'scholar',
          fellowDisplayName: 'Scholar',
          createdAt: '',
          updatedAt: '',
        },
      ],
    });

    useAnnotationStore.getState().enrichFellowAnnotations();
    expect(useAnnotationStore.getState().fellowAnnotations[0].fellowUsername).toBe('ada_lovelace');
    expect(useAnnotationStore.getState().fellowAnnotations[0].fellowDisplayName).toBe('Ada Lovelace');
  });

  it('fetchAllFellowAnnotations queries all fellow annotations and enriches metadata and companion profiles', async () => {
    mockSelect.mockReturnValueOnce({
      neq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'fa-all-1',
              user_id: 'user-fellow-99',
              book_id: 1342,
              chapter_index: 0,
              chapter_page: 2,
              selected_text: 'A truth universally acknowledged',
              color: 'amber',
              note: 'Opening line comment',
              created_at: '2026-10-25T12:00:00Z',
              updated_at: '2026-10-25T12:00:00Z',
            },
          ],
          error: null,
        }),
      }),
    });

    useFellowshipStore.setState({
      symposiums: [
        {
          id: 'sym-99',
          book_id: 1342,
          host_id: 'user-me',
          fellow_id: 'user-fellow-99',
          fellow_username: 'jane_austen_fan',
          fellow_display_name: 'Janeite',
          status: 'active',
        } as any,
      ],
    });

    const results = await useAnnotationStore.getState().fetchAllFellowAnnotations('user-me');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('fa-all-1');
    expect(results[0].fellowUsername).toBe('jane_austen_fan');
    expect(results[0].fellowDisplayName).toBe('Janeite');
    expect(useAnnotationStore.getState().fellowAnnotations).toHaveLength(1);
  });

  it('fetchAllFellowAnnotations returns empty array when currentUserId is not provided', async () => {
    const results = await useAnnotationStore.getState().fetchAllFellowAnnotations();
    expect(results).toEqual([]);
  });

  it('fetchAllFellowAnnotations handles supabase errors gracefully', async () => {
    mockSelect.mockReturnValueOnce({
      neq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Simulated fetch failure'),
        }),
      }),
    });

    const results = await useAnnotationStore.getState().fetchAllFellowAnnotations('user-me');
    expect(results).toEqual([]);
  });

  it('fetchAllFellowAnnotations resolves companion identity when current user is fellow and preserves metadata', async () => {
    mockSelect.mockReturnValueOnce({
      neq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'fa-host-1',
              user_id: 'host-user-88',
              book_id: 84,
              chapter_index: 2,
              chapter_page: 5,
              selected_text: 'It was on a dreary night of November',
              color: 'mint',
              note: null,
              created_at: '2026-10-25T14:00:00Z',
              updated_at: '2026-10-25T14:00:00Z',
            },
          ],
          error: null,
        }),
      }),
    });

    useFellowshipStore.setState({
      symposiums: [
        {
          id: 'symp-host-active',
          book_id: 84,
          host_id: 'host-user-88',
          host_username: 'mary_s',
          host_display_name: 'Mary Shelley Fan',
          fellow_id: 'user-me',
          fellow_username: 'me',
          fellow_display_name: 'Me',
          status: 'active',
        } as any,
      ],
    });

    useAnnotationStore.setState({
      annotations: [
        {
          id: 'own-frank',
          bookId: 84,
          bookTitle: 'Frankenstein',
          bookAuthor: 'Mary Wollstonecraft Shelley',
          chapterIndex: 0,
          chapterPage: 1,
          selectedText: 'Preamble',
          color: 'yellow',
          createdAt: '2026-10-25T10:00:00Z',
          updatedAt: '2026-10-25T10:00:00Z',
        },
      ],
    });

    const results = await useAnnotationStore.getState().fetchAllFellowAnnotations('user-me');
    expect(results).toHaveLength(1);
    expect(results[0].fellowUsername).toBe('mary_s');
    expect(results[0].fellowDisplayName).toBe('Mary Shelley Fan');
    expect(results[0].bookTitle).toBe('Frankenstein');
    expect(results[0].bookAuthor).toBe('Mary Wollstonecraft Shelley');
  });

  it('fetchAllFellowAnnotations falls back to profiles table for missing companion handles', async () => {
    mockSelect.mockReturnValueOnce({
      neq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'fa-missing-prof',
              user_id: 'user-remote-44',
              book_id: 1342,
              chapter_index: 1,
              chapter_page: 3,
              selected_text: 'Text without known companion',
              color: 'rose',
              note: null,
              created_at: '2026-10-25T12:00:00Z',
              updated_at: '2026-10-25T12:00:00Z',
            },
          ],
          error: null,
        }),
      }),
    });

    mockProfilesIn.mockResolvedValueOnce({
      data: [{ id: 'user-remote-44', username: 'resolved_scholar', display_name: null }],
      error: null,
    });

    useFellowshipStore.setState({ symposiums: [] });

    const results = await useAnnotationStore.getState().fetchAllFellowAnnotations('user-me');
    expect(results).toHaveLength(1);
    expect(results[0].fellowUsername).toBe('resolved_scholar');
  });

  it('addAnnotation persists expanded selected_text to supabase when new highlight covers a wider range', async () => {
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    await useAnnotationStore.getState().addAnnotation(
      {
        bookId: 1342,
        chapterIndex: 3,
        chapterPage: 1,
        selectedText: 'Brief text',
        color: 'yellow',
      },
      'user-me'
    );

    const expanded = await useAnnotationStore.getState().addAnnotation(
      {
        bookId: 1342,
        chapterIndex: 3,
        chapterPage: 1,
        selectedText: 'Brief text expanded to include the whole sentence.',
        color: 'yellow',
      },
      'user-me'
    );

    expect(expanded.selectedText).toBe('Brief text expanded to include the whole sentence.');
  });

  it('addAnnotation enforces chapterIndex isolation for identical text phrases in different chapters', async () => {
    const annChap0 = await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      chapterIndex: 0,
      chapterPage: 1,
      selectedText: 'Indeed.',
      color: 'yellow',
    });

    const annChap1 = await useAnnotationStore.getState().addAnnotation({
      bookId: 1342,
      chapterIndex: 1,
      chapterPage: 1,
      selectedText: 'Indeed.',
      color: 'yellow',
    });

    expect(annChap0.id).not.toBe(annChap1.id);
    expect(useAnnotationStore.getState().annotations.filter((a) => a.selectedText === 'Indeed.')).toHaveLength(2);
  });

  it('covers setOrUpdateFellowMapEntry placeholder upgrade, enrichFellowAnnotations host matching, cached fellow bookMeta, and addAnnotation expand outbox fallback', async () => {
    const { buildFellowScholarsMap } = await import('./useAnnotationStore');
    const { useFellowshipStore } = await import('@/stores/useFellowshipStore');

    // 1. Circle has placeholder first, Symposium upgrades to real handle; explicitMap has placeholder
    useFellowshipStore.setState({
      circles: [
        {
          id: 'c-placeholder',
          requester_id: 'u-upgrade',
          requester_username: 'scholar',
          requester_display_name: 'Scholar',
          recipient_id: 'u-other',
          recipient_username: 'real_recipient',
          recipient_display_name: null,
          status: 'accepted',
          created_at: '',
          updated_at: '',
        } as any,
      ],
      symposiums: [
        {
          id: 's-upgrade',
          book_id: 99,
          host_id: 'u-upgrade',
          host_username: 'virgil_poet',
          host_display_name: 'Publius Vergilius Maro',
          fellow_id: 'u-other',
          fellow_username: 'real_recipient',
          fellow_display_name: 'Real Recipient Name',
          status: 'completed',
        } as any,
      ],
    });

    const map = buildFellowScholarsMap({
      'u-upgrade': { username: 'fellow_scholar', display_name: 'Scholar' },
      'u-other': { username: 'real_recipient', display_name: null },
    });
    expect(map['u-upgrade'].username).toBe('virgil_poet');
    expect(map['u-upgrade'].display_name).toBe('Publius Vergilius Maro');
    expect(map['u-other'].display_name).toBe('Real Recipient Name');

    // 2. enrichFellowAnnotations when fellow is host_id (isFellowTheHost = true) & cached fellow bookMeta in fetchAllFellowAnnotations
    useFellowshipStore.setState({
      circles: [],
      symposiums: [
        {
          id: 's-host-match',
          book_id: 500,
          host_id: 'host-500',
          host_username: 'dante_alighieri',
          host_display_name: 'Dante',
          fellow_id: 'me-500',
          fellow_username: 'beatrice',
          fellow_display_name: 'Beatrice',
          status: 'completed',
        } as any,
      ],
    });

    useAnnotationStore.setState({
      annotations: [],
      fellowAnnotations: [
        {
          id: 'fa-500',
          userId: 'host-500',
          bookId: 500,
          bookTitle: 'The Divine Comedy',
          bookAuthor: 'Dante Alighieri',
          chapterIndex: 0,
          chapterPage: 1,
          selectedText: 'Midway upon the journey of our life',
          color: 'amber',
          isFellow: true,
          fellowUsername: 'dante_alighieri',
          fellowDisplayName: undefined,
          createdAt: '',
          updatedAt: '',
        },
      ],
    });

    // Enriches missing fellowDisplayName even when fellowUsername already matches, plus !fa.userId fallback
    useAnnotationStore.setState({
      annotations: [],
      fellowAnnotations: [
        {
          id: 'fa-500',
          userId: 'host-500',
          bookId: 500,
          bookTitle: 'The Divine Comedy',
          bookAuthor: 'Dante Alighieri',
          chapterIndex: 0,
          chapterPage: 1,
          selectedText: 'Midway upon the journey of our life',
          color: 'amber',
          isFellow: true,
          fellowUsername: 'dante_alighieri',
          fellowDisplayName: undefined,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'fa-500-no-uid',
          userId: undefined,
          bookId: 500,
          chapterIndex: 0,
          chapterPage: 2,
          selectedText: 'Legacy fellow annotation without userId',
          color: 'mint',
          isFellow: true,
          fellowUsername: 'fellow_scholar',
          fellowDisplayName: undefined,
          createdAt: '',
          updatedAt: '',
        },
      ],
    });

    useAnnotationStore.getState().enrichFellowAnnotations({});
    expect(useAnnotationStore.getState().fellowAnnotations[0].fellowDisplayName).toBe('Dante');
    expect(useAnnotationStore.getState().fellowAnnotations[1].fellowUsername).toBe('beatrice');
    expect(useAnnotationStore.getState().fellowAnnotations[1].fellowDisplayName).toBe('Beatrice');

    // Guard checks on updateBookMetadata
    useAnnotationStore.getState().updateBookMetadata(0, 'Valid Title', 'Valid Author');
    useAnnotationStore.getState().updateBookMetadata(500, 'Gutenberg Volume #500', 'Anonymous');
    useAnnotationStore.getState().updateBookMetadata(500, 'The Divine Comedy', 'by Dante Alighieri');
    expect(useAnnotationStore.getState().fellowAnnotations[1].bookTitle).toBe('The Divine Comedy');
    expect(useAnnotationStore.getState().fellowAnnotations[1].bookAuthor).toBe('Dante Alighieri');

    // 3. fetchAllFellowAnnotations inherits bookTitle/bookAuthor from existing fellowAnnotations and handles profiles query rejection
    mockSelect.mockReturnValueOnce({
      neq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValueOnce({
          data: [
            {
              id: 'fa-500-remote',
              user_id: 'unknown-500',
              book_id: 500,
              chapter_index: 1,
              chapter_page: 2,
              selected_text: 'Abandon all hope',
              color: 'rose',
              note: 'Inferno',
              created_at: '2026-10-25T12:00:00Z',
              updated_at: '2026-10-25T12:00:00Z',
            },
          ],
          error: null,
        }),
      }),
    });
    mockProfilesIn.mockRejectedValueOnce(new Error('Profiles offline'));

    const allFetched = await useAnnotationStore.getState().fetchAllFellowAnnotations('me-500');
    expect(allFetched[0].bookTitle).toBe('The Divine Comedy');
    expect(allFetched[0].bookAuthor).toBe('Dante Alighieri');
    expect(allFetched[0].fellowUsername).toBe('fellow_scholar');

    // 4. addAnnotation queues UPSERT_ANNOTATION when expanding selectedText fails in Supabase
    await useAnnotationStore.getState().addAnnotation({
      bookId: 500,
      chapterIndex: 2,
      chapterPage: 1,
      selectedText: 'Short span',
      color: 'yellow',
    });
    mockUpdate.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValueOnce({ error: new Error('Offline update error') }),
      }),
    });
    await useAnnotationStore.getState().addAnnotation(
      {
        bookId: 500,
        chapterIndex: 2,
        chapterPage: 1,
        selectedText: 'Short span expanded while offline',
        color: 'mint',
        note: 'Added note on expand',
      },
      'me-500'
    );
    expect(useAnnotationStore.getState().outbox.some((o) => o.type === 'UPSERT_ANNOTATION')).toBe(true);
  });
});


