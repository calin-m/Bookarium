import { describe, it, expect } from 'vitest';
import {
  ANNOTATION_COLOR_CONFIG,
  ANNOTATION_COLOR_LIST,
  ALL_COLORS_FILTER_BADGE,
} from './annotation-tokens';
import type { HighlightColor } from '@/stores/useAnnotationStore';

describe('annotation-tokens', () => {
  const expectedColors: HighlightColor[] = ['yellow', 'amber', 'mint', 'rose'];

  it('contains configurations for all 4 primary highlight colors', () => {
    expect(Object.keys(ANNOTATION_COLOR_CONFIG)).toEqual(expectedColors);
  });

  it('populates ANNOTATION_COLOR_LIST with all 4 items', () => {
    expect(ANNOTATION_COLOR_LIST).toHaveLength(4);
    expect(ANNOTATION_COLOR_LIST.map((c) => c.id)).toEqual(expectedColors);
  });

  it('provides complete styling tokens for each color theme', () => {
    for (const color of expectedColors) {
      const theme = ANNOTATION_COLOR_CONFIG[color];
      expect(theme.id).toBe(color);
      expect(theme.label).toBeTruthy();
      expect(theme.detailedLabel).toBeTruthy();
      expect(theme.dotClass).toContain('bg-');
      expect(theme.popoverPillClass).toContain('bg-');
      expect(theme.popoverActiveRing).toContain('ring-');
      expect(theme.notebookSwatchClass).toContain('bg-');
      expect(theme.notebookActiveRing).toContain('ring-');
      expect(theme.filterBadgeClass).toContain('border');
      expect(theme.cardBorderClass).toContain('border-l-');
      expect(theme.cardBgClass).toContain('bg-');
      expect(theme.cardTextClass).toContain('text-');
      expect(theme.drawerCardClass).toContain('border-l-');
      expect(theme.surfaceHighlightClass).toContain('border-b-2');
    }
  });

  it('exports valid fallback class for all colors filter badge', () => {
    expect(ALL_COLORS_FILTER_BADGE).toContain('bg-stone-200');
  });
});

