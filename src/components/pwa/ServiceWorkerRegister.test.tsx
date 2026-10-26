import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { ServiceWorkerRegister } from './ServiceWorkerRegister';

vi.mock('@/app/read/[id]/page', () => ({ default: () => null }));
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
    const registerMock = vi.fn().mockResolvedValue({
      active: { postMessage: postMessageMock },
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
    scriptEl.src = 'http://localhost:3000/_next/static/chunks/main.js';
    const linkEl = document.createElement('link');
    linkEl.rel = 'stylesheet';
    linkEl.href = 'http://localhost:3000/_next/static/css/app.css';
    document.head.appendChild(scriptEl);
    document.head.appendChild(linkEl);

    const { unmount } = render(<ServiceWorkerRegister />);

    expect(registerMock).toHaveBeenCalledWith('/sw.js', { scope: '/' });

    await waitFor(() => {
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CACHE_URLS',
          urls: expect.arrayContaining([
            '/',
            '/account',
            'http://localhost:3000/_next/static/chunks/main.js',
            'http://localhost:3000/_next/static/css/app.css',
          ]),
        })
      );
    });

    unmount();
    scriptEl.remove();
    linkEl.remove();
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
});
