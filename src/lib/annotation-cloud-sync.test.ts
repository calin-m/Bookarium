import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setOrUpdateFellowMapEntry,
  mapRowToFellowAnnotation,
  buildFellowScholarsMap,
  toAnnotationDbRow,
  syncAnnotationMutation,
  ANNOTATION_OUTBOX_DISPATCHERS,
  resolveFellowIdentityMap,
  generateValidAnnotationUuid,
} from './annotation-cloud-sync';
import { useFellowshipStore } from '@/stores/useFellowshipStore';
import type { createClient } from '@/lib/supabase/client';

describe('annotation-cloud-sync', () => {
  beforeEach(() => {
    useFellowshipStore.getState().clearFellowshipState();
  });

  it('retains real scholar handles over placeholder handles in setOrUpdateFellowMapEntry and buildFellowScholarsMap', () => {
    const map: Record<string, { username: string; display_name?: string | null }> = {};
    setOrUpdateFellowMapEntry(map, 'u1', 'jane_austen', 'Jane Austen');
    setOrUpdateFellowMapEntry(map, 'u1', 'scholar', null);
    expect(map.u1).toEqual({ username: 'jane_austen', display_name: 'Jane Austen' });

    useFellowshipStore.setState({
      circles: [
        {
          id: 'c1',
          requester_id: 'u1',
          requester_username: 'jane_austen',
          requester_display_name: 'Jane Austen',
          recipient_id: 'u2',
          recipient_username: 'melville',
          recipient_display_name: 'Herman Melville',
          status: 'accepted',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });

    const built = buildFellowScholarsMap({ u3: { username: 'dostoevsky', display_name: 'Fyodor' } });
    expect(built.u1.username).toBe('jane_austen');
    expect(built.u2.username).toBe('melville');
    expect(built.u3.username).toBe('dostoevsky');
  });

  it('maps database rows to FellowAnnotation and converts Annotation to db row payload', async () => {
    const fellowAnn = mapRowToFellowAnnotation(
      {
        id: 'ann-1',
        user_id: 'u2',
        book_id: 1342,
        chapter_index: 1,
        chapter_page: 2,
        selected_text: 'Universally acknowledged',
        color: 'mint',
        note: 'Great line',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      { u2: { username: 'melville', display_name: 'Herman Melville' } },
      { title: 'Pride and Prejudice', author: 'Jane Austen' }
    );
    expect(fellowAnn.isFellow).toBe(true);
    expect(fellowAnn.fellowUsername).toBe('melville');
    expect(fellowAnn.fellowDisplayName).toBe('Herman Melville');
    expect(fellowAnn.bookTitle).toBe('Pride and Prejudice');

    const dbRow = toAnnotationDbRow(fellowAnn, 'u1');
    expect(dbRow.book_id).toBe(1342);
    expect(dbRow.user_id).toBe('u1');

    const queueOutboxAction = vi.fn();
    await syncAnnotationMutation(
      fellowAnn,
      'u1',
      async () => ({ error: new Error('Offline') }),
      queueOutboxAction
    );
    expect(queueOutboxAction).toHaveBeenCalledWith({
      type: 'UPSERT_ANNOTATION',
      payload: dbRow,
    });
  });

  it('dispatches DELETE_ANNOTATION and UPSERT_ANNOTATION with exact Supabase table, column, and conflict arguments', async () => {
    const innerDeleteEq = vi.fn().mockResolvedValue({ error: null });
    const outerDeleteEq = vi.fn(() => ({ eq: innerDeleteEq }));
    const deleteMock = vi.fn(() => ({ eq: outerDeleteEq }));
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn(() => ({
      delete: deleteMock,
      upsert: upsertMock,
    }));
    const mockSupabase = { from: fromMock } as unknown as ReturnType<typeof createClient>;

    await ANNOTATION_OUTBOX_DISPATCHERS.DELETE_ANNOTATION(mockSupabase, 'u-scholar-1', {
      id: 'ann-del-99',
    });
    expect(fromMock).toHaveBeenCalledWith('user_annotations');
    expect(deleteMock).toHaveBeenCalled();
    expect(outerDeleteEq).toHaveBeenCalledWith('id', 'ann-del-99');
    expect(innerDeleteEq).toHaveBeenCalledWith('user_id', 'u-scholar-1');

    await ANNOTATION_OUTBOX_DISPATCHERS.UPSERT_ANNOTATION(mockSupabase, 'u-scholar-1', {
      id: 'ann-up-42',
      book_id: 84,
      selected_text: 'Beware; for I am fearless, and therefore powerful.',
    });
    expect(upsertMock).toHaveBeenCalledWith(
      {
        id: 'ann-up-42',
        book_id: 84,
        selected_text: 'Beware; for I am fearless, and therefore powerful.',
        user_id: 'u-scholar-1',
      },
      { onConflict: 'id' }
    );
  });

  it('resolves missing and placeholder fellow scholar profiles via Supabase while skipping currentUserId and known handles', async () => {
    const inMock = vi.fn().mockResolvedValue({
      data: [
        { id: 'u-missing', username: 'mary_shelley', display_name: 'Mary Shelley' },
        { id: 'u-placeholder', username: 'lord_byron', display_name: 'Lord Byron' },
      ],
      error: null,
    });
    const selectMock = vi.fn(() => ({ in: inMock }));
    const fromMock = vi.fn(() => ({ select: selectMock }));
    const mockSupabase = { from: fromMock } as unknown as ReturnType<typeof createClient>;

    const resolved = await resolveFellowIdentityMap(
      [
        { user_id: 'u-current' },
        { user_id: 'u-known' },
        { user_id: 'u-missing' },
        { user_id: 'u-placeholder' },
      ],
      'u-current',
      {
        'u-known': { username: 'jane_austen', display_name: 'Jane Austen' },
        'u-placeholder': { username: 'fellow_scholar', display_name: null },
      },
      mockSupabase
    );

    expect(fromMock).toHaveBeenCalledWith('profiles');
    expect(selectMock).toHaveBeenCalledWith('id, username, display_name');
    expect(inMock).toHaveBeenCalledWith('id', ['u-missing', 'u-placeholder']);
    expect(resolved['u-known']).toEqual({
      username: 'jane_austen',
      display_name: 'Jane Austen',
    });
    expect(resolved['u-missing']).toEqual({
      username: 'mary_shelley',
      display_name: 'Mary Shelley',
    });
    expect(resolved['u-placeholder']).toEqual({
      username: 'lord_byron',
      display_name: 'Lord Byron',
    });
  });

  describe('generateValidAnnotationUuid', () => {
    const RFC4122_V4_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    it('generates valid RFC 4122 v4 UUID with native crypto.randomUUID', () => {
      const id = generateValidAnnotationUuid();
      expect(id).toMatch(RFC4122_V4_REGEX);
    });

    it('generates valid RFC 4122 v4 UUID when crypto.randomUUID is unavailable using getRandomValues', () => {
      const originalRandomUUID = crypto.randomUUID;
      try {
        // @ts-expect-error test fallback override
        delete crypto.randomUUID;
        const fallbackId = generateValidAnnotationUuid();
        expect(fallbackId).toMatch(RFC4122_V4_REGEX);
      } finally {
        crypto.randomUUID = originalRandomUUID;
      }
    });

    it('generates valid RFC 4122 v4 UUID when global crypto is completely unavailable', () => {
      const originalCrypto = globalThis.crypto;
      try {
        // @ts-expect-error test pure math PRNG fallback
        delete globalThis.crypto;
        const mathFallbackId = generateValidAnnotationUuid();
        expect(mathFallbackId).toMatch(RFC4122_V4_REGEX);
      } finally {
        globalThis.crypto = originalCrypto;
      }
    });
  });
});

