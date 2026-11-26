import { describe, it, expect } from 'vitest';
import {
  ANNOTATION_COLOR_CONFIG,
  ANNOTATION_COLOR_LIST,
  ALL_COLORS_FILTER_BADGE,
  BOOKMARK_DRAWER_TOKEN,
} from './annotation-tokens';
import type { HighlightColor } from '@/stores/useAnnotationStore';

describe('annotation-tokens', () => {
  const expectedColors: HighlightColor[] = ['yellow', 'amber', 'mint', 'rose', 'sky', 'lavender', 'indigo'];

  it('contains configurations for all 7 archival highlight colors', () => {
    expect(Object.keys(ANNOTATION_COLOR_CONFIG)).toEqual(expectedColors);
  });

  it('populates ANNOTATION_COLOR_LIST with all 7 items', () => {
    expect(ANNOTATION_COLOR_LIST).toHaveLength(7);
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
      expect(theme.overlapRingClass).toContain('ring-');
    }
  });

  it('exports valid fallback class for all colors filter badge', () => {
    expect(ALL_COLORS_FILTER_BADGE).toContain('bg-stone-200');
  });

  it('exports proprietary BOOKMARK_DRAWER_TOKEN leather-brown styling separate from highlight colors', () => {
    expect(BOOKMARK_DRAWER_TOKEN.id).toBe('bookmark');
    expect(BOOKMARK_DRAWER_TOKEN.label).toBe('Bookmark');
    expect(BOOKMARK_DRAWER_TOKEN.dotClass).toContain('bg-primary');
    expect(BOOKMARK_DRAWER_TOKEN.pillActiveClass).toContain('border-primary-');
    expect(BOOKMARK_DRAWER_TOKEN.badgeClass).toContain('bg-primary-');
    expect(BOOKMARK_DRAWER_TOKEN.drawerCardClass).toContain('border-l-primary-');
    expect(BOOKMARK_DRAWER_TOKEN.jumpLinkClass).toContain('text-primary');
    expect(BOOKMARK_DRAWER_TOKEN.quoteHoverUnderlineClass).toContain('decoration-primary/');
    expect(BOOKMARK_DRAWER_TOKEN.surfacePulseRingClass).toContain('ring-primary/');
    expect(Object.keys(ANNOTATION_COLOR_CONFIG)).not.toContain('bookmark');
    expect(ANNOTATION_COLOR_LIST.map((c) => c.id as string)).not.toContain('bookmark');
  });
});

