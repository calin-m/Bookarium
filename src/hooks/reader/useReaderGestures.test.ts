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

  it('cancels pending zoom feedback timeout upon unmounting', () => {
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
});

