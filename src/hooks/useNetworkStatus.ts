'use client';

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
