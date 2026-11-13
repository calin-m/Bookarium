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

