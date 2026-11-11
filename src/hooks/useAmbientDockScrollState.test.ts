import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAmbientDockScrollState } from './useAmbientDockScrollState';

describe('useAmbientDockScrollState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'scrollY', {
      value: 0,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tracks top-of-page threshold, scroll wake, idle dimming, and pointer wake interactions', () => {
    const { result, rerender } = renderHook(
      ({ isPinnedAwake }) =>
        useAmbientDockScrollState({
          idleTimeoutMs: 500,
          isPinnedAwake,
          topThresholdPx: 60,
        }),
      { initialProps: { isPinnedAwake: false } }
    );

    // At scrollY = 0 (< 60), isAtTop is true and dock is dimmed when not hovered/pinned
    expect(result.current.isAtTop).toBe(true);
    expect(result.current.isDockDimmed).toBe(true);

    // Scroll down to 120px wakes the dock
    act(() => {
      Object.defineProperty(window, 'scrollY', {
        value: 120,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.isAtTop).toBe(false);
    expect(result.current.isIdle).toBe(false);
    expect(result.current.isDockDimmed).toBe(false);

    // After idleTimeoutMs (500ms), dock becomes idle and dimmed
    act(() => {
      vi.advanceTimersByTime(550);
    });

    expect(result.current.isIdle).toBe(true);
    expect(result.current.isDockDimmed).toBe(true);

    // Hovering wakes the dock immediately
    act(() => {
      result.current.handlePointerEnter();
    });
    expect(result.current.isHovered).toBe(true);
    expect(result.current.isDockDimmed).toBe(false);

    // Leaving restarts idle timer, but isPinnedAwake keeps it un-dimmed
    rerender({ isPinnedAwake: true });
    act(() => {
      result.current.handlePointerLeave();
      vi.advanceTimersByTime(550);
    });
    expect(result.current.isDockDimmed).toBe(false);
  });
});
