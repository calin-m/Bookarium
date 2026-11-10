'use client';

import { useState, useEffect } from 'react';

export interface VisualViewportKeyboardState {
  keyboardHeight: number;
  isKeyboardOpen: boolean;
}

/**
 * useVisualViewportKeyboard
 * Tracks mobile software virtual keyboard elevation in real time via the Visual Viewport API.
 * Returns the keyboard height in pixels and a boolean indicator when keyboard is actively displayed.
 */
export function useVisualViewportKeyboard(): VisualViewportKeyboardState {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) {
      return;
    }

    const vv = window.visualViewport;

    const handleViewportChange = () => {
      // Calculate vertical difference between standard layout height and visual viewport height
      const offset = Math.max(0, window.innerHeight - vv.height - (vv.offsetTop || 0));
      
      // Mobile software keyboards typically occupy >= 100px of vertical screen real estate
      if (offset >= 100) {
        setKeyboardHeight(Math.round(offset));
      } else {
        setKeyboardHeight(0);
      }
    };

    vv.addEventListener('resize', handleViewportChange);
    vv.addEventListener('scroll', handleViewportChange);

    // Initial evaluation
    handleViewportChange();

    return () => {
      vv.removeEventListener('resize', handleViewportChange);
      vv.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  return {
    keyboardHeight,
    isKeyboardOpen: keyboardHeight > 0,
  };
}
