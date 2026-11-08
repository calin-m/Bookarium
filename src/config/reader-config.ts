/**
 * Centralized Configuration Constants for Reader Typography, Gestures & Layout
 */

export const READER_FONT_CONFIG = {
  MIN_SIZE: 12,
  MAX_SIZE: 36,
  MOBILE_DEFAULT_SIZE: 15,
  TABLET_DEFAULT_SIZE: 17,
  DEFAULT_SIZE: 18,
  DEFAULT_LINE_HEIGHT: 1.75,
  PRESET_SIZES: [15, 18, 22] as const,
  MIN_BRIGHTNESS: 30,
  MAX_BRIGHTNESS: 100,
  DEFAULT_BRIGHTNESS: 100,
  PRESET_BRIGHTNESS: [50, 75, 100] as const,
} as const;

/**
 * Resolves the ergonomic default reader font size based on the device viewport width:
 * - Phone (`< 640px`): `15px`
 * - Tablet (`640px – 1023px`): `17px`
 * - Desktop (`>= 1024px` or SSR): `18px`
 */
export function resolveDefaultReaderFontSize(viewportWidth?: number): number {
  const width =
    typeof viewportWidth === 'number' && !Number.isNaN(viewportWidth)
      ? viewportWidth
      : typeof window !== 'undefined' && typeof window.innerWidth === 'number' && window.innerWidth > 0
        ? window.innerWidth
        : 1024;
  if (width < 640) {
    return READER_FONT_CONFIG.MOBILE_DEFAULT_SIZE;
  }
  if (width < 1024) {
    return READER_FONT_CONFIG.TABLET_DEFAULT_SIZE;
  }
  return READER_FONT_CONFIG.DEFAULT_SIZE;
}

export const READER_GESTURE_CONFIG = {
  SWIPE_MIN_DISTANCE_PX: 45,
  SWIPE_MAX_DURATION_MS: 800,
  SWIPE_DOMINANCE_RATIO: 1.3,
  PINCH_DEADZONE_PX: 14,
  PINCH_PIXELS_PER_STEP: 24,
  ZOOM_FEEDBACK_DURATION_MS: 900,
  AUTO_FOCUS_DELAY_MS: 60,
  TAP_MAX_DURATION_MS: 350,
  TAP_MAX_MOVEMENT_PX: 10,
} as const;

