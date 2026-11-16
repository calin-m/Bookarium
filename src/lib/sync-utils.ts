/**
 * @module src/lib/sync-utils
 * @scope Cross-store Supabase cloud synchronization coordinator and session-validity re-export hub.
 * @invariant Reject empty `userId` and coalesce overlapping sync calls per `userId` via `coalesceInFlightByUser` so concurrent mount/focus events share one Promise identity (`p1 === p2`).
 * @invariant Verify an active authenticated cookie/session via `verifyActiveCloudSession` before dispatching PostgREST queries across the 7 syncable stores, executing all stores under `Promise.allSettled` for partial-failure isolation.
 * @rationale Without pre-sync token verification, stale tabs whose `sb-*-auth-token` cookies were cleared emit bursts of PostgreSQL `42501` RLS write violations and overwrite state with false empty `SELECT` arrays.
 * @adr ADR-005, ADR-035, ADR-069, ADR-080
 */

import { createClient } from '@/lib/supabase/client';
import {
  useAuthStore,
  coalesceInFlightByUser,
  hasSupabaseAuthCookie,
  shouldVerifyCloudSession,
  verifyActiveCloudSession,
  type SessionVerifiableClient,
} from '@/stores/useAuthStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useAnnotationStore } from '@/stores/useAnnotationStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { useHabitsStore } from '@/stores/useHabitsStore';
import { useAccoladesStore } from '@/stores/useAccoladesStore';
import { useFellowshipStore } from '@/stores/useFellowshipStore';

export {
  coalesceInFlightByUser,
  hasSupabaseAuthCookie,
  shouldVerifyCloudSession,
  verifyActiveCloudSession,
  type SessionVerifiableClient,
};

const inFlightSyncByUser = new Map<string, Promise<void>>();

/**
 * Common syncable store contract.
 */
export interface CloudSyncable {
  syncWithCloud: (userId: string) => Promise<void>;
}

/**
 * Concurrently triggers cloud synchronization across all user data stores,
 * coalescing overlapping calls per `userId` into a single active flight.
 * Verifies an active authenticated session token first to prevent unauthenticated
 * `SELECT` (`data: []`) or `42501` RLS errors after browser cookie clearance.
 * Uses Promise.allSettled to guarantee that failure or network error in one store
 * does not block or abort synchronization in other stores.
 *
 * @scope Fans out unified 7-store cloud synchronization for a verified `userId`.
 * @invariant Must execute `verifyActiveCloudSession` inside the coalesced per-user flight before calling `syncWithCloud` / `fetchFellowshipData`.
 */
export function syncAllStoresWithCloud(userId: string): Promise<void> {
  if (!userId) return Promise.resolve();

  return coalesceInFlightByUser(inFlightSyncByUser, userId, async () => {
    if (!(await verifyActiveCloudSession(createClient(), userId))) return;

    await Promise.allSettled([
      useAuthStore.getState().syncWithCloud(userId),
      useBookshelfStore.getState().syncWithCloud(userId),
      useAnnotationStore.getState().syncWithCloud(userId),
      useReaderStore.getState().syncWithCloud(userId),
      useHabitsStore.getState().syncWithCloud(userId),
      useAccoladesStore.getState().syncWithCloud(userId),
      useFellowshipStore.getState().fetchFellowshipData(userId),
    ]);
  });
}

