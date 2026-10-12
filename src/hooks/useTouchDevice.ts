'use client';

import { useSyncExternalStore } from 'react';

function subscribeTouchDevice(callback: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mqCoarse = window.matchMedia('(pointer: coarse)');
  const mqTablet = window.matchMedia('(max-width: 1366px)');
  mqCoarse.addEventListener('change', callback);
  mqTablet.addEventListener('change', callback);
  return () => {
    mqCoarse.removeEventListener('change', callback);
    mqTablet.removeEventListener('change', callback);
  };
}

function getTouchDeviceSnapshot(): boolean {
  if (typeof window === 'undefined') return false;

  const hasTouchPoints = typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 0;
  const hasCoarsePointer = Boolean(
    window.matchMedia && window.matchMedia('(pointer: coarse)').matches
  );
  const isTactile = hasTouchPoints || hasCoarsePointer;

  const isWithinTabletWidth = Boolean(
    window.matchMedia
      ? window.matchMedia('(max-width: 1366px)').matches
      : window.innerWidth <= 1366
  );

  return isTactile && isWithinTabletWidth;
}

function getServerTouchDeviceSnapshot(): boolean {
  return false;
}

/**
 * Detects whether the current device is a tactile/touchscreen device within
 * mobile/tablet viewports (width <= 1366px with coarse pointer or touch points).
 * Uses useSyncExternalStore for hydration-safe SSR execution.
 */
export function useTouchDevice(): boolean {
  return useSyncExternalStore(
    subscribeTouchDevice,
    getTouchDeviceSnapshot,
    getServerTouchDeviceSnapshot
  );
}

