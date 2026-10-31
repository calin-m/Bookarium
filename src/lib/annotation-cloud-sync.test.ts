import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setOrUpdateFellowMapEntry,
  mapRowToFellowAnnotation,
  buildFellowScholarsMap,
  toAnnotationDbRow,
  syncAnnotationMutation,
} from './annotation-cloud-sync';
import { useFellowshipStore } from '@/stores/useFellowshipStore';

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
});

