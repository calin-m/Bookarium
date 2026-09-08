import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReaderDrawers } from './useReaderDrawers';

describe('useReaderDrawers Hook', () => {
  it('initializes with all drawers closed', () => {
    const { result } = renderHook(() => useReaderDrawers());

    expect(result.current.activeDrawer).toBeNull();
    expect(result.current.isTocOpen).toBe(false);
    expect(result.current.isSearchOpen).toBe(false);
    expect(result.current.isControlsOpen).toBe(false);
    expect(result.current.isTranslationsOpen).toBe(false);
    expect(result.current.isAnnotationsOpen).toBe(false);
  });

  it('opens a drawer via openDrawer', () => {
    const { result } = renderHook(() => useReaderDrawers());

    act(() => {
      result.current.openDrawer('toc');
    });

    expect(result.current.activeDrawer).toBe('toc');
    expect(result.current.isTocOpen).toBe(true);
    expect(result.current.isSearchOpen).toBe(false);
    expect(result.current.isAnnotationsOpen).toBe(false);
  });

  it('toggles a drawer open and closed', () => {
    const { result } = renderHook(() => useReaderDrawers());

    act(() => {
      result.current.toggleDrawer('search');
    });
    expect(result.current.activeDrawer).toBe('search');
    expect(result.current.isSearchOpen).toBe(true);

    act(() => {
      result.current.toggleDrawer('search');
    });
    expect(result.current.activeDrawer).toBeNull();
    expect(result.current.isSearchOpen).toBe(false);
  });

  it('switches between drawers maintaining mutual exclusivity', () => {
    const { result } = renderHook(() => useReaderDrawers());

    act(() => {
      result.current.toggleDrawer('controls');
    });
    expect(result.current.isControlsOpen).toBe(true);
    expect(result.current.isTranslationsOpen).toBe(false);

    act(() => {
      result.current.toggleDrawer('translations');
    });
    expect(result.current.isControlsOpen).toBe(false);
    expect(result.current.isTranslationsOpen).toBe(true);
  });

  it('supports annotations drawer with strict mutual exclusivity', () => {
    const { result } = renderHook(() => useReaderDrawers());

    // Open annotations
    act(() => {
      result.current.toggleDrawer('annotations');
    });
    expect(result.current.activeDrawer).toBe('annotations');
    expect(result.current.isAnnotationsOpen).toBe(true);
    expect(result.current.isTocOpen).toBe(false);
    expect(result.current.isControlsOpen).toBe(false);

    // Switch from annotations to toc
    act(() => {
      result.current.toggleDrawer('toc');
    });
    expect(result.current.activeDrawer).toBe('toc');
    expect(result.current.isAnnotationsOpen).toBe(false);
    expect(result.current.isTocOpen).toBe(true);

    // Switch from toc back to annotations
    act(() => {
      result.current.toggleDrawer('annotations');
    });
    expect(result.current.activeDrawer).toBe('annotations');
    expect(result.current.isAnnotationsOpen).toBe(true);
    expect(result.current.isTocOpen).toBe(false);
  });

  it('closes active drawer via closeDrawer', () => {
    const { result } = renderHook(() => useReaderDrawers());

    act(() => {
      result.current.openDrawer('annotations');
    });
    expect(result.current.isAnnotationsOpen).toBe(true);

    act(() => {
      result.current.closeDrawer();
    });
    expect(result.current.activeDrawer).toBeNull();
    expect(result.current.isAnnotationsOpen).toBe(false);
  });
});

