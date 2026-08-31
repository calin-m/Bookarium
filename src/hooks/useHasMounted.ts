import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/**
 * Hook to check if the component has mounted on the client.
 * Uses useSyncExternalStore with a deterministic server snapshot (() => false)
 * to guarantee identical server and initial client hydration renders.
 */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}


