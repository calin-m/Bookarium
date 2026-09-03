import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { ServiceWorkerRegister } from './ServiceWorkerRegister';

describe('ServiceWorkerRegister', () => {
  const originalNavigator = global.navigator;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders null without throwing', () => {
    const { container } = render(<ServiceWorkerRegister />);
    expect(container.firstChild).toBeNull();
  });

  it('attempts registration in production when serviceWorker is available', () => {
    vi.stubEnv('NODE_ENV', 'production');
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

    // Trigger load event
    window.dispatchEvent(new Event('load'));

    expect(registerMock).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    unmount();

    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
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

    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });
});
