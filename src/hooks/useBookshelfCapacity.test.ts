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
});
