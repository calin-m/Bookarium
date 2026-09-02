/**
 * Centralized Configuration Constants for Reader Typography, Gestures & Layout
 */

export const READER_FONT_CONFIG = {
  MIN_SIZE: 12,
  MAX_SIZE: 36,
  DEFAULT_SIZE: 18,
  DEFAULT_LINE_HEIGHT: 1.75,
  PRESET_SIZES: [14, 18, 24] as const,
} as const;

export const READER_GESTURE_CONFIG = {
  SWIPE_MIN_DISTANCE_PX: 45,
  SWIPE_MAX_DURATION_MS: 800,
  SWIPE_DOMINANCE_RATIO: 1.3,
  ZOOM_FEEDBACK_DURATION_MS: 900,
  AUTO_FOCUS_DELAY_MS: 60,
} as const;

