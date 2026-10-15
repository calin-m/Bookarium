import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTouchDevice } from './useTouchDevice';

describe('useTouchDevice hook', () => {
  const originalMatchMedia = window.matchMedia;
  const originalMaxTouchPoints = navigator.maxTouchPoints;
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: originalMaxTouchPoints,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      writable: true,
      configurable: true,
    });
  });

  const setupDevice = ({
    width,
    isCoarse,
    touchPoints,
  }: {
    width: number;
    isCoarse: boolean;
    touchPoints: number;
  }) => {
    Object.defineProperty(window, 'innerWidth', {
      value: width,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: touchPoints,
      writable: true,
      configurable: true,
    });

    const listeners = new Map<string, Set<() => void>>();

    window.matchMedia = vi.fn().mockImplementation((query: string) => {
      let matches = false;
      if (query === '(pointer: coarse)') {
        matches = isCoarse;
      } else if (query === '(max-width: 1366px)') {
        matches = width <= 1366;
      }

      if (!listeners.has(query)) {
        listeners.set(query, new Set());
      }

      return {
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((event: string, cb: () => void) => {
          if (event === 'change') {
            listeners.get(query)?.add(cb);
          }
        }),
        removeEventListener: vi.fn((event: string, cb: () => void) => {
          if (event === 'change') {
            listeners.get(query)?.delete(cb);
          }
        }),
        dispatchEvent: vi.fn(),
      };
    });

    return {
      listeners,
      triggerChange: (query: string) => {
        listeners.get(query)?.forEach((cb) => cb());
      },
    };
  };

  it('returns true for tactile tablet in portrait (800px, coarse pointer, 10 touch points)', () => {
    setupDevice({ width: 800, isCoarse: true, touchPoints: 10 });
    const { result } = renderHook(() => useTouchDevice());
    expect(result.current).toBe(true);
  });

  it('returns true for tactile tablet in landscape (1200px, coarse pointer, 10 touch points)', () => {
    setupDevice({ width: 1200, isCoarse: true, touchPoints: 10 });
    const { result } = renderHook(() => useTouchDevice());
    expect(result.current).toBe(true);
  });

  it('returns true for mobile device (390px, coarse pointer, 5 touch points)', () => {
    setupDevice({ width: 390, isCoarse: true, touchPoints: 5 });
    const { result } = renderHook(() => useTouchDevice());
    expect(result.current).toBe(true);
  });

  it('returns false for non-touch desktop (1920px, fine pointer, 0 touch points)', () => {
    setupDevice({ width: 1920, isCoarse: false, touchPoints: 0 });
    const { result } = renderHook(() => useTouchDevice());
    expect(result.current).toBe(false);
  });

  it('returns false for large touch monitors exceeding tablet width (1920px, coarse pointer, 10 touch points)', () => {
    setupDevice({ width: 1920, isCoarse: true, touchPoints: 10 });
    const { result } = renderHook(() => useTouchDevice());
    expect(result.current).toBe(false);
  });

  it('detects touch points even when pointer: coarse is not reported by browser', () => {
    setupDevice({ width: 1024, isCoarse: false, touchPoints: 5 });
    const { result } = renderHook(() => useTouchDevice());
    expect(result.current).toBe(true);
  });

  it('detects pointer: coarse even when maxTouchPoints is 0', () => {
    setupDevice({ width: 1024, isCoarse: true, touchPoints: 0 });
    const { result } = renderHook(() => useTouchDevice());
    expect(result.current).toBe(true);
  });

  it('subscribes to media query changes and unmounts cleanly', () => {
    const { triggerChange } = setupDevice({ width: 1024, isCoarse: true, touchPoints: 10 });
    const { result, unmount } = renderHook(() => useTouchDevice());
    expect(result.current).toBe(true);

    // Trigger change callback
    act(() => {
      triggerChange('(max-width: 1366px)');
    });
    expect(result.current).toBe(true);

    // Unmount safely
    expect(() => unmount()).not.toThrow();
  });
});

