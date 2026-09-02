'use client';

import { useState, useCallback } from 'react';

export type ReaderDrawerType = 'toc' | 'search' | 'controls' | 'translations';

export interface UseReaderDrawersReturn {
  activeDrawer: ReaderDrawerType | null;
  isTocOpen: boolean;
  isSearchOpen: boolean;
  isControlsOpen: boolean;
  isTranslationsOpen: boolean;
  toggleDrawer: (drawer: ReaderDrawerType) => void;
  closeDrawer: () => void;
  openDrawer: (drawer: ReaderDrawerType) => void;
}

/**
 * Headless hook to manage the 4 mutually-exclusive reader drawers
 * (TOC, Search, Controls, Translations) with guaranteed single active drawer state.
 */
export function useReaderDrawers(): UseReaderDrawersReturn {
  const [activeDrawer, setActiveDrawer] = useState<ReaderDrawerType | null>(null);

  const toggleDrawer = useCallback((drawer: ReaderDrawerType) => {
    setActiveDrawer((current) => (current === drawer ? null : drawer));
  }, []);

  const closeDrawer = useCallback(() => {
    setActiveDrawer(null);
  }, []);

  const openDrawer = useCallback((drawer: ReaderDrawerType) => {
    setActiveDrawer(drawer);
  }, []);

  return {
    activeDrawer,
    isTocOpen: activeDrawer === 'toc',
    isSearchOpen: activeDrawer === 'search',
    isControlsOpen: activeDrawer === 'controls',
    isTranslationsOpen: activeDrawer === 'translations',
    toggleDrawer,
    closeDrawer,
    openDrawer,
  };
}

