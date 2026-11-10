import type { StateStorage } from 'zustand/middleware';

/**
 * Universal SSR-safe storage adapter for Zustand `persist` middleware.
 *
 * Why this exists:
 * 1. Node.js / Next.js Server-Side Rendering:
 *    On Node 22+ (Vercel deployment runtime), referencing the bare `localStorage` identifier
 *    emits `(node) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided`.
 *    Furthermore, calling `store.setState(...)` during SSR (e.g. `initializeTheme(initialTheme)`) causes
 *    Zustand's default `createJSONStorage(() => localStorage)` to throw:
 *    `TypeError: Cannot read properties of undefined (reading 'setItem')`.
 * 2. Storage Quota & Private Browsing Resilience:
 *    In restricted browser environments (e.g. Safari Private Browsing or disabled cookies/storage),
 *    invoking `localStorage.setItem` can throw `QuotaExceededError` or `SecurityError`.
 *
 * Behavior:
 * - On the server (`typeof window === 'undefined'`), `getItem` returns `null` and `setItem` / `removeItem`
 *   are safe no-ops, allowing the server to update store state in memory without crashing or emitting Node warnings.
 * - In the browser (`typeof window !== 'undefined'`), operations delegate directly to `window.localStorage`
 *   with graceful try/catch error boundaries.
 */
export const safeLocalStorage: StateStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Graceful degradation when storage quota is exceeded or storage is disabled
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Graceful degradation
    }
  },
};
