import { describe, it, expect, beforeEach } from 'vitest';
import {
  useThemeStore,
  applyThemeToDocument,
  initializeTheme,
  getClientPersistedTheme,
  resolveInitialTheme,
} from './useThemeStore';
import { STORAGE_KEYS } from '@/config/site-config';

describe('useThemeStore', () => {
  beforeEach(() => {
    document.cookie = `${STORAGE_KEYS.THEME}=; path=/; max-age=0`;
    localStorage.clear();
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

  it('preserves client-persisted dark or sepia theme when initializeTheme is called with fallback light', () => {
    // 1. Persisted in localStorage without cookie yet
    localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify({ state: { theme: 'dark' }, version: 0 }));
    expect(getClientPersistedTheme()).toBe('dark');
    expect(resolveInitialTheme()).toBe('dark');

    initializeTheme('light');
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // 2. Persisted in cookie as sepia
    useThemeStore.getState().setTheme('sepia');
    initializeTheme('light');
    expect(useThemeStore.getState().theme).toBe('sepia');
    expect(document.documentElement.classList.contains('sepia')).toBe(true);
  });

  it('synchronizes getInitialState().theme with active theme during initializeTheme, setTheme, and cycleTheme for SSR', () => {
    initializeTheme('dark');
    expect(useThemeStore.getInitialState().theme).toBe('dark');

    useThemeStore.getState().setTheme('sepia');
    expect(useThemeStore.getInitialState().theme).toBe('sepia');

    useThemeStore.getState().cycleTheme();
    expect(useThemeStore.getInitialState().theme).toBe('dark');

    useThemeStore.getState().cycleTheme();
    expect(useThemeStore.getInitialState().theme).toBe('light');
  });
});

