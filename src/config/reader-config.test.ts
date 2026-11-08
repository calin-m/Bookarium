import { describe, it, expect } from 'vitest';
import {
  READER_FONT_CONFIG,
  READER_GESTURE_CONFIG,
  resolveDefaultReaderFontSize,
} from './reader-config';

describe('reader-config', () => {
  it('defines valid font size boundaries, device defaults, and presets', () => {
    expect(READER_FONT_CONFIG.MIN_SIZE).toBeLessThan(READER_FONT_CONFIG.MAX_SIZE);
    expect(READER_FONT_CONFIG.MOBILE_DEFAULT_SIZE).toBe(15);
    expect(READER_FONT_CONFIG.TABLET_DEFAULT_SIZE).toBe(17);
    expect(READER_FONT_CONFIG.DEFAULT_SIZE).toBe(18);
    expect(READER_FONT_CONFIG.DEFAULT_LINE_HEIGHT).toBeGreaterThan(1);
    expect(READER_FONT_CONFIG.PRESET_SIZES).toEqual([15, 18, 22]);
    expect(READER_FONT_CONFIG.MIN_BRIGHTNESS).toBeLessThan(READER_FONT_CONFIG.MAX_BRIGHTNESS);
    expect(READER_FONT_CONFIG.DEFAULT_BRIGHTNESS).toBe(100);
    expect(READER_FONT_CONFIG.PRESET_BRIGHTNESS).toEqual([50, 75, 100]);
  });

  it('resolves device-adaptive default font size across phone, tablet, and desktop widths', () => {
    expect(resolveDefaultReaderFontSize(375)).toBe(15);
    expect(resolveDefaultReaderFontSize(639)).toBe(15);
    expect(resolveDefaultReaderFontSize(640)).toBe(17);
    expect(resolveDefaultReaderFontSize(768)).toBe(17);
    expect(resolveDefaultReaderFontSize(1023)).toBe(17);
    expect(resolveDefaultReaderFontSize(1024)).toBe(18);
    expect(resolveDefaultReaderFontSize(1440)).toBe(18);
    expect(resolveDefaultReaderFontSize()).toBe(18);
  });

  it('defines valid gesture and damped pinch-to-zoom thresholds', () => {
    expect(READER_GESTURE_CONFIG.SWIPE_MIN_DISTANCE_PX).toBeGreaterThan(0);
    expect(READER_GESTURE_CONFIG.SWIPE_MAX_DURATION_MS).toBeGreaterThan(0);
    expect(READER_GESTURE_CONFIG.SWIPE_DOMINANCE_RATIO).toBeGreaterThan(1);
    expect(READER_GESTURE_CONFIG.PINCH_DEADZONE_PX).toBe(14);
    expect(READER_GESTURE_CONFIG.PINCH_PIXELS_PER_STEP).toBe(24);
    expect(READER_GESTURE_CONFIG.ZOOM_FEEDBACK_DURATION_MS).toBeGreaterThan(0);
    expect(READER_GESTURE_CONFIG.AUTO_FOCUS_DELAY_MS).toBeGreaterThan(0);
    expect(READER_GESTURE_CONFIG.TAP_MAX_DURATION_MS).toBeGreaterThan(0);
    expect(READER_GESTURE_CONFIG.TAP_MAX_MOVEMENT_PX).toBeGreaterThan(0);
  });
});

