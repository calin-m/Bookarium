import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCursorTooltip } from './useCursorTooltip';

describe('useCursorTooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useCursorTooltip({ initialAction: 'preview' }));

    expect(result.current.mousePos).toBeNull();
    expect(result.current.showTooltip).toBe(false);
    expect(result.current.hoveredAction).toBe('preview');
  });

  it('updates mouse coordinates on handleMouseMove', () => {
    const { result } = renderHook(() => useCursorTooltip());

    act(() => {
      result.current.handleMouseMove({ clientX: 150, clientY: 250 } as any);
    });

    expect(result.current.mousePos).toEqual({ x: 150, y: 250 });
  });

  it('activates tooltip after specified delay on mouseEnter', () => {
    const { result } = renderHook(() => useCursorTooltip({ delayMs: 300 }));

    act(() => {
      result.current.handleMouseEnter();
    });

    expect(result.current.showTooltip).toBe(false);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.showTooltip).toBe(true);
  });

  it('cleans up state and resets action on mouseLeave', () => {
    const { result } = renderHook(() => useCursorTooltip({ initialAction: 'default' }));

    act(() => {
      result.current.handleMouseMove({ clientX: 100, clientY: 100 } as any);
      result.current.handleMouseEnter();
      result.current.setHoveredAction('custom');
      vi.advanceTimersByTime(400);
    });

    expect(result.current.showTooltip).toBe(true);
    expect(result.current.hoveredAction).toBe('custom');

    act(() => {
      result.current.handleMouseLeave();
    });

    expect(result.current.showTooltip).toBe(false);
    expect(result.current.mousePos).toBeNull();
    expect(result.current.hoveredAction).toBe('default');
  });
});

