import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  usePerformanceTier,
  getClientSnapshot,
  defaultServerInfo,
} from './usePerformanceTier';

describe('usePerformanceTier', () => {
  const originalHardwareConcurrency = Object.getOwnPropertyDescriptor(
    window.navigator,
    'hardwareConcurrency'
  );
  const originalDeviceMemory = Object.getOwnPropertyDescriptor(
    window.navigator,
    'deviceMemory'
  );

  const setHardwareProfile = (cores?: number, deviceMemory?: number) => {
    Object.defineProperty(window.navigator, 'hardwareConcurrency', {
      configurable: true,
      value: cores,
    });
    Object.defineProperty(window.navigator, 'deviceMemory', {
      configurable: true,
      value: deviceMemory,
    });
  };

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalHardwareConcurrency) {
      Object.defineProperty(
        window.navigator,
        'hardwareConcurrency',
        originalHardwareConcurrency
      );
    }
    if (originalDeviceMemory) {
      Object.defineProperty(
        window.navigator,
        'deviceMemory',
        originalDeviceMemory
      );
    } else {
      Reflect.deleteProperty(
        window.navigator as unknown as Record<string, unknown>,
        'deviceMemory'
      );
    }
  });

  it('classifies high, medium, and low hardware tiers and caches frozen snapshots', () => {
    setHardwareProfile(8, 8);
    const { result: highResult } = renderHook(() => usePerformanceTier());
    expect(highResult.current).toEqual({
      tier: 'high',
      allowHeavyMotion: true,
      enablePrefetching: true,
      cores: 8,
    });
    expect(getClientSnapshot()).toBe(highResult.current);
    expect(Object.isFrozen(highResult.current)).toBe(true);
    expect(Object.isFrozen(defaultServerInfo)).toBe(true);

    setHardwareProfile(4, 8);
    const { result: mediumResult } = renderHook(() => usePerformanceTier());
    expect(mediumResult.current).toEqual({
      tier: 'medium',
      allowHeavyMotion: true,
      enablePrefetching: false,
      cores: 4,
    });

    setHardwareProfile(2, 8);
    const { result: lowCoresResult } = renderHook(() => usePerformanceTier());
    expect(lowCoresResult.current).toEqual({
      tier: 'low',
      allowHeavyMotion: false,
      enablePrefetching: false,
      cores: 2,
    });

    setHardwareProfile(8, 2);
    const { result: lowMemoryResult } = renderHook(() => usePerformanceTier());
    expect(lowMemoryResult.current).toEqual({
      tier: 'low',
      allowHeavyMotion: false,
      enablePrefetching: false,
      cores: 8,
    });
  });

  it('should respect reduced motion preference and clean up matchMedia listeners on unmount', () => {
    setHardwareProfile(8, 8);
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();

    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener,
      removeEventListener,
      dispatchEvent: vi.fn(),
    }));

    const { result, unmount } = renderHook(() => usePerformanceTier());
    expect(result.current.tier).toBe('high');
    expect(result.current.allowHeavyMotion).toBe(false);
    expect(result.current.enablePrefetching).toBe(true);
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    unmount();
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});

