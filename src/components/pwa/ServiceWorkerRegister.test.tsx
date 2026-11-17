import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { ServiceWorkerRegister } from './ServiceWorkerRegister';

vi.mock('@/app/read/[id]/page', () => ({ default: () => null }));
vi.mock('@/app/account/page', () => ({ default: () => null }));
vi.mock('@/components/presentation/BookPreviewModal', () => ({ BookPreviewModal: () => null }));
vi.mock('@/components/presentation/DownloadDrawer', () => ({ DownloadDrawer: () => null }));

describe('ServiceWorkerRegister', () => {
  const originalNavigator = global.navigator;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it('renders null without throwing', () => {
    const { container } = render(<ServiceWorkerRegister />);
    expect(container.firstChild).toBeNull();
  });

  it('attempts registration immediately in production when document.readyState is complete and posts CACHE_URLS', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const postMessageMock = vi.fn();
    const updateMock = vi.fn().mockResolvedValue(undefined);
    const registerMock = vi.fn().mockResolvedValue({
      active: { postMessage: postMessageMock },
      update: updateMock,
    } as unknown as ServiceWorkerRegistration);

    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        serviceWorker: {
          register: registerMock,
        },
      },
      configurable: true,
      writable: true,
    });

    const scriptEl = document.createElement('script');
    scriptEl.src = '/_next/static/chunks/main.js';
    const linkEl = document.createElement('link');
    linkEl.rel = 'stylesheet';
    linkEl.href = '/_next/static/css/app.css';
    document.head.appendChild(scriptEl);
    document.head.appendChild(linkEl);

    const { unmount } = render(<ServiceWorkerRegister />);

    expect(registerMock).toHaveBeenCalledWith('/sw.js', { scope: '/' });

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled();
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CACHE_URLS',
          urls: expect.arrayContaining([
            '/',
            '/account',
            '/read/1342',
            expect.stringContaining('/_next/static/chunks/main.js'),
            expect.stringContaining('/_next/static/css/app.css'),
          ]),
        })
      );
    });

    unmount();
    scriptEl.remove();
    linkEl.remove();
  });

  it('falls back to navigator.serviceWorker.controller when active/waiting/installing are null and handles registration rejection', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const controllerPostMessage = vi.fn();
    const registerMock = vi
      .fn()
      .mockResolvedValueOnce({
        active: null,
        waiting: null,
        installing: null,
      } as unknown as ServiceWorkerRegistration)
      .mockRejectedValueOnce(new Error('SW blocked'));

    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        serviceWorker: {
          register: registerMock,
          controller: { postMessage: controllerPostMessage },
        },
      },
      configurable: true,
      writable: true,
    });

    const { unmount } = render(<ServiceWorkerRegister />);
    await waitFor(() => {
      expect(controllerPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'CACHE_URLS' })
      );
    });
    unmount();

    // Second render triggers rejected promise catch branch gracefully
    const { unmount: unmount2 } = render(<ServiceWorkerRegister />);
    expect(registerMock).toHaveBeenCalledTimes(2);
    unmount2();
  });

  it('registers on window load event when document.readyState is loading', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const registerMock = vi.fn().mockResolvedValue({} as ServiceWorkerRegistration);
    const originalReadyState = Object.getOwnPropertyDescriptor(document, 'readyState');

    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get: () => 'loading',
    });

    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        serviceWorker: {
          register: registerMock,
        },
      },
      configurable: true,
      writable: true,
    });

    const { unmount } = render(<ServiceWorkerRegister />);
    expect(registerMock).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('load'));
    expect(registerMock).toHaveBeenCalledWith('/sw.js', { scope: '/' });

    unmount();
    if (originalReadyState) {
      Object.defineProperty(document, 'readyState', originalReadyState);
    } else {
      Object.defineProperty(document, 'readyState', {
        configurable: true,
        get: () => 'complete',
      });
    }
  });

  it('does not attempt registration in development mode', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const registerMock = vi.fn().mockResolvedValue({} as ServiceWorkerRegistration);

    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        serviceWorker: {
          register: registerMock,
        },
      },
      configurable: true,
      writable: true,
    });

    const { unmount } = render(<ServiceWorkerRegister />);
    window.dispatchEvent(new Event('load'));

    expect(registerMock).not.toHaveBeenCalled();
    unmount();
  });

  describe('public/sw.js runtime behavior (sandboxed ServiceWorkerGlobalScope)', () => {
    function createSwHarness(options?: {
      fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
      seedCaches?: Record<string, Record<string, Response>>;
    }) {
      const storeMap = new Map<string, Map<string, Response>>();
      if (options?.seedCaches) {
        for (const [cacheName, entries] of Object.entries(options.seedCaches)) {
          const inner = new Map<string, Response>();
          for (const [k, resp] of Object.entries(entries)) {
            inner.set(k, resp);
          }
          storeMap.set(cacheName, inner);
        }
      }

      const normalizeCacheKey = (req: string | Request): string => {
        const raw = typeof req === 'string' ? req : req.url;
        const parsed = new URL(raw, 'https://bookarium.example');
        return `${parsed.pathname}${parsed.search}`;
      };

      const cachesMock = {
        open: vi.fn(async (name: string) => {
          let inner = storeMap.get(name);
          if (!inner) {
            inner = new Map<string, Response>();
            storeMap.set(name, inner);
          }
          return {
            match: vi.fn(async (req: string | Request, opts?: { ignoreSearch?: boolean }) => {
              const raw = typeof req === 'string' ? req : req.url;
              const parsed = new URL(raw, 'https://bookarium.example');
              const key = opts?.ignoreSearch ? parsed.pathname : `${parsed.pathname}${parsed.search}`;
              const exact = inner.get(key);
              if (exact) return exact.clone();
              if (opts?.ignoreSearch) {
                for (const [storedKey, resp] of inner.entries()) {
                  if (storedKey.split('?')[0] === parsed.pathname) {
                    return resp.clone();
                  }
                }
              }
              return undefined;
            }),
            put: vi.fn(async (req: string | Request, resp: Response) => {
              inner.set(normalizeCacheKey(req), resp.clone());
            }),
          };
        }),
        match: vi.fn(async (req: string | Request, opts?: { ignoreSearch?: boolean }) => {
          const raw = typeof req === 'string' ? req : req.url;
          const parsed = new URL(raw, 'https://bookarium.example');
          const key = opts?.ignoreSearch ? parsed.pathname : `${parsed.pathname}${parsed.search}`;
          for (const inner of storeMap.values()) {
            if (inner.has(key)) return inner.get(key)?.clone();
            if (opts?.ignoreSearch) {
              for (const [storedKey, resp] of inner.entries()) {
                if (storedKey.split('?')[0] === parsed.pathname) {
                  return resp.clone();
                }
              }
            }
          }
          return undefined;
        }),
        keys: vi.fn(async () => Array.from(storeMap.keys())),
        delete: vi.fn(async (name: string) => storeMap.delete(name)),
      };

      const listeners: Record<string, ((ev: unknown) => void)[]> = {};
      const fetchMock = vi.fn(
        options?.fetchImpl ||
          (async (input: RequestInfo | URL) => {
            const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
            if (urlStr === '/' || urlStr === '/account' || urlStr === '/read/1342') {
              return new Response(
                '<html><script src="/_next/static/chunks/app.js"></script><script>"static/chunks/extra.js"</script></html>',
                { status: 200, headers: { 'Content-Type': 'text/html' } }
              );
            }
            return new Response('ok', { status: 200, headers: { 'Content-Type': 'application/javascript' } });
          })
      );

      const skipWaitingMock = vi.fn(async () => {});
      const claimMock = vi.fn(async () => {});
      const swErrorResponse = new Response(null, { status: 500 });
      const ResponseCtor = Object.assign(
        function MockSwResponse(body?: BodyInit | null, init?: ResponseInit) {
          return new Response(body, init);
        },
        { error: vi.fn(() => swErrorResponse.clone()) }
      );

      const sandbox: Record<string, unknown> = {
        URL,
        Headers,
        Request,
        Response: ResponseCtor,
        caches: cachesMock,
        fetch: fetchMock,
        setTimeout,
        clearTimeout,
        console,
        self: {
          location: new URL('https://bookarium.example/sw.js'),
          addEventListener: (type: string, fn: (ev: unknown) => void) => {
            listeners[type] = listeners[type] || [];
            listeners[type].push(fn);
          },
          skipWaiting: skipWaitingMock,
          clients: { claim: claimMock },
        },
      };
      (sandbox.self as Record<string, unknown>).caches = cachesMock;

      const swPath = path.resolve(process.cwd(), 'public/sw.js');
      const swCode = fs.readFileSync(swPath, 'utf-8');
      vm.runInNewContext(swCode, sandbox);

      return {
        sandbox,
        storeMap,
        cachesMock,
        fetchMock,
        skipWaitingMock,
        claimMock,
        async dispatchExtendable(type: string, extra: Record<string, unknown> = {}) {
          const promises: Promise<unknown>[] = [];
          const event = {
            ...extra,
            waitUntil: (p: Promise<unknown>) => promises.push(p),
          };
          for (const fn of listeners[type] || []) {
            fn(event);
          }
          await Promise.all(promises);
        },
        async dispatchFetch(request: {
          url: string;
          method?: string;
          mode?: string;
          headers?: Headers;
        }): Promise<{ intercepted: boolean; response: Response | null }> {
          let respondedPromise: Promise<Response> | null = null;
          const event = {
            request: {
              method: request.method || 'GET',
              url: request.url,
              mode: request.mode || 'cors',
              headers: request.headers || new Headers(),
              clone() {
                return this;
              },
            },
            respondWith: (p: Promise<Response>) => {
              respondedPromise = p;
            },
          };
          for (const fn of listeners.fetch || []) {
            fn(event);
          }
          if (!respondedPromise) {
            return { intercepted: false, response: null };
          }
          return { intercepted: true, response: await respondedPromise };
        },
      };
    }

    it('handles install static precache + HTML asset discovery and activate stale cache cleanup', async () => {
      const harness = createSwHarness({
        seedCaches: {
          'bookarium-app-shell-v6': { '/': new Response('old') },
          'bookarium-covers-v1': { 'cover-1': new Response('old-cover') },
        },
      });

      await harness.dispatchExtendable('install');
      const shellCache = harness.storeMap.get('bookarium-app-shell-v7');
      expect(shellCache?.has('/')).toBe(true);
      expect(shellCache?.has('/_next/static/chunks/app.js')).toBe(true);
      expect(shellCache?.has('/_next/static/chunks/extra.js')).toBe(true);
      expect(harness.skipWaitingMock).toHaveBeenCalledTimes(1);

      await harness.dispatchExtendable('activate');
      expect(harness.storeMap.has('bookarium-app-shell-v6')).toBe(false);
      expect(harness.storeMap.has('bookarium-covers-v1')).toBe(false);
      expect(harness.storeMap.has('bookarium-app-shell-v7')).toBe(true);
      expect(harness.claimMock).toHaveBeenCalledTimes(1);
    });

    it('sanitizes CACHE_URLS messages (dropping //, cross-origin, /auth/, /api/ and enforcing 100-URL cap)', async () => {
      const harness = createSwHarness({
        seedCaches: {
          'bookarium-covers-v1': { legacy: new Response('x') },
        },
      });

      const bulkValidUrls = Array.from({ length: 105 }, (_, idx) => `/_next/static/chunks/c-${idx}.js`);
      await harness.dispatchExtendable('message', {
        data: {
          type: 'CACHE_URLS',
          urls: [
            '//evil.example/payload.js',
            'https://evil.example/other.js',
            'https://bookarium.example/auth/callback?code=secret',
            'https://bookarium.example/api/books?page=1',
            ...bulkValidUrls,
          ],
        },
      });

      expect(harness.cachesMock.delete).toHaveBeenCalledWith('bookarium-covers-v1');
      const shellCache = harness.storeMap.get('bookarium-app-shell-v7');
      expect(shellCache?.has('/payload.js')).toBe(false);
      expect(shellCache?.has('/auth/callback?code=secret')).toBe(false);
      expect(shellCache?.has('/api/books?page=1')).toBe(false);
      // 100 URLs max sliced BEFORE sanitizePrecacheUrl -> 4 malicious dropped + 96 cached (<= 100 total checked)
      expect(shellCache?.size).toBe(96);
    });

    it('enforces cross-origin & /auth/ pass-through, /api/ 503 offline fallback, /read/* offline shell fallback, and _rsc anti-HTML guard', async () => {
      const harness = createSwHarness({
        seedCaches: {
          'bookarium-app-shell-v7': {
            '/': new Response('<html>Root Shell</html>', { headers: { 'Content-Type': 'text/html' } }),
            '/read/1342': new Response('<html>Reader Shell</html>', { headers: { 'Content-Type': 'text/html' } }),
            '/account': new Response('<html>Account Page</html>', { headers: { 'Content-Type': 'text/html' } }),
            '/account?_rsc=stalehtml': new Response('<html>Wrong HTML</html>', {
              headers: { 'Content-Type': 'text/html' },
            }),
          },
        },
        fetchImpl: async () => {
          throw new Error('Offline network down');
        },
      });

      // Cross-origin cover mirror requests must bypass SW completely
      const mirrorRes = await harness.dispatchFetch({
        url: 'https://aleph.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg',
      });
      expect(mirrorRes.intercepted).toBe(false);

      // Non-GET & /auth/ requests must bypass SW completely
      expect(
        (await harness.dispatchFetch({ url: 'https://bookarium.example/api/books', method: 'POST' })).intercepted
      ).toBe(false);
      expect(
        (await harness.dispatchFetch({ url: 'https://bookarium.example/auth/callback?code=1' })).intercepted
      ).toBe(false);

      // /api/* offline fallback returns structured 503 JSON
      const apiRes = await harness.dispatchFetch({ url: 'https://bookarium.example/api/books?page=1' });
      expect(apiRes.intercepted).toBe(true);
      expect(apiRes.response?.status).toBe(503);
      const apiJson = await apiRes.response?.json();
      expect(apiJson.offline).toBe(true);

      // /read/999 navigation falls back to cached /read/1342 reader shell HTML
      const readerNav = await harness.dispatchFetch({
        url: 'https://bookarium.example/read/999',
        mode: 'navigate',
      });
      expect(readerNav.intercepted).toBe(true);
      expect(await readerNav.response?.text()).toBe('<html>Reader Shell</html>');

      // _rsc Flight request never receives cached text/html payload
      const rscRes = await harness.dispatchFetch({
        url: 'https://bookarium.example/account?_rsc=stalehtml',
        headers: new Headers({ RSC: '1' }),
      });
      expect(rscRes.intercepted).toBe(true);
      expect(rscRes.response?.status).toBe(500);
    });
  });
});
