'use client';

/**
 * @module
 * @scope Hydration-safe React connectivity hook (`useNetworkStatus`) tracking browser `online` and `offline` events.
 * @invariant Use `useSyncExternalStore` returning a constant `true` from `getServerNetworkSnapshot` so SSR markup and initial client hydration never diverge.
 * @rationale Prevents React hydration mismatch warnings while keeping navbar indicators, catalog fallbacks, and offline guards reactive to browser connectivity changes.
 * @adr ADR-069
 */

import { useSyncExternalStore } from 'react';

function subscribeNetworkStatus(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getNetworkSnapshot(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

function getServerNetworkSnapshot(): boolean {
  return true;
}

export interface NetworkStatus {
  isOnline: boolean;
  isOffline: boolean;
}

/**
 * Reactive, SSR-safe hook tracking browser online/offline connectivity state.
 */
export function useNetworkStatus(): NetworkStatus {
  const isOnline = useSyncExternalStore(
    subscribeNetworkStatus,
    getNetworkSnapshot,
    getServerNetworkSnapshot
  );

  return {
    isOnline,
    isOffline: !isOnline,
  };
}
