import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNetworkStatus } from './useNetworkStatus';

describe('useNetworkStatus', () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');

  const setNavigatorOnline = (status: boolean) => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => status,
    });
  };

  afterEach(() => {
    if (originalOnLine) {
      Object.defineProperty(window.navigator, 'onLine', originalOnLine);
    } else {
      setNavigatorOnline(true);
    }
  });

  it('returns online status when navigator.onLine is true', () => {
    setNavigatorOnline(true);
    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.isOnline).toBe(true);
    expect(result.current.isOffline).toBe(false);
  });

  it('returns offline status when navigator.onLine is false', () => {
    setNavigatorOnline(false);
    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.isOnline).toBe(false);
    expect(result.current.isOffline).toBe(true);
  });

  it('reactively updates when window offline and online events fire', () => {
    setNavigatorOnline(true);
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);

    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.isOffline).toBe(true);

    act(() => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current.isOnline).toBe(true);
    expect(result.current.isOffline).toBe(false);
  });

  it('defaults to online when navigator lacks onLine, supports SSR snapshot, and removes event listeners on unmount', async () => {
    const { vi } = await import('vitest');
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useNetworkStatus());
    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    addSpy.mockRestore();
    removeSpy.mockRestore();

    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {},
    });
    try {
      const { result } = renderHook(() => useNetworkStatus());
      expect(result.current.isOnline).toBe(true);
      expect(result.current.isOffline).toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: originalNavigator,
      });
    }

    const React = await import('react');
    const { renderToString } = await import('react-dom/server');
    function SsrProbe() {
      const status = useNetworkStatus();
      return React.createElement('span', null, `${status.isOnline}:${status.isOffline}`);
    }
    expect(renderToString(React.createElement(SsrProbe))).toContain('true:false');
  });
});
