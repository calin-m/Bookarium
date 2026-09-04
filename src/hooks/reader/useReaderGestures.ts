'use client';

import { useRef, useState, useEffect } from 'react';
import { READER_FONT_CONFIG, READER_GESTURE_CONFIG } from '@/config/reader-config';

export interface UseReaderGesturesOptions {
  fontSize: number;
  readingMode: 'paginated' | 'scroll';
  onFontSizeChange?: (size: number) => void;
  onNextPage?: () => void;
  onPreviousPage?: () => void;
}

export interface ZoomFeedbackState {
  visible: boolean;
  size: number;
}

export interface UseReaderGesturesReturn {
  zoomFeedback: ZoomFeedbackState | null;
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: (e: React.TouchEvent) => void;
}

/**
 * Headless touch gesture hook encapsulating 2-finger pinch-to-zoom
 * font scaling and 1-finger horizontal page swipe detection.
 */
export function useReaderGestures({
  fontSize,
  readingMode,
  onFontSizeChange,
  onNextPage,
  onPreviousPage,
}: UseReaderGesturesOptions): UseReaderGesturesReturn {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const pinchStartRef = useRef<{ distance: number; initialFontSize: number } | null>(null);
  const [zoomFeedback, setZoomFeedback] = useState<ZoomFeedbackState | null>(null);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = null;
      }
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && onFontSizeChange) {
      // 2-finger touch: Initialize pinch-to-zoom font scaler
      touchStartRef.current = null;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartRef.current = {
        distance: Math.max(10, dist),
        initialFontSize: fontSize,
      };
      setZoomFeedback({ visible: true, size: fontSize });
    } else if (e.touches.length === 1 && readingMode === 'paginated') {
      // 1-finger touch: Initialize page swipe
      pinchStartRef.current = null;
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartRef.current && onFontSizeChange) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = currentDist / pinchStartRef.current.distance;
      const targetSize = Math.round(pinchStartRef.current.initialFontSize * ratio);
      const clampedSize = Math.min(
        READER_FONT_CONFIG.MAX_SIZE,
        Math.max(READER_FONT_CONFIG.MIN_SIZE, targetSize)
      );

      if (clampedSize !== fontSize) {
        onFontSizeChange(clampedSize);
      }
      setZoomFeedback({ visible: true, size: clampedSize });

      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (pinchStartRef.current) {
      pinchStartRef.current = null;
      if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
      zoomTimeoutRef.current = setTimeout(() => {
        setZoomFeedback(null);
      }, READER_GESTURE_CONFIG.ZOOM_FEEDBACK_DURATION_MS);
      return;
    }

    if (readingMode !== 'paginated' || !touchStartRef.current) return;
    if (e.changedTouches.length === 1) {
      const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
      const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
      const deltaTime = Date.now() - touchStartRef.current.time;

      // Minimum swipe threshold and dominant horizontal axis
      if (
        deltaTime < READER_GESTURE_CONFIG.SWIPE_MAX_DURATION_MS &&
        Math.abs(deltaX) > READER_GESTURE_CONFIG.SWIPE_MIN_DISTANCE_PX &&
        Math.abs(deltaX) > Math.abs(deltaY) * READER_GESTURE_CONFIG.SWIPE_DOMINANCE_RATIO
      ) {
        if (deltaX < 0) {
          onNextPage?.();
        } else {
          onPreviousPage?.();
        }
      }
    }
    touchStartRef.current = null;
  };

  return {
    zoomFeedback,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}

