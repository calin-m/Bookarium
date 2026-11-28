/**
 * @module src/hooks/useHasMounted
 * @scope Hydration barrier hook (`useHasMounted`) distinguishing SSR/first-paint renders from mounted browser frames via React `useSyncExternalStore`.
 * @invariant Return `false` on every server and initial hydration snapshot (`() => false`) and switch synchronously to `true` only after client mount (`emptySubscribe` no-op subscription) without triggering cascading `useEffect` state updates.
 * @rationale Guaranteeing identical SSR and initial client HTML prevents React hydration mismatch errors across persisted Zustand stores, localStorage caches, and responsive layout hooks.
 * @adr ADR-079, ADR-081
 */

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


