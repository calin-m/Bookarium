import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReaderGestures } from './useReaderGestures';

describe('useReaderGestures Hook', () => {
  it('initializes with null zoom feedback', () => {
    const { result } = renderHook(() =>
      useReaderGestures({
        fontSize: 18,
        readingMode: 'paginated',
      })
    );

    expect(result.current.zoomFeedback).toBeNull();
  });

  it('triggers onNextPage on leftward swipe with sufficient distance', () => {
    const handleNext = vi.fn();
    const handlePrev = vi.fn();

    const { result } = renderHook(() =>
      useReaderGestures({
        fontSize: 18,
        readingMode: 'paginated',
        onNextPage: handleNext,
        onPreviousPage: handlePrev,
      })
    );

    // Simulate 1-finger touch start at x=200, y=100
    act(() => {
      result.current.handleTouchStart({
        touches: [{ clientX: 200, clientY: 100 } as React.Touch],
      } as unknown as React.TouchEvent);
    });

    // Simulate 1-finger touch end at x=100, y=100 (deltaX = -100, swipe left)
    act(() => {
      result.current.handleTouchEnd({
        changedTouches: [{ clientX: 100, clientY: 100 } as React.Touch],
      } as unknown as React.TouchEvent);
    });

    expect(handleNext).toHaveBeenCalledTimes(1);
    expect(handlePrev).not.toHaveBeenCalled();
  });

  it('triggers onPreviousPage on rightward swipe with sufficient distance', () => {
    const handleNext = vi.fn();
    const handlePrev = vi.fn();

    const { result } = renderHook(() =>
      useReaderGestures({
        fontSize: 18,
        readingMode: 'paginated',
        onNextPage: handleNext,
        onPreviousPage: handlePrev,
      })
    );

    act(() => {
      result.current.handleTouchStart({
        touches: [{ clientX: 100, clientY: 100 } as React.Touch],
      } as unknown as React.TouchEvent);
    });

    act(() => {
      result.current.handleTouchEnd({
        changedTouches: [{ clientX: 200, clientY: 100 } as React.Touch],
      } as unknown as React.TouchEvent);
    });

    expect(handlePrev).toHaveBeenCalledTimes(1);
    expect(handleNext).not.toHaveBeenCalled();
  });

  it('does not trigger swipe if vertical delta exceeds threshold ratio', () => {
    const handleNext = vi.fn();
    const handlePrev = vi.fn();

    const { result } = renderHook(() =>
      useReaderGestures({
        fontSize: 18,
        readingMode: 'paginated',
        onNextPage: handleNext,
        onPreviousPage: handlePrev,
      })
    );

    act(() => {
      result.current.handleTouchStart({
        touches: [{ clientX: 100, clientY: 100 } as React.Touch],
      } as unknown as React.TouchEvent);
    });

    // deltaX = 50, deltaY = 60 (dominant vertical scroll)
    act(() => {
      result.current.handleTouchEnd({
        changedTouches: [{ clientX: 150, clientY: 160 } as React.Touch],
      } as unknown as React.TouchEvent);
    });

    expect(handlePrev).not.toHaveBeenCalled();
    expect(handleNext).not.toHaveBeenCalled();
  });

  it('handles 2-finger pinch scaling and clamps font size', () => {
    const handleFontChange = vi.fn();

    const { result } = renderHook(() =>
      useReaderGestures({
        fontSize: 18,
        readingMode: 'paginated',
        onFontSizeChange: handleFontChange,
      })
    );

    // Initial 2-finger touch: distance = 100
    act(() => {
      result.current.handleTouchStart({
        touches: [
          { clientX: 100, clientY: 100 } as React.Touch,
          { clientX: 200, clientY: 100 } as React.Touch,
        ],
      } as unknown as React.TouchEvent);
    });

    expect(result.current.zoomFeedback).toEqual({ visible: true, size: 18 });

    // Pinch expand: distance = 150 -> ratio = 1.5 -> target = 27
    act(() => {
      result.current.handleTouchMove({
        touches: [
          { clientX: 75, clientY: 100 } as React.Touch,
          { clientX: 225, clientY: 100 } as React.Touch,
        ],
      } as unknown as React.TouchEvent);
    });

    expect(handleFontChange).toHaveBeenCalledWith(27);
    expect(result.current.zoomFeedback?.size).toBe(27);
  });

  it('cancels pending zoom feedback timeout upon unmounting or repeated pinch operations', () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const onFontSizeChange = vi.fn();

    const { result, unmount } = renderHook(() =>
      useReaderGestures({
        fontSize: 18,
        readingMode: 'paginated',
        onFontSizeChange,
      })
    );

    // Call handleTouchEnd when touchStartRef is null (early return)
    act(() => {
      result.current.handleTouchEnd({
        touches: [],
        changedTouches: [{ clientX: 100, clientY: 100 } as React.Touch],
      } as unknown as React.TouchEvent);
    });

    // Trigger pinch touch start
    act(() => {
      result.current.handleTouchStart({
        touches: [
          { clientX: 100, clientY: 100 } as React.Touch,
          { clientX: 200, clientY: 100 } as React.Touch,
        ],
      } as unknown as React.TouchEvent);
    });

    // Trigger pinch touch end (schedules zoom timeout)
    act(() => {
      result.current.handleTouchEnd({
        touches: [],
        changedTouches: [{ clientX: 100, clientY: 100 } as React.Touch],
      } as unknown as React.TouchEvent);
    });

    // Another pinch move while zoomTimeoutRef is set clears the pending timeout
    act(() => {
      result.current.handleTouchStart({
        touches: [
          { clientX: 100, clientY: 100 } as React.Touch,
          { clientX: 200, clientY: 100 } as React.Touch,
        ],
      } as unknown as React.TouchEvent);
      result.current.handleTouchMove({
        touches: [
          { clientX: 80, clientY: 100 } as React.Touch,
          { clientX: 220, clientY: 100 } as React.Touch,
        ],
      } as unknown as React.TouchEvent);
    });

    // End pinch again and advance timer to execute timeout callback
    act(() => {
      result.current.handleTouchEnd({
        touches: [],
        changedTouches: [{ clientX: 80, clientY: 100 } as React.Touch],
      } as unknown as React.TouchEvent);
    });

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(result.current.zoomFeedback).toBeNull();

    // Trigger one more pinch touch end to schedule timeout before unmount
    act(() => {
      result.current.handleTouchStart({
        touches: [
          { clientX: 100, clientY: 100 } as React.Touch,
          { clientX: 200, clientY: 100 } as React.Touch,
        ],
      } as unknown as React.TouchEvent);
      result.current.handleTouchEnd({
        touches: [],
        changedTouches: [{ clientX: 100, clientY: 100 } as React.Touch],
      } as unknown as React.TouchEvent);
    });

    // Unmount hook while timeout is pending
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    vi.useRealTimers();
    clearTimeoutSpy.mockRestore();
  });

  it('suppresses swipe navigation when text selection is active', () => {
    const handleNext = vi.fn();
    const handlePrev = vi.fn();

    // Mock active selection
    const mockSelection = {
      isCollapsed: false,
      toString: () => 'selected sentence for note or highlight',
    };
    vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection as unknown as Selection);

    const { result } = renderHook(() =>
      useReaderGestures({
        fontSize: 18,
        readingMode: 'paginated',
        onNextPage: handleNext,
        onPreviousPage: handlePrev,
      })
    );

    act(() => {
      result.current.handleTouchStart({
        touches: [{ clientX: 200, clientY: 100 } as React.Touch],
      } as unknown as React.TouchEvent);
    });

    act(() => {
      result.current.handleTouchEnd({
        changedTouches: [{ clientX: 100, clientY: 100 } as React.Touch],
      } as unknown as React.TouchEvent);
    });

    expect(handleNext).not.toHaveBeenCalled();
    expect(handlePrev).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('suppresses swipe navigation when touch target is inside a dialog or popover', () => {
    const handleNext = vi.fn();
    const { result } = renderHook(() =>
      useReaderGestures({
        fontSize: 18,
        readingMode: 'paginated',
        onNextPage: handleNext,
      })
    );

    act(() => {
      result.current.handleTouchStart({
        touches: [{ clientX: 200, clientY: 100 } as React.Touch],
      } as unknown as React.TouchEvent);
    });

    const mockTarget = {
      closest: vi.fn((selector: string) => {
        if (selector.includes('[role="dialog"]')) return document.createElement('div');
        return null;
      }),
    };

    act(() => {
      result.current.handleTouchEnd({
        target: mockTarget,
        changedTouches: [{ clientX: 100, clientY: 100 } as React.Touch],
      } as unknown as React.TouchEvent);
    });

    expect(handleNext).not.toHaveBeenCalled();
  });

  it('triggers onTapSurface on clean single-finger tap and ignores taps on marks or swipes', () => {
    const onTapSurface = vi.fn();
    const handleNext = vi.fn();

    const { result } = renderHook(() =>
      useReaderGestures({
        fontSize: 18,
        readingMode: 'paginated',
        onNextPage: handleNext,
        onTapSurface,
      })
    );

    // 1. Clean single tap (movement <= 10px) triggers onTapSurface
    act(() => {
      result.current.handleTouchStart({
        touches: [{ clientX: 150, clientY: 200 } as React.Touch],
      } as unknown as React.TouchEvent);
    });
    act(() => {
      result.current.handleTouchEnd({
        changedTouches: [{ clientX: 152, clientY: 201 } as React.Touch],
      } as unknown as React.TouchEvent);
    });

    expect(onTapSurface).toHaveBeenCalledTimes(1);
    expect(handleNext).not.toHaveBeenCalled();

    // 2. Tapping inside a highlight <mark> does NOT trigger onTapSurface
    onTapSurface.mockClear();
    act(() => {
      result.current.handleTouchStart({
        touches: [{ clientX: 150, clientY: 200 } as React.Touch],
      } as unknown as React.TouchEvent);
    });
    const markTarget = {
      closest: vi.fn((selector: string) =>
        selector.includes('mark') ? document.createElement('mark') : null
      ),
    };
    act(() => {
      result.current.handleTouchEnd({
        target: markTarget,
        changedTouches: [{ clientX: 150, clientY: 200 } as React.Touch],
      } as unknown as React.TouchEvent);
    });
    expect(onTapSurface).not.toHaveBeenCalled();
  });
});

