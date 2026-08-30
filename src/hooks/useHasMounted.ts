'use client';

import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/**
 * Hook to check if the component has mounted on the client using useSyncExternalStore.
 * Guarantees zero SSR hydration mismatch and zero cascading render warnings in React 19.
 */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

