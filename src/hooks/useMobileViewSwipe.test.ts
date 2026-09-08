import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useMobileViewSwipe, MOBILE_VIEW_ORDER } from './useMobileViewSwipe';
import type { ViewId } from '@/config/views.config';

function createTouchEvent(
  type: 'touchstart' | 'touchend',
  touchData: { clientX: number; clientY: number },
  targetElement?: HTMLElement
): React.TouchEvent {
  const target = targetElement || document.createElement('div');
  const touch = {
    clientX: touchData.clientX,
    clientY: touchData.clientY,
    target,
  } as unknown as Touch;

  if (type === 'touchstart') {
    return {
      touches: [touch],
      changedTouches: [touch],
      target,
    } as unknown as React.TouchEvent;
  }

  return {
    touches: [],
    changedTouches: [touch],
    target,
  } as unknown as React.TouchEvent;
}

describe('useMobileViewSwipe', () => {
  let originalInnerWidth: number;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1000 });
    vi.useFakeTimers();
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalInnerWidth });
    vi.useRealTimers();
  });

  it('advances to next view on valid swipe left', () => {
    const onViewChange = vi.fn();
    const { result } = renderHook(() =>
      useMobileViewSwipe({
        activeView: 'catalog',
        onViewChange,
      })
    );

    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 500, clientY: 300 }));
    });

    // Advance time by 150ms
    act(() => {
      vi.advanceTimersByTime(150);
    });

    // Move finger left by 80px (|deltaX| = 80, deltaY = 10)
    act(() => {
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 420, clientY: 310 }));
    });

    expect(onViewChange).toHaveBeenCalledWith('bookshelf');
  });

  it('navigates to previous view on valid swipe right', () => {
    const onViewChange = vi.fn();
    const { result } = renderHook(() =>
      useMobileViewSwipe({
        activeView: 'favorites',
        onViewChange,
      })
    );

    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 400, clientY: 300 }));
    });

    act(() => {
      vi.advanceTimersByTime(150);
    });

    // Move finger right by 90px (|deltaX| = 90, deltaY = 5)
    act(() => {
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 490, clientY: 305 }));
    });

    expect(onViewChange).toHaveBeenCalledWith('bookshelf');
  });

  it('clamps at boundaries (no-op when swiping right on catalog or left on account)', () => {
    const onViewChange = vi.fn();

    // 1. Swiping right on 'catalog'
    const { result: catalogHook } = renderHook(() =>
      useMobileViewSwipe({
        activeView: 'catalog',
        onViewChange,
      })
    );

    act(() => {
      catalogHook.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 400, clientY: 300 }));
      vi.advanceTimersByTime(100);
      catalogHook.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 500, clientY: 300 }));
    });

    expect(onViewChange).not.toHaveBeenCalled();

    // 2. Swiping left on 'bookmarks' advances to 'account'
    const { result: bookmarksHook } = renderHook(() =>
      useMobileViewSwipe({
        activeView: 'bookmarks',
        onViewChange,
      })
    );

    act(() => {
      bookmarksHook.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 500, clientY: 300 }));
      vi.advanceTimersByTime(100);
      bookmarksHook.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 400, clientY: 300 }));
    });

    expect(onViewChange).toHaveBeenCalledWith('account');
    onViewChange.mockClear();

    // 3. Swiping left on 'account' is clamped
    const { result: accountHook } = renderHook(() =>
      useMobileViewSwipe({
        activeView: 'account',
        onViewChange,
      })
    );

    act(() => {
      accountHook.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 500, clientY: 300 }));
      vi.advanceTimersByTime(100);
      accountHook.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 400, clientY: 300 }));
    });

    expect(onViewChange).not.toHaveBeenCalled();

    // 4. Swiping right on 'account' returns to 'bookmarks'
    act(() => {
      accountHook.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 400, clientY: 300 }));
      vi.advanceTimersByTime(100);
      accountHook.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 500, clientY: 300 }));
    });

    expect(onViewChange).toHaveBeenCalledWith('bookmarks');
  });

  it('ignores swipe if touch starts within 25px edge dead-zone (native Safari/Android back-forward)', () => {
    const onViewChange = vi.fn();
    const { result } = renderHook(() =>
      useMobileViewSwipe({
        activeView: 'catalog',
        onViewChange,
      })
    );

    // Touch starting at clientX = 15 (< 25px from left edge)
    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 15, clientY: 300 }));
      vi.advanceTimersByTime(100);
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 150, clientY: 300 }));
    });
    expect(onViewChange).not.toHaveBeenCalled();

    // Touch starting at clientX = 985 (> 1000 - 25 = 975px from right edge)
    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 985, clientY: 300 }));
      vi.advanceTimersByTime(100);
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 850, clientY: 300 }));
    });
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it('ignores swipe originating on interactive controls or inputs', () => {
    const onViewChange = vi.fn();
    const { result } = renderHook(() =>
      useMobileViewSwipe({
        activeView: 'catalog',
        onViewChange,
      })
    );

    // Target inside input
    const input = document.createElement('input');
    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 500, clientY: 300 }, input));
      vi.advanceTimersByTime(100);
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 400, clientY: 300 }, input));
    });
    expect(onViewChange).not.toHaveBeenCalled();

    // Target inside button
    const button = document.createElement('button');
    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 500, clientY: 300 }, button));
      vi.advanceTimersByTime(100);
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 400, clientY: 300 }, button));
    });
    expect(onViewChange).not.toHaveBeenCalled();

    // Target with data-no-swipe attribute
    const protectedDiv = document.createElement('div');
    protectedDiv.setAttribute('data-no-swipe', 'true');
    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 500, clientY: 300 }, protectedDiv));
      vi.advanceTimersByTime(100);
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 400, clientY: 300 }, protectedDiv));
    });
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it('ignores diagonal or vertical scroll gestures failing dominance ratio', () => {
    const onViewChange = vi.fn();
    const { result } = renderHook(() =>
      useMobileViewSwipe({
        activeView: 'catalog',
        onViewChange,
      })
    );

    // DeltaX = 60, DeltaY = 50 -> 60 < 50 * 1.8 (90) -> Should NOT trigger
    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 500, clientY: 300 }));
      vi.advanceTimersByTime(100);
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 440, clientY: 350 }));
    });

    expect(onViewChange).not.toHaveBeenCalled();
  });

  it('ignores gestures exceeding max duration or below min distance', () => {
    const onViewChange = vi.fn();
    const { result } = renderHook(() =>
      useMobileViewSwipe({
        activeView: 'catalog',
        onViewChange,
      })
    );

    // Too slow: duration = 600ms (> 500ms)
    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 500, clientY: 300 }));
      vi.advanceTimersByTime(600);
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 400, clientY: 300 }));
    });
    expect(onViewChange).not.toHaveBeenCalled();

    // Too short: distance = 30px (< 50px)
    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 500, clientY: 300 }));
      vi.advanceTimersByTime(100);
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 470, clientY: 300 }));
    });
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it('does nothing when disabled', () => {
    const onViewChange = vi.fn();
    const { result } = renderHook(() =>
      useMobileViewSwipe({
        activeView: 'catalog',
        onViewChange,
        enabled: false,
      })
    );

    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 500, clientY: 300 }));
      vi.advanceTimersByTime(100);
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 400, clientY: 300 }));
    });

    expect(onViewChange).not.toHaveBeenCalled();
  });

  it('supports custom config overrides', () => {
    const onViewChange = vi.fn();
    const { result } = renderHook(() =>
      useMobileViewSwipe({
        activeView: 'catalog',
        onViewChange,
        config: {
          minDistancePx: 120, // stricter distance
        },
      })
    );

    // Distance = 80px (would pass default 50px, but fails custom 120px)
    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 500, clientY: 300 }));
      vi.advanceTimersByTime(100);
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 420, clientY: 300 }));
    });
    expect(onViewChange).not.toHaveBeenCalled();

    // Distance = 130px (passes custom 120px)
    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 500, clientY: 300 }));
      vi.advanceTimersByTime(100);
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 370, clientY: 300 }));
    });
    expect(onViewChange).toHaveBeenCalledWith('bookshelf');
  });

  it('cycles across all 6 views in sequence', () => {
    let currentView: ViewId = 'catalog';
    const onViewChange = vi.fn((next: ViewId) => {
      currentView = next;
    });

    const { result, rerender } = renderHook(() =>
      useMobileViewSwipe({
        activeView: currentView,
        onViewChange,
      })
    );

    // Sequence forward: catalog -> bookshelf -> favorites -> notebook -> bookmarks -> account
    const expectedViews: ViewId[] = ['bookshelf', 'favorites', 'notebook', 'bookmarks', 'account'];
    for (const expected of expectedViews) {
      act(() => {
        result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 500, clientY: 300 }));
        vi.advanceTimersByTime(100);
        result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 400, clientY: 300 }));
      });
      expect(onViewChange).toHaveBeenLastCalledWith(expected);
      rerender();
    }

    expect(MOBILE_VIEW_ORDER).toEqual(['catalog', 'bookshelf', 'favorites', 'notebook', 'bookmarks', 'account']);
  });
});

