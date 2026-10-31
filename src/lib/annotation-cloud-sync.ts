import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.types';
import { useFellowshipStore } from '@/stores/useFellowshipStore';
import {
  isPlaceholderUsername,
  fetchScholarProfilesMap,
} from '@/lib/fellowship-cloud-sync';

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

export function setOrUpdateFellowMapEntry(
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
    !existingIsPlaceholder && nextIsPlaceholder ? existing.username : username;
  const displayNameIsPlaceholder =
    !displayName || isPlaceholderUsername(displayName);
  const existingDisplayNameIsPlaceholder =
    !existing.display_name || isPlaceholderUsername(existing.display_name);

  const resolvedDisplayName = !displayNameIsPlaceholder
    ? displayName
    : !existingDisplayNameIsPlaceholder
    ? existing.display_name
    : displayName || existing.display_name;

  map[userId] = {
    username: resolvedUsername,
    display_name: resolvedDisplayName || undefined,
  };
}

export function mapRowToFellowAnnotation(
  row: Record<string, unknown>,
  resolvedMap: Record<string, { username: string; display_name?: string | null }>,
  cachedMeta?: { title?: string; author?: string }
): FellowAnnotation {
  const fellowUserId = String(row.user_id);
  const fellowInfo = resolvedMap[fellowUserId];
  return {
    id: String(row.id),
    userId: fellowUserId,
    bookId: Number(row.book_id),
    bookTitle: cachedMeta?.title,
    bookAuthor: cachedMeta?.author,
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

  for (const circle of fellowshipState.circles) {
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

  for (const sym of fellowshipState.symposiums) {
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

export type AnnotationOutboxDispatcher = (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  payload: Record<string, unknown>
) => PromiseLike<{ error: unknown }>;

export async function resolveFellowIdentityMap(
  rows: Record<string, unknown>[],
  currentUserId: string,
  fellowScholarsMap: Record<string, { username: string; display_name?: string | null }> | undefined,
  supabase: ReturnType<typeof createClient>
): Promise<Record<string, { username: string; display_name?: string | null }>> {
  const resolvedMap = buildFellowScholarsMap(fellowScholarsMap);

  const missingIds = Array.from(
    new Set(
      rows
        .map((r) => String(r.user_id || ''))
        .filter(
          (uid) =>
            uid &&
            uid !== currentUserId &&
            (!resolvedMap[uid]?.username ||
              isPlaceholderUsername(resolvedMap[uid]?.username))
        )
    )
  );

  if (missingIds.length > 0) {
    const profileMap = await fetchScholarProfilesMap(supabase, missingIds);
    for (const [id, prof] of profileMap.entries()) {
      if (prof.username || prof.display_name) {
        resolvedMap[id] = {
          username: prof.username || prof.display_name || 'fellow_scholar',
          display_name: prof.display_name || undefined,
        };
      }
    }
  }

  return resolvedMap;
}

export const ANNOTATION_OUTBOX_DISPATCHERS: Record<
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

export function toAnnotationDbRow(a: Annotation, userId: string) {
  return {
    id: a.id,
    user_id: userId,
    book_id: a.bookId,
    chapter_index: a.chapterIndex,
    chapter_page: a.chapterPage,
    selected_text: a.selectedText,
    color: a.color,
    note: a.note ?? null,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
  };
}

export async function syncAnnotationMutation(
  target: Annotation,
  userId: string,
  mutateCloud: (
    supabase: ReturnType<typeof createClient>,
    dbPayload: ReturnType<typeof toAnnotationDbRow>
  ) => PromiseLike<{ error: unknown }>,
  queueOutboxAction: (action: Omit<AnnotationOutboxAction, 'id' | 'timestamp'>) => void
) {
  const dbPayload = toAnnotationDbRow(target, userId);
  try {
    const supabase = createClient();
    const { error } = await mutateCloud(supabase, dbPayload);
    if (error) throw error;
  } catch {
    queueOutboxAction({
      type: 'UPSERT_ANNOTATION',
      payload: dbPayload,
    });
  }
}

