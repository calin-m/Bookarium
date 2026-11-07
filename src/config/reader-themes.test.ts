import { describe, it, expect } from 'vitest';
import {
  getReaderTheme,
  READER_THEMES,
  NEXT_READER_THEME,
  type ReaderThemeConfig,
} from './reader-themes';
import type { ReaderTheme } from '@/stores/useReaderStore';

describe('reader-themes', () => {
  it('returns valid config tokens for all supported themes', () => {
    const themes: ReaderTheme[] = ['light', 'sepia', 'dark'];

    themes.forEach((theme) => {
      const config: ReaderThemeConfig = getReaderTheme(theme);
      expect(config).toBeDefined();
      expect(config.surface).toBeTruthy();
      expect(config.header).toBeTruthy();
      expect(config.footer).toBeTruthy();
      expect(config.pill).toBeTruthy();
      expect(config.activePill).toBeTruthy();
      expect(config.inactivePill).toBeTruthy();
      expect(config.button).toBeTruthy();
      expect(config.border).toBeTruthy();
      expect(config.textMuted).toBeTruthy();
      expect(config.drawerBg).toBeTruthy();
      expect(config.drawerActive).toBeTruthy();
      expect(config.drawerHover).toBeTruthy();
      expect(config.scrollbarClass).toContain(`reader-surface-${theme}`);
      expect(config.iconAccent).toBeTruthy();
      expect(config.speechHighlight).toBeTruthy();
      expect(config.popoverBg).toBeTruthy();
    });

    expect(READER_THEMES.light.surface).toContain('bg-[#fcfbf9]');
    expect(READER_THEMES.sepia.surface).toContain('bg-[#2b1d16]');
    expect(READER_THEMES.dark.surface).toContain('bg-[#0e1117]');
    expect(READER_THEMES.light.header).toContain('shadow-sm');
    expect(READER_THEMES.sepia.header).toContain('bg-[#332219]');
    expect(READER_THEMES.dark.header).toContain('bg-[#161b26]');
  });

  it('falls back gracefully to light theme for null, undefined, or invalid theme', () => {
    expect(getReaderTheme(null)).toBe(READER_THEMES.light);
    expect(getReaderTheme(undefined)).toBe(READER_THEMES.light);
    expect(getReaderTheme('invalid-theme' as unknown as ReaderTheme)).toBe(READER_THEMES.light);
  });

  it('correctly cycles through themes with NEXT_READER_THEME', () => {
    expect(NEXT_READER_THEME.light).toBe('sepia');
    expect(NEXT_READER_THEME.sepia).toBe('dark');
    expect(NEXT_READER_THEME.dark).toBe('light');

    // Full 3-step cycle returns to start
    let current: ReaderTheme = 'light';
    current = NEXT_READER_THEME[current];
    expect(current).toBe('sepia');
    current = NEXT_READER_THEME[current];
    expect(current).toBe('dark');
    current = NEXT_READER_THEME[current];
    expect(current).toBe('light');
  });
});

