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

  it('clamps at boundaries when wrapAround is disabled', () => {
    const onViewChange = vi.fn();

    // 1. Swiping right on 'catalog' with wrapAround: false
    const { result: catalogHook } = renderHook(() =>
      useMobileViewSwipe({
        activeView: 'catalog',
        onViewChange,
        config: { wrapAround: false },
      })
    );

    act(() => {
      catalogHook.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 400, clientY: 300 }));
      vi.advanceTimersByTime(100);
      catalogHook.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 500, clientY: 300 }));
    });

    expect(onViewChange).not.toHaveBeenCalled();

    // 2. Swiping left on 'account' is clamped with wrapAround: false
    const { result: accountHook } = renderHook(() =>
      useMobileViewSwipe({
        activeView: 'account',
        onViewChange,
        config: { wrapAround: false },
      })
    );

    act(() => {
      accountHook.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 500, clientY: 300 }));
      vi.advanceTimersByTime(100);
      accountHook.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 400, clientY: 300 }));
    });

    expect(onViewChange).not.toHaveBeenCalled();
  });

  it('supports circular carousel wrap-around by default (catalog right to account, account left to catalog)', () => {
    const onViewChange = vi.fn();
    const onSwipeDirection = vi.fn();

    // 1. Swiping right on 'catalog' wraps around to 'account' (backward)
    const { result: catalogHook } = renderHook(() =>
      useMobileViewSwipe({
        activeView: 'catalog',
        onViewChange,
        onSwipeDirection,
      })
    );

    act(() => {
      catalogHook.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 400, clientY: 300 }));
      vi.advanceTimersByTime(100);
      catalogHook.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 500, clientY: 300 }));
    });

    expect(onSwipeDirection).toHaveBeenCalledWith('backward');
    expect(onViewChange).toHaveBeenCalledWith('account');
    onViewChange.mockClear();
    onSwipeDirection.mockClear();

    // 2. Swiping left on 'account' wraps around to 'catalog' (forward)
    const { result: accountHook } = renderHook(() =>
      useMobileViewSwipe({
        activeView: 'account',
        onViewChange,
        onSwipeDirection,
      })
    );

    act(() => {
      accountHook.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 500, clientY: 300 }));
      vi.advanceTimersByTime(100);
      accountHook.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 400, clientY: 300 }));
    });

    expect(onSwipeDirection).toHaveBeenCalledWith('forward');
    expect(onViewChange).toHaveBeenCalledWith('catalog');
  });

  it('ignores swipe if touch starts within 20px edge dead-zone (native Safari/Android back-forward)', () => {
    const onViewChange = vi.fn();
    const { result } = renderHook(() =>
      useMobileViewSwipe({
        activeView: 'catalog',
        onViewChange,
      })
    );

    // Touch starting at clientX = 15 (< 20px from left edge)
    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 15, clientY: 300 }));
      vi.advanceTimersByTime(100);
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 150, clientY: 300 }));
    });
    expect(onViewChange).not.toHaveBeenCalled();

    // Touch starting at clientX = 985 (> 1000 - 20 = 980px from right edge)
    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 985, clientY: 300 }));
      vi.advanceTimersByTime(100);
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 850, clientY: 300 }));
    });
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it('permits swipes starting just outside edge dead-zone (e.g. 25px from bezel)', () => {
    const onViewChange = vi.fn();
    const { result } = renderHook(() =>
      useMobileViewSwipe({
        activeView: 'catalog',
        onViewChange,
      })
    );

    // Touch starting at clientX = 25 (> 20px dead-zone)
    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 25, clientY: 300 }));
      vi.advanceTimersByTime(100);
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 100, clientY: 300 }));
    });
    // deltaX = +75 (swiped right on catalog, clamped) -> test swipe left from clientX = 120 to 25
    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 25, clientY: 300 }));
      vi.advanceTimersByTime(100);
      // Wait, on catalog, swiping left is deltaX < 0: start at 100, end at 25 (|deltaX| = 75)
    });

    const { result: leftSwipeHook } = renderHook(() =>
      useMobileViewSwipe({
        activeView: 'catalog',
        onViewChange,
      })
    );
    act(() => {
      leftSwipeHook.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 25, clientY: 300 }));
      vi.advanceTimersByTime(100);
      // deltaX = -10 is not enough, start at 100, end at 40 -> or start at 25, end at 0? Wait, start at 25 and move left to 0: deltaX = -25 (< 40px)
      // If user swipes right from 25px on bookshelf:
    });

    const { result: bookshelfHook } = renderHook(() =>
      useMobileViewSwipe({
        activeView: 'bookshelf',
        onViewChange,
      })
    );
    act(() => {
      // Swiping right from 25px across to 120px (|deltaX| = 95 >= 40)
      bookshelfHook.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 25, clientY: 300 }));
      vi.advanceTimersByTime(150);
      bookshelfHook.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 120, clientY: 300 }));
    });
    expect(onViewChange).toHaveBeenCalledWith('catalog');
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

    // Too slow: duration = 750ms (> 650ms)
    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 500, clientY: 300 }));
      vi.advanceTimersByTime(750);
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 400, clientY: 300 }));
    });
    expect(onViewChange).not.toHaveBeenCalled();

    // Too short: distance = 25px (< 40px)
    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 500, clientY: 300 }));
      vi.advanceTimersByTime(100);
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 475, clientY: 300 }));
    });
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it('permits deliberate swipes within 650ms and responsive flicks down to 40px', () => {
    const onViewChange = vi.fn();
    const { result } = renderHook(() =>
      useMobileViewSwipe({
        activeView: 'catalog',
        onViewChange,
      })
    );

    // Deliberate swipe: duration = 580ms (previously dropped under 500ms, now accepted under 650ms)
    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 500, clientY: 300 }));
      vi.advanceTimersByTime(580);
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 420, clientY: 300 }));
    });
    expect(onViewChange).toHaveBeenCalledWith('bookshelf');
    onViewChange.mockClear();

    // Agile flick: distance = 42px (previously dropped under 50px, now accepted under 40px)
    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 500, clientY: 300 }));
      vi.advanceTimersByTime(120);
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 458, clientY: 300 }));
    });
    expect(onViewChange).toHaveBeenCalledWith('bookshelf');
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

  it('allows natural biomechanical thumb arcs conforming to 1.25 dominance ratio', () => {
    const onViewChange = vi.fn();
    const { result } = renderHook(() =>
      useMobileViewSwipe({
        activeView: 'catalog',
        onViewChange,
      })
    );

    // Natural curved thumb swipe: DeltaX = 60, DeltaY = 40 (Angle ~33.7°, ratio = 1.5)
    // Under previous 1.8 ratio (60 < 72) this failed; under 1.25 ratio (60 >= 50) this succeeds.
    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 500, clientY: 300 }));
      vi.advanceTimersByTime(120);
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 440, clientY: 340 }));
    });

    expect(onViewChange).toHaveBeenCalledWith('bookshelf');
  });

  it('invokes onSwipeDirection callback and updates lastSwipeDirection state', () => {
    const onViewChange = vi.fn();
    const onSwipeDirection = vi.fn();
    const { result } = renderHook(() =>
      useMobileViewSwipe({
        activeView: 'bookshelf',
        onViewChange,
        onSwipeDirection,
      })
    );

    // 1. Swipe left -> advance forward
    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 500, clientY: 300 }));
      vi.advanceTimersByTime(120);
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 420, clientY: 300 }));
    });

    expect(onSwipeDirection).toHaveBeenCalledWith('forward');
    expect(result.current.lastSwipeDirection).toBe('forward');
    expect(onViewChange).toHaveBeenCalledWith('favorites');

    onSwipeDirection.mockClear();

    // 2. Swipe right -> go backward
    act(() => {
      result.current.handleTouchStart(createTouchEvent('touchstart', { clientX: 400, clientY: 300 }));
      vi.advanceTimersByTime(120);
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 490, clientY: 300 }));
    });

    expect(onSwipeDirection).toHaveBeenCalledWith('backward');
    expect(result.current.lastSwipeDirection).toBe('backward');
    expect(onViewChange).toHaveBeenCalledWith('catalog');
  });

  it('handleTouchCancel safely aborts active gesture without triggering navigation', () => {
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

    // Browser touch cancellation (e.g. system gesture or incoming call)
    act(() => {
      result.current.handleTouchCancel();
    });

    act(() => {
      result.current.handleTouchEnd(createTouchEvent('touchend', { clientX: 400, clientY: 300 }));
    });

    expect(onViewChange).not.toHaveBeenCalled();
  });
});


