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
      expect(config.button).toBeTruthy();
      expect(config.border).toBeTruthy();
      expect(config.pill).toBeTruthy();
      expect(config.activePill).toBeTruthy();
      expect(config.speechHighlight).toBeTruthy();
      expect(config.popoverBg).toBeTruthy();
    });
  });

  it('falls back gracefully to light theme for null, undefined, or invalid theme', () => {
    expect(getReaderTheme(null)).toBe(READER_THEMES.light);
    expect(getReaderTheme(undefined)).toBe(READER_THEMES.light);
    expect(getReaderTheme('invalid-theme' as any)).toBe(READER_THEMES.light);
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

