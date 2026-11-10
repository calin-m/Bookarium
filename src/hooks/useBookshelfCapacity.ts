'use client';

import { useSyncExternalStore } from 'react';
import { calculateShelfCapacity } from '@/components/presentation/BookshelfRack';

function subscribeWindowResize(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('resize', callback, { passive: true });
  return () => window.removeEventListener('resize', callback);
}

function getShelfCapacitySnapshot(): number {
  if (typeof window === 'undefined') return 18;
  return calculateShelfCapacity(window.innerWidth);
}

function getServerShelfCapacitySnapshot(): number {
  // Desktop standard container capacity default (1280px container bounds -> 18 books)
  return 18;
}

/**
 * Hydration-safe hook that tracks physical bookshelf spine capacity based on viewport width.
 * Used to dynamically couple Bookshelf page sizes (2 shelves x capacity) and shelf row limits.
 */
export function useBookshelfCapacity(): number {
  return useSyncExternalStore(
    subscribeWindowResize,
    getShelfCapacitySnapshot,
    getServerShelfCapacitySnapshot
  );
}
