import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReadingTimer } from './useReadingTimer';
import { useHabitsStore } from '@/stores/useHabitsStore';

describe('useReadingTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    useHabitsStore.getState().resetHabits();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when disabled or bookId is missing', () => {
    renderHook(() => useReadingTimer({ enabled: false, bookId: 123 }));
    expect(useHabitsStore.getState().activeDates).toHaveLength(0);

    renderHook(() => useReadingTimer({ enabled: true, bookId: undefined }));
    expect(useHabitsStore.getState().activeDates).toHaveLength(0);
  });

  it('does not grant daily streak on mounting until 5 minutes of immersion are completed', () => {
    renderHook(() => useReadingTimer({ enabled: true, bookId: 456 }));
    expect(useHabitsStore.getState().activeDates).toHaveLength(0);
  });

  it('accumulates reading seconds and flushes on interval', () => {
    renderHook(() =>
      useReadingTimer({
        enabled: true,
        bookId: 789,
        idleTimeoutMs: 5000,
        flushIntervalMs: 5000,
      })
    );

    // Advance 4 seconds
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    // Before flush interval, store still has 0 uncommitted
    expect(useHabitsStore.getState().totalReadingSeconds).toBe(0);

    // Advance 1 more second to hit 5s flush interval
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(useHabitsStore.getState().totalReadingSeconds).toBe(5);
  });

  it('flushes uncommitted seconds on unmount', () => {
    const { unmount } = renderHook(() =>
      useReadingTimer({
        enabled: true,
        bookId: 789,
        idleTimeoutMs: 10000,
        flushIntervalMs: 30000,
      })
    );

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    expect(useHabitsStore.getState().totalReadingSeconds).toBe(0);

    unmount();

    expect(useHabitsStore.getState().totalReadingSeconds).toBe(8);
  });

  it('stops accumulating seconds when user is idle beyond idleTimeoutMs', () => {
    renderHook(() =>
      useReadingTimer({
        enabled: true,
        bookId: 789,
        idleTimeoutMs: 3000,
        flushIntervalMs: 10000,
      })
    );

    // Active 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Now idle for 10 seconds without interactions
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Flush occurred at 10s: should only have accumulated the 3 active seconds
    expect(useHabitsStore.getState().totalReadingSeconds).toBe(3);
  });

  it('resets idle guard when registerInteraction is invoked', () => {
    const { result } = renderHook(() =>
      useReadingTimer({
        enabled: true,
        bookId: 789,
        idleTimeoutMs: 3000,
        flushIntervalMs: 10000,
      })
    );

    // Active 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // User interacts (page turn / scroll)
    act(() => {
      result.current.registerInteraction();
    });

    // Another 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Advance to flush: ticks at t=5 (3s after interaction), then idle for remaining time
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(useHabitsStore.getState().totalReadingSeconds).toBe(5);
  });

  it('tracks listening duration when isPlayingTTS is true, even in background tab', () => {
    const { unmount } = renderHook(() =>
      useReadingTimer({
        enabled: true,
        bookId: 999,
        isPlayingTTS: true,
        flushIntervalMs: 60000,
      })
    );

    // Simulate tab hidden (user switched to another tab)
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    act(() => {
      vi.advanceTimersByTime(10000); // 10 seconds of TTS listening in background
    });

    unmount();

    expect(useHabitsStore.getState().totalListeningSeconds).toBe(10);
    expect(useHabitsStore.getState().totalReadingSeconds).toBe(0);
  });

  it('pauses visual reading time when tab is hidden but resumes when visible', () => {
    const { unmount } = renderHook(() =>
      useReadingTimer({
        enabled: true,
        bookId: 888,
        isPlayingTTS: false,
        flushIntervalMs: 60000,
      })
    );

    // Visible for 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Switch tab to hidden for 10 seconds
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Switch tab back to visible for 5 seconds
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    unmount();

    // Total should be 5s + 5s = 10s, excluding the 10s hidden
    expect(useHabitsStore.getState().totalReadingSeconds).toBe(10);
  });

  it('qualifies 5-minute daily streak when 300 seconds of immersion are accumulated', () => {
    const { unmount } = renderHook(() =>
      useReadingTimer({
        enabled: true,
        bookId: 777,
        flushIntervalMs: 15000,
        idleTimeoutMs: 600000, // 10 min idle guard
      })
    );

    act(() => {
      vi.advanceTimersByTime(290000); // 290 seconds (under 5 minutes)
    });
    expect(useHabitsStore.getState().activeDates).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(15000); // Crosses 305 seconds (>= 300s)
    });

    unmount();

    expect(useHabitsStore.getState().activeDates.length).toBe(1);
    expect(useHabitsStore.getState().getStreakStats().hasReadToday).toBe(true);
  });
});
