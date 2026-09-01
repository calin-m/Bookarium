import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore, applyThemeToDocument } from './useThemeStore';

describe('useThemeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'light' });
    document.documentElement.className = '';
  });

  it('initializes with default light theme', () => {
    expect(useThemeStore.getState().theme).toBe('light');
  });

  it('sets sepia theme and syncs sepia DOM class', () => {
    useThemeStore.getState().setTheme('sepia');
    expect(useThemeStore.getState().theme).toBe('sepia');
    expect(document.documentElement.classList.contains('sepia')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('sets dark theme and syncs dark DOM class', () => {
    useThemeStore.getState().setTheme('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('sepia')).toBe(false);
  });

  it('sets light theme and clears dark/sepia DOM classes', () => {
    useThemeStore.getState().setTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    useThemeStore.getState().setTheme('light');
    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('sepia')).toBe(false);
  });

  it('cycles theme through light -> sepia -> dark -> light', () => {
    expect(useThemeStore.getState().theme).toBe('light');

    useThemeStore.getState().cycleTheme();
    expect(useThemeStore.getState().theme).toBe('sepia');

    useThemeStore.getState().cycleTheme();
    expect(useThemeStore.getState().theme).toBe('dark');

    useThemeStore.getState().cycleTheme();
    expect(useThemeStore.getState().theme).toBe('light');
  });

  it('applyThemeToDocument handles document manipulation safely', () => {
    applyThemeToDocument('sepia');
    expect(document.documentElement.classList.contains('sepia')).toBe(true);

    applyThemeToDocument('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    applyThemeToDocument('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('sepia')).toBe(false);
  });
});

