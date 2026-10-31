import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCopyFeedback } from './useCopyFeedback';

describe('useCopyFeedback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('writes to navigator.clipboard, sets copiedKey, and resets after resetDelayMs', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });

    const { result, unmount } = renderHook(() => useCopyFeedback<'link' | 'author'>(1500));
    expect(result.current.copiedKey).toBeNull();

    // Empty string is a no-op
    act(() => {
      expect(result.current.copyWithFeedback('link', '')).toBe(false);
    });
    expect(result.current.copiedKey).toBeNull();

    const stopPropagation = vi.fn();
    act(() => {
      expect(
        result.current.copyWithFeedback('link', 'https://bookarium.app/read/1342', {
          stopPropagation,
        })
      ).toBe(true);
    });
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(writeTextMock).toHaveBeenCalledWith('https://bookarium.app/read/1342');
    expect(result.current.copiedKey).toBe('link');

    // Re-triggering replaces the timer cleanly
    act(() => {
      result.current.triggerCopied('author');
    });
    expect(result.current.copiedKey).toBe('author');

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.copiedKey).toBeNull();

    // Unmounting while a timer is active cleans up without errors
    act(() => {
      result.current.triggerCopied('link');
    });
    unmount();
  });
});

