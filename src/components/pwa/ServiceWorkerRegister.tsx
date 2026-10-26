'use client';

import { useEffect } from 'react';

function collectLoadedStaticAssetUrls(): string[] {
  if (typeof document === 'undefined') return [];
  const urls = new Set<string>(['/', '/account']);

  const scripts = document.querySelectorAll<HTMLScriptElement>('script[src]');
  scripts.forEach((script) => {
    if (script.src && script.src.includes('/_next/static/')) {
      urls.add(script.src);
    }
  });

  const styles = document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]');
  styles.forEach((link) => {
    if (link.href && link.href.includes('/_next/static/')) {
      urls.add(link.href);
    }
  });

  return Array.from(urls);
}

/**
 * ServiceWorkerRegister
 * Seamlessly registers the Bookarium offline Service Worker in production
 * client environments, warms initial static JS/CSS chunks, and preloads
 * dynamic Reader/Modal bundles so offline navigation never hits ChunkLoadError.
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

    let hasRegistered = false;

    const registerSw = () => {
      if (hasRegistered) return;
      hasRegistered = true;

      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          // Warm dynamic chunks so Reader and Modals are available offline
          void Promise.allSettled([
            import('@/app/read/[id]/page'),
            import('@/components/presentation/BookPreviewModal'),
            import('@/components/presentation/DownloadDrawer'),
          ]).then(() => {
            const targetWorker =
              registration?.active ||
              registration?.waiting ||
              registration?.installing ||
              navigator.serviceWorker?.controller;
            if (targetWorker && typeof targetWorker.postMessage === 'function') {
              targetWorker.postMessage({
                type: 'CACHE_URLS',
                urls: collectLoadedStaticAssetUrls(),
              });
            }
          });
        })
        .catch(() => {
          // Non-blocking fallback if Service Worker registration fails
        });
    };

    if (typeof document !== 'undefined' && document.readyState === 'complete') {
      registerSw();
    } else {
      window.addEventListener('load', registerSw);
    }

    return () => {
      window.removeEventListener('load', registerSw);
    };
  }, []);

  return null;
}
