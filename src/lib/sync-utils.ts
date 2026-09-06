import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useAnnotationStore } from '@/stores/useAnnotationStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { useHabitsStore } from '@/stores/useHabitsStore';

/**
 * Common syncable store contract.
 */
export interface CloudSyncable {
  syncWithCloud: (userId: string) => Promise<void>;
}

/**
 * Concurrently triggers cloud synchronization across all user data stores.
 * Uses Promise.allSettled to guarantee that failure or network error in one store
 * does not block or abort synchronization in other stores.
 */
export async function syncAllStoresWithCloud(userId: string): Promise<void> {
  if (!userId) return;

  await Promise.allSettled([
    useBookshelfStore.getState().syncWithCloud(userId),
    useAnnotationStore.getState().syncWithCloud(userId),
    useReaderStore.getState().syncWithCloud(userId),
    useHabitsStore.getState().syncWithCloud(userId),
  ]);
}

