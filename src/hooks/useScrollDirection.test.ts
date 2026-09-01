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

  it('advances STRICTLY 1 step during a long continuous multi-step scroll until gesture pauses', () => {
    const { result } = renderHook(() =>
      useScrollDirection({ threshold: 10, gestureEndTimeoutMs: 150, topOffset: 100, heroDockSelector: '' })
    );

    // 1. In hero at 100px -> State 0 (Both Visible)
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 100, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.isHeaderVisible).toBe(true);
    expect(result.current.isToolbarVisible).toBe(true);

    // 2. Start scrolling down: moves 20px -> transitions to State 1 (Toolbar Only)
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 120, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.isHeaderVisible).toBe(false);
    expect(result.current.isToolbarVisible).toBe(true);

    // 3. User continues scrolling continuously in the same gesture (120 -> 500 -> 1500px) without pausing!
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 500, configurable: true });
      window.dispatchEvent(new Event('scroll'));
      Object.defineProperty(window, 'scrollY', { value: 1500, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });

    // STILL in State 1! (Toolbar Only @ top-0) - It does NOT skip to State 2 during continuous scroll!
    expect(result.current.isHeaderVisible).toBe(false);
    expect(result.current.isToolbarVisible).toBe(true);

    // 4. User pauses / stops scrolling for 180ms
    act(() => {
      vi.advanceTimersByTime(180);
    });

    // 5. User performs second scroll down gesture (1500 -> 1530px) -> Now transitions to State 2 (Both Hidden)!
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 1530, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.isHeaderVisible).toBe(false);
    expect(result.current.isToolbarVisible).toBe(false);

    // 6. User continues scrolling continuously down (1530 -> 2500px) -> stays in State 2
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 2500, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.isHeaderVisible).toBe(false);
    expect(result.current.isToolbarVisible).toBe(false);

    // 7. User immediately reverses and scrolls UP (2500 -> 2450px) -> Instant transition to State 1!
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 2450, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.isHeaderVisible).toBe(false);
    expect(result.current.isToolbarVisible).toBe(true);

    // 8. User continues scrolling up continuously in same gesture (2450 -> 1800px) -> stays in State 1!
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 1800, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.isHeaderVisible).toBe(false);
    expect(result.current.isToolbarVisible).toBe(true);

    // 9. Pause gesture (180ms)
    act(() => {
      vi.advanceTimersByTime(180);
    });

    // 10. Second scroll UP gesture (1800 -> 1750px) -> Transitions to State 0 (Header visible @ top-0, Toolbar @ top-16)!
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 1750, configurable: true });
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

      // Scroll past dockOffset to 400px + scroll down 1x to 430px -> Header hides, Toolbar stays at top-0
      act(() => {
        Object.defineProperty(window, 'scrollY', { value: 430, configurable: true });
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
