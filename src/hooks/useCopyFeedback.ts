'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Shared clipboard copy feedback hook managing keyed `copiedKey` state,
 * automatic timeout cleanup on unmount, and safe `navigator.clipboard.writeText` execution.
 */
export function useCopyFeedback<K extends string = string>(resetDelayMs = 2000) {
  const [copiedKey, setCopiedKey] = useState<K | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const triggerCopied = useCallback(
    (key: K) => {
      setCopiedKey(key);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setCopiedKey(null);
      }, resetDelayMs);
    },
    [resetDelayMs]
  );

  const copyWithFeedback = useCallback(
    (key: K, value: string, e?: { stopPropagation?: () => void }) => {
      e?.stopPropagation?.();
      if (!value) return false;
      try {
        navigator.clipboard?.writeText(value);
      } catch {
        // Non-blocking clipboard fallback
      }
      triggerCopied(key);
      return true;
    },
    [triggerCopied]
  );

  return {
    copiedKey,
    setCopiedKey,
    triggerCopied,
    copyWithFeedback,
  };
}

