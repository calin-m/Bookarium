import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePerformanceTier } from './usePerformanceTier';

describe('usePerformanceTier', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should detect performance tier and device capabilities', () => {
    const { result } = renderHook(() => usePerformanceTier());
    expect(result.current.tier).toBeDefined();
    expect(typeof result.current.allowHeavyMotion).toBe('boolean');
    expect(typeof result.current.enablePrefetching).toBe('boolean');
  });

  it('should respect reduced motion preference', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => usePerformanceTier());
    expect(result.current.allowHeavyMotion).toBe(false);
  });
});

