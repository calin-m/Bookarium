import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBookshelfCapacity } from './useBookshelfCapacity';

describe('useBookshelfCapacity hook', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it('returns default capacity of 18 on wide desktop viewports (>= 1280px)', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1440,
    });

    const { result } = renderHook(() => useBookshelfCapacity());
    expect(result.current).toBe(18);
  });

  it('returns calculated capacity of 14 on small desktop / laptop viewports (1024px)', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useBookshelfCapacity());
    expect(result.current).toBe(14);
  });

  it('returns calculated capacity of 10 on tablet viewports (768px)', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768,
    });

    const { result } = renderHook(() => useBookshelfCapacity());
    expect(result.current).toBe(10);
  });

  it('returns clamped minimum capacity of 6 on mobile viewports (< 640px)', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    const { result } = renderHook(() => useBookshelfCapacity());
    expect(result.current).toBe(6);
  });

  it('updates capacity dynamically when window resize event is triggered', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1280,
    });

    const { result } = renderHook(() => useBookshelfCapacity());
    expect(result.current).toBe(18);

    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(10);

    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 390,
      });
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(6);
  });

  it('removes the window resize listener on unmount and provides a deterministic SSR snapshot', async () => {
    const { vi } = await import('vitest');
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useBookshelfCapacity());
    expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function), { passive: true });
    const registeredListener = addSpy.mock.calls.find((call) => call[0] === 'resize')?.[1];
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('resize', registeredListener);
    addSpy.mockRestore();
    removeSpy.mockRestore();

    const React = await import('react');
    const { renderToString } = await import('react-dom/server');
    function SsrCapacityProbe() {
      const cap = useBookshelfCapacity();
      return React.createElement('span', null, String(cap));
    }
    const html = renderToString(React.createElement(SsrCapacityProbe));
    expect(html).toMatch(/<span>\d+<\/span>/);
    const match = html.match(/<span>(\d+)<\/span>/);
    expect(Number(match?.[1])).toBeGreaterThanOrEqual(6);
  });
});
