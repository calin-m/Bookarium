/**
 * Bookarium Service Worker
 * Provides offline application shell resilience, static asset caching,
 * and seamless fallback for saved IndexedDB book reading in offline mode.
 */

const CACHE_NAME = 'bookarium-app-shell-v3';

const STATIC_PRECACHE = [
  '/',
  '/account',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => {
        // Non-blocking install fallback
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'CACHE_URLS' || !Array.isArray(data.urls)) {
    return;
  }

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        for (const rawUrl of data.urls) {
          try {
            const existing = await cache.match(rawUrl);
            if (!existing) {
              const response = await fetch(rawUrl, { credentials: 'same-origin' });
              if (response && response.status === 200) {
                await cache.put(rawUrl, response);
              }
            }
          } catch {
            // Ignore individual asset warm failures
          }
        }
      })
      .catch(() => {})
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle HTTP/HTTPS GET requests
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  const url = new URL(request.url);

  // Ignore cross-origin requests (e.g., Supabase REST/Auth APIs, external CDNs)
  if (url.origin !== self.location.origin) {
    return;
  }

  // 1. Dynamic API routes: Network-only with graceful offline fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({
            error: 'Network unavailable. Stored offline data remains accessible in local storage.',
            offline: true,
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
    );
    return;
  }

  // 2. Navigation requests: Network-first, fallback to cached document or App Shell ('/')
  if (request.mode === 'navigate') {
    const isPrivateAuthRoute = url.pathname.startsWith('/auth/');

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && !isPrivateAuthRoute) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          if (!isPrivateAuthRoute) {
            const cached = await caches.match(request);
            if (cached) return cached;
            const cachedWithoutSearch = await caches.match(url.pathname, { ignoreSearch: true });
            if (cachedWithoutSearch) {
              const contentType = cachedWithoutSearch.headers.get('content-type') || '';
              if (contentType.includes('text/html')) {
                return cachedWithoutSearch;
              }
            }
          }
          const shell = await caches.match('/');
          return shell || Response.error();
        })
    );
    return;
  }

  // 3. Static Next.js chunks, fonts, and assets: Cache-first with network populate
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => Response.error());
      })
    );
    return;
  }

  // 4. Default (including Next.js RSC Flight requests): Network-first with exact cache match fallback
  // Never substitute text/html documents for RSC Flight requests (_rsc / RSC: 1)
  const isRscRequest = url.searchParams.has('_rsc') || request.headers.get('RSC') === '1';

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) {
        if (isRscRequest) {
          const ct = cached.headers.get('content-type') || '';
          if (!ct.includes('text/html')) {
            return cached;
          }
        } else {
          return cached;
        }
      }

      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          if (cached && !isRscRequest) return cached;
          return Response.error();
        });
    })
  );
});
