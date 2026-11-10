import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useVisualViewportKeyboard } from './useVisualViewportKeyboard';

describe('useVisualViewportKeyboard', () => {
  const originalVisualViewport = window.visualViewport;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 800,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'visualViewport', {
      writable: true,
      configurable: true,
      value: originalVisualViewport,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
    vi.restoreAllMocks();
  });

  it('returns zeros when visualViewport is not supported in the environment', () => {
    Object.defineProperty(window, 'visualViewport', {
      writable: true,
      configurable: true,
      value: undefined,
    });

    const { result } = renderHook(() => useVisualViewportKeyboard());
    expect(result.current.keyboardHeight).toBe(0);
    expect(result.current.isKeyboardOpen).toBe(false);
  });

  it('tracks keyboard height elevation when visual viewport shrinks', () => {
    const listeners: Record<string, () => void> = {};
    const mockViewport = {
      height: 800,
      offsetTop: 0,
      addEventListener: vi.fn((event: string, cb: () => void) => {
        listeners[event] = cb;
      }),
      removeEventListener: vi.fn(),
    };

    Object.defineProperty(window, 'visualViewport', {
      writable: true,
      configurable: true,
      value: mockViewport,
    });

    const { result } = renderHook(() => useVisualViewportKeyboard());
    expect(result.current.keyboardHeight).toBe(0);
    expect(result.current.isKeyboardOpen).toBe(false);

    // Simulate virtual keyboard opening (viewport height shrinks from 800 to 520, offset 280)
    act(() => {
      mockViewport.height = 520;
      listeners['resize']?.();
    });

    expect(result.current.keyboardHeight).toBe(280);
    expect(result.current.isKeyboardOpen).toBe(true);

    // Simulate virtual keyboard closing (viewport height returns to 800)
    act(() => {
      mockViewport.height = 800;
      listeners['resize']?.();
    });

    expect(result.current.keyboardHeight).toBe(0);
    expect(result.current.isKeyboardOpen).toBe(false);
  });

  it('unsubscribes listeners on unmount', () => {
    const mockViewport = {
      height: 800,
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    Object.defineProperty(window, 'visualViewport', {
      writable: true,
      configurable: true,
      value: mockViewport,
    });

    const { unmount } = renderHook(() => useVisualViewportKeyboard());
    unmount();

    expect(mockViewport.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(mockViewport.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
  });
});
