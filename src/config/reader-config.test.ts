import { describe, it, expect } from 'vitest';
import { READER_FONT_CONFIG, READER_GESTURE_CONFIG } from './reader-config';

describe('reader-config', () => {
  it('defines valid font size boundaries and defaults', () => {
    expect(READER_FONT_CONFIG.MIN_SIZE).toBeLessThan(READER_FONT_CONFIG.MAX_SIZE);
    expect(READER_FONT_CONFIG.DEFAULT_SIZE).toBeGreaterThanOrEqual(READER_FONT_CONFIG.MIN_SIZE);
    expect(READER_FONT_CONFIG.DEFAULT_SIZE).toBeLessThanOrEqual(READER_FONT_CONFIG.MAX_SIZE);
    expect(READER_FONT_CONFIG.DEFAULT_LINE_HEIGHT).toBeGreaterThan(1);
    expect(READER_FONT_CONFIG.PRESET_SIZES.length).toBeGreaterThan(0);
  });

  it('defines valid gesture thresholds', () => {
    expect(READER_GESTURE_CONFIG.SWIPE_MIN_DISTANCE_PX).toBeGreaterThan(0);
    expect(READER_GESTURE_CONFIG.SWIPE_MAX_DURATION_MS).toBeGreaterThan(0);
    expect(READER_GESTURE_CONFIG.SWIPE_DOMINANCE_RATIO).toBeGreaterThan(1);
    expect(READER_GESTURE_CONFIG.ZOOM_FEEDBACK_DURATION_MS).toBeGreaterThan(0);
    expect(READER_GESTURE_CONFIG.AUTO_FOCUS_DELAY_MS).toBeGreaterThan(0);
  });
});

