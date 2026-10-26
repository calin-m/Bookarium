/**
 * Bookarium Service Worker
 * Provides offline application shell resilience, static asset caching,
 * and seamless fallback for saved IndexedDB book reading in offline mode.
 */

const CACHE_NAME = 'bookarium-app-shell-v4';

const STATIC_PRECACHE = [
  '/',
  '/account',
  '/read/1342',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
];

/**
 * Extracts Next.js static chunk, stylesheet, and font URLs referenced inside an HTML document.
 */
function extractStaticAssetUrlsFromHtml(htmlText) {
  if (!htmlText || typeof htmlText !== 'string') return [];
  const discovered = new Set();

  const directMatches = htmlText.match(/\/_next\/static\/[^"'\s<>\\]+\.(?:js|css|woff2)/g) || [];
  for (const raw of directMatches) {
    discovered.add(raw);
  }

  const flightChunkMatches = htmlText.match(/static\/chunks\/[^"'\s<>\\]+\.(?:js|css)/g) || [];
  for (const raw of flightChunkMatches) {
    discovered.add(`/_next/${raw}`);
  }

  return Array.from(discovered);
}

/**
 * Caches any uncached Next.js static assets discovered inside an HTML response.
 */
async function warmStaticAssetsFromHtmlResponse(cache, response) {
  try {
    if (!response) return;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return;

    const htmlText = await response.clone().text();
    const assetUrls = extractStaticAssetUrlsFromHtml(htmlText);
    for (const assetUrl of assetUrls) {
      try {
        const existingAsset = await cache.match(assetUrl);
        if (!existingAsset) {
          const assetResp = await fetch(assetUrl, { credentials: 'same-origin' });
          if (assetResp && assetResp.status === 200) {
            await cache.put(assetUrl, assetResp);
          }
        }
      } catch {
        // Ignore individual chunk warm failures
      }
    }
  } catch {
    // Non-blocking HTML asset extraction fallback
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        try {
          await cache.addAll(STATIC_PRECACHE);
        } catch {
          await Promise.allSettled(
            STATIC_PRECACHE.map((url) => cache.add(url))
          );
        }
        for (const htmlRoute of ['/', '/account', '/read/1342']) {
          const cachedHtml = await cache.match(htmlRoute, { ignoreSearch: true });
          if (cachedHtml) {
            await warmStaticAssetsFromHtmlResponse(cache, cachedHtml);
          }
        }
      })
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
                await cache.put(rawUrl, response.clone());
                await warmStaticAssetsFromHtmlResponse(cache, response);
              }
            } else {
              await warmStaticAssetsFromHtmlResponse(cache, existing);
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
            const warmCopy = response.clone();
            caches.open(CACHE_NAME).then(async (cache) => {
              await cache.put(request, copy);
              await warmStaticAssetsFromHtmlResponse(cache, warmCopy);
            });
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
            if (url.pathname.startsWith('/read/')) {
              const cachedReaderShell = await caches.match('/read/1342', { ignoreSearch: true });
              if (cachedReaderShell) {
                const readerCt = cachedReaderShell.headers.get('content-type') || '';
                if (readerCt.includes('text/html')) {
                  return cachedReaderShell;
                }
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
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) {
          if (isRscRequest) {
            const ct = cached.headers.get('content-type') || '';
            if (!ct.includes('text/html')) {
              return cached;
            }
            return Response.error();
          }
          return cached;
        }
        return Response.error();
      })
  );
});
