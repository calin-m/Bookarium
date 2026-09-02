import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrollDirection } from './useScrollDirection';

describe('useScrollDirection hook', () => {
  let originalScrollY: number;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    originalScrollY = window.scrollY;
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      configurable: true,
      value: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      configurable: true,
      value: originalScrollY,
    });
    vi.restoreAllMocks();
  });

  it('initializes with BOTH header and toolbar visible at top of page', () => {
    const { result } = renderHook(() => useScrollDirection({ topOffset: 64, heroDockSelector: '' }));
    expect(result.current.isHeaderVisible).toBe(true);
    expect(result.current.isToolbarVisible).toBe(true);
  });

  it('preserves BOTH_VISIBLE while scrolling down within Hero section (scrollY <= dockOffset)', () => {
    const { result } = renderHook(() => useScrollDirection({ threshold: 10, topOffset: 200, heroDockSelector: '' }));

    // Scroll down inside hero (e.g. to 150px <= 200px)
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 150, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.isHeaderVisible).toBe(true);
    expect(result.current.isToolbarVisible).toBe(true);
  });

  it('preserves header visibility on initial arrival at catalog dock point', () => {
    const { result } = renderHook(() =>
      useScrollDirection({ threshold: 10, gestureEndTimeoutMs: 150, topOffset: 100, heroDockSelector: '' })
    );

    // Initial arrival at catalog dock point (100 -> 120px)
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 120, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.isHeaderVisible).toBe(true);
    expect(result.current.isToolbarVisible).toBe(true);
  });

  it('transitions to toolbar-only docked at top-0 on subsequent downward scroll gesture', () => {
    const { result } = renderHook(() =>
      useScrollDirection({ threshold: 10, continuousThreshold: 100, gestureEndTimeoutMs: 150, topOffset: 100, heroDockSelector: '' })
    );

    // Initial dock arrival
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 120, configurable: true });
      window.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(180);
    });

    // Second scroll down gesture (120 -> 150px) -> State 1 (Toolbar Only @ top-0)
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 150, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.isHeaderVisible).toBe(false);
    expect(result.current.isToolbarVisible).toBe(true);

    // Short continuous scroll within the same gesture (< continuousThreshold) maintains State 1
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 180, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.isHeaderVisible).toBe(false);
    expect(result.current.isToolbarVisible).toBe(true);
  });

  it('transitions to fully hidden during a single long continuous scroll gesture past continuousThreshold', () => {
    const { result } = renderHook(() =>
      useScrollDirection({
        threshold: 10,
        continuousThreshold: 100,
        gestureEndTimeoutMs: 150,
        topOffset: 100,
        heroDockSelector: '',
      })
    );

    // Initial dock arrival
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 120, configurable: true });
      window.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(180);
    });

    // Start downward swipe: 120 -> 140px (delta = 20px >= threshold 10px) -> State 1 (Toolbar Only)
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 140, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.isHeaderVisible).toBe(false);
    expect(result.current.isToolbarVisible).toBe(true);

    // Continue the SAME swipe past continuousThreshold (140 -> 260px, delta = 120px >= 100px) -> State 2 (Both Hidden)
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 260, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.isHeaderVisible).toBe(false);
    expect(result.current.isToolbarVisible).toBe(false);
  });

  it('transitions to fully hidden on third downward scroll gesture', () => {
    const { result } = renderHook(() =>
      useScrollDirection({ threshold: 10, continuousThreshold: 100, gestureEndTimeoutMs: 150, topOffset: 100, heroDockSelector: '' })
    );

    // Sequence through Step 1 and Step 2
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 120, configurable: true });
      window.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(180);

      Object.defineProperty(window, 'scrollY', { value: 150, configurable: true });
      window.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(180);
    });

    // Step 3 downward scroll gesture -> State 2 (Both Hidden)
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 170, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.isHeaderVisible).toBe(false);
    expect(result.current.isToolbarVisible).toBe(false);
  });

  it('immediately reveals filter toolbar upon upward scroll reversal', () => {
    const { result } = renderHook(() =>
      useScrollDirection({ threshold: 10, gestureEndTimeoutMs: 150, topOffset: 100, heroDockSelector: '' })
    );

    // Reach State 2 (Both Hidden)
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 120, configurable: true });
      window.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(180);

      Object.defineProperty(window, 'scrollY', { value: 150, configurable: true });
      window.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(180);

      Object.defineProperty(window, 'scrollY', { value: 1530, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.isToolbarVisible).toBe(false);

    // Upward scroll reversal (1530 -> 1450px) immediately reveals toolbar
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 1450, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.isHeaderVisible).toBe(false);
    expect(result.current.isToolbarVisible).toBe(true);

    // Second upward scroll gesture after pause reveals header as well
    act(() => {
      vi.advanceTimersByTime(180);
      Object.defineProperty(window, 'scrollY', { value: 1350, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.isHeaderVisible).toBe(true);
    expect(result.current.isToolbarVisible).toBe(true);
  });

  it('measures dynamic element offset from DOM when heroDockSelector is provided', () => {
    const mockElement = document.createElement('div');
    Object.defineProperty(mockElement, 'offsetTop', { value: 500, configurable: true });
    mockElement.id = 'catalog-section';
    document.body.appendChild(mockElement);

    try {
      const { result } = renderHook(() =>
        useScrollDirection({ threshold: 10, gestureEndTimeoutMs: 150, topOffset: 64, heroDockSelector: '#catalog-section' })
      );

      // Scroll to 300px (<= 500 - 120 = 380px): inside hero, nothing hides
      act(() => {
        Object.defineProperty(window, 'scrollY', { value: 300, configurable: true });
        window.dispatchEvent(new Event('scroll'));
      });
      expect(result.current.isHeaderVisible).toBe(true);
      expect(result.current.isToolbarVisible).toBe(true);

      // Advance timeout
      act(() => {
        vi.advanceTimersByTime(180);
      });

      // 1. Initial arrival past dockOffset (430px > 380px): docks filter bar under header, header stays visible
      act(() => {
        Object.defineProperty(window, 'scrollY', { value: 430, configurable: true });
        window.dispatchEvent(new Event('scroll'));
      });
      expect(result.current.isHeaderVisible).toBe(true);
      expect(result.current.isToolbarVisible).toBe(true);

      // 2. Pause gesture
      act(() => {
        vi.advanceTimersByTime(180);
      });

      // 3. Second scroll down gesture in catalog (430 -> 470px): now header hides, toolbar moves to top-0
      act(() => {
        Object.defineProperty(window, 'scrollY', { value: 470, configurable: true });
        window.dispatchEvent(new Event('scroll'));
      });
      expect(result.current.isHeaderVisible).toBe(false);
      expect(result.current.isToolbarVisible).toBe(true);
    } finally {
      document.body.removeChild(mockElement);
    }
  });

  it('keeps both header and toolbar unconditionally visible when enabled is false', () => {
    const { result } = renderHook(() =>
      useScrollDirection({ enabled: false, threshold: 10, topOffset: 64 })
    );

    // Scroll down deeply
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 1500, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.isHeaderVisible).toBe(true);
    expect(result.current.isToolbarVisible).toBe(true);
  });
});
