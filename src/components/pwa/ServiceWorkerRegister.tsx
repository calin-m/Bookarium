'use client';

import { useEffect } from 'react';

/**
 * ServiceWorkerRegister
 * Seamlessly registers the Bookarium offline Service Worker in production
 * client environments to enable app shell caching and offline reading.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      process.env.NODE_ENV !== 'production'
    ) {
      return;
    }

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(() => {
          // Non-blocking fallback if Service Worker registration fails
        });
    };

    window.addEventListener('load', onLoad);
    return () => {
      window.removeEventListener('load', onLoad);
    };
  }, []);

  return null;
}
