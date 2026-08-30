import { useSyncExternalStore } from 'react';

export type PerformanceTier = 'high' | 'medium' | 'low';

export interface PerformanceInfo {
  tier: PerformanceTier;
  allowHeavyMotion: boolean;
  enablePrefetching: boolean;
  cores: number;
}

const defaultServerInfo: PerformanceInfo = {
  tier: 'high',
  allowHeavyMotion: true,
  enablePrefetching: true,
  cores: 8,
};

let lastSnapshot: PerformanceInfo = defaultServerInfo;

function getClientSnapshot(): PerformanceInfo {
  if (typeof window === 'undefined') return defaultServerInfo;

  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as any).deviceMemory || 8;
  const prefersReducedMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  let tier: PerformanceTier = 'high';
  if (cores <= 2 || memory <= 2) {
    tier = 'low';
  } else if (cores <= 4 || memory <= 4) {
    tier = 'medium';
  }

  const allowHeavyMotion = !prefersReducedMotion && tier !== 'low';
  const enablePrefetching = tier === 'high';

  if (
    lastSnapshot.tier === tier &&
    lastSnapshot.allowHeavyMotion === allowHeavyMotion &&
    lastSnapshot.enablePrefetching === enablePrefetching &&
    lastSnapshot.cores === cores
  ) {
    return lastSnapshot;
  }

  lastSnapshot = {
    tier,
    allowHeavyMotion,
    enablePrefetching,
    cores,
  };

  return lastSnapshot;
}

const subscribe = (callback: () => void) => {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {};
  }
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (media.addEventListener) {
    media.addEventListener('change', callback);
    return () => media.removeEventListener('change', callback);
  }
  return () => {};
};

export function usePerformanceTier(): PerformanceInfo {
  return useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    () => defaultServerInfo
  );
}
